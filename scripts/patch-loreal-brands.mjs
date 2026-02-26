/**
 * Patches the Supabase perfumes table to add missing L'Oréal Luxe brand flags.
 * Safe to run multiple times (idempotent — only sets is_loreal=true, never removes).
 *
 * New additions:
 *   - Prada, Miu Miu, Diesel, Atelier Cologne, Aesop   (L'Oréal Luxe owned/licensed)
 *   - Creed, Bottega Veneta, Balenciaga, Gucci          (Kering Beauté acquisition, 2025)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Each entry: [match substring (lowercase), canonical brand name]
const NEW_BRANDS = [
  // L'Oréal Luxe licensed/owned
  ['prada',            'Prada'],
  ['miu miu',          'Miu Miu'],
  ['diesel',           'Diesel'],
  ['atelier cologne',  'Atelier Cologne'],
  ['aesop',            'Aesop'],
  // Kering Beauté acquisition (2025)
  ['creed',            'Creed'],
  ['bottega veneta',   'Bottega Veneta'],
  ['balenciaga',       'Balenciaga'],
  ['gucci',            'Gucci'],
]

async function patch() {
  console.log("Patching L'Oréal brand flags in Supabase...\n")

  for (const [match, canonical] of NEW_BRANDS) {
    // Count how many rows match before updating
    const { count: before } = await supabase
      .from('perfumes')
      .select('*', { count: 'exact', head: true })
      .ilike('brand', `%${match}%`)
      .eq('is_loreal', false)

    if (before === 0) {
      console.log(`  ${canonical}: already fully flagged or not in DB — skipped`)
      continue
    }

    const { error } = await supabase
      .from('perfumes')
      .update({ is_loreal: true, loreal_brand: canonical })
      .ilike('brand', `%${match}%`)

    if (error) {
      console.error(`  ${canonical}: ERROR — ${error.message}`)
    } else {
      console.log(`  ${canonical}: flagged ${before} perfumes ✓`)
    }
  }

  // Summary
  const { count: total } = await supabase
    .from('perfumes')
    .select('*', { count: 'exact', head: true })

  const { count: lorealTotal } = await supabase
    .from('perfumes')
    .select('*', { count: 'exact', head: true })
    .eq('is_loreal', true)

  // Per-brand breakdown
  const { data: breakdown } = await supabase
    .from('perfumes')
    .select('loreal_brand')
    .eq('is_loreal', true)
    .not('loreal_brand', 'is', null)

  const counts = {}
  for (const row of breakdown ?? []) {
    counts[row.loreal_brand] = (counts[row.loreal_brand] ?? 0) + 1
  }

  console.log(`\n📊 DB totals: ${total} perfumes | ${lorealTotal} L'Oréal flagged`)
  console.log('\nPer-brand breakdown:')
  for (const [brand, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${brand.padEnd(22)} ${count}`)
  }
}

patch().catch(console.error)
