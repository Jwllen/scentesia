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

const { count: total } = await supabase.from('perfumes').select('*', { count: 'exact', head: true })
const { count: loreal } = await supabase.from('perfumes').select('*', { count: 'exact', head: true }).eq('is_loreal', true)
const { data: sample } = await supabase.from('perfumes').select('name, brand, accords, is_loreal').limit(3)
const { data: lorealSample } = await supabase.from('perfumes').select('name, brand, loreal_brand').eq('is_loreal', true).limit(5)

console.log(`\n📊 Database Stats:`)
console.log(`   Total perfumes: ${total}`)
console.log(`   L'Oréal brands: ${loreal}`)
console.log(`\n🔍 Sample perfumes:`)
sample.forEach(p => console.log(`   ${p.brand} — ${p.name} | accords: ${p.accords?.join(', ')}`))
console.log(`\n💛 Sample L'Oréal perfumes:`)
lorealSample.forEach(p => console.log(`   ${p.loreal_brand} — ${p.name}`))
