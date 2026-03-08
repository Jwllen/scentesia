import { NextRequest, NextResponse } from 'next/server'

interface OEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

async function fetchOEmbed(videoUrl: string): Promise<OEmbedResponse> {
  // Resolve short links first
  let resolvedUrl = videoUrl
  if (videoUrl.includes('vm.tiktok.com')) {
    const res = await fetch(videoUrl, { redirect: 'follow' })
    resolvedUrl = res.url
  }

  const res = await fetch(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    },
  )

  if (!res.ok) {
    throw new Error(
      'Could not fetch video info. Make sure the video exists and is from a public account.',
    )
  }

  const data = await res.json()
  if (data.code || data.message === 'Something went wrong') {
    throw new Error(
      'Could not access this video. Make sure the link is correct and the account is public.',
    )
  }

  if (!data.thumbnail_url) {
    throw new Error('No thumbnail available for this video.')
  }

  return data as OEmbedResponse
}

// GET — thumbnail preview + metadata (import step)
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const oembed = await fetchOEmbed(url)
    return NextResponse.json({
      images: [{ id: 'cover', url: oembed.thumbnail_url }],
      title: oembed.title || '',
      author: oembed.author_name || '',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch video' },
      { status: 500 },
    )
  }
}
