/**
 * Supplemental patch — fixes brands missed by patch-1 because the DB uses
 * hyphenated slugs (e.g. "atelier-cologne") while patch-1 used space-separated
 * search strings (e.g. "atelier cologne").
 *
 * Miu Miu is absent from the DB (only false-match: orientica-premium).
 * Bottega Veneta uses "bottega-veneta" — must NOT match "bottega-verde".
 * YSL uses "saint-laurent" — avoids matching "yves-rocher" (not L'Oréal).
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

const SLUG_BRANDS = [
  ['saint-laurent',    'Yves Saint Laurent'],
  ['ralph-lauren',     'Ralph Lauren'],
  ['margiela',         'Maison Margiela'],
  ['viktor-rolf',      'Viktor & Rolf'],
  ['bottega-veneta',   'Bottega Veneta'],
  ['atelier-cologne',  'Atelier Cologne'],
]

async function patch() {
  console.log("Patching slug-format L'Oréal brands...\n")

  for (const [match, canonical] of SLUG_BRANDS) {
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

  // Final summary
  const { count: lorealTotal } = await supabase
    .from('perfumes')
    .select('*', { count: 'exact', head: true })
    .eq('is_loreal', true)

  const { data: breakdown } = await supabase
    .from('perfumes')
    .select('loreal_brand')
    .eq('is_loreal', true)
    .not('loreal_brand', 'is', null)

  const counts = {}
  for (const row of breakdown ?? []) {
    counts[row.loreal_brand] = (counts[row.loreal_brand] ?? 0) + 1
  }

  console.log(`\n📊 Total L'Oréal flagged: ${lorealTotal}`)
  console.log('\nPer-brand breakdown:')
  for (const [brand, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${brand.padEnd(24)} ${count}`)
  }
}

patch().catch(console.error)
