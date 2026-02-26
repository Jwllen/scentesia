import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// L'Oréal Luxe brands (lowercase for matching)
const LOREAL_BRANDS = {
  'lancome': 'Lancôme',
  'lancôme': 'Lancôme',
  'yves saint laurent': 'Yves Saint Laurent',
  'ysl': 'Yves Saint Laurent',
  'giorgio armani': 'Giorgio Armani',
  'armani': 'Giorgio Armani',
  'maison margiela': 'Maison Margiela',
  'mugler': 'Mugler',
  'thierry mugler': 'Mugler',
  'azzaro': 'Azzaro',
  'valentino': 'Valentino',
  'cacharel': 'Cacharel',
  'ralph lauren': 'Ralph Lauren',
  'viktor&rolf': 'Viktor & Rolf',
  'viktor & rolf': 'Viktor & Rolf',
}

function parseNotes(notesStr) {
  if (!notesStr || notesStr === 'unknown' || notesStr.trim() === '') return []
  return notesStr.split(',').map(n => n.trim().toLowerCase()).filter(Boolean)
}

function parseAccords(row) {
  const accords = []
  for (let i = 1; i <= 5; i++) {
    const accord = row[`mainaccord${i}`]
    if (accord && accord.trim() && accord.trim() !== 'unknown') {
      accords.push(accord.trim().toLowerCase())
    }
  }
  return accords
}

function parseRating(ratingStr) {
  if (!ratingStr) return null
  return parseFloat(ratingStr.replace(',', '.'))
}

function getLorealInfo(brand) {
  const lower = brand.toLowerCase()
  for (const [key, value] of Object.entries(LOREAL_BRANDS)) {
    if (lower.includes(key)) return { is_loreal: true, loreal_brand: value }
  }
  return { is_loreal: false, loreal_brand: null }
}

const CSV_PATH = '/Users/julienfontaine/Desktop/Scentesia-related docs/Fragrantica database 2024 (cleaned 3rd party).csv'
const BATCH_SIZE = 200

async function importData() {
  console.log('Starting Fragrantica data import...')

  const records = []

  await new Promise((resolve, reject) => {
    createReadStream(CSV_PATH)
      .pipe(parse({ delimiter: ';', columns: true, skip_empty_lines: true }))
      .on('data', (row) => {
        const { is_loreal, loreal_brand } = getLorealInfo(row.Brand || '')
        records.push({
          name: (row.Perfume || '').trim(),
          brand: (row.Brand || '').trim(),
          country: (row.Country || '').trim() || null,
          gender: (row.Gender || '').trim() || null,
          rating: parseRating(row['Rating Value']),
          votes: parseInt(row['Rating Count']) || null,
          year: parseInt(row.Year) || null,
          top_notes: parseNotes(row.Top),
          heart_notes: parseNotes(row.Middle),
          base_notes: parseNotes(row.Base),
          accords: parseAccords(row),
          url: (row.url || '').trim() || null,
          is_loreal,
          loreal_brand,
        })
      })
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Parsed ${records.length} perfumes. Uploading in batches...`)

  let inserted = 0
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('perfumes').insert(batch)
    if (error) {
      console.error(`Batch ${i}-${i + BATCH_SIZE} failed:`, error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`\rUploaded ${inserted}/${records.length} perfumes...`)
    }
  }

  console.log(`\n✅ Import complete! ${inserted} perfumes uploaded to Supabase.`)

  // Quick verification
  const { count } = await supabase.from('perfumes').select('*', { count: 'exact', head: true })
  const { count: lorealCount } = await supabase.from('perfumes').select('*', { count: 'exact', head: true }).eq('is_loreal', true)
  console.log(`📊 Total in DB: ${count} | L'Oréal brands: ${lorealCount}`)
}

importData().catch(console.error)
