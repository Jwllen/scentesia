import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

/** Hard cap to avoid runaway pagination on giant boards. */
const MAX_PINS = 200
const MAX_PAGES = 20

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const BROWSER_HEADERS: HeadersInit = {
  'User-Agent': CHROME_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

function normaliseToPinterestBoard(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    const h = url.hostname
    const isPinterest =
      h === 'pinterest.com' ||
      h.endsWith('.pinterest.com') ||
      /^(www\.)?pinterest\.[a-z]{2,}(\.[a-z]{2,})?$/.test(h)
    if (!isPinterest) return null
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    if (parts[0] === 'pin') return null
    if (parts.length < 2) return null
    return `https://www.pinterest.com/${parts[0]}/${parts[1]}/`
  } catch {
    return null
  }
}

/** Extract username and slug from a canonical board URL. */
function parseBoardPath(boardUrl: string): { username: string; slug: string; path: string } {
  const u = new URL(boardUrl)
  const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean)
  return { username: parts[0], slug: parts[1], path: u.pathname }
}

/** Fetch the board page to establish a session (cookies + app version). */
async function getSession(boardUrl: string): Promise<{ cookies: string; csrfToken: string; appVersion: string }> {
  const res = await fetch(boardUrl, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Pinterest returned ${res.status}`)

  const setCookies = res.headers.getSetCookie?.() ?? []
  const csrfCookie = setCookies.find(c => c.startsWith('csrftoken='))
  const csrfToken = csrfCookie
    ? csrfCookie.split('=')[1].split(';')[0]
    : randomUUID().replace(/-/g, '')
  const cookies = setCookies.map(c => c.split(';')[0]).join('; ')

  const html = await res.text()
  const avMatch = html.match(/"appVersion"\s*:\s*"([a-f0-9]+)"/)
  const appVersion = avMatch?.[1] ?? '466b2af'

  return { cookies, csrfToken, appVersion }
}

/** POST to a Pinterest internal resource endpoint. */
async function pinterestApi(
  resource: string,
  options: AnyRecord,
  session: { cookies: string; csrfToken: string; appVersion: string },
  sourceUrl: string,
): Promise<AnyRecord> {
  const data = JSON.stringify({ options, context: {} })
  const res = await fetch(`https://www.pinterest.com/resource/${resource}/get/`, {
    method: 'POST',
    headers: {
      'User-Agent': CHROME_UA,
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'X-APP-VERSION': session.appVersion,
      'X-Pinterest-AppState': 'active',
      'X-CSRFToken': session.csrfToken,
      'Cookie': session.cookies,
      'Referer': `https://www.pinterest.com${sourceUrl}`,
      'Origin': 'https://www.pinterest.com',
    },
    body: `source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(data)}`,
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Pinterest API ${res.status}`)
  return res.json() as Promise<AnyRecord>
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let resolvedUrl = raw.trim()

  // Resolve pin.it short links
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
    const { username, slug, path } = parseBoardPath(boardUrl)

    // ── Step 1: Establish session ───────────────────────────────────────
    const session = await getSession(boardUrl)

    // ── Step 2: Get board info ──────────────────────────────────────────
    let boardId: string | null = null
    try {
      const boardRes = await pinterestApi(
        'BoardResource',
        { slug, username, field_set_key: 'detailed' },
        session,
        path,
      )
      const board = boardRes?.resource_response?.data
      if (board?.id) boardId = String(board.id)
    } catch {
      // Board lookup failed — try feed directly without board_id
    }

    // ── Step 3: Fetch pins via BoardFeedResource ────────────────────────
    const images: { id: string; url: string }[] = []
    const seen = new Set<string>()
    let bookmark: string | null = null
    let pages = 0

    // First request — no bookmark needed
    const feedOptions: AnyRecord = {
      board_url: path,
      field_set_key: 'react_grid_pin',
      filter_section_pins: true,
      sort: 'default',
      layout: 'default',
      page_size: 25,
      prepend: false,
    }
    if (boardId) feedOptions.board_id = boardId

    while (pages < MAX_PAGES && images.length < MAX_PINS) {
      pages++
      const opts = { ...feedOptions }
      if (bookmark) opts.bookmarks = [bookmark]

      try {
        const feedRes = await pinterestApi('BoardFeedResource', opts, session, path)

        const feedData = feedRes?.resource_response?.data
        const pins: AnyRecord[] = Array.isArray(feedData)
          ? feedData
          : Array.isArray(feedData?.results)
            ? feedData.results
            : []

        if (pins.length === 0) break

        for (const pin of pins) {
          if (!pin?.id || seen.has(String(pin.id)) || images.length >= MAX_PINS) continue
          const url = pin?.images?.['736x']?.url
          if (url) {
            seen.add(String(pin.id))
            images.push({ id: `pin_${pin.id}`, url })
          }
        }

        // Next bookmark
        const nextBookmarks = feedRes?.resource?.options?.bookmarks as string[] | undefined
        const next = nextBookmarks?.[0] ?? null
        if (!next || next === '-end-' || next.startsWith('Y2JOb25lO') || next === bookmark) break
        bookmark = next
      } catch {
        break // network error — return what we have
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
