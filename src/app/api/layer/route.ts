import { NextRequest, NextResponse } from 'next/server'
import type { PerfumeRecommendation, LayeringSuggestion } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { recommendations }: { recommendations: PerfumeRecommendation[] } = await request.json()

    if (!recommendations?.length || recommendations.length < 2) {
      return NextResponse.json({ layers: [] })
    }

    const layers: LayeringSuggestion[] = []
    const used = new Set<number>()

    for (let i = 0; i < recommendations.length && layers.length < 3; i++) {
      if (used.has(i)) continue

      for (let j = i + 1; j < recommendations.length && layers.length < 3; j++) {
        if (used.has(j)) continue

        const a = recommendations[i]
        const b = recommendations[j]

        // Check accords are complementary (not identical)
        const sharedAccords = (a.accords || []).filter(acc => (b.accords || []).includes(acc))
        const totalAccords = new Set([...(a.accords || []), ...(b.accords || [])]).size

        if (sharedAccords.length < totalAccords * 0.8) {
          layers.push(buildLayer(a, b))
          used.add(i)
          used.add(j)
        }
      }
    }

    return NextResponse.json({ layers })
  } catch (error) {
    console.error('[layer] error:', error)
    return NextResponse.json({ error: 'Failed to generate layering suggestions' }, { status: 500 })
  }
}

function buildLayer(a: PerfumeRecommendation, b: PerfumeRecommendation): LayeringSuggestion {
  const aAccords = a.accords?.slice(0, 2).join(' & ') || 'warm'
  const bAccords = b.accords?.slice(0, 2).join(' & ') || 'fresh'

  return {
    perfume_1: formatName(a.name),
    perfume_2: formatName(b.name),
    brand_1: formatName(a.brand),
    brand_2: formatName(b.brand),
    effect: `The ${aAccords} depth of ${formatName(a.name)} is elevated by the ${bAccords} brightness of ${formatName(b.name)}, creating something uniquely yours.`,
    apply: `Apply ${formatName(a.name)} to your pulse points first, wait 3–5 minutes, then layer ${formatName(b.name)} on top.`
  }
}

function formatName(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
