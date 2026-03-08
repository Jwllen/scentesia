'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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

/** Extract Fragrantica perfume ID from page URL */
function getPerfumeId(url?: string): string | null {
  if (!url) return null
  const match = url.match(/(\d+)\.html$/)
  return match ? match[1] : null
}

function PerfumeBottleImage({ perfume }: { perfume: PerfumeRecommendation }) {
  const [error, setError] = useState(false)
  const id = getPerfumeId(perfume.url)

  if (!id || error) {
    return (
      <div className="w-full h-full flex items-end justify-center pb-4">
        <div className="w-7 h-14 bg-brand-teal/10 border border-brand-teal/20 rounded-sm" />
      </div>
    )
  }

  return (
    <picture className="w-full h-full flex items-center justify-center p-3">
      <source
        type="image/avif"
        srcSet={`https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${id}.avif 1x, https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${id}.2x.avif 2x`}
      />
      <source
        type="image/webp"
        srcSet={`https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${id}.webp 1x, https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${id}.2x.webp 2x`}
      />
      <img
        src={`https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${id}.webp`}
        alt={perfume.name}
        width={375}
        height={500}
        className="w-full h-full object-contain"
        loading="eager"
        decoding="async"
        onError={() => setError(true)}
      />
    </picture>
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
                  const pairId = getPerfumeId(pair.url)
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
                        {pairId ? (
                          <picture>
                            <source type="image/webp" srcSet={`https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${pairId}.webp`} />
                            <img src={`https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${pairId}.webp`} alt={`${pair.name} bottle`} className="w-full h-full object-contain" />
                          </picture>
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

function PerfumeCarousel({
  recommendations,
  onSelect,
  activeIndex,
  onIndexChange,
}: {
  recommendations: PerfumeRecommendation[]
  onSelect: (rec: PerfumeRecommendation) => void
  activeIndex: number
  onIndexChange: (i: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pointerStartX = useRef(0)
  const pointerDelta = useRef(0)
  const didDrag = useRef(false)
  const wheelTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  const count = recommendations.length
  const DRAG_THRESHOLD = 10

  // Pointer handlers — only treat as drag if moved beyond threshold
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartX.current = e.clientX
    pointerDelta.current = 0
    didDrag.current = false
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    pointerDelta.current = e.clientX - pointerStartX.current
    if (Math.abs(pointerDelta.current) > DRAG_THRESHOLD) {
      didDrag.current = true
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!didDrag.current) return // was a click, not a drag
    const swipeThreshold = 40
    if (pointerDelta.current < -swipeThreshold && activeIndex < count - 1) {
      onIndexChange(activeIndex + 1)
    } else if (pointerDelta.current > swipeThreshold && activeIndex > 0) {
      onIndexChange(activeIndex - 1)
    }
    pointerDelta.current = 0
  }, [activeIndex, count, onIndexChange])

  // Mouse wheel / trackpad scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      // Always block page scroll when pointer is over the carousel
      e.preventDefault()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 10) return
      // Debounce card changes to avoid rapid-fire
      if (wheelTimeout.current) return
      wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null }, 300)
      if (delta > 0 && activeIndex < count - 1) onIndexChange(activeIndex + 1)
      else if (delta < 0 && activeIndex > 0) onIndexChange(activeIndex - 1)
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [activeIndex, count, onIndexChange])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && activeIndex > 0) onIndexChange(activeIndex - 1)
      if (e.key === 'ArrowRight' && activeIndex < count - 1) onIndexChange(activeIndex + 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeIndex, count, onIndexChange])

  return (
    <div className="relative select-none">
      {/* Carousel viewport */}
      <div
        ref={containerRef}
        className="relative overflow-visible cursor-grab active:cursor-grabbing"
        style={{ height: 'clamp(380px, 55vh, 520px)' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {recommendations.map((rec, index) => {
          const offset = index - activeIndex
          const absOffset = Math.abs(offset)
          const isBestMatch = index === 2 && rec.match_score > 70
          const isCenter = absOffset === 0

          // Podium: center large + lifted, sides smaller + dropped
          const scale = isCenter ? 1 : absOffset === 1 ? 0.75 : 0.58
          const zIndex = 10 - absOffset

          // Horizontal spread
          const translateX = offset === 0 ? 0 : offset > 0
            ? 42 + (absOffset - 1) * 22
            : -(42 + (absOffset - 1) * 22)

          // Podium height: center raised, sides descend
          const translateY = isCenter ? -16 : absOffset === 1 ? 12 : 32

          // Liquid glass: blur + opacity for background cards
          const blur = isCenter ? 0 : absOffset === 1 ? 2 : 5
          const cardOpacity = isCenter ? 1 : absOffset === 1 ? 0.75 : 0.5

          // Drop shadow: prominent on center, subtle on sides
          const shadow = isCenter
            ? '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(30,69,91,0.15)'
            : absOffset === 1
            ? '0 10px 30px rgba(0,0,0,0.3)'
            : '0 5px 15px rgba(0,0,0,0.2)'

          const visible = absOffset <= 2

          return (
            <div
              key={rec.id}
              className="absolute left-1/2 top-1/2"
              style={{
                width: 'clamp(240px, 58vw, 320px)',
                transform: `translate(-50%, -50%) translateX(${translateX}%) translateY(${translateY}px) scale(${scale})`,
                opacity: visible ? cardOpacity : 0,
                zIndex,
                filter: blur > 0 ? `blur(${blur}px)` : 'none',
                transition: 'all 0.6s cubic-bezier(0.32, 0.72, 0, 1)',
                pointerEvents: visible ? 'auto' : 'none',
                willChange: 'transform, opacity, filter',
              }}
              onClick={() => {
                if (didDrag.current) return // was a drag, not a click
                if (isCenter) onSelect(rec)
                else onIndexChange(index)
              }}
            >
              <TiltCard
                glowColor={isBestMatch ? 'rgba(251,191,36,0.7)' : undefined}
                className={`glass-card rounded-2xl overflow-hidden cursor-pointer ${
                  isBestMatch ? 'border-amber-400/50 gold-pulse' : ''
                }`}
                style={{ boxShadow: shadow, background: 'rgba(0,0,0,0.40)' }}
              >
                {/* Best Match badge */}
                {isBestMatch && (
                  <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/35 backdrop-blur-sm">
                    <span className="text-amber-300 text-sm tracking-[0.15em] uppercase font-semibold leading-none">Best Match</span>
                  </div>
                )}

                {/* Match score */}
                <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full bg-brand-teal/10 border border-brand-teal/20 backdrop-blur-sm">
                  <span className="text-brand-subtitle/80 text-sm">{rec.match_score}%</span>
                </div>

                {/* Bottle area */}
                <div className="h-52 sm:h-60 bg-transparent relative flex items-center justify-center">
                  <PerfumeBottleImage perfume={rec} />
                </div>

                {/* Info */}
                <div className="px-4 pb-4 pt-2 border-t border-brand-teal/8">
                  <p className="text-brand-subtitle/80 text-sm tracking-[0.15em] uppercase mb-0.5 truncate">
                    {formatName(rec.brand)}
                  </p>
                  <h3 className="font-expanded text-base font-light text-white/90 leading-tight truncate mb-2">
                    {formatName(rec.name)}
                  </h3>
                  <div className="flex flex-wrap gap-1">
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
              </TiltCard>
            </div>
          )
        })}
      </div>

      {/* Navigation arrows — desktop */}
      {activeIndex > 0 && (
        <button
          onClick={() => onIndexChange(activeIndex - 1)}
          className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm"
          aria-label="Previous perfume"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
      )}
      {activeIndex < count - 1 && (
        <button
          onClick={() => onIndexChange(activeIndex + 1)}
          className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm"
          aria-label="Next perfume"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4l6 6-6 6" />
          </svg>
        </button>
      )}

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {recommendations.map((rec, i) => {
          const isGold = i === 2 && rec.match_score > 70
          const activeColor = isGold ? 'bg-amber-400/70' : 'bg-brand-teal/60'
          const inactiveColor = isGold ? 'bg-amber-400/25 hover:bg-amber-400/40' : 'bg-white/20 hover:bg-white/40'
          return (
            <button
              key={i}
              onClick={() => onIndexChange(i)}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                i === activeIndex
                  ? `w-6 h-2 ${activeColor}`
                  : `w-2 h-2 ${inactiveColor}`
              }`}
              aria-label={`Go to perfume ${i + 1}`}
            />
          )
        })}
      </div>

      {/* Tap hint */}
      <p className="text-center text-brand-subtitle/50 text-sm mt-3">
        Tap to explore
      </p>
    </div>
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const { spray } = useMist()
  const [vibe, setVibe] = useState<VibeAnalysis | null>(null)
  const [recommendations, setRecommendations] = useState<PerfumeRecommendation[]>([])
  const [selected, setSelected] = useState<PerfumeRecommendation | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(2)

  useEffect(() => {
    const raw = sessionStorage.getItem('scentesia_results')
    if (!raw) { router.push('/build'); return }
    try {
      const data = JSON.parse(raw)
      setVibe(data.vibe)
      // Reorder into podium: [#4, #2, #1, #3, #5] — best match at center (index 2)
      const recs: PerfumeRecommendation[] = data.recommendations || []
      if (recs.length === 5) {
        setRecommendations([recs[3], recs[1], recs[0], recs[2], recs[4]])
      } else {
        // For other counts, place best in the middle
        const mid = Math.floor(recs.length / 2)
        const reordered = [...recs]
        reordered.splice(0, 1) // remove best
        reordered.splice(mid, 0, recs[0]) // insert at center
        setRecommendations(reordered)
      }
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

      {/* Recommendations — Apple-style carousel */}
      <div className="pt-8 pb-4">
        <h2 className="font-expanded text-white text-lg tracking-[0.2em] uppercase mb-8 px-6 md:px-10">
          Your Scents
        </h2>

        {recommendations.length === 0 ? (
          <div className="text-center py-16 px-6">
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
          <PerfumeCarousel
            recommendations={recommendations}
            onSelect={setSelected}
            activeIndex={carouselIndex}
            onIndexChange={setCarouselIndex}
          />
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
