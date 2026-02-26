import { NextRequest, NextResponse } from 'next/server'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

/** Returns the shortcode for /p/ and /reel/ URLs, null for profiles or invalid URLs. */
function extractShortcode(raw: string): { shortcode: string; isProfile: boolean } | null {
  try {
    const url = new URL(raw.trim())
    const h = url.hostname
    const isInstagram =
      h === 'instagram.com' ||
      h === 'www.instagram.com' ||
      h === 'instagr.am' ||
      h === 'www.instagr.am'
    if (!isInstagram) return null
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    if (parts.length === 0) return null
    if (parts[0] === 'p' || parts[0] === 'reel') {
      if (parts.length < 2) return null
      return { shortcode: parts[1], isProfile: false }
    }
    // Single segment = profile (e.g. /username/)
    if (parts.length === 1) return { shortcode: parts[0], isProfile: true }
    return null
  } catch {
    return null
  }
}

/**
 * Extract Instagram CDN image URLs from HTML.
 * Targets scontent / cdninstagram CDN hosts, skips profile pictures.
 */
function extractCdnImages(html: string): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  // Match quoted src/content attributes pointing to Instagram CDN
  const regex = /(?:src|content)="(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    const url = m[1]
    // Skip profile pictures, icons, and video thumbnails that are too small
    if (url.includes('150x150') || url.includes('s150x150')) continue
    if (url.includes('/p/') && url.includes('profile')) continue
    if (!seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  const parsed = extractShortcode(raw)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 })
  }
  if (parsed.isProfile) {
    return NextResponse.json(
      { error: 'Paste a post or reel link, not a profile page.' },
      { status: 400 }
    )
  }

  const { shortcode } = parsed

  try {
    // ── Step 1: Embed page (reliable, always works for public posts) ──────────
    const embedRes = await fetch(
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) }
    )
    if (!embedRes.ok) throw new Error(`Instagram returned ${embedRes.status}`)
    const embedHtml = await embedRes.text()

    const embedImages = extractCdnImages(embedHtml)

    // Carousel detection: the word "carousel" or "sidecar" appears in embed markup,
    // or more than one distinct image URL was found.
    const looksLikeCarousel =
      /carousel|sidecar/i.test(embedHtml) || embedImages.length > 1

    // ── Step 2: For carousels try the main post page for all slides ───────────
    if (looksLikeCarousel) {
      try {
        const mainRes = await fetch(
          `https://www.instagram.com/p/${shortcode}/`,
          { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) }
        )
        if (mainRes.ok) {
          const mainHtml = await mainRes.text()
          const mainImages = extractCdnImages(mainHtml)
          if (mainImages.length > 1) {
            const images = mainImages
              .slice(0, 5)
              .map((url, i) => ({ id: `ig_${i}`, url }))
            return NextResponse.json({ images, type: 'carousel' })
          }
        }
      } catch {
        // Fall through to embed images
      }
    }

    // ── Fallback / single post ────────────────────────────────────────────────
    if (embedImages.length === 0) {
      return NextResponse.json(
        { error: "This post is private or couldn't be reached." },
        { status: 404 }
      )
    }

    const type = looksLikeCarousel ? 'carousel' : 'single'
    const images = embedImages.slice(0, 5).map((url, i) => ({ id: `ig_${i}`, url }))
    return NextResponse.json({ images, type })
  } catch {
    return NextResponse.json(
      { error: "Instagram couldn't be reached. Try again later." },
      { status: 502 }
    )
  }
}
