import { NextRequest, NextResponse } from 'next/server'

const MAX_IMAGES = 5

// Googlebot UA gets server-rendered HTML with actual image URLs.
// Browser UAs get a JS-shell with no image URLs in the initial HTML.
const GOOGLEBOT_HEADERS: HeadersInit = {
  'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

/** Returns parsed shortcode info for /p/ and /reel/ URLs. Returns isProfile:true for profile paths, null for non-Instagram or invalid URLs. */
function extractShortcode(raw: string): { shortcode: string; isProfile: boolean; pathType: 'p' | 'reel' } | null {
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
      return { shortcode: parts[1], isProfile: false, pathType: parts[0] as 'p' | 'reel' }
    }
    // Single segment = profile (e.g. /username/)
    if (parts.length === 1) return { shortcode: parts[0], isProfile: true, pathType: 'p' }
    return null
  } catch {
    return null
  }
}

/**
 * Extract Instagram CDN image URLs from server-rendered HTML.
 * Decodes HTML entities (&amp; → &) so URLs are valid for browser <img> use.
 */
function extractCdnImages(html: string): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  const regex = /(?:src|content)="(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    const raw = m[1]
    // Skip static resources (JS/CSS bundles) — only image CDN hosts matter
    if (raw.includes('static.cdninstagram.com')) continue
    // Decode HTML entities so the URL is usable in <img src>
    const url = raw.replace(/&amp;/g, '&')
    // Skip profile pictures and small thumbnails
    if (url.includes('s150x150') || url.includes('150x150')) continue
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

  const { shortcode, pathType } = parsed

  try {
    // Googlebot UA returns server-rendered HTML with actual scontent image URLs.
    // Browser UAs get a JS-only shell with no images in the initial HTML.
    const res = await fetch(
      `https://www.instagram.com/${pathType}/${shortcode}/`,
      { headers: GOOGLEBOT_HEADERS, signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) throw new Error(`Instagram returned ${res.status}`)
    const html = await res.text()

    const images = extractCdnImages(html)

    if (images.length === 0) {
      return NextResponse.json(
        { error: "This post is private or couldn't be reached." },
        { status: 404 }
      )
    }

    const capped = images.slice(0, MAX_IMAGES).map((url, i) => ({ id: `ig_${i}`, url }))
    const type = capped.length > 1 ? 'carousel' : 'single'
    return NextResponse.json({ images: capped, type })
  } catch {
    return NextResponse.json(
      { error: "Instagram couldn't be reached. Try again later." },
      { status: 502 }
    )
  }
}
