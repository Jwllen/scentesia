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
    if (parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'reels') {
      if (parts.length < 2) return null
      const isReel = parts[0] === 'reel' || parts[0] === 'reels'
      return { shortcode: parts[1], isProfile: false, pathType: isReel ? 'reel' : 'p' }
    }
    // Single segment = profile (e.g. /username/)
    if (parts.length === 1) return { shortcode: parts[0], isProfile: true, pathType: 'p' }
    return null
  } catch {
    return null
  }
}

/**
 * Decode a URL string that was JSON-encoded inside an HTML script tag.
 * Handles: \/ → /  and  \uXXXX → char  and  &amp; → &
 */
// Matches \uXXXX sequences literally (e.g. \u0026 → &).
// Built with new RegExp to avoid Turbopack SWC issues with \\u in regex literals.
const JSON_UNICODE_RE = new RegExp('\\\\u([0-9a-fA-F]{4})', 'gi')

function decodeJsonUrl(raw: string): string {
  return raw
    .split('\\/').join('/')
    .replace(JSON_UNICODE_RE, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

/**
 * Primary: extract carousel slides from the `carousel_media` JSON object that
 * Instagram embeds in a <script> tag in the Googlebot-served HTML.
 * Each carousel item has an image_versions2.candidates[] array ordered largest→smallest;
 * we take the first (largest) candidate per unique image.
 * Returns [] if no carousel_media key is found (i.e. the post is not a carousel).
 */
function extractFromCarouselJson(html: string): string[] {
  const carouselStart = html.indexOf('"carousel_media":[')
  if (carouselStart === -1) return []

  // Pre-decode backslash-escaped forward slashes so URLs look like https://...
  // This avoids regex literal issues with \/ sequences in the source.
  // 60 KB covers up to ~20 slides at 10+ resolution candidates each.
  const chunk = html.slice(carouselStart, carouselStart + 60000).split('\\/').join('/')
  const seenFnames = new Set<string>()
  const urls: string[] = []

  const urlPattern = /"url"\s*:\s*"(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = urlPattern.exec(chunk)) !== null) {
    // Decode remaining JSON escapes (\uXXXX) and HTML entities
    const decoded = decodeJsonUrl(m[1])
    if (decoded.includes('s150x150') || decoded.includes('150x150')) continue
    if (!/\/t51\.\d+-15\//.test(decoded)) continue
    const key = decoded.match(/\/(\d+_\d+_\d+_n\.\w+)/)?.[1] ?? decoded
    if (!seenFnames.has(key)) {
      seenFnames.add(key)
      urls.push(decoded)
    }
  }

  return urls
}

/**
 * Fallback for single posts: scan img src= attributes.
 * Decodes HTML entities (&amp; → &) so URLs are valid for browser <img> use.
 *
 * Uses a draggable-boundary heuristic: Instagram marks profile pics and "More posts"
 * grid thumbnails with draggable="false"; carousel/post images are not draggable.
 * We stop at the first draggable post-type (t51.x-15) img — these are always small
 * s150x150 thumbnails. Profile-pic img tags (t51.2-19) are skipped before the
 * draggable check so they don't trigger a premature stop.
 */
function extractFromImgSrc(html: string): string[] {
  const seenFnames = new Set<string>()
  const urls: string[] = []

  function isValidPostUrl(raw: string): string | null {
    if (raw.includes('static.cdninstagram.com')) return null
    const url = raw.replace(/&amp;/g, '&')
    if (!/\/t51\.\d+-15\//.test(url)) return null
    if (url.includes('s150x150') || url.includes('150x150')) return null
    return url
  }

  function addUrl(url: string) {
    const key = url.match(/\/(\d+_\d+_\d+_n\.\w+)/)?.[1] ?? url
    if (!seenFnames.has(key)) {
      seenFnames.add(key)
      urls.push(url)
    }
  }

  const srcRegex = /\bsrc="(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = srcRegex.exec(html)) !== null) {
    // Skip non-post-type CDN URLs (profile pics t51.2-19, bundles, external media)
    if (!/\/t51\.\d+-15\//.test(m[1])) continue
    // Look back up to 2000 chars for the opening <img tag
    const searchStart = Math.max(0, m.index - 2000)
    const before = html.slice(searchStart, m.index)
    const imgStart = before.lastIndexOf('<img')
    if (imgStart === -1) continue
    const tagFragment = before.slice(imgStart)
    // draggable check before size filter: "More posts" thumbnails are t51.x-15 + small +
    // draggable; we must stop on them even though isValidPostUrl would return null for them.
    if (tagFragment.includes('draggable="false"')) break
    const url = isValidPostUrl(m[1])
    if (!url) continue
    addUrl(url)
  }

  // Last resort: og:image / twitter:image meta tags
  if (urls.length === 0) {
    const metaRegex = /content="(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
    while ((m = metaRegex.exec(html)) !== null) {
      const url = isValidPostUrl(m[1])
      if (url) addUrl(url)
    }
  }

  return urls
}

/**
 * Extract Instagram CDN image URLs from Googlebot-rendered HTML.
 * Tries the embedded carousel_media JSON first (gets all carousel slides),
 * then falls back to img src= scanning (sufficient for single posts).
 */
function extractCdnImages(html: string): string[] {
  const fromJson = extractFromCarouselJson(html)
  if (fromJson.length > 0) return fromJson
  return extractFromImgSrc(html)
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
      `https://www.instagram.com/${pathType === 'reel' ? 'reel' : 'p'}/${shortcode}/`,
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
    const type = pathType === 'reel' ? 'reel' : capped.length > 1 ? 'carousel' : 'single'
    return NextResponse.json({ images: capped, type })
  } catch {
    return NextResponse.json(
      { error: "Instagram couldn't be reached. Try again later." },
      { status: 502 }
    )
  }
}
