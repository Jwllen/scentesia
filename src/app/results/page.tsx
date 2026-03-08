'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'
import { TiltCard } from '@/components/TiltCard'
import { Logo } from '@/components/Logo'
import ShareCard from '@/components/ShareCard'
import type { PerfumeRecommendation, VibeAnalysis } from '@/types'

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

// Module-level cache: persists across re-renders, cleared on page navigation
const imageCache = new Map<string, string>()

function PerfumeBottleImage({ perfume }: { perfume: PerfumeRecommendation }) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const rawUrl = getPerfumeImageUrl(perfume.url)
  // Route through our proxy so canvas can read cross-origin pixels
  const proxyUrl = rawUrl
    ? `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`
    : null

  // Check cache on mount / when rawUrl changes
  useEffect(() => {
    if (rawUrl && imageCache.has(rawUrl)) {
      setProcessedSrc(imageCache.get(rawUrl)!)
    }
  }, [rawUrl])

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
        // Soft edge fade in the near-white range (210-240) for smooth edges
        const brightness = (r + g + b) / 3
        if (brightness > 240) {
          d[i + 3] = 0
        } else if (brightness > 210) {
          d[i + 3] = Math.round(255 * (1 - (brightness - 210) / 30))
        }
      }

      ctx.putImageData(imageData, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      if (rawUrl) imageCache.set(rawUrl, dataUrl)
      setProcessedSrc(dataUrl)
    } catch {
      // Canvas blocked (shouldn't happen via proxy) — show original
      const fallback = img.src
      if (rawUrl) imageCache.set(rawUrl, fallback)
      setProcessedSrc(fallback)
    }
  }, [rawUrl])

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

function PerfumeDetailModal({
  perfume, recommendations, onClose, onSelectPerfume,
}: {
  perfume: PerfumeRecommendation
  recommendations: PerfumeRecommendation[]
  onClose: () => void
  onSelectPerfume?: (rec: PerfumeRecommendation) => void
}) {
  const { spray } = useMist()
  const [showShare, setShowShare] = useState(false)

  const handleClose = () => {
    setShowShare(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ position: 'fixed', zIndex: 50 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div className="relative w-full sm:max-w-md bg-gradient-to-b from-[#0a1a22] to-[#080808] border border-brand-teal/15 z-10 max-h-[85dvh] sm:max-h-[80dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-fade-up">

        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Bottle area */}
        <div className="h-44 bg-transparent relative flex items-center justify-center border-b border-brand-teal/15">
          <PerfumeBottleImage perfume={perfume} />
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-10 h-10 min-h-[44px] flex items-center justify-center text-white/40 hover:text-white/80 text-2xl leading-none transition-colors cursor-pointer focus:ring focus:ring-white/30 focus:outline-none rounded-full"
          >&times;</button>
          {/* Score badge */}
          <div className="absolute bottom-4 left-4 px-2 py-1 border border-brand-teal/20 rounded-full bg-brand-teal/5 backdrop-blur-sm">
            <span className="text-brand-subtitle/80 text-sm tracking-[0.2em] uppercase">
              {perfume.match_score}% match
            </span>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-7 sm:py-7">
          <p className="text-brand-subtitle/70 text-sm tracking-[0.25em] uppercase mb-1">
            {formatName(perfume.brand)}
          </p>
          <h2 className="font-expanded text-xl sm:text-2xl md:text-3xl font-light text-white mb-5">
            {formatName(perfume.name)}
          </h2>

          <p className="text-white/70 text-base leading-relaxed mb-6 italic border-l border-brand-teal/20 pl-4">
            {perfume.match_reason}
          </p>

          {/* Matched accords */}
          <div className="flex flex-wrap gap-2 mb-6">
            {perfume.matched_accords.map(accord => {
              const c = getAccordColor(accord)
              return (
                <span
                  key={accord}
                  className={`text-base px-2.5 py-1 border ${c.border} ${c.text} tracking-wide rounded-full ${c.bg}`}
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
                <p className="text-brand-subtitle/80 text-sm tracking-[0.25em] uppercase mb-1.5">Top Notes</p>
                <p className="text-white/80 text-base">{perfume.top_notes.slice(0, 5).join(' \u00b7 ')}</p>
              </div>
            )}
            {perfume.heart_notes?.length > 0 && (
              <div>
                <p className="text-brand-subtitle/80 text-sm tracking-[0.25em] uppercase mb-1.5">Heart Notes</p>
                <p className="text-white/80 text-base">{perfume.heart_notes.slice(0, 5).join(' \u00b7 ')}</p>
              </div>
            )}
            {perfume.base_notes?.length > 0 && (
              <div>
                <p className="text-brand-subtitle/80 text-sm tracking-[0.25em] uppercase mb-1.5">Base Notes</p>
                <p className="text-white/80 text-base">{perfume.base_notes.slice(0, 5).join(' \u00b7 ')}</p>
              </div>
            )}
          </div>

          {perfume.rating && (
            <p className="text-brand-subtitle/80 text-base mb-6">
              Rated <span className="text-white/70">{Number(perfume.rating).toFixed(1)}/5</span>
              {perfume.votes && ` \u00b7 ${Number(perfume.votes).toLocaleString()} reviews`}
            </p>
          )}

          {/* Pairs well with — per-card layering */}
          {perfume.layering && perfume.layering.length > 0 && (
            <div className="mb-6">
              <p className="text-brand-subtitle/80 text-sm tracking-[0.25em] uppercase mb-3">Pairs well with</p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                {perfume.layering.map((pair) => {
                  const pairImgUrl = getPerfumeImageUrl(pair.url)
                  const proxyUrl = pairImgUrl ? `/api/proxy-image?url=${encodeURIComponent(pairImgUrl)}` : null
                  return (
                    <button
                      key={pair.perfume_id}
                      onClick={() => {
                        const fullRec = recommendations.find(r => r.id === pair.perfume_id)
                        if (fullRec && onSelectPerfume) onSelectPerfume(fullRec)
                      }}
                      className="shrink-0 w-28 glass-card rounded-xl overflow-hidden text-left hover:border-white/15 transition-colors duration-200 cursor-pointer snap-start min-h-[44px]"
                    >
                      <div className="h-20 bg-transparent relative overflow-hidden border-b border-brand-teal/8">
                        {proxyUrl ? (
                          <img src={proxyUrl} alt={`${pair.name} bottle`} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-subtitle/20 text-2xl">?</div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-brand-subtitle/70 text-sm tracking-wider uppercase truncate">{formatName(pair.brand)}</p>
                        <p className="text-white/80 text-sm font-light truncate">{formatName(pair.name)}</p>
                        <div className="mt-1 px-1.5 py-0.5 rounded-full bg-brand-teal/10 border border-brand-teal/20 w-fit">
                          <span className="text-brand-subtitle/80 text-sm">{pair.combo_score}%</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {perfume.url && (
            <a
              href={perfume.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                spray(e.currentTarget.getBoundingClientRect())
              }}
              className="btn-glass-primary block w-full text-center py-3.5 rounded-xl min-h-[44px] cursor-pointer focus:ring focus:ring-white/30 focus:outline-none"
            >
              Find This Perfume &rarr;
            </a>
          )}

          <button
            onClick={() => setShowShare(true)}
            className="btn-glass block w-full text-center py-3.5 rounded-xl min-h-[44px] cursor-pointer focus:ring focus:ring-white/30 focus:outline-none mt-3"
          >
            Share This Match
          </button>
        </div>
      </div>

      {showShare && (
        <ShareCard perfume={perfume} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const { spray } = useMist()
  const [vibe, setVibe] = useState<VibeAnalysis | null>(null)
  const [recommendations, setRecommendations] = useState<PerfumeRecommendation[]>([])
  const [selected, setSelected] = useState<PerfumeRecommendation | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('scentesia_results')
    if (!raw) { router.push('/build'); return }
    try {
      const data = JSON.parse(raw)
      setVibe(data.vibe)
      setRecommendations(data.recommendations || [])
    } catch {
      router.push('/build')
    }
  }, [router])

  if (!vibe) return (
    <main className="bg-organic flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="w-5 h-5 border border-brand-teal/30 rounded-full animate-spin border-t-brand-subtitle/60" />
    </main>
  )

  return (
    <main className="bg-organic grain-layer pb-24" style={{ minHeight: '100dvh' }}>

      {/* Vibe header */}
      <div className="px-6 md:px-10 pt-10 pb-8 border-b border-white/8">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 group min-h-[44px] cursor-pointer"
          aria-label="Go back to home"
        >
          <Logo size={48} className="text-white" />
          <span className="text-brand-subtitle/70 text-sm tracking-[0.25em] uppercase group-hover:text-brand-subtitle/90 transition-colors duration-200">Back</span>
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
                className={`text-base px-2.5 py-1 border ${c.border} ${c.text} tracking-wide rounded-full ${c.bg}`}
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
            <p className="text-brand-subtitle/70 text-base mb-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                      <span className="text-amber-300 text-sm tracking-[0.15em] uppercase font-semibold leading-none">Best Match</span>
                    </div>
                  )}
                  <div className="flex sm:block">
                    {/* Bottle area */}
                    <div className="w-28 sm:w-full h-28 sm:h-36 bg-transparent relative overflow-hidden border-r sm:border-r-0 sm:border-b border-brand-teal/8 shrink-0">
                      <PerfumeBottleImage perfume={rec} />
                      <div className="absolute top-2 right-2">
                        <span className="text-brand-subtitle/80 text-sm">
                          {rec.match_score}%
                        </span>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3.5 flex-1 min-w-0 flex flex-col justify-center sm:block">
                      <p className="text-brand-subtitle/80 text-sm tracking-[0.15em] uppercase mb-0.5 truncate">
                        {formatName(rec.brand)}
                      </p>
                      <h3 className="font-expanded text-base font-light text-white/90 group-hover:text-white transition-colors leading-tight truncate">
                        {formatName(rec.name)}
                      </h3>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rec.matched_accords.slice(0, 3).map(accord => {
                          const c = getAccordColor(accord)
                          return (
                          <span
                            key={accord}
                            className={`text-sm px-1.5 py-0.5 border ${c.border} ${c.text} rounded-full ${c.bg}`}
                          >
                            {accord}
                          </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </TiltCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Start Over */}
      <div className="px-6 pt-12 text-center">
        <button
          onClick={(e) => {
            spray(e.currentTarget.getBoundingClientRect())
            sessionStorage.removeItem('scentesia_results')
            sessionStorage.removeItem('scentesia_vibe_images')
            setTimeout(() => router.push('/'), 300)
          }}
          className="btn-glass px-8 py-3 rounded-full cursor-pointer min-h-[44px]"
        >
          Start Over
        </button>
      </div>

      {selected && (
        <PerfumeDetailModal
          perfume={selected}
          recommendations={recommendations}
          onClose={() => setSelected(null)}
          onSelectPerfume={(rec) => { setSelected(null); setTimeout(() => setSelected(rec), 150) }}
        />
      )}
    </main>
  )
}
