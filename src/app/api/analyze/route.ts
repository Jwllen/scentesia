import { NextRequest, NextResponse } from 'next/server'
import { analyzeImages } from '@/lib/groq'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { images } = await request.json()

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    const vibe = await analyzeImages(images)
    return NextResponse.json({ vibe })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[analyze] error:', msg)
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 })
  }
}
