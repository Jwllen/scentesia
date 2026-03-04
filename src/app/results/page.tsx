'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'
import { TiltCard } from '@/components/TiltCard'
import { Logo } from '@/components/Logo'
import type { PerfumeRecommendation, LayeringSuggestion, VibeAnalysis } from '@/types'

function formatName(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const ACCORD_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  // Citrus / fresh
  citrus:    { border: 'border-yellow-400/30', bg: 'bg-yellow-400/8',  text: 'text-yellow-300/80' },
  fresh:     { border: 'border-cyan-400/30',   bg: 'bg-cyan-400/8',    text: 'text-cyan-300/80' },
  aromatic:  { border: 'border-emerald-400/30', bg: 'bg-emerald-400/8', text: 'text-emerald-300/80' },
  green:     { border: 'border-green-400/30',  bg: 'bg-green-400/8',   text: 'text-green-300/80' },
  aquatic:   { border: 'border-sky-400/30',    bg: 'bg-sky-400/8',     text: 'text-sky-300/80' },
  marine:    { border: 'border-sky-400/30',    bg: 'bg-sky-400/8',     text: 'text-sky-300/80' },
  // Floral
  floral:    { border: 'border-pink-400/30',   bg: 'bg-pink-400/8',    text: 'text-pink-300/80' },
  rose:      { border: 'border-rose-400/30',   bg: 'bg-rose-400/8',    text: 'text-rose-300/80' },
  powdery:   { border: 'border-fuchsia-300/30', bg: 'bg-fuchsia-300/8', text: 'text-fuchsia-200/80' },
  // Warm / spicy
  warm:      { border: 'border-orange-400/30', bg: 'bg-orange-400/8',  text: 'text-orange-300/80' },
  spicy:     { border: 'border-red-400/30',    bg: 'bg-red-400/8',     text: 'text-red-300/80' },
  oriental:  { border: 'border-amber-400/30',  bg: 'bg-amber-400/8',   text: 'text-amber-300/80' },
  amber:     { border: 'border-amber-400/30',  bg: 'bg-amber-400/8',   text: 'text-amber-300/80' },
  // Woody / earthy
  woody:     { border: 'border-yellow-700/30', bg: 'bg-yellow-700/8',  text: 'text-yellow-600/80' },
  earthy:    { border: 'border-stone-400/30',  bg: 'bg-stone-400/8',   text: 'text-stone-300/80' },
  musky:     { border: 'border-stone-400/30',  bg: 'bg-stone-400/8',   text: 'text-stone-300/80' },
  leather:   { border: 'border-amber-700/30',  bg: 'bg-amber-700/8',   text: 'text-amber-600/80' },
  smoky:     { border: 'border-zinc-400/30',   bg: 'bg-zinc-400/8',    text: 'text-zinc-300/80' },
  oud:       { border: 'border-amber-700/30',  bg: 'bg-amber-700/8',   text: 'text-amber-600/80' },
  // Sweet / gourmand
  sweet:     { border: 'border-pink-300/30',   bg: 'bg-pink-300/8',    text: 'text-pink-200/80' },
  vanilla:   { border: 'border-amber-200/30',  bg: 'bg-amber-200/8',   text: 'text-amber-100/80' },
  gourmand:  { border: 'border-orange-300/30', bg: 'bg-orange-300/8',  text: 'text-orange-200/80' },
  // Fruity
  fruity:    { border: 'border-red-300/30',    bg: 'bg-red-300/8',     text: 'text-red-200/80' },
  tropical:  { border: 'border-lime-400/30',   bg: 'bg-lime-400/8',    text: 'text-lime-300/80' },
}

const DEFAULT_ACCORD = { border: 'border-brand-teal/25', bg: 'bg-brand-teal/5', text: 'text-brand-subtitle/70' }

function getAccordColor(accord: string) {
  const key = accord.toLowerCase().trim()
  for (const [k, v] of Object.entries(ACCORD_COLORS)) {
    if (key.includes(k)) return v
  }
  return DEFAULT_ACCORD
}

function getPerfumeImageUrl(url?: string): string | null {
  if (!url) return null
  const match = url.match(/(\d+)\.html$/)
  if (!match) return null
  return `https://fimgs.net/mdimg/perfume/375x500.${match[1]}.jpg`
}

function PerfumeBottleImage({ perfume }: { perfume: PerfumeRecommendation }) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const rawUrl = getPerfumeImageUrl(perfume.url)
  // Route through our proxy so canvas can read cross-origin pixels
  const proxyUrl = rawUrl
    ? `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`
    : null

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    try {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imageData.data

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2]
        // Soft edge fade in the near-white range (210–240) for smooth edges
        const brightness = (r + g + b) / 3
        if (brightness > 240) {
          d[i + 3] = 0
        } else if (brightness > 210) {
          d[i + 3] = Math.round(255 * (1 - (brightness - 210) / 30))
        }
      }

      ctx.putImageData(imageData, 0, 0)
      setProcessedSrc(canvas.toDataURL('image/png'))
    } catch {
      // Canvas blocked (shouldn't happen via proxy) — show original
      setProcessedSrc(img.src)
    }
  }, [])

  if (!proxyUrl || error) {
    return (
      <div className="w-full h-full flex items-end justify-center pb-4">
        <div className="w-7 h-14 bg-brand-teal/10 border border-brand-teal/20 rounded-sm" />
      </div>
    )
  }

  return (
    <>
      {/* Hidden loader — triggers canvas processing on load */}
      {!processedSrc && (
        <img
          src={proxyUrl}
          crossOrigin="anonymous"
          className="hidden"
          onLoad={onLoad}
          onError={() => setError(true)}
          alt=""
        />
      )}
      {/* Processed transparent bottle */}
      {processedSrc && (
        <img
          src={processedSrc}
          alt={perfume.name}
          className="w-full h-full object-contain p-3"
        />
      )}
    </>
  )
}

function PerfumeDetailModal({ perfume, onClose }: { perfume: PerfumeRecommendation; onClose: () => void }) {
  const { spray } = useMist()

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ position: 'fixed', zIndex: 50 }}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-gradient-to-b from-[#0a1a22] to-[#080808] border border-brand-teal/15 z-10 max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl">

        {/* Bottle area */}
        <div className="h-44 bg-transparent relative flex items-center justify-center border-b border-brand-teal/15">
          <PerfumeBottleImage perfume={perfume} />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-white/40 hover:text-white/80 text-2xl leading-none transition-colors"
          >&times;</button>
          {/* Score badge */}
          <div className="absolute bottom-4 left-4 px-2 py-1 border border-brand-teal/20 rounded-full bg-brand-teal/5 backdrop-blur-sm">
            <span className="text-brand-subtitle/70 text-[9px] tracking-[0.2em] uppercase">
              {perfume.match_score}% match
            </span>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-7 sm:py-7">
          <p className="text-brand-subtitle/50 text-[9px] tracking-[0.25em] uppercase mb-1">
            {formatName(perfume.brand)}
          </p>
          <h2 className="font-expanded text-xl sm:text-2xl md:text-3xl font-light text-white mb-5">
            {formatName(perfume.name)}
          </h2>

          <p className="text-white/60 text-sm leading-relaxed mb-6 italic border-l border-brand-teal/20 pl-4">
            {perfume.match_reason}
          </p>

          {/* Matched accords */}
          <div className="flex flex-wrap gap-2 mb-6">
            {perfume.matched_accords.map(accord => {
              const c = getAccordColor(accord)
              return (
                <span
                  key={accord}
                  className={`text-[9px] px-2.5 py-1 border ${c.border} ${c.text} tracking-wide rounded-full ${c.bg}`}
                >
                  {accord}
                </span>
              )
            })}
          </div>

          {/* Notes */}
          <div className="space-y-4 mb-6">
            {perfume.top_notes?.length > 0 && (
              <div>
                <p className="text-brand-subtitle/60 text-[9px] tracking-[0.25em] uppercase mb-1.5">Top Notes</p>
                <p className="text-white/70 text-sm">{perfume.top_notes.slice(0, 5).join(' \u00b7 ')}</p>
              </div>
            )}
            {perfume.heart_notes?.length > 0 && (
              <div>
                <p className="text-brand-subtitle/60 text-[9px] tracking-[0.25em] uppercase mb-1.5">Heart Notes</p>
                <p className="text-white/70 text-sm">{perfume.heart_notes.slice(0, 5).join(' \u00b7 ')}</p>
              </div>
            )}
            {perfume.base_notes?.length > 0 && (
              <div>
                <p className="text-brand-subtitle/60 text-[9px] tracking-[0.25em] uppercase mb-1.5">Base Notes</p>
                <p className="text-white/70 text-sm">{perfume.base_notes.slice(0, 5).join(' \u00b7 ')}</p>
              </div>
            )}
          </div>

          {perfume.rating && (
            <p className="text-brand-subtitle/60 text-xs mb-6">
              Rated <span className="text-white/60">{Number(perfume.rating).toFixed(1)}/5</span>
              {perfume.votes && ` \u00b7 ${Number(perfume.votes).toLocaleString()} reviews`}
            </p>
          )}

          {perfume.url && (
            <a
              href={perfume.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                spray(e.currentTarget.getBoundingClientRect())
              }}
              className="btn-glass-primary block w-full text-center py-3.5 rounded-xl"
            >
              Find This Perfume &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const { spray } = useMist()
  const [vibe, setVibe] = useState<VibeAnalysis | null>(null)
  const [recommendations, setRecommendations] = useState<PerfumeRecommendation[]>([])
  const [layers, setLayers] = useState<LayeringSuggestion[]>([])
  const [selected, setSelected] = useState<PerfumeRecommendation | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('scentesia_results')
    if (!raw) { router.push('/build'); return }
    try {
      const data = JSON.parse(raw)
      setVibe(data.vibe)
      setRecommendations(data.recommendations || [])
      setLayers(data.layers || [])
    } catch {
      router.push('/build')
    }
  }, [router])

  if (!vibe) return (
    <main className="min-h-screen bg-organic flex items-center justify-center">
      <div className="w-5 h-5 border border-brand-teal/30 rounded-full animate-spin border-t-brand-subtitle/60" />
    </main>
  )

  return (
    <main className="min-h-screen bg-organic grain-layer pb-24">

      {/* Vibe header */}
      <div className="px-6 md:px-10 pt-10 pb-8 border-b border-white/8">
        <button
          onClick={() => router.push('/build')}
          className="mb-6 hover:opacity-80 transition-opacity"
        >
          <Logo size={48} className="text-white" />
        </button>
        <h2 className="font-expanded text-white text-lg tracking-[0.2em] uppercase mb-3">
          Your Vibe
        </h2>
        <h1 className="font-expanded text-lg sm:text-2xl md:text-3xl font-light text-white leading-snug mb-5">
          &ldquo;{vibe.vibe_summary}&rdquo;
        </h1>
        <div className="flex flex-wrap gap-2">
          {vibe.accords?.map(accord => {
            const c = getAccordColor(accord)
            return (
              <span
                key={accord}
                className={`text-[9px] px-2.5 py-1 border ${c.border} ${c.text} tracking-wide rounded-full ${c.bg}`}
              >
                {accord}
              </span>
            )
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="px-6 md:px-10 pt-8">
        <h2 className="font-expanded text-white text-lg tracking-[0.2em] uppercase mb-6">
          Your Scents
        </h2>

        {recommendations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-brand-subtitle/50 text-sm mb-5">
              No matches found for this vibe.
            </p>
            <button
              onClick={() => router.push('/build')}
              className="btn-glass"
            >
              Try Different Images &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {recommendations.map((rec, index) => {
              const isBestMatch = index === 0 && rec.match_score > 70
              return (
                <TiltCard
                  key={rec.id}
                  onClick={() => setSelected(rec)}
                  glowColor={isBestMatch ? 'rgba(251,191,36,0.7)' : undefined}
                  className={`text-left glass-card rounded-2xl group ${
                    isBestMatch
                      ? 'border-amber-400/50 gold-pulse'
                      : ''
                  }`}
                >
                  {/* Best Match badge */}
                  {isBestMatch && (
                    <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/35 backdrop-blur-sm flex items-center justify-center leading-none">
                      <span className="text-amber-300 text-[8px] tracking-[0.15em] uppercase font-semibold leading-none">Best Match</span>
                    </div>
                  )}
                  {/* Bottle area */}
                  <div className="h-36 bg-transparent relative overflow-hidden border-b border-brand-teal/8">
                    <PerfumeBottleImage perfume={rec} />
                    <div className="absolute top-2 right-2">
                      <span className="text-brand-subtitle/60 text-[9px]">
                        {rec.match_score}%
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3.5">
                    <p className="text-brand-subtitle/60 text-[8px] tracking-[0.15em] uppercase mb-0.5 truncate">
                      {formatName(rec.brand)}
                    </p>
                    <h3 className="font-expanded text-sm sm:text-base font-light text-white/90 group-hover:text-white transition-colors leading-tight truncate">
                      {formatName(rec.name)}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rec.matched_accords.slice(0, 2).map(accord => {
                        const c = getAccordColor(accord)
                        return (
                        <span
                          key={accord}
                          className={`text-[7px] px-1.5 py-0.5 border ${c.border} ${c.text} rounded-full ${c.bg}`}
                        >
                          {accord}
                        </span>
                        )
                      })}
                    </div>
                  </div>
                </TiltCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Layering */}
      {layers.length > 0 && (
        <div className="px-6 md:px-10 pt-12">
          <h2 className="font-expanded text-white text-lg tracking-[0.2em] uppercase mb-1">
            Layering
          </h2>
          <p className="text-brand-subtitle/60 text-xs mb-6">
            Combine for a scent that&apos;s uniquely yours.
          </p>
          <div className="space-y-3">
            {layers.map((layer, i) => (
              <div key={i} className="p-5 glass-card rounded-xl relative">
                {layer.combo_score > 0 && (
                  <div className="absolute top-4 right-4 px-2 py-1 rounded-full bg-brand-teal/10 border border-brand-teal/20">
                    <span className="text-brand-subtitle/70 text-[9px] tracking-[0.15em]">
                      {layer.combo_score}% match
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                  <div>
                    <p className="text-brand-subtitle/60 text-[8px] uppercase tracking-wider">
                      {layer.brand_1}
                    </p>
                    <p className="font-expanded text-white/90 text-base sm:text-lg font-light">
                      {layer.perfume_1}
                    </p>
                  </div>
                  <span className="text-white/60 text-xl sm:text-2xl font-light">+</span>
                  <div>
                    <p className="text-brand-subtitle/60 text-[8px] uppercase tracking-wider">
                      {layer.brand_2}
                    </p>
                    <p className="font-expanded text-white/90 text-base sm:text-lg font-light">
                      {layer.perfume_2}
                    </p>
                  </div>
                </div>
                <p className="text-brand-subtitle/60 text-xs leading-relaxed mb-1.5">
                  {layer.effect}
                </p>
                <p className="text-white/60 text-xs leading-relaxed">
                  {layer.apply}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Try again */}
      <div className="px-6 pt-12 text-center">
        <button
          onClick={(e) => {
            spray(e.currentTarget.getBoundingClientRect())
            setTimeout(() => router.push('/build'), 300)
          }}
          className="btn-glass px-8 py-3 rounded-full"
        >
          Try a Different Vibe
        </button>
      </div>

      {selected && <PerfumeDetailModal perfume={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
