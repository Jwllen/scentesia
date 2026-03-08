'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

type Phase = 'select' | 'discover' | 'results' | 'detail' | 'share'

const PHASE_DURATIONS: Record<Phase, number> = {
  select: 4000,
  discover: 2000,
  results: 4000,
  detail: 4000,
  share: 3000,
}

const PHASES: Phase[] = ['select', 'discover', 'results', 'detail', 'share']

const SAMPLE_IMAGES = [
  '/curated/c1.jpg',
  '/curated/c2.jpg',
  '/curated/c3.jpg',
  '/curated/c4.jpg',
]

const RESULT_PERFUMES = [
  { name: 'Baccarat Rouge 540', brand: 'MFK', score: 97, accords: ['Amber', 'Sweet', 'Woody'], fragranticaId: '33519' },
  { name: 'Bleu de Chanel', brand: 'Chanel', score: 91, accords: ['Woody', 'Aromatic', 'Citrus'], fragranticaId: '25967' },
  { name: 'Light Blue', brand: 'D&G', score: 85, accords: ['Citrus', 'White Floral', 'Fresh'], fragranticaId: '485' },
]

const ACCORD_COLORS: Record<string, string> = {
  Amber: 'bg-amber-500/20 text-amber-300',
  Sweet: 'bg-pink-500/20 text-pink-300',
  Woody: 'bg-amber-700/20 text-amber-400',
  Aromatic: 'bg-emerald-500/20 text-emerald-300',
  Citrus: 'bg-yellow-500/20 text-yellow-300',
  'White Floral': 'bg-pink-400/20 text-pink-200',
  Fresh: 'bg-cyan-500/20 text-cyan-300',
}

// Canvas-based background removal (same as results page)
function BottleImage({ fragranticaId, name, size = 40 }: { fragranticaId: string; name: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(`https://fimgs.net/mdimg/perfume/375x500.${fragranticaId}.jpg`)}`

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    try {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imageData.data
      for (let i = 0; i < d.length; i += 4) {
        const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3
        if (brightness > 240) {
          d[i + 3] = 0
        } else if (brightness > 210) {
          d[i + 3] = Math.round(255 * (1 - (brightness - 210) / 30))
        }
      }
      ctx.putImageData(imageData, 0, 0)
      setSrc(canvas.toDataURL('image/png'))
    } catch {
      setSrc(img.src)
    }
  }, [])

  if (error) {
    return <div className="w-full h-full rounded-lg bg-white/5" />
  }

  return (
    <>
      {!src && (
        <img
          src={proxyUrl}
          crossOrigin="anonymous"
          className="hidden"
          onLoad={onLoad}
          onError={() => setError(true)}
          alt=""
        />
      )}
      {src ? (
        <img
          src={src}
          alt={name}
          className="object-contain"
          style={{ height: size, width: 'auto' }}
        />
      ) : (
        <div style={{ width: size, height: size }} className="rounded-lg bg-white/5 animate-pulse" />
      )}
    </>
  )
}

function CursorSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#cursorShadow)">
        <path d="M4 2L4 16L8.5 11.5L13 18L15 17L10.5 10.5L16 9L4 2Z" fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"/>
      </g>
      <defs>
        <filter id="cursorShadow" x="0" y="0" width="20" height="22" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.4"/>
        </filter>
      </defs>
    </svg>
  )
}

const CONTENT_HEIGHT = 280

export function VibePreview() {
  const [phase, setPhase] = useState<Phase>('select')
  const [phaseProgress, setPhaseProgress] = useState(0)
  const [selectedImages, setSelectedImages] = useState<number[]>([])
  const [clicking, setClicking] = useState(false)
  const [cursorTarget, setCursorTarget] = useState({ x: 50, y: 50 })
  const [showResults, setShowResults] = useState(false)
  const [detailIndex, setDetailIndex] = useState(-1)
  const [showShare, setShowShare] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRefs = useRef<(HTMLDivElement | null)[]>([])
  const discoverBtnRef = useRef<HTMLButtonElement>(null)
  const resultRefs = useRef<(HTMLDivElement | null)[]>([])
  const shareBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const getRelativePos = useCallback((el: HTMLElement | null) => {
    if (!el || !containerRef.current) return { x: 50, y: 50 }
    const container = containerRef.current.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    return {
      x: ((rect.left + rect.width / 2 - container.left) / container.width) * 100,
      y: ((rect.top + rect.height / 2 - container.top) / container.height) * 100,
    }
  }, [])

  const click = useCallback(() => {
    setClicking(true)
    setTimeout(() => setClicking(false), 150)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return

    const timeouts: ReturnType<typeof setTimeout>[] = []
    let interval: ReturnType<typeof setTimeout>

    const runPhase = (p: Phase) => {
      setPhaseProgress(0)
      setShowResults(false)
      setDetailIndex(-1)
      setShowShare(false)

      if (p === 'select') {
        setSelectedImages([])
        const selectTimings = [600, 1400, 2200, 3000]
        selectTimings.forEach((t, i) => {
          timeouts.push(setTimeout(() => {
            setCursorTarget(getRelativePos(imageRefs.current[i]))
            timeouts.push(setTimeout(() => {
              click()
              setSelectedImages(prev => [...prev, i])
            }, 400))
          }, t))
        })
      } else if (p === 'discover') {
        timeouts.push(setTimeout(() => {
          setCursorTarget(getRelativePos(discoverBtnRef.current))
          timeouts.push(setTimeout(() => click(), 500))
        }, 400))
      } else if (p === 'results') {
        setShowResults(true)
        setCursorTarget({ x: 50, y: 30 })
      } else if (p === 'detail') {
        setShowResults(true)
        timeouts.push(setTimeout(() => {
          setCursorTarget(getRelativePos(resultRefs.current[0]))
          timeouts.push(setTimeout(() => {
            click()
            setDetailIndex(0)
          }, 500))
        }, 400))
      } else if (p === 'share') {
        setShowResults(true)
        setDetailIndex(0)
        timeouts.push(setTimeout(() => {
          setCursorTarget(getRelativePos(shareBtnRef.current))
          timeouts.push(setTimeout(() => {
            click()
            setShowShare(true)
          }, 500))
        }, 600))
      }

      const dur = PHASE_DURATIONS[p]
      const step = 50
      let elapsed = 0
      interval = setInterval(() => {
        elapsed += step
        setPhaseProgress(Math.min(elapsed / dur, 1))
      }, step)

      timeouts.push(setTimeout(() => {
        clearInterval(interval)
        const nextIdx = (PHASES.indexOf(p) + 1) % PHASES.length
        setPhase(PHASES[nextIdx])
      }, dur))
    }

    runPhase(phase)
    return () => {
      timeouts.forEach(clearTimeout)
      clearInterval(interval)
    }
  }, [phase, prefersReducedMotion, getRelativePos, click])

  const phaseLabels: Record<Phase, string> = useMemo(() => ({
    select: 'Pick your vibes',
    discover: 'Hit discover',
    results: 'See your matches',
    detail: 'Explore a perfume',
    share: 'Share your results',
  }), [])

  if (prefersReducedMotion) {
    return (
      <section className="relative z-10 w-full max-w-lg mx-auto px-6 py-12">
        <p className="text-brand-subtitle/70 text-base tracking-[0.3em] uppercase text-center mb-6">
          How it works
        </p>
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {SAMPLE_IMAGES.map((src, i) => (
              <div key={i} className="aspect-square rounded-xl bg-white/5 border-2 border-brand-teal overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <p className="text-base text-brand-subtitle/80 text-center">
            Pick images that match your vibe, and we find your perfect fragrance.
          </p>
        </div>
      </section>
    )
  }

  const isSelectPhase = phase === 'select' || phase === 'discover'
  const isResultPhase = phase === 'results' || phase === 'detail' || phase === 'share'
  const showDetailOverlay = detailIndex >= 0 && (phase === 'detail' || phase === 'share')

  return (
    <section className="relative z-10 w-full max-w-lg mx-auto px-6 py-12">
      <p className="text-brand-subtitle/70 text-base tracking-[0.3em] uppercase text-center mb-6">
        How it works
      </p>

      <div
        ref={containerRef}
        className="glass-card rounded-2xl p-6 relative overflow-hidden"
        style={{ height: CONTENT_HEIGHT + 100 }}
      >
          {/* Phase indicator */}
          <div className="flex items-center gap-2 mb-5">
            {PHASES.map((p, i) => (
              <div
                key={p}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < PHASES.indexOf(phase) ? 'bg-brand-teal'
                  : i === PHASES.indexOf(phase) ? 'bg-brand-teal/60'
                  : 'bg-white/10'
                }`}
              >
                {i === PHASES.indexOf(phase) && (
                  <div
                    className="h-full bg-brand-teal rounded-full transition-all duration-100"
                    style={{ width: `${phaseProgress * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>

          <p className="text-base text-brand-subtitle/80 mb-4 text-center font-medium">
            {phaseLabels[phase]}
          </p>

          {/* Content area — fixed height */}
          <div style={{ height: CONTENT_HEIGHT }} className="relative">

            {/* SELECT / DISCOVER phases */}
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: isSelectPhase ? 1 : 0, pointerEvents: isSelectPhase ? 'auto' : 'none' }}
            >
              <div className="grid grid-cols-4 gap-2">
                {SAMPLE_IMAGES.map((src, i) => (
                  <div
                    key={i}
                    ref={(el) => { imageRefs.current[i] = el }}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 relative ${
                      selectedImages.includes(i)
                        ? 'border-brand-teal scale-95'
                        : 'border-transparent'
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    {selectedImages.includes(i) && (
                      <div className="absolute inset-0 bg-brand-teal/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {phase === 'discover' && (
                <div className="flex justify-center mt-4">
                  <button
                    ref={discoverBtnRef}
                    className="btn-glass-primary px-8 py-3 rounded-xl text-base pointer-events-none"
                  >
                    Discover My Scent
                  </button>
                </div>
              )}
            </div>

            {/* RESULTS phases (just the list) */}
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: isResultPhase ? 1 : 0, pointerEvents: isResultPhase ? 'auto' : 'none' }}
            >
              {showResults && (
                <div className="space-y-3">
                  {RESULT_PERFUMES.map((perfume, i) => (
                    <div
                      key={perfume.name}
                      ref={(el) => { resultRefs.current[i] = el }}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${
                        detailIndex === i ? 'bg-white/8 ring-1 ring-brand-teal/40' : 'bg-white/3'
                      }`}
                      style={{
                        opacity: 0,
                        animation: `fadeUp 0.5s ease ${i * 150}ms forwards`,
                      }}
                    >
                      <div className="w-10 h-10 flex items-center justify-center shrink-0">
                        <BottleImage fragranticaId={perfume.fragranticaId} name={perfume.name} size={40} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base text-white/90 font-medium truncate">{perfume.name}</p>
                        <p className="text-base text-brand-subtitle/70 truncate">{perfume.brand}</p>
                      </div>
                      <div className="text-base text-white/80 font-semibold shrink-0">{perfume.score}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Detail card — centered overlay INSIDE the container */}
          {showDetailOverlay && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center p-4"
              style={{ animation: 'fadeIn 0.3s ease forwards' }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-xl" />
              {/* Card */}
              <div
                className="relative z-10 w-full max-w-sm p-5 rounded-2xl bg-gradient-to-b from-[#0a1a22] to-[#080808] border border-brand-teal/15 shadow-2xl shadow-black/60 space-y-3"
                style={{ animation: 'fadeUp 0.4s ease forwards' }}
              >
                <div className="flex items-start gap-4">
                  <div className="h-16 flex items-center justify-center shrink-0">
                    <BottleImage fragranticaId={RESULT_PERFUMES[0].fragranticaId} name={RESULT_PERFUMES[0].name} size={60} />
                  </div>
                  <div>
                    <p className="text-base text-white font-semibold">{RESULT_PERFUMES[0].name}</p>
                    <p className="text-base text-brand-subtitle/70">{RESULT_PERFUMES[0].brand}</p>
                    <p className="text-base text-white/80 font-bold mt-1">{RESULT_PERFUMES[0].score}% match</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {RESULT_PERFUMES[0].accords.map((a) => (
                    <span key={a} className={`px-3 py-1 rounded-full text-sm ${ACCORD_COLORS[a] || 'bg-white/10 text-white/70'}`}>
                      {a}
                    </span>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    ref={shareBtnRef}
                    className="btn-glass px-4 py-2 rounded-lg text-base pointer-events-none"
                  >
                    Share
                  </button>
                </div>

                {showShare && (
                  <div
                    className="text-center py-1 text-base text-brand-teal font-medium"
                    style={{ animation: 'fadeIn 0.3s ease forwards' }}
                  >
                    Link copied!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Animated Cursor */}
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: `${cursorTarget.x}%`,
              top: `${cursorTarget.y}%`,
              transform: `translate(-2px, -2px) ${clicking ? 'scale(0.85)' : 'scale(1)'}`,
              transition: 'left 0.6s cubic-bezier(0.4, 0, 0.2, 1), top 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s ease',
              willChange: 'transform, left, top',
            }}
          >
            <CursorSvg />
          </div>
        </div>
    </section>
  )
}
