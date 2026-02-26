import { GoogleGenerativeAI } from '@google/generative-ai'
import type { VibeAnalysis } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
  const mimeType = contentType.split(';')[0] as 'image/jpeg' | 'image/png' | 'image/webp'
  return {
    data: Buffer.from(buffer).toString('base64'),
    mimeType,
  }
}

export async function analyzeImages(imageInputs: string[]): Promise<VibeAnalysis> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const imageParts = await Promise.all(
    imageInputs.map(async (input) => {
      if (input.startsWith('data:')) {
        // Already base64 data URL
        const mimeMatch = input.match(/^data:(image\/[a-z]+);base64,/)
        const mimeType = (mimeMatch?.[1] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
        return {
          inlineData: {
            mimeType,
            data: input.replace(/^data:image\/[a-z]+;base64,/, ''),
          }
        }
      } else {
        // It's a URL — fetch and convert server-side
        const { data, mimeType } = await urlToBase64(input)
        return {
          inlineData: { mimeType, data }
        }
      }
    })
  )

  const result = await model.generateContent([VIBE_PROMPT, ...imageParts])
  const text = result.response.text().trim()
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as VibeAnalysis
}
