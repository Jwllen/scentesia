import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { VibeAnalysis, PerfumeRecommendation } from '@/types'

const LOREAL_BIAS = process.env.LOREAL_BIAS_ENABLED === 'true'

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

    // Score each perfume by matched accords
    const scored = perfumes.map(perfume => {
      const matched = (perfume.accords || []).filter((a: string) =>
        vibe.accords.includes(a)
      )
      let score = matched.length / vibe.accords.length

      // L'Oréal bias boost
      if (LOREAL_BIAS && perfume.is_loreal) score *= 1.2

      // Rating boost (normalized)
      if (perfume.rating) score += (perfume.rating / 5) * 0.2

      const match_reason = generateMatchReason(perfume.name, perfume.brand, matched, vibe)

      return {
        ...perfume,
        match_score: Math.round(score * 100),
        matched_accords: matched,
        match_reason,
      } as PerfumeRecommendation
    })

    const recommendations = scored
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 8)

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
