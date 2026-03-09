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
    return parts.length >= 2 && (parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'reels')
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

function isValidTiktokUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    const h = u.hostname
    if (h === 'vm.tiktok.com') return true
    if (!h.includes('tiktok.com')) return false
    return u.pathname.includes('/video/')
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
  const [loadingText, setLoadingText] = useState('Analyzing your vibe...')
  const [loadingPct, setLoadingPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'curated' | 'pinterest' | 'instagram' | 'tiktok'>('curated')
  const [pinterestUrl, setPinterestUrl] = useState('')
  const [pinterestImages, setPinterestImages] = useState<{ id: string; url: string }[]>([])
  const [pinterestLoading, setPinterestLoading] = useState(false)
  const [pinterestError, setPinterestError] = useState<string | null>(null)
  const [instagramUrl, setInstagramUrl] = useState('')
  const [instagramImages, setInstagramImages] = useState<{ id: string; url: string }[]>([])
  const [instagramType, setInstagramType] = useState<'single' | 'carousel' | 'reel' | null>(null)
  const [instagramLoading, setInstagramLoading] = useState(false)
  const [instagramError, setInstagramError] = useState<string | null>(null)
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [tiktokImages, setTiktokImages] = useState<{ id: string; url: string }[]>([])
  const [tiktokLoading, setTiktokLoading] = useState(false)
  const [tiktokError, setTiktokError] = useState<string | null>(null)

  const totalSelected = selected.length + uploadedImages.length

  function switchTab(tab: 'curated' | 'pinterest' | 'instagram' | 'tiktok') {
    setActiveTab(tab)
    setSelected([])
    if (tab !== 'instagram') {
      setInstagramImages([])
      setInstagramType(null)
      setInstagramError(null)
      setInstagramUrl('')
    }
    if (tab !== 'tiktok') {
      setTiktokImages([])
      setTiktokError(null)
      setTiktokUrl('')
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
      (activeTab === 'instagram' && instagramImages.length > 0) ||
      (activeTab === 'pinterest' && pinterestImages.length > 0) ||
      (activeTab === 'tiktok' && tiktokImages.length > 0) ||
      (activeTab === 'curated' && totalSelected > 0)
    if (!canDiscover) return

    spray(e.currentTarget.getBoundingClientRect())
    setLoading(true)
    setLoadingPct(0)
    setError(null)

    // Accelerate the background mist
    ;(window as unknown as Record<string, boolean>).__scentesiaLoading = true

    // Staged messages — gets playful the longer the user waits
    const stages = [
      { at: 0,     text: 'Analyzing your vibe...' },
      { at: 3000,  text: 'Finding your scents...' },
      { at: 7000,  text: 'Curating layering combos\u2026' },
      { at: 12000, text: 'Your taste is impeccable, this might take a sec\u2026' },
      { at: 18000, text: 'Okay, your vibe is very specific. We respect that...' },
      { at: 25000, text: 'We\u2019d rush, but you deserve better than that\u2026' },
      { at: 33000, text: 'If it makes you feel better, basic people load instantly.' },
      { at: 42000, text: 'We could give you generic picks in 2 seconds. But you\u2019d never forgive us.' },
      { at: 52000, text: 'If this were easy, you wouldn\u2019t be interesting.' },
      { at: 63000, text: 'Speed is for people who smell like everyone else.' },
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
        tabUrls = pinterestImages.map(img => img.url)
      } else if (activeTab === 'tiktok') {
        tabUrls = tiktokImages.map(img => img.url)
      } else if (activeTab === 'instagram') {
        tabUrls = instagramImages.map(img => img.url)
      }

      const uploadedBase64 = uploadedImages.map(img => img.base64)
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
      sessionStorage.setItem('scentesia_vibe_images', JSON.stringify(allImages))
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

  async function handleTiktokImport(urlOverride?: string) {
    const urlToUse = urlOverride ?? tiktokUrl
    if (!isValidTiktokUrl(urlToUse)) return
    setTiktokLoading(true)
    setTiktokError(null)
    setTiktokImages([])

    try {
      const res = await fetch(`/api/tiktok?url=${encodeURIComponent(urlToUse)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch video')
      setTiktokImages(data.images)
    } catch (err) {
      setTiktokError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setTiktokLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-organic relative">
        <div className="flex flex-col items-center gap-6 text-center px-6">
          <Logo size={40} className="text-white/80 animate-pulse" />
          <p className="text-white/70 text-base tracking-wide max-w-[240px] sm:max-w-xs transition-opacity duration-500">
            {loadingText}
          </p>
        </div>
        {/* Discreet percentage — bottom right */}
        <span className="absolute bottom-6 right-6 text-white/40 text-sm tracking-widest tabular-nums">
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-expanded text-2xl sm:text-3xl md:text-4xl font-light text-white">
              Upload your world.
            </h1>
            <p className="text-brand-subtitle/80 text-base mt-2 leading-relaxed">
              We&apos;ll translate it into fragrance.
            </p>
            {/* Tab toggle */}
            <div className="flex gap-0.5 sm:gap-1 mt-6 glass-card rounded-xl p-1 w-full">
              {(['curated', 'pinterest', 'instagram', 'tiktok'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={`flex-1 text-sm sm:text-base tracking-[0.08em] sm:tracking-[0.25em] uppercase px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-all duration-200 min-h-[44px] ${
                    activeTab === tab
                      ? 'text-white bg-brand-teal/30'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  {tab === 'curated' ? 'Curated' : tab === 'pinterest' ? 'Pinterest' : tab === 'instagram' ? 'Instagram' : 'TikTok'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded images strip */}
      {uploadedImages.length > 0 && (
        <div className="px-6 pt-5 flex gap-3 overflow-x-auto pb-1">
          {uploadedImages.map(img => (
            <div key={img.id} className="relative flex-shrink-0 w-24 h-[80px] sm:w-20 sm:h-[60px] rounded-xl overflow-hidden border border-brand-teal/20">
              <img src={img.url} alt="uploaded" className="w-full h-full object-cover" />
              <button
                onClick={() => removeUploaded(img.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black border border-white/20 rounded-full text-white/50 text-base flex items-center justify-center hover:text-white transition-colors"
              >&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Counter + upload (hidden on TikTok tab) */}
      {activeTab !== 'tiktok' && activeTab !== 'instagram' && activeTab !== 'pinterest' && (
        <div className="px-6 pt-5 flex items-center justify-between">
          <span className="text-brand-subtitle/80 text-base">
            <span className="text-white font-medium">{totalSelected}</span>
            <span className="text-brand-subtitle/80">/{MAX_IMAGES}</span>
            <span className="ml-2 text-brand-subtitle/80">selected</span>
          </span>
          {totalSelected < MAX_IMAGES && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-glass text-xs sm:text-base !px-2 !py-1 sm:!px-6 sm:!py-2.5 !rounded-lg sm:!rounded-xl"
              >
                + Upload yours
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 border border-brand-teal/15 bg-brand-teal/5 text-brand-subtitle/80 text-base rounded-xl">
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
          {pinterestImages.length === 0 && (
            <div className="mb-5">
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
                className="w-full bg-transparent border border-white/15 px-4 py-3 text-white/70 text-base placeholder:text-white/40 focus:outline-none focus:border-brand-teal/50 transition-colors rounded-xl min-h-[44px]"
              />
              <div className="flex justify-center mt-4">
                <div className="px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 w-fit">
                  <p className="text-base text-amber-300/80">
                    Links must be from public accounts and the board must be public
                  </p>
                </div>
              </div>
              {!pinterestLoading && (
                <div className="mt-6 flex justify-center">
                  <video
                    src="/tutorials/pinterest-tutorial.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="max-h-[34vh] rounded-xl border border-white/10"
                  />
                </div>
              )}
            </div>
          )}

          {pinterestError && pinterestImages.length === 0 && (
            <p className="text-brand-subtitle/80 text-base mb-5">
              {pinterestError}
            </p>
          )}

          {pinterestImages.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase">
                  {pinterestImages.length} images imported from board
                </p>
                <button
                  onClick={() => {
                    setPinterestImages([])
                    setPinterestUrl('')
                    setPinterestError(null)
                  }}
                  className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase hover:text-white/60 transition-colors"
                >
                  &times; Clear
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pinterestImages.slice(0, 6).map(img => (
                  <div key={img.id} className="flex-shrink-0 w-20 h-[60px] rounded-xl overflow-hidden border border-brand-teal/20">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {pinterestImages.length > 6 && (
                  <div className="flex-shrink-0 w-20 h-[60px] rounded-xl border border-white/10 flex items-center justify-center text-white/50 text-base">
                    +{pinterestImages.length - 6}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'instagram' && (
        <div className="pt-5 px-6">
          {instagramImages.length === 0 && (
            <div className="mb-5">
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
                className="w-full bg-transparent border border-white/15 px-4 py-3 text-white/70 text-base placeholder:text-white/40 focus:outline-none focus:border-brand-teal/50 transition-colors rounded-xl min-h-[44px]"
              />
              <div className="flex justify-center mt-4">
                <div className="px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 w-fit">
                  <p className="text-base text-amber-300/80">
                    Links must be from public accounts
                  </p>
                </div>
              </div>
              {!instagramLoading && (
                <div className="mt-6 flex justify-center">
                  <video
                    src="/tutorials/instagram-tutorial.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="max-h-[34vh] rounded-xl border border-white/10"
                  />
                </div>
              )}
            </div>
          )}

          {instagramError && instagramImages.length === 0 && (
            <p className="text-brand-subtitle/80 text-base mb-5">
              {instagramError}
            </p>
          )}

          {instagramType === 'single' && instagramImages.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase">
                  Post imported
                </p>
                <button
                  onClick={() => {
                    setInstagramImages([])
                    setInstagramType(null)
                    setInstagramUrl('')
                    setInstagramError(null)
                  }}
                  className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase hover:text-white/60 transition-colors"
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

          {instagramType === 'reel' && instagramImages.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase">
                  Reel imported
                </p>
                <button
                  onClick={() => {
                    setInstagramImages([])
                    setInstagramType(null)
                    setInstagramUrl('')
                    setInstagramError(null)
                  }}
                  className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase hover:text-white/60 transition-colors"
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

          {instagramType === 'carousel' && instagramImages.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase">
                  {instagramImages.length} images imported from carousel
                </p>
                <button
                  onClick={() => {
                    setInstagramImages([])
                    setInstagramType(null)
                    setInstagramUrl('')
                    setInstagramError(null)
                    setSelected([])
                  }}
                  className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase hover:text-white/60 transition-colors"
                >
                  &times; Clear
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {instagramImages.slice(0, 6).map(img => (
                  <div key={img.id} className="flex-shrink-0 w-20 h-[60px] rounded-xl overflow-hidden border border-brand-teal/20">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {instagramImages.length > 6 && (
                  <div className="flex-shrink-0 w-20 h-[60px] rounded-xl border border-white/10 flex items-center justify-center text-white/50 text-base">
                    +{instagramImages.length - 6}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tiktok' && (
        <div className="pt-5 px-6">
          {tiktokImages.length === 0 && (
            <div className="mb-5">
              <input
                type="url"
                value={tiktokUrl}
                onChange={e => setTiktokUrl(e.target.value)}
                onPaste={e => {
                  e.preventDefault()
                  const pasted = e.clipboardData.getData('text')
                  setTiktokUrl(pasted)
                  if (isValidTiktokUrl(pasted)) {
                    handleTiktokImport(pasted)
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && handleTiktokImport()}
                placeholder="Paste a TikTok video URL"
                className="w-full bg-transparent border border-white/15 px-4 py-3 text-white/70 text-base placeholder:text-white/40 focus:outline-none focus:border-brand-teal/50 transition-colors rounded-xl min-h-[44px]"
              />
              <div className="flex justify-center mt-4">
                <div className="px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 w-fit">
                  <p className="text-base text-amber-300/80">
                    Links must be from public accounts
                  </p>
                </div>
              </div>
              {!tiktokLoading && (
                <div className="mt-6 flex justify-center">
                  <video
                    src="/tutorials/tiktok-tutorial.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="max-h-[34vh] rounded-xl border border-white/10"
                  />
                </div>
              )}
            </div>
          )}

          {tiktokError && tiktokImages.length === 0 && (
            <p className="text-brand-subtitle/80 text-base mb-5">
              {tiktokError}
            </p>
          )}

          {tiktokImages.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase">
                  Video cover imported
                </p>
                <button
                  onClick={() => {
                    setTiktokImages([])
                    setTiktokUrl('')
                    setTiktokError(null)
                  }}
                  className="text-brand-subtitle/80 text-base tracking-[0.15em] uppercase hover:text-white/60 transition-colors"
                >
                  &times; Clear
                </button>
              </div>
              <div className="w-40 aspect-[4/3] rounded-xl overflow-hidden">
                <img
                  src={tiktokImages[0].url}
                  alt=""
                  className="w-full h-full object-cover animate-fade-in"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/80 backdrop-blur-md border-t border-white/6"
        style={{ position: 'fixed', zIndex: 40 }}
      >
        <button
          onClick={handleDiscover}
          disabled={
            (activeTab === 'instagram' && instagramImages.length === 0) ||
            (activeTab === 'pinterest' && pinterestImages.length === 0) ||
            (activeTab === 'tiktok' && tiktokImages.length === 0) ||
            (activeTab === 'curated' && totalSelected === 0)
          }
          className="btn-glass-primary w-full py-4 rounded-xl"
        >
          {activeTab === 'instagram' && instagramImages.length === 0
            ? 'Import an Instagram post or reel first'
            : activeTab === 'instagram' && instagramType === 'carousel'
            ? `Discover My Scent \u2014 ${instagramImages.length} images`
            : activeTab === 'instagram'
            ? 'Discover My Scent'
            : activeTab === 'pinterest' && pinterestImages.length === 0
            ? 'Import a Pinterest board first'
            : activeTab === 'pinterest'
            ? `Discover My Scent \u2014 ${pinterestImages.length} images`
            : activeTab === 'tiktok' && tiktokImages.length === 0
            ? 'Import a TikTok video first'
            : activeTab === 'tiktok'
            ? 'Discover My Scent'
            : totalSelected === 0
            ? 'Select at least one image'
            : `Discover My Scent \u2014 ${totalSelected} selected`}
        </button>
      </div>

    </main>
  )
}
