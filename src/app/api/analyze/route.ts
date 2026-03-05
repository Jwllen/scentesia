import { NextRequest, NextResponse } from 'next/server'
import { analyzeImages } from '@/lib/groq'

export async function POST(request: NextRequest) {
  try {
    const { images } = await request.json()

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    const vibe = await analyzeImages(images)
    return NextResponse.json({ vibe })
  } catch (error) {
    console.error('[analyze] error:', error)
    return NextResponse.json({ error: 'Failed to analyze images' }, { status: 500 })
  }
}
