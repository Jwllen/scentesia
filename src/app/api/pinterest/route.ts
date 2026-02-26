import { NextRequest, NextResponse } from 'next/server'

function normaliseToPinterestBoard(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    const h = url.hostname
    // Accept: pinterest.com, *.pinterest.com (fr, de, etc.),
    // and ccTLDs like pinterest.fr, www.pinterest.fr, pinterest.co.uk
    const isPinterest =
      h === 'pinterest.com' ||
      h.endsWith('.pinterest.com') ||
      /^(www\.)?pinterest\.[a-z]{2,}(\.[a-z]{2,})?$/.test(h)
    if (!isPinterest) return null
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    // Reject single-pin URLs (/pin/123456/)
    if (parts[0] === 'pin') return null
    if (parts.length < 2) return null
    // Normalise to www.pinterest.com canonical form
    return `https://www.pinterest.com/${parts[0]}/${parts[1]}/`
  } catch {
    return null
  }
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let resolvedUrl = raw.trim()

  // Resolve pin.it short links — follow redirects to get the real board URL
  try {
    const u = new URL(resolvedUrl)
    if (u.hostname === 'pin.it') {
      const redirect = await fetch(resolvedUrl, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
      })
      resolvedUrl = redirect.url
    }
  } catch {
    return NextResponse.json({ error: 'Could not resolve this link.' }, { status: 400 })
  }

  const boardUrl = normaliseToPinterestBoard(resolvedUrl)
  if (!boardUrl) {
    try {
      const parts = new URL(resolvedUrl).pathname.replace(/\/$/, '').split('/').filter(Boolean)
      if (parts[0] === 'pin') {
        return NextResponse.json(
          { error: 'This link points to a single pin, not a board. Share the board URL instead.' },
          { status: 400 }
        )
      }
    } catch { /* fall through */ }
    return NextResponse.json({ error: 'Invalid Pinterest board URL' }, { status: 400 })
  }

  try {
    const res = await fetch(boardUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Pinterest returned ${res.status}`)

    const html = await res.text()

    // Extract embedded initial data from the page
    const match = html.match(/__PWS_INITIAL_PROPS__[^>]*>([\s\S]*?)<\/script>/)
    if (!match) {
      return NextResponse.json(
        { error: 'No images found. The board may be private or empty.' },
        { status: 404 }
      )
    }

    let pageData: Record<string, unknown>
    try {
      pageData = JSON.parse(match[1])
    } catch {
      return NextResponse.json(
        { error: 'No images found. The board may be private or empty.' },
        { status: 404 }
      )
    }

    const pins = (pageData?.initialReduxState as Record<string, unknown>)?.pins as
      | Record<string, { images?: { '736x'?: { url?: string } } }>
      | undefined

    if (!pins || typeof pins !== 'object') {
      return NextResponse.json(
        { error: 'No images found. The board may be private or empty.' },
        { status: 404 }
      )
    }

    const images: { id: string; url: string }[] = []
    let idx = 0
    for (const [pinId, pin] of Object.entries(pins)) {
      const url = pin?.images?.['736x']?.url
      if (url) {
        images.push({ id: `pin_${pinId}`, url })
        idx++
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images found. The board may be private or empty.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch board' }, { status: 502 })
  }
}
