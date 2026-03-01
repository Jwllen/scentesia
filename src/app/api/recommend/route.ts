import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { VibeAnalysis, PerfumeRecommendation } from '@/types'

const LOREAL_BIAS = process.env.LOREAL_BIAS_ENABLED === 'true'
const LOREAL_TOP_ROW = process.env.LOREAL_TOP_ROW_ENABLED === 'true'
const LOREAL_TOP_ROW_SLOTS = parseInt(process.env.LOREAL_TOP_ROW_SLOTS || '4', 10)

/**
 * Positional weights for matched accords.
 * The vibe analyser returns accords ordered by relevance (most important first).
 * Matching the top accord is worth much more than matching a peripheral one.
 * Weights sum to 1.0 across 5 slots; extra matches beyond 5 use the last weight.
 */
const ACCORD_WEIGHTS = [0.30, 0.22, 0.18, 0.16, 0.14]

/** Minimum votes threshold for the popularity-confidence signal. */
const MIN_VOTES_FOR_CONFIDENCE = 50

export async function POST(request: NextRequest) {
  try {
    const { vibe }: { vibe: VibeAnalysis } = await request.json()

    if (!vibe?.accords?.length) {
      return NextResponse.json({ error: 'No vibe data provided' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // Fetch perfumes matching any of the target accords
    const { data: perfumes, error } = await supabase
      .from('perfumes')
      .select('*')
      .overlaps('accords', vibe.accords)
      .not('accords', 'eq', '{}')
      .gte('votes', 10)
      .order('rating', { ascending: false })
      .limit(100)

    if (error) throw error
    if (!perfumes?.length) {
      return NextResponse.json({ recommendations: [] })
    }

    // Score each perfume
    const scored = perfumes.map(perfume => {
      const perfumeAccords: string[] = perfume.accords || []

      // Weighted accord score: each vibe accord has a positional weight (index 0 = most important).
      // We award the weight for any vibe accord that the perfume also carries.
      let accordScore = 0
      vibe.accords.forEach((vibeAccord, i) => {
        if (perfumeAccords.includes(vibeAccord)) {
          accordScore += ACCORD_WEIGHTS[Math.min(i, ACCORD_WEIGHTS.length - 1)]
        }
      })

      // Popularity-confidence boost: a well-rated perfume with many votes is more trustworthy.
      // Confidence factor scales from 0 → 1 as votes increase toward MIN_VOTES_FOR_CONFIDENCE.
      // Max boost: 0.20 (same ceiling as before, but now earned by popularity signal).
      const votes = perfume.votes ?? 0
      const rating = perfume.rating ?? 0
      const confidence = Math.min(votes / MIN_VOTES_FOR_CONFIDENCE, 1)
      const popularityBoost = (rating / 5) * confidence * 0.20

      let score = accordScore + popularityBoost

      // L'Oréal bias boost — applied multiplicatively so it amplifies the full score
      if (LOREAL_BIAS && perfume.is_loreal) score *= 1.2

      const matched = perfumeAccords.filter((a: string) => vibe.accords.includes(a))
      const match_reason = generateMatchReason(perfume.name, perfume.brand, matched, vibe)

      return {
        ...perfume,
        match_score: Math.round(score * 100),
        matched_accords: matched,
        match_reason,
      } as PerfumeRecommendation
    })

    scored.sort((a, b) => b.match_score - a.match_score)

    let recommendations: PerfumeRecommendation[]

    if (LOREAL_TOP_ROW) {
      // Guarantee: first N slots are the highest-scoring L'Oréal perfumes,
      // remaining slots filled by the highest-scoring non-L'Oréal perfumes.
      // Both partitions stay in score-descending order.
      const loreal = scored.filter(p => p.is_loreal)
      const other = scored.filter(p => !p.is_loreal)
      const topLoreal = loreal.slice(0, LOREAL_TOP_ROW_SLOTS)
      const remaining = 8 - topLoreal.length
      recommendations = [...topLoreal, ...other.slice(0, remaining)]
    } else {
      recommendations = scored.slice(0, 8)
    }

    return NextResponse.json({ recommendations })
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
