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

interface Session {
  cookies: string
  csrfToken: string
  appVersion: string
  htmlPins: { id: string; url: string }[]
  boardId: string | null
  initialBookmark: string | null
}

/** Fetch the board page to establish a session and extract any HTML-embedded pins as fallback. */
async function getSession(boardUrl: string): Promise<Session> {
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

  // Try to extract pins from __PWS_INITIAL_PROPS__ (HTML fallback)
  const htmlPins: { id: string; url: string }[] = []
  let boardId: string | null = null
  let initialBookmark: string | null = null

  const match = html.match(/__PWS_INITIAL_PROPS__[^>]*>([\s\S]*?)<\/script>/)
  if (match) {
    try {
      const pageData = JSON.parse(match[1]) as AnyRecord
      const redux = pageData?.initialReduxState as AnyRecord | undefined

      // Extract pins
      const pins = redux?.pins as AnyRecord | undefined
      if (pins && typeof pins === 'object') {
        for (const [pinId, pin] of Object.entries(pins)) {
          const url = (pin as AnyRecord)?.images?.['736x']?.url
          if (url) htmlPins.push({ id: `pin_${pinId}`, url })
        }
      }

      // Extract board ID
      const boards = redux?.boards as AnyRecord | undefined
      if (boards) {
        const firstKey = Object.keys(boards)[0]
        if (firstKey) boardId = firstKey
      }

      // Extract initial bookmark
      const resources = redux?.resources as AnyRecord | undefined
      if (resources?.BoardFeedResource) {
        for (const val of Object.values(resources.BoardFeedResource) as AnyRecord[]) {
          const bm = val?.nextBookmark ?? val?.response?.bookmark
          if (bm && typeof bm === 'string') { initialBookmark = bm; break }
        }
      }
    } catch { /* parse failed — proceed without HTML pins */ }
  }

  return { cookies, csrfToken, appVersion, htmlPins, boardId, initialBookmark }
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

    // ── Step 1: Establish session + extract HTML-embedded pins ──────────
    const session = await getSession(boardUrl)

    const images: { id: string; url: string }[] = [...session.htmlPins]
    const seen = new Set<string>(images.map(i => i.id))

    // ── Step 2: Try API pagination for remaining pins ───────────────────
    let boardId = session.boardId
    if (!boardId) {
      try {
        const boardRes = await pinterestApi(
          'BoardResource',
          { slug, username, field_set_key: 'detailed' },
          session,
          path,
        )
        const board = boardRes?.resource_response?.data
        if (board?.id) boardId = String(board.id)
      } catch { /* proceed without board_id */ }
    }

    let bookmark = session.initialBookmark
    let pages = 0

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
          if (!pin?.id || seen.has(`pin_${pin.id}`) || images.length >= MAX_PINS) continue
          const url = pin?.images?.['736x']?.url
          if (url) {
            seen.add(`pin_${pin.id}`)
            images.push({ id: `pin_${pin.id}`, url })
          }
        }

        const nextBookmarks = feedRes?.resource?.options?.bookmarks as string[] | undefined
        const next = nextBookmarks?.[0] ?? null
        if (!next || next === '-end-' || next.startsWith('Y2JOb25lO') || next === bookmark) break
        bookmark = next
      } catch {
        break // API failed — return whatever we have (HTML pins as fallback)
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
