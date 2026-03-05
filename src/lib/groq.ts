import type { VibeAnalysis } from '@/types'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const VIBE_PROMPT = `You are a fragrance expert and visual analyst.

Analyze these images together as a single mood board.

Return ONLY a valid JSON object with this exact structure:
{
  "palette": ["2-4 color descriptors, e.g. warm amber, deep navy"],
  "mood": ["2-4 emotional tones, e.g. mysterious, sensual, energetic"],
  "themes": ["2-4 visual themes, e.g. nature, urban, luxury, vintage"],
  "textures": ["2-4 tactile qualities, e.g. velvet, silk, rough stone"],
  "accords": ["3-6 perfume accords from this list only: woody, floral, citrus, oriental, fresh, gourmand, aquatic, spicy, earthy, musk, amber, leather, smoky, green, powdery, fruity, white floral, rose, vanilla, sandalwood, oud"],
  "intensity": "light OR moderate OR intense",
  "vibe_summary": "One evocative sentence describing this scent vibe in plain English, no technical terms"
}

No markdown, no explanation. Only the JSON object.`

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

export async function analyzeImages(imageInputs: string[]): Promise<VibeAnalysis> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  // Build image content parts for OpenAI-compatible vision format
  const imageContent = await Promise.all(
    imageInputs.map(async (input) => {
      let dataUrl: string
      if (input.startsWith('data:')) {
        dataUrl = input
      } else {
        const { data, mimeType } = await urlToBase64(input)
        dataUrl = `data:${mimeType};base64,${data}`
      }
      return {
        type: 'image_url' as const,
        image_url: { url: dataUrl },
      }
    })
  )

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VIBE_PROMPT },
            ...imageContent,
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content?.trim() || ''
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as VibeAnalysis
}
