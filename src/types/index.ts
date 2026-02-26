export interface Perfume {
  id: number
  name: string
  brand: string
  country?: string
  gender?: string
  rating?: number
  votes?: number
  year?: number
  top_notes: string[]
  heart_notes: string[]
  base_notes: string[]
  accords: string[]
  url?: string
  is_loreal: boolean
  loreal_brand?: string
}

export interface VibeAnalysis {
  palette: string[]
  mood: string[]
  themes: string[]
  textures: string[]
  accords: string[]
  intensity: 'light' | 'moderate' | 'intense'
  vibe_summary: string
}

export interface PerfumeRecommendation extends Perfume {
  match_score: number
  matched_accords: string[]
  match_reason: string
}

export interface LayeringSuggestion {
  perfume_1: string
  perfume_2: string
  brand_1: string
  brand_2: string
  effect: string
  apply: string
}

export interface CuratedImage {
  id: string
  url: string
  category: string
  label: string
  accords: string[]
}
