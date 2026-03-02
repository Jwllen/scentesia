import { NextRequest, NextResponse } from 'next/server'
import type { PerfumeRecommendation, LayeringSuggestion, VibeAnalysis } from '@/types'

/**
 * Effect sentence templates — each one reads differently so the 3 cards
 * never feel copy-pasted.  Placeholders:
 *   {a}  = perfume A name
 *   {b}  = perfume B name
 *   {aA} = perfume A accords (first 2)
 *   {bA} = perfume B accords (first 2)
 *   {v}  = a vibe keyword (mood or theme)
 */
const EFFECT_TEMPLATES = [
  `{a} anchors the {aA} foundation while {b} lifts it with {bA} brightness — together they land much closer to your {v} vibe.`,
  `Worn alone, each tells half the story. {a}'s {aA} warmth fused with {b}'s {bA} edge recreates the {v} energy your board radiates.`,
  `Think of {a} as the base layer — rich in {aA} — and {b} as the top coat adding {bA} contrast. The blend mirrors the {v} atmosphere you're drawn to.`,
  `{b} brings {bA} lightness that opens up {a}'s {aA} depth, nudging the overall scent squarely into {v} territory.`,
  `The {aA} character of {a} and the {bA} facets of {b} overlap just enough to create a seamless accord that captures the {v} mood of your board.`,
  `Layering {a} underneath {b} lets the {aA} notes emerge through the {bA} top, producing a scent arc that tracks the {v} feeling you curated.`,
]

const APPLY_TEMPLATES = [
  `Spray {a} on your pulse points, let it settle for a few minutes, then mist {b} over the top.`,
  `Start with {a} on your wrists and neck. Once it dries down, apply {b} on top for the full effect.`,
  `Layer {a} on skin first — its {aA} base needs direct contact. Follow with {b} on your clothes and hair for projection.`,
  `Apply {a} generously to warm skin, pause, then add a light pass of {b}. The heat will blend them naturally.`,
]

export async function POST(request: NextRequest) {
  try {
    const { recommendations, vibe }: { recommendations: PerfumeRecommendation[]; vibe?: VibeAnalysis } = await request.json()

    if (!recommendations?.length || recommendations.length < 2) {
      return NextResponse.json({ layers: [] })
    }

    const vibeKeywords = [...(vibe?.mood || []), ...(vibe?.themes || [])]

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
          layers.push(buildLayer(a, b, vibeKeywords, layers.length))
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

function buildLayer(
  a: PerfumeRecommendation,
  b: PerfumeRecommendation,
  vibeKeywords: string[],
  index: number,
): LayeringSuggestion {
  const aAccords = a.accords?.slice(0, 2).join(' & ') || 'warm'
  const bAccords = b.accords?.slice(0, 2).join(' & ') || 'fresh'
  const aName = formatName(a.name)
  const bName = formatName(b.name)

  // Pick a vibe word — rotate through available keywords, fallback to "desired"
  const vibeWord = vibeKeywords.length > 0
    ? vibeKeywords[index % vibeKeywords.length]
    : 'desired'

  // Combo score: average of both match scores + complementarity bonus
  const allAccords = new Set([...(a.accords || []), ...(b.accords || [])])
  const shared = (a.accords || []).filter(acc => (b.accords || []).includes(acc))
  const complementarity = allAccords.size > 0 ? (allAccords.size - shared.length) / allAccords.size : 0
  const avgScore = ((a.match_score || 0) + (b.match_score || 0)) / 2
  const combo_score = Math.min(Math.round(avgScore + complementarity * 12), 100)

  // Pick a unique template per card
  const effectTemplate = EFFECT_TEMPLATES[index % EFFECT_TEMPLATES.length]
  const applyTemplate = APPLY_TEMPLATES[index % APPLY_TEMPLATES.length]

  const fill = (tpl: string) =>
    tpl
      .replace(/\{a\}/g, aName)
      .replace(/\{b\}/g, bName)
      .replace(/\{aA\}/g, aAccords)
      .replace(/\{bA\}/g, bAccords)
      .replace(/\{v\}/g, vibeWord)

  return {
    perfume_1: aName,
    perfume_2: bName,
    brand_1: formatName(a.brand),
    brand_2: formatName(b.brand),
    effect: fill(effectTemplate),
    apply: fill(applyTemplate),
    combo_score,
  }
}

function formatName(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
