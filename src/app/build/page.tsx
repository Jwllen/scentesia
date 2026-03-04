'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'
import { Logo } from '@/components/Logo'

const CURATED_COUNT = 138
const CURATED_IMAGES = Array.from({ length: CURATED_COUNT }, (_, i) => ({
  id: `c${i + 1}`,
  url: `/curated/c${i + 1}.jpg`,
}))

const MAX_IMAGES = 5

function isValidInstagramUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    const h = u.hostname
    if (
      h !== 'instagram.com' &&
      h !== 'www.instagram.com' &&
      h !== 'instagr.am' &&
      h !== 'www.instagr.am'
    ) return false
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    return parts.length >= 2 && (parts[0] === 'p' || parts[0] === 'reel')
  } catch {
    return false
  }
}

function isValidPinterestUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    // Accept pin.it short links — the API resolves the redirect server-side
    if (u.hostname === 'pin.it') return true
    if (!u.hostname.includes('pinterest')) return false
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    return parts.length >= 2
  } catch {
    return false
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function BuildPage() {
  const router = useRouter()
  const { spray } = useMist()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shuffledCurated = useMemo(() => shuffleArray(CURATED_IMAGES), [])
  const [selected, setSelected] = useState<string[]>([])
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string; base64: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('Reading your vibe...')
  const [loadingPct, setLoadingPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'curated' | 'pinterest' | 'instagram'>('curated')
  const [pinterestUrl, setPinterestUrl] = useState('')
  const [pinterestImages, setPinterestImages] = useState<{ id: string; url: string }[]>([])
  const [pinterestLoading, setPinterestLoading] = useState(false)
  const [pinterestError, setPinterestError] = useState<string | null>(null)
  const [instagramUrl, setInstagramUrl] = useState('')
  const [instagramImages, setInstagramImages] = useState<{ id: string; url: string }[]>([])
  const [instagramType, setInstagramType] = useState<'single' | 'carousel' | null>(null)
  const [instagramLoading, setInstagramLoading] = useState(false)
  const [instagramError, setInstagramError] = useState<string | null>(null)

  const totalSelected = selected.length + uploadedImages.length

  function switchTab(tab: 'curated' | 'pinterest' | 'instagram') {
    setActiveTab(tab)
    setSelected([])
    if (tab !== 'instagram') {
      setInstagramImages([])
      setInstagramType(null)
      setInstagramError(null)
      setInstagramUrl('')
    }
  }

  function toggleCurated(id: string) {
    if (selected.includes(id)) {
      setSelected(prev => prev.filter(s => s !== id))
    } else if (totalSelected < MAX_IMAGES) {
      setSelected(prev => [...prev, id])
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_IMAGES - totalSelected
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        setUploadedImages(prev => [...prev, {
          id: `upload-${Date.now()}-${Math.random()}`,
          url: base64,
          base64,
        }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function removeUploaded(id: string) {
    setUploadedImages(prev => prev.filter(img => img.id !== id))
  }

  async function handleDiscover(e: React.MouseEvent<HTMLButtonElement>) {
    const canDiscover =
      (activeTab === 'instagram' && instagramType === 'single' && instagramImages.length > 0) ||
      (activeTab === 'instagram' && instagramType === 'carousel' && selected.length > 0) ||
      (activeTab !== 'instagram' && totalSelected > 0)
    if (!canDiscover) return

    spray(e.currentTarget.getBoundingClientRect())
    setLoading(true)
    setLoadingPct(0)
    setError(null)

    // Accelerate the background mist
    ;(window as unknown as Record<string, boolean>).__scentesiaLoading = true

    // Staged messages — gets playful the longer the user waits
    const stages = [
      { at: 0,    text: 'Reading your vibe...' },
      { at: 3000, text: 'Analyzing your aesthetic...' },
      { at: 7000, text: 'Matching accords to your mood...' },
      { at: 12000, text: 'Cross-referencing thousands of fragrances...' },
      { at: 18000, text: 'Almost there, good scents take time...' },
      { at: 25000, text: 'Still working — perfection can\'t be rushed...' },
      { at: 33000, text: 'Your nose will thank you for the wait...' },
      { at: 42000, text: 'Okay this is taking a while, bear with us...' },
    ]
    let stageIdx = 0
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      // Advance message stage
      while (stageIdx < stages.length - 1 && elapsed >= stages[stageIdx + 1].at) stageIdx++
      setLoadingText(stages[stageIdx].text)
      // Asymptotic percentage: approaches 95% but never reaches it
      setLoadingPct(Math.min(95, Math.round((1 - Math.exp(-elapsed / 15000)) * 100)))
    }, 500)

    try {
      let tabUrls: string[] = []
      if (activeTab === 'curated') {
        tabUrls = selected
          .map(id => CURATED_IMAGES.find(c => c.id === id)?.url)
          .filter((u): u is string => u !== undefined)
      } else if (activeTab === 'pinterest') {
        tabUrls = selected
          .map(id => pinterestImages.find(p => p.id === id)?.url)
          .filter((u): u is string => u !== undefined)
      } else if (activeTab === 'instagram') {
        if (instagramType === 'carousel') {
          tabUrls = instagramImages
            .filter(img => selected.includes(img.id))
            .map(img => img.url)
        } else {
          tabUrls = instagramImages.map(img => img.url)
        }
      }

      const uploadedBase64 = uploadedImages.map(img => img.base64)
      // Resolve relative paths (curated images) to absolute URLs for server-side fetch
      const resolvedUrls = tabUrls.map(u =>
        u.startsWith('/') ? `${window.location.origin}${u}` : u
      )
      const allImages = [...uploadedBase64, ...resolvedUrls]

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allImages }),
      })
      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json().catch(() => ({}))
        throw new Error(errData.error || `Analysis failed (${analyzeRes.status})`)
      }
      const { vibe } = await analyzeRes.json()

      const recommendRes = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibe }),
      })
      if (!recommendRes.ok) throw new Error('Recommendations failed')
      const { recommendations, layers } = await recommendRes.json()

      sessionStorage.setItem('scentesia_results', JSON.stringify({ vibe, recommendations, layers }))
      router.push('/results')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    } finally {
      clearInterval(interval)
      setLoadingPct(100)
      ;(window as unknown as Record<string, boolean>).__scentesiaLoading = false
    }
  }

  async function handleInstagramImport(urlOverride?: string) {
    const urlToUse = urlOverride ?? instagramUrl
    if (!isValidInstagramUrl(urlToUse)) return
    setInstagramLoading(true)
    setInstagramError(null)
    setInstagramImages([])
    setInstagramType(null)
    setSelected([])

    try {
      const res = await fetch(`/api/instagram?url=${encodeURIComponent(urlToUse)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch post')
      setInstagramImages(data.images)
      setInstagramType(data.type)
    } catch (err) {
      setInstagramError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setInstagramLoading(false)
    }
  }

  async function handlePinterestImport(urlOverride?: string) {
    const urlToUse = urlOverride ?? pinterestUrl
    if (!isValidPinterestUrl(urlToUse)) return
    setPinterestLoading(true)
    setPinterestError(null)
    setPinterestImages([])

    try {
      const res = await fetch(`/api/pinterest?url=${encodeURIComponent(urlToUse)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch board')
      setPinterestImages(data.images)
    } catch (err) {
      setPinterestError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPinterestLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-organic relative">
        <div className="flex flex-col items-center gap-6 text-center px-6">
          <Logo size={40} className="text-white/80 animate-pulse" />
          <p className="text-white/60 text-sm tracking-wide max-w-xs transition-opacity duration-500">
            {loadingText}
          </p>
        </div>
        {/* Discreet percentage — bottom right */}
        <span className="absolute bottom-6 right-6 text-white/20 text-[10px] tracking-widest tabular-nums">
          {loadingPct}%
        </span>
      </main>
    )
  }

  // Shared selection grid renderer
  function renderImageGrid(
    images: { id: string; url: string }[],
    gridClass: string,
    toggleFn: (id: string) => void,
  ) {
    return (
      <div className={gridClass}>
        {images.map((img, index) => {
          const isSelected = selected.includes(img.id)
          const isDisabled = !isSelected && totalSelected >= MAX_IMAGES
          return (
            <button
              key={img.id}
              onClick={() => toggleFn(img.id)}
              disabled={isDisabled}
              className={`relative overflow-hidden group transition-all duration-300 rounded-2xl aspect-[4/3] hover:scale-105 hover:z-10 ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'opacity-100'}`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover transition-transform duration-700 animate-fade-in"
              />
              <div className={`absolute inset-0 transition-all duration-300 ${isSelected ? 'bg-brand-teal/10' : 'bg-black/30 group-hover:bg-black/5'}`} />
              {isSelected && <div className="absolute inset-0 border-2 border-brand-teal/60 rounded-2xl" />}
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-brand-teal flex items-center justify-center rounded-sm">
                  <svg width="7" height="5" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  function toggleImage(id: string) {
    if (selected.includes(id)) {
      setSelected(prev => prev.filter(s => s !== id))
    } else if (totalSelected < MAX_IMAGES) {
      setSelected(prev => [...prev, id])
    }
  }

  return (
    <main className="min-h-screen bg-organic pb-32">

      {/* Header */}
      <div className="px-6 md:px-10 pt-10 pb-7 border-b border-white/8">
        <button
          onClick={() => router.push('/')}
          className="mb-5 hover:opacity-80 transition-opacity"
        >
          <Logo size={48} className="text-white" />
        </button>
        <h1 className="font-expanded text-3xl md:text-4xl font-light text-white">
          Upload your world.
        </h1>
        <p className="text-brand-subtitle/60 text-sm mt-2 leading-relaxed">
          We&apos;ll translate it into fragrance.
        </p>
        {/* Tab toggle — glass pill */}
        <div className="flex gap-1 mt-6 glass-card rounded-xl p-1 w-fit">
          {(['curated', 'pinterest', 'instagram'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`text-[9px] tracking-[0.25em] uppercase px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === tab
                  ? 'text-white bg-brand-teal/30'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {tab === 'curated' ? 'Curated' : tab === 'pinterest' ? 'Pinterest' : 'Instagram'}
            </button>
          ))}
        </div>
      </div>

      {/* Uploaded images strip */}
      {uploadedImages.length > 0 && (
        <div className="px-6 pt-5 flex gap-3 overflow-x-auto pb-1">
          {uploadedImages.map(img => (
            <div key={img.id} className="relative flex-shrink-0 w-20 h-[60px] rounded-xl overflow-hidden border border-brand-teal/20">
              <img src={img.url} alt="uploaded" className="w-full h-full object-cover" />
              <button
                onClick={() => removeUploaded(img.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black border border-white/20 rounded-full text-white/50 text-xs flex items-center justify-center hover:text-white transition-colors"
              >&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Counter + upload */}
      <div className="px-6 pt-5 flex items-center justify-between">
        <span className="text-brand-subtitle/60 text-sm">
          <span className="text-white font-medium">{totalSelected}</span>
          <span className="text-brand-subtitle/60">/{MAX_IMAGES}</span>
          <span className="ml-2 text-brand-subtitle/60 text-xs">selected</span>
        </span>
        {totalSelected < MAX_IMAGES && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-glass"
            >
              + Upload yours
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 border border-brand-teal/15 bg-brand-teal/5 text-brand-subtitle/70 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Curated grid — Pinterest-style masonry */}
      {activeTab === 'curated' && (
        <div className="pt-5">
          <div className="masonry-grid">
            {shuffledCurated.map((img, index) => {
              const isSelected = selected.includes(img.id)
              const isDisabled = !isSelected && totalSelected >= MAX_IMAGES
              return (
                <button
                  key={img.id}
                  onClick={() => toggleCurated(img.id)}
                  disabled={isDisabled}
                  className={`relative overflow-hidden group transition-all duration-300 rounded-2xl w-full hover:scale-105 hover:z-10 ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'opacity-100'}`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-auto block transition-transform duration-700 animate-fade-in rounded-2xl"
                  />
                  <div className={`absolute inset-0 transition-all duration-300 rounded-2xl ${isSelected ? 'bg-brand-teal/10' : 'bg-black/30 group-hover:bg-black/5'}`} />
                  {isSelected && <div className="absolute inset-0 border-2 border-brand-teal/60 rounded-2xl" />}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-brand-teal flex items-center justify-center rounded-sm">
                      <svg width="7" height="5" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'pinterest' && (
        <div className="pt-5 px-6">
          {/* URL input row */}
          <div className="flex gap-3 mb-5">
            <input
              type="url"
              value={pinterestUrl}
              onChange={e => setPinterestUrl(e.target.value)}
              onPaste={e => {
                e.preventDefault()
                const pasted = e.clipboardData.getData('text')
                setPinterestUrl(pasted)
                if (isValidPinterestUrl(pasted)) {
                  handlePinterestImport(pasted)
                }
              }}
              onKeyDown={e => e.key === 'Enter' && handlePinterestImport()}
              placeholder="Paste a Pinterest board URL"
              className="flex-1 bg-transparent border border-white/15 px-4 py-2.5 text-white/70 text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-teal/50 transition-colors rounded-xl"
            />
            <button
              onClick={() => handlePinterestImport()}
              disabled={!isValidPinterestUrl(pinterestUrl) || pinterestLoading}
              className="btn-glass"
            >
              {pinterestLoading ? '\u00b7\u00b7\u00b7' : 'Import'}
            </button>
          </div>

          {pinterestError && (
            <p className="text-brand-subtitle/50 text-xs mb-5">
              {pinterestError}
            </p>
          )}

          {pinterestImages.length > 0 && (
            <div className="-mx-6">
              {renderImageGrid(pinterestImages, 'vibe-grid', toggleImage)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'instagram' && (
        <div className="pt-5 px-6">
          {/* URL input row — hidden once images are loaded */}
          {instagramImages.length === 0 && (
            <div className="flex gap-3 mb-5">
              <input
                type="url"
                value={instagramUrl}
                onChange={e => setInstagramUrl(e.target.value)}
                onPaste={e => {
                  e.preventDefault()
                  const pasted = e.clipboardData.getData('text')
                  setInstagramUrl(pasted)
                  if (isValidInstagramUrl(pasted)) {
                    handleInstagramImport(pasted)
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && handleInstagramImport()}
                placeholder="Paste an Instagram post or reel URL"
                className="flex-1 bg-transparent border border-white/15 px-4 py-2.5 text-white/70 text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-teal/50 transition-colors rounded-xl"
              />
              <button
                onClick={() => handleInstagramImport()}
                disabled={!isValidInstagramUrl(instagramUrl) || instagramLoading}
                className="btn-glass"
              >
                {instagramLoading ? '\u00b7\u00b7\u00b7' : 'Import'}
              </button>
            </div>
          )}

          {instagramError && (
            <p className="text-brand-subtitle/50 text-xs mb-5">
              {instagramError}
            </p>
          )}

          {/* Single post — non-interactive preview */}
          {instagramType === 'single' && instagramImages.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-subtitle/60 text-[9px] tracking-[0.35em] uppercase">
                  Post imported
                </p>
                <button
                  onClick={() => {
                    setInstagramImages([])
                    setInstagramType(null)
                    setInstagramUrl('')
                    setInstagramError(null)
                  }}
                  className="text-brand-subtitle/60 text-[9px] tracking-[0.25em] uppercase hover:text-white/60 transition-colors"
                >
                  &times; Clear
                </button>
              </div>
              <div className="w-40 aspect-[4/3] rounded-xl overflow-hidden">
                <img
                  src={instagramImages[0].url}
                  alt=""
                  className="w-full h-full object-cover animate-fade-in"
                />
              </div>
            </div>
          )}

          {/* Carousel — selection grid */}
          {instagramType === 'carousel' && instagramImages.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-subtitle/60 text-[9px] tracking-[0.35em] uppercase">
                  {selected.length}/{Math.min(instagramImages.length, MAX_IMAGES - uploadedImages.length)} selected
                </p>
                <button
                  onClick={() => {
                    setInstagramImages([])
                    setInstagramType(null)
                    setInstagramUrl('')
                    setInstagramError(null)
                    setSelected([])
                  }}
                  className="text-brand-subtitle/60 text-[9px] tracking-[0.25em] uppercase hover:text-white/60 transition-colors"
                >
                  &times; Clear
                </button>
              </div>
              <div className="-mx-6">
                {renderImageGrid(instagramImages, 'vibe-grid', toggleImage)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-black/80 backdrop-blur-md border-t border-white/6"
        style={{ position: 'fixed', zIndex: 50 }}
      >
        <button
          onClick={handleDiscover}
          disabled={
            (activeTab === 'instagram' && instagramType === 'single' && instagramImages.length === 0) ||
            (activeTab === 'instagram' && instagramType === 'carousel' && selected.length === 0) ||
            (activeTab === 'instagram' && instagramType === null) ||
            (activeTab !== 'instagram' && totalSelected === 0)
          }
          className="btn-glass-primary w-full py-4 rounded-xl"
        >
          {activeTab === 'instagram' && instagramType === null
            ? 'Import an Instagram post first'
            : activeTab === 'instagram' && instagramType === 'single'
            ? instagramImages.length === 0
              ? 'Import an Instagram post first'
              : 'Discover My Scent'
            : activeTab === 'instagram' && instagramType === 'carousel' && selected.length === 0
            ? 'Select images from the carousel'
            : totalSelected === 0
            ? 'Select at least one image'
            : `Discover My Scent \u2014 ${totalSelected} selected`}
        </button>
      </div>

    </main>
  )
}
