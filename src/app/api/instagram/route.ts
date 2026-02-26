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
  const seenFilenames = new Set<string>()
  const urls: string[] = []

  function isValidPostUrl(raw: string): string | null {
    if (raw.includes('static.cdninstagram.com')) return null
    const url = raw.replace(/&amp;/g, '&')
    // Only feed post image types (/t51.x-15/); profiles use -19, external proxied use /t13/
    if (!/\/t51\.\d+-15\//.test(url)) return null
    if (url.includes('s150x150') || url.includes('150x150')) return null
    return url
  }

  function addUrl(url: string) {
    // Deduplicate by filename — same image can appear on multiple CDN nodes
    const key = url.match(/\/(\d+_\d+_\d+_n\.\w+)/)?.[1] ?? url
    if (!seenFilenames.has(key)) {
      seenFilenames.add(key)
      urls.push(url)
    }
  }

  // Primary: find each CDN src= attribute, then look backwards to the opening
  // <img tag and check whether draggable="false" appears in that tag.
  // Instagram marks profile pics and grid thumbnails with draggable="false";
  // carousel slides are NOT draggable. Stop at the first draggable post-type image.
  //
  // Order matters:
  //   1. Filter to post-type URLs (t51.x-15) first — profile avatars (t51.2-19),
  //      JS bundles, and external media use different path tokens and must be skipped
  //      entirely; their draggable="false" must NOT trigger the boundary stop.
  //   2. Then check draggable — within the post-type set, draggable="false" signals
  //      the boundary (thumbnails, "More posts" grid). These may be small (s150x150)
  //      so the draggable check must come before the size filter.
  const srcRegex = /\bsrc="(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = srcRegex.exec(html)) !== null) {
    // Skip non-post-type CDN URLs (profile pics, bundles, external media)
    if (!/\/t51\.\d+-15\//.test(m[1])) continue
    // Look back up to 2000 chars for the opening <img tag
    const searchStart = Math.max(0, m.index - 2000)
    const before = html.slice(searchStart, m.index)
    const imgStart = before.lastIndexOf('<img')
    if (imgStart === -1) continue  // not an img tag (could be <meta src=... — rare)
    const tagFragment = before.slice(imgStart)
    if (tagFragment.includes('draggable="false"')) break  // boundary: draggable post-type img
    const url = isValidPostUrl(m[1])
    if (!url) continue  // filtered (static CDN, small thumbnail, etc.)
    addUrl(url)
  }

  // Fallback: if img scan found nothing, check og:image / twitter:image meta tags.
  // Covers single posts where the main image may be nested differently.
  if (urls.length === 0) {
    const metaRegex = /content="(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
    while ((m = metaRegex.exec(html)) !== null) {
      const url = isValidPostUrl(m[1])
      if (url) addUrl(url)
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
