import { NextRequest, NextResponse } from 'next/server'

function normaliseToPinterestRss(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    // Accept any pinterest.* domain
    if (!url.hostname.includes('pinterest')) return null
    // Must have at least /username/board-name path segments
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    return `https://www.pinterest.com/${parts[0]}/${parts[1]}.rss`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  const rssUrl = normaliseToPinterestRss(raw)
  if (!rssUrl) return NextResponse.json({ error: 'Invalid Pinterest board URL' }, { status: 400 })

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    const xml = await res.text()

    // Extract <img> tags from each <item>'s <description>
    const imgRegex = /<img[^>]+src="([^"]+)"/g
    const seen = new Set<string>()
    const images: { id: string; url: string }[] = []
    let match: RegExpExecArray | null

    // Only look inside <item> blocks
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let item: RegExpExecArray | null
    let idx = 0

    while ((item = itemRegex.exec(xml)) !== null) {
      const block = item[1]
      imgRegex.lastIndex = 0
      while ((match = imgRegex.exec(block)) !== null) {
        // Upgrade thumbnail size: 236x → 736x
        const url = match[1].replace('/236x/', '/736x/')
        if (!seen.has(url)) {
          seen.add(url)
          images.push({ id: `pin_${idx++}`, url })
        }
        break // one image per pin
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
