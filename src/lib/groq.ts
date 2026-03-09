import type { VibeAnalysis } from '@/types'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'
const MAX_IMAGES = 5

/* ── Prompt ────────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are a world-class Semiotician, Fashion Critic, and Master Perfumer working for L'Oréal Luxe. Your expertise lies in decoding visual media, understanding deep cultural aesthetics, analyzing human psychology through imagery, and translating those visual/emotional cues into precise olfactory profiles (perfume notes).

You do not provide surface-level descriptions; you uncover the hidden narrative, the socio-cultural vibe, and the psychological weight of the images provided. You must pay close attention to demographics, gender presentation (traditional or subverted), body language, clothing, color theory, and lighting.

CRITICAL INSTRUCTION: You must respond ONLY in valid JSON format. Do not include any conversational text, introductions, or markdown formatting (like \`\`\`json). Use the exact JSON schema provided.`

function buildAnalysisPrompt(imageCount: number): string {
  return `You are analyzing ${imageCount} image${imageCount > 1 ? 's' : ''} from a mood board. Decode the visual narrative, cultural aesthetic, and emotional weight across ALL images, then translate them into a precise fragrance profile.

For each image, consider: lighting, color psychology, objects, environment, character/body language, wardrobe semiotics, implied textures, and cultural subtext. Then synthesize everything into ONE cohesive olfactory identity.

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
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error(`[groq] API error ${response.status}: ${err}`)
    throw new Error(`Groq API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.trim() || ''
  if (!content) {
    console.error('[groq] Empty response from model:', JSON.stringify(data))
  }
  return content
}

/* ── Public API ────────────────────────────────────────────────────── */

export async function analyzeImages(imageInputs: string[]): Promise<VibeAnalysis> {
  const sampled = sampleEvenly(imageInputs, MAX_IMAGES)

  // Convert all to base64 data URLs in parallel
  const dataUrls = await Promise.all(sampled.map(toDataUrl))

  console.log(`[groq] Analyzing ${dataUrls.length} images in single pass with ${MODEL}`)

  // Single-pass: send all images + prompt in one call
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: buildAnalysisPrompt(dataUrls.length) },
    ...dataUrls.map(url => ({ type: 'image_url' as const, image_url: { url } })),
  ]

  const text = await callGroq(SYSTEM_PROMPT, userContent)
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(cleaned) as VibeAnalysis

  // Ensure arrays have fallback defaults
  return {
    palette: parsed.palette || [],
    mood: parsed.mood || [],
    themes: parsed.themes || [],
    textures: parsed.textures || [],
    accords: parsed.accords || [],
    top_notes: parsed.top_notes || [],
    heart_notes: parsed.heart_notes || [],
    base_notes: parsed.base_notes || [],
    intensity: parsed.intensity || 'moderate',
    vibe_summary: parsed.vibe_summary || '',
    core_aesthetic: parsed.core_aesthetic || '',
  }
}
