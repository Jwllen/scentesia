'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'
import { TiltCard } from '@/components/TiltCard'
import type { PerfumeRecommendation, LayeringSuggestion, VibeAnalysis } from '@/types'

function formatName(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
        <div className="w-7 h-14 bg-white/8 border border-white/12" />
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-[#080808] border border-white/10 z-10 max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl">

        {/* Bottle area — transparent so particle field shows through */}
        <div className="h-44 bg-transparent relative flex items-center justify-center border-b border-white/8">
          <PerfumeBottleImage perfume={perfume} />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 text-2xl leading-none transition-colors"
          >×</button>
          {/* Score badge */}
          <div className="absolute bottom-4 left-4 px-2 py-1 border border-white/15 rounded-full">
            <span
              className="text-white/50 text-[9px] tracking-[0.2em] uppercase"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              {perfume.match_score}% match
            </span>
          </div>
        </div>

        <div className="p-7">
          <p
            className="text-white/30 text-[9px] tracking-[0.25em] uppercase mb-1"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            {formatName(perfume.brand)}
          </p>
          <h2
            className="text-3xl font-light text-white mb-5"
            style={{ fontFamily: 'var(--font-cormorant), serif' }}
          >
            {formatName(perfume.name)}
          </h2>

          <p
            className="text-white/40 text-sm leading-relaxed mb-6 italic border-l border-white/15 pl-4"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            {perfume.match_reason}
          </p>

          {/* Matched accords */}
          <div className="flex flex-wrap gap-2 mb-6">
            {perfume.matched_accords.map(accord => (
              <span
                key={accord}
                className="text-[9px] px-2.5 py-1 border border-white/15 text-white/50 tracking-wide rounded-full"
                style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
              >
                {accord}
              </span>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-4 mb-6">
            {perfume.top_notes?.length > 0 && (
              <div>
                <p className="text-white/25 text-[9px] tracking-[0.25em] uppercase mb-1.5" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>Top Notes</p>
                <p className="text-white/70 text-sm" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>{perfume.top_notes.slice(0, 5).join(' · ')}</p>
              </div>
            )}
            {perfume.heart_notes?.length > 0 && (
              <div>
                <p className="text-white/25 text-[9px] tracking-[0.25em] uppercase mb-1.5" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>Heart Notes</p>
                <p className="text-white/70 text-sm" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>{perfume.heart_notes.slice(0, 5).join(' · ')}</p>
              </div>
            )}
            {perfume.base_notes?.length > 0 && (
              <div>
                <p className="text-white/25 text-[9px] tracking-[0.25em] uppercase mb-1.5" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>Base Notes</p>
                <p className="text-white/70 text-sm" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>{perfume.base_notes.slice(0, 5).join(' · ')}</p>
              </div>
            )}
          </div>

          {perfume.rating && (
            <p className="text-white/25 text-xs mb-6" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Rated <span className="text-white/60">{Number(perfume.rating).toFixed(1)}/5</span>
              {perfume.votes && ` · ${Number(perfume.votes).toLocaleString()} reviews`}
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
              className="block w-full text-center py-3.5 bg-white text-black text-[9px] tracking-[0.25em] uppercase rounded-xl hover:bg-white/88 transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              Find This Perfume →
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
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-5 h-5 border border-white/20 rounded-full animate-spin border-t-white/60" />
    </main>
  )

  return (
    <main className="min-h-screen bg-black pb-24">

      {/* Vibe header */}
      <div className="px-6 md:px-10 pt-10 pb-8 border-b border-white/8">
        <button
          onClick={() => router.push('/build')}
          className="text-white/30 text-[9px] tracking-[0.45em] uppercase mb-6 block hover:text-white/60 transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          ← Scentesia
        </button>
        <p
          className="text-white/25 text-[9px] tracking-[0.35em] uppercase mb-3"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Your Vibe
        </p>
        <h1
          className="text-2xl md:text-3xl font-light text-white italic leading-snug max-w-sm mb-5"
          style={{ fontFamily: 'var(--font-cormorant), serif' }}
        >
          &ldquo;{vibe.vibe_summary}&rdquo;
        </h1>
        <div className="flex flex-wrap gap-2">
          {vibe.accords?.map(accord => (
            <span
              key={accord}
              className="text-[9px] px-2.5 py-1 border border-white/12 text-white/35 tracking-wide rounded-full"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              {accord}
            </span>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="px-6 md:px-10 pt-8">
        <p
          className="text-white/25 text-[9px] tracking-[0.4em] uppercase mb-6"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Your Scents
        </p>

        {recommendations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/30 text-sm mb-5" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              No matches found for this vibe.
            </p>
            <button
              onClick={() => router.push('/build')}
              className="text-white/40 text-[9px] tracking-[0.25em] uppercase hover:text-white/70 transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              Try Different Images →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recommendations.map((rec) => (
              <TiltCard
                key={rec.id}
                onClick={() => setSelected(rec)}
                className="text-left bg-white/3 backdrop-blur-sm rounded-2xl group border border-white/6"
              >
                {/* Bottle area — transparent so particle field shows through */}
                <div className="h-36 bg-transparent relative overflow-hidden border-b border-white/6">
                  <PerfumeBottleImage perfume={rec} />
                  <div className="absolute top-2 right-2">
                    <span
                      className="text-white/35 text-[9px]"
                      style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                    >
                      {rec.match_score}%
                    </span>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3.5">
                  <p
                    className="text-white/25 text-[8px] tracking-[0.15em] uppercase mb-0.5 truncate"
                    style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                  >
                    {formatName(rec.brand)}
                  </p>
                  <h3
                    className="text-base font-light text-white/80 group-hover:text-white transition-colors leading-tight truncate"
                    style={{ fontFamily: 'var(--font-cormorant), serif' }}
                  >
                    {formatName(rec.name)}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {rec.matched_accords.slice(0, 2).map(accord => (
                      <span
                        key={accord}
                        className="text-[7px] px-1.5 py-0.5 border border-white/10 text-white/25 rounded-full"
                        style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                      >
                        {accord}
                      </span>
                    ))}
                  </div>
                </div>
              </TiltCard>
            ))}
          </div>
        )}
      </div>

      {/* Layering */}
      {layers.length > 0 && (
        <div className="px-6 md:px-10 pt-12">
          <p
            className="text-white/25 text-[9px] tracking-[0.4em] uppercase mb-1"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            Layering
          </p>
          <p
            className="text-white/25 text-xs mb-6"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            Combine for a scent that&apos;s uniquely yours.
          </p>
          <div className="space-y-3">
            {layers.map((layer, i) => (
              <div key={i} className="p-5 bg-white/3 rounded-xl border border-white/6">
                <div className="flex items-center gap-4 mb-3 flex-wrap">
                  <div>
                    <p
                      className="text-white/25 text-[8px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                    >
                      {layer.brand_1}
                    </p>
                    <p
                      className="text-white/80 text-lg font-light"
                      style={{ fontFamily: 'var(--font-cormorant), serif' }}
                    >
                      {layer.perfume_1}
                    </p>
                  </div>
                  <span className="text-white/20 text-lg">+</span>
                  <div>
                    <p
                      className="text-white/25 text-[8px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                    >
                      {layer.brand_2}
                    </p>
                    <p
                      className="text-white/80 text-lg font-light"
                      style={{ fontFamily: 'var(--font-cormorant), serif' }}
                    >
                      {layer.perfume_2}
                    </p>
                  </div>
                </div>
                <p
                  className="text-white/30 text-xs leading-relaxed mb-1.5"
                  style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                >
                  {layer.effect}
                </p>
                <p
                  className="text-white/50 text-xs leading-relaxed"
                  style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                >
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
          className="text-[9px] text-white/30 tracking-[0.25em] uppercase border border-white/12 px-8 py-3 rounded-full hover:border-white/30 hover:text-white/60 transition-all duration-200"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Try a Different Vibe
        </button>
      </div>

      {selected && <PerfumeDetailModal perfume={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
