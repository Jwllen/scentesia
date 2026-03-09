import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { VibeAnalysis, PerfumeRecommendation, LayeringSuggestion } from '@/types'

const LOREAL_BIAS = process.env.LOREAL_BIAS_ENABLED === 'true'
const LOREAL_TOP_ROW = process.env.LOREAL_TOP_ROW_ENABLED === 'true'
const LOREAL_TOP_ROW_SLOTS = parseInt(process.env.LOREAL_TOP_ROW_SLOTS || '2', 10)

/**
 * Positional weights for matched accords.
 * The vibe analyser returns accords ordered by relevance (most important first).
 * Matching the top accord is worth much more than matching a peripheral one.
 * Weights sum to 1.0 across 5 slots; extra matches beyond 5 use the last weight.
 */
const ACCORD_WEIGHTS = [0.30, 0.22, 0.18, 0.16, 0.14]

/** Minimum votes threshold for the popularity-confidence signal. */
const MIN_VOTES_FOR_CONFIDENCE = 50

// ── Layering templates ──────────────────────────────────────────────
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
    const { vibe }: { vibe: VibeAnalysis } = await request.json()

    if (!vibe?.accords?.length) {
      return NextResponse.json({ error: 'No vibe data provided' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // Fetch only the columns needed for scoring — skip notes, url, country etc.
    // This dramatically reduces payload size when the dataset is large.
    const { data: perfumes, error } = await supabase
      .from('perfumes')
      .select('id, name, brand, rating, votes, accords, is_loreal')
      .overlaps('accords', vibe.accords)
      .not('accords', 'eq', '{}')
      .gte('votes', 10)

    if (error) throw error
    if (!perfumes?.length) {
      return NextResponse.json({ recommendations: [], layers: [] })
    }

    // Score each perfume
    const scored = perfumes.map(perfume => {
      const perfumeAccords: string[] = perfume.accords || []

      let accordScore = 0
      vibe.accords.forEach((vibeAccord, i) => {
        if (perfumeAccords.includes(vibeAccord)) {
          accordScore += ACCORD_WEIGHTS[Math.min(i, ACCORD_WEIGHTS.length - 1)]
        }
      })

      const votes = perfume.votes ?? 0
      const rating = perfume.rating ?? 0
      const confidence = Math.min(votes / MIN_VOTES_FOR_CONFIDENCE, 1)
      const popularityBoost = (rating / 5) * confidence * 0.20

      let score = accordScore + popularityBoost
      if (LOREAL_BIAS && perfume.is_loreal) score *= 1.2

      const matched = perfumeAccords.filter((a: string) => vibe.accords.includes(a))

      return {
        id: perfume.id,
        name: perfume.name,
        brand: perfume.brand,
        accords: perfumeAccords,
        is_loreal: perfume.is_loreal,
        match_score: Math.min(Math.round(score * 100), 100),
        matched_accords: matched,
      }
    })

    scored.sort((a, b) => b.match_score - a.match_score)

    let topPicks: typeof scored

    if (LOREAL_TOP_ROW) {
      const loreal = scored.filter(p => p.is_loreal)
      const other = scored.filter(p => !p.is_loreal)
      const topLoreal = loreal.slice(0, LOREAL_TOP_ROW_SLOTS)
      const remaining = 5 - topLoreal.length
      topPicks = [...topLoreal, ...other.slice(0, remaining)]
    } else {
      topPicks = scored.slice(0, 5)
    }

    // Hydrate the final 5 with full data (notes, url, etc.) in one small query
    const topIds = topPicks.map(p => p.id)
    const { data: fullPerfumes, error: fullError } = await supabase
      .from('perfumes')
      .select('*')
      .in('id', topIds)

    if (fullError) throw fullError

    // Merge full data back in score order
    const fullMap = new Map((fullPerfumes || []).map(p => [p.id, p]))
    const recommendations: PerfumeRecommendation[] = topPicks.map(pick => {
      const full = fullMap.get(pick.id) || pick
      return {
        ...full,
        match_score: pick.match_score,
        matched_accords: pick.matched_accords,
        match_reason: generateMatchReason(pick.name, pick.brand, pick.matched_accords, vibe),
      } as PerfumeRecommendation
    })

    // Generate layering suggestions inline (eliminates separate /api/layer call)
    const layers = generateLayers(recommendations, vibe)

    // Attach per-card layering pairings (for "Pairs well with" on each card)
    attachPerCardLayering(recommendations, vibe)

    return NextResponse.json({ recommendations, layers })
  } catch (error) {
    console.error('[recommend] error:', error)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}

function generateMatchReason(name: string, brand: string, matched: string[], vibe: VibeAnalysis): string {
  const moodWord = vibe.mood?.[0] || 'evocative'
  const themeWord = vibe.themes?.[0] || 'refined'
  const accordList = matched.slice(0, 2).join(' and ')
  return `Its ${accordList} character mirrors the ${moodWord}, ${themeWord} energy of your board.`
}

// ── Per-card layering ("Pairs well with") ────────────────────────────

function attachPerCardLayering(recommendations: PerfumeRecommendation[], vibe: VibeAnalysis) {
  const vibeKeywords = [...(vibe?.mood || []), ...(vibe?.themes || [])]

  for (let i = 0; i < recommendations.length; i++) {
    const rec = recommendations[i]
    const pairings: Array<{ idx: number; complementarity: number }> = []

    for (let j = 0; j < recommendations.length; j++) {
      if (i === j) continue
      const other = recommendations[j]
      const recAccords = rec.accords || []
      const otherAccords = other.accords || []
      const shared = recAccords.filter(a => otherAccords.includes(a))
      const allUnique = new Set([...recAccords, ...otherAccords]).size
      // Good pairing = some overlap (harmony) but not too much (complementarity)
      const complementarity = allUnique > 0 ? (allUnique - shared.length) / allUnique : 0
      if (complementarity > 0.15) {
        pairings.push({ idx: j, complementarity })
      }
    }

    // Sort by complementarity (best pairings first), take top 3
    pairings.sort((a, b) => b.complementarity - a.complementarity)
    const topPairings = pairings.slice(0, 3)

    rec.layering = topPairings.map((p, pIdx) => {
      const other = recommendations[p.idx]
      const aAccords = rec.accords?.slice(0, 2).join(' & ') || 'warm'
      const bAccords = other.accords?.slice(0, 2).join(' & ') || 'fresh'
      const aName = formatName(rec.name)
      const bName = formatName(other.name)
      const vibeWord = vibeKeywords.length > 0
        ? vibeKeywords[pIdx % vibeKeywords.length]
        : 'desired'

      const avgScore = ((rec.match_score || 0) + (other.match_score || 0)) / 2
      const combo_score = Math.min(Math.round(avgScore + p.complementarity * 12), 100)

      const effectTemplate = EFFECT_TEMPLATES[pIdx % EFFECT_TEMPLATES.length]
      const applyTemplate = APPLY_TEMPLATES[pIdx % APPLY_TEMPLATES.length]

      const fill = (tpl: string) =>
        tpl
          .replace(/\{a\}/g, aName)
          .replace(/\{b\}/g, bName)
          .replace(/\{aA\}/g, aAccords)
          .replace(/\{bA\}/g, bAccords)
          .replace(/\{v\}/g, vibeWord)

      return {
        perfume_id: other.id,
        name: other.name,
        brand: other.brand,
        url: other.url,
        combo_score,
        effect: fill(effectTemplate),
        apply: fill(applyTemplate),
      }
    })
  }
}

// ── Layering logic (moved from /api/layer) ──────────────────────────

function formatName(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function generateLayers(recommendations: PerfumeRecommendation[], vibe: VibeAnalysis): LayeringSuggestion[] {
  if (recommendations.length < 2) return []

  const vibeKeywords = [...(vibe?.mood || []), ...(vibe?.themes || [])]
  const layers: LayeringSuggestion[] = []
  const used = new Set<number>()

  for (let i = 0; i < recommendations.length && layers.length < 3; i++) {
    if (used.has(i)) continue
    for (let j = i + 1; j < recommendations.length && layers.length < 3; j++) {
      if (used.has(j)) continue

      const a = recommendations[i]
      const b = recommendations[j]
      const sharedAccords = (a.accords || []).filter(acc => (b.accords || []).includes(acc))
      const totalAccords = new Set([...(a.accords || []), ...(b.accords || [])]).size

      if (sharedAccords.length < totalAccords * 0.8) {
        layers.push(buildLayer(a, b, vibeKeywords, layers.length))
        used.add(i)
        used.add(j)
      }
    }
  }

  return layers
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

  const vibeWord = vibeKeywords.length > 0
    ? vibeKeywords[index % vibeKeywords.length]
    : 'desired'

  const allAccords = new Set([...(a.accords || []), ...(b.accords || [])])
  const shared = (a.accords || []).filter(acc => (b.accords || []).includes(acc))
  const complementarity = allAccords.size > 0 ? (allAccords.size - shared.length) / allAccords.size : 0
  const avgScore = ((a.match_score || 0) + (b.match_score || 0)) / 2
  const combo_score = Math.min(Math.round(avgScore + complementarity * 12), 100)

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
