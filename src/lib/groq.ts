import type { VibeAnalysis } from '@/types'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'
const MAX_IMAGES_FOR_DEEP = 6

/* ── Per-image deep analysis type ──────────────────────────────────── */

interface ImageAnalysis {
  inventory: {
    lighting_and_time: string
    objects_and_environment: string[]
  }
  character_profiling: {
    demographics_and_gender: string
    body_language: string
    wardrobe_semiotics: string
  }
  color_and_texture: {
    dominant_colors: string[]
    psychological_mood: string
    implied_textures: string[]
  }
  collective_narrative: {
    vibe_description: string
    core_aesthetic: string
  }
  olfactory_translation: {
    top_notes: string[]
    heart_notes: string[]
    base_notes: string[]
  }
}

/* ── Prompts ───────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are a world-class Semiotician, Fashion Critic, and Master Perfumer working for L'Oréal Luxe. Your expertise lies in decoding visual media, understanding deep cultural aesthetics, analyzing human psychology through imagery, and translating those visual/emotional cues into precise olfactory profiles (perfume notes).

You do not provide surface-level descriptions; you uncover the hidden narrative, the socio-cultural vibe, and the psychological weight of the images provided. You must pay close attention to demographics, gender presentation (traditional or subverted), body language, clothing, color theory, and lighting.

CRITICAL INSTRUCTION: You must respond ONLY in valid JSON format. Do not include any conversational text, introductions, or markdown formatting (like \`\`\`json). Use the exact JSON schema provided.`

const PER_IMAGE_PROMPT = `Analyze this image deeply and map it to a fragrance profile. Use this exact JSON schema:

{
  "inventory": {
    "lighting_and_time": "Describe the lighting, time of day, and image quality/texture.",
    "objects_and_environment": ["List 3-5 key objects or architectural elements"]
  },
  "character_profiling": {
    "demographics_and_gender": "How does the subject present? Discuss traditional/subverted gender roles. If no person, describe the implied viewer/inhabitant.",
    "body_language": "What does posture and expression communicate? If no person, describe the energy of the scene.",
    "wardrobe_semiotics": "Describe clothing/textures and what they signal about status or subculture. If no person, describe the visual 'outfit' of the scene."
  },
  "color_and_texture": {
    "dominant_colors": ["Color 1", "Color 2"],
    "psychological_mood": "What mood do these colors dictate?",
    "implied_textures": ["Texture 1", "Texture 2"]
  },
  "collective_narrative": {
    "vibe_description": "What is the overarching cinematic story being told?",
    "core_aesthetic": "Name the specific subculture or aesthetic (e.g., Dark Academia, Old Money, Clean Girl, Mob Wife, Quiet Luxury, Coastal Grandmother, Cyberpunk, Cottagecore)"
  },
  "olfactory_translation": {
    "top_notes": ["2-3 specific perfume ingredient notes"],
    "heart_notes": ["2-3 specific perfume ingredient notes"],
    "base_notes": ["2-3 specific perfume ingredient notes"]
  }
}

Return ONLY this JSON object filled with your deep analysis.`

function buildMergePrompt(analyses: ImageAnalysis[]): string {
  const analysesText = analyses
    .map((a, i) => `Image ${i + 1}:\n${JSON.stringify(a, null, 2)}`)
    .join('\n\n')

  return `You are synthesizing ${analyses.length} individual image analyses from a mood board into ONE cohesive fragrance profile.

Here are the individual deep analyses:

${analysesText}

Synthesize all observations into a single unified profile. Identify the DOMINANT narrative, aesthetic, and olfactory direction across ALL images. Resolve contradictions by favoring the majority theme. The notes must be specific perfume ingredients (e.g., "bergamot", "iris", "sandalwood"), not categories.

CRITICAL ACCORD SELECTION RULES:
- Choose accords that PRECISELY capture the mood board's CHARACTER, not generic safe picks.
- AVOID defaulting to the most common/generic accords (woody, citrus, aromatic, floral, fresh) unless the board genuinely calls for them. These are the perfumery equivalent of "nice" — they say nothing specific.
- Prioritize DISTINCTIVE accords that differentiate this vibe from others. A cyberpunk board should smell industrial (smoky, leather, ozonic), not like a department store bestseller. A cottagecore board needs herbal, honey, green — not just "floral."
- Think about what makes this mood board UNIQUE. What would someone smell and immediately think "that's exactly this vibe"?
- Use AT LEAST 2 accords from the less common options (leather, smoky, ozonic, animalic, tobacco, balsamic, mossy, marine, herbal, cinnamon, honey, coffee, cacao, lactonic, salty, etc.) when the aesthetic warrants edge, warmth, darkness, or specificity.
- Order accords by importance: the first accord should be the DEFINING scent character, not just the most common category.

ACCORD LIST (choose 5-6 from ONLY these):
woody, floral, citrus, sweet, aromatic, fruity, powdery, white floral, warm spicy, fresh spicy, amber, vanilla, musky, green, fresh, rose, patchouli, leather, earthy, aquatic, lavender, iris, oud, soft spicy, yellow floral, tropical, ozonic, violet, balsamic, animalic, tuberose, marine, herbal, caramel, mossy, smoky, cinnamon, almond, coconut, lactonic, tobacco, honey, aldehydic, nutty, cherry, coffee, cacao, salty, anis, chocolate

Return ONLY valid JSON with this exact schema:

{
  "palette": ["3-4 dominant color descriptors across the mood board"],
  "mood": ["3-4 emotional tones"],
  "themes": ["3-4 visual themes"],
  "textures": ["3-4 tactile qualities"],
  "accords": ["5-6 perfume accords — specific and distinctive, ordered by importance"],
  "top_notes": ["3-5 specific top perfume notes capturing the mood board's opening impression"],
  "heart_notes": ["3-5 specific heart notes defining the core character"],
  "base_notes": ["3-5 specific base notes anchoring the scent"],
  "intensity": "light OR moderate OR intense",
  "vibe_summary": "One evocative sentence describing this scent vibe — poetic, not technical",
  "core_aesthetic": "The single most fitting subculture or aesthetic name"
}`
}

/* ── Helpers ────────────────────────────────────────────────────────── */

async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const mimeType = contentType.split(';')[0]
  return {
    data: Buffer.from(buffer).toString('base64'),
    mimeType,
  }
}

async function toDataUrl(input: string): Promise<string> {
  if (input.startsWith('data:')) return input
  const { data, mimeType } = await urlToBase64(input)
  return `data:${mimeType};base64,${data}`
}

function sampleEvenly<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const step = arr.length / max
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)])
}

async function callGroq(
  systemPrompt: string,
  userContent: Array<{ type: string; text?: string; image_url?: { url: string } }>,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

/* ── Pass 1: Per-image deep analysis ───────────────────────────────── */

async function analyzeOneImage(imageDataUrl: string): Promise<ImageAnalysis> {
  const text = await callGroq(SYSTEM_PROMPT, [
    { type: 'text', text: PER_IMAGE_PROMPT },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ])
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as ImageAnalysis
}

/* ── Pass 2: Merge into unified VibeAnalysis ───────────────────────── */

async function mergeAnalyses(analyses: ImageAnalysis[]): Promise<VibeAnalysis> {
  const mergePrompt = buildMergePrompt(analyses)
  const text = await callGroq(SYSTEM_PROMPT, [
    { type: 'text', text: mergePrompt },
  ])
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as VibeAnalysis
}

/* ── Public API ────────────────────────────────────────────────────── */

export async function analyzeImages(imageInputs: string[]): Promise<VibeAnalysis> {
  // Sample images if too many for per-image analysis
  const sampled = sampleEvenly(imageInputs, MAX_IMAGES_FOR_DEEP)

  // Convert all to base64 data URLs in parallel
  const dataUrls = await Promise.all(sampled.map(toDataUrl))

  // Pass 1: Deep per-image analysis (parallel)
  const perImageResults = await Promise.allSettled(
    dataUrls.map(url => analyzeOneImage(url))
  )

  const successful = perImageResults
    .filter((r): r is PromiseFulfilledResult<ImageAnalysis> => r.status === 'fulfilled')
    .map(r => r.value)

  console.log(`[groq] Per-image analysis: ${successful.length}/${dataUrls.length} succeeded`)

  if (successful.length === 0) {
    throw new Error('All per-image analyses failed')
  }

  // Pass 2: Merge into unified mood board profile
  const merged = await mergeAnalyses(successful)

  // Ensure arrays have fallback defaults
  return {
    palette: merged.palette || [],
    mood: merged.mood || [],
    themes: merged.themes || [],
    textures: merged.textures || [],
    accords: merged.accords || [],
    top_notes: merged.top_notes || [],
    heart_notes: merged.heart_notes || [],
    base_notes: merged.base_notes || [],
    intensity: merged.intensity || 'moderate',
    vibe_summary: merged.vibe_summary || '',
    core_aesthetic: merged.core_aesthetic || '',
  }
}
