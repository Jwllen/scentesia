'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'

const CURATED_IMAGES = [
  { id: 'c1',  url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=85', accords: ['leather', 'smoky', 'woody', 'amber'] },
  { id: 'c2',  url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=85', accords: ['green', 'earthy', 'woody', 'fresh'] },
  { id: 'c3',  url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=85', accords: ['powdery', 'musk', 'white floral', 'sandalwood'] },
  { id: 'c4',  url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=85', accords: ['fruity', 'aquatic', 'floral', 'citrus'] },
  { id: 'c5',  url: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600&q=85', accords: ['vanilla', 'gourmand', 'musk', 'powdery'] },
  { id: 'c6',  url: 'https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=600&q=85', accords: ['oud', 'amber', 'spicy', 'leather'] },
  { id: 'c7',  url: 'https://images.unsplash.com/photo-1490750967868-88df5691890d?w=600&q=85', accords: ['rose', 'floral', 'white floral', 'powdery'] },
  { id: 'c8',  url: 'https://images.unsplash.com/photo-1510784722466-f2aa240267d4?w=600&q=85', accords: ['sandalwood', 'earthy', 'spicy', 'amber'] },
  { id: 'c9',  url: 'https://images.unsplash.com/photo-1499856871958-5b9357976b82?w=600&q=85', accords: ['iris', 'musk', 'white floral', 'woody'] },
  { id: 'c10', url: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600&q=85', accords: ['green', 'earthy', 'woody', 'smoky'] },
  { id: 'c11', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=85', accords: ['citrus', 'fresh', 'aquatic', 'green'] },
  { id: 'c12', url: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&q=85', accords: ['gourmand', 'vanilla', 'amber', 'spicy'] },
  { id: 'c13', url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=85', accords: ['sandalwood', 'green', 'woody', 'citrus'] },
  { id: 'c14', url: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&q=85', accords: ['oud', 'amber', 'leather', 'smoky'] },
  { id: 'c15', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=85', accords: ['aquatic', 'citrus', 'fresh', 'green'] },
  { id: 'c16', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=85', accords: ['fresh', 'green', 'earthy', 'woody'] },
  { id: 'c17', url: 'https://images.unsplash.com/photo-1490750967868-88df5691890d?w=600&q=85', accords: ['floral', 'rose', 'fresh', 'powdery'] },
  { id: 'c18', url: 'https://images.unsplash.com/photo-1533038590840-1cee814cad0b?w=600&q=85', accords: ['vanilla', 'amber', 'musk', 'woody'] },
]

const MAX_IMAGES = 5

function isValidPinterestUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (!u.hostname.includes('pinterest')) return false
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    return parts.length >= 2
  } catch {
    return false
  }
}

export default function BuildPage() {
  const router = useRouter()
  const { spray } = useMist()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string; base64: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('Reading your vibe...')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'curated' | 'pinterest'>('curated')
  const [pinterestUrl, setPinterestUrl] = useState('')
  const [pinterestImages, setPinterestImages] = useState<{ id: string; url: string }[]>([])
  const [pinterestLoading, setPinterestLoading] = useState(false)
  const [pinterestError, setPinterestError] = useState<string | null>(null)

  const totalSelected = selected.length + uploadedImages.length

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
    if (totalSelected === 0) return
    spray(e.currentTarget.getBoundingClientRect())

    setLoading(true)
    setError(null)

    const texts = ['Reading your vibe...', 'Finding your scent...', 'Almost there...']
    let i = 0
    const interval = setInterval(() => { i = (i + 1) % texts.length; setLoadingText(texts[i]) }, 2500)

    try {
      const curatedUrls = selected
        .map(id => {
          const curated = CURATED_IMAGES.find(c => c.id === id)
          if (curated) return curated.url
          const pin = pinterestImages.find(p => p.id === id)
          if (pin) return pin.url
          return null
        })
        .filter((u): u is string => u !== null)
      const uploadedBase64 = uploadedImages.map(img => img.base64)
      const allImages = [...uploadedBase64, ...curatedUrls]

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allImages }),
      })
      if (!analyzeRes.ok) throw new Error('Analysis failed')
      const { vibe } = await analyzeRes.json()

      const recommendRes = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibe }),
      })
      if (!recommendRes.ok) throw new Error('Recommendations failed')
      const { recommendations } = await recommendRes.json()

      const layerRes = await fetch('/api/layer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations }),
      })
      const { layers } = await layerRes.json()

      sessionStorage.setItem('scentesia_results', JSON.stringify({ vibe, recommendations, layers }))
      router.push('/results')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    } finally {
      clearInterval(interval)
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
      <main className="min-h-screen flex flex-col items-center justify-center bg-black">
        {/* Particles from MistEffect fill this void — they become the animation */}
        <div className="flex flex-col items-center gap-5 text-center px-6">
          <p
            className="text-[9px] text-white/20 tracking-[0.6em] uppercase"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            Scentesia
          </p>
          <p
            className="text-3xl md:text-4xl text-white/60 font-light italic"
            style={{ fontFamily: 'var(--font-cormorant), serif' }}
          >
            {loadingText}
          </p>
          {/* Thin progress line */}
          <div className="w-16 h-px bg-white/10 overflow-hidden mt-2">
            <div
              className="h-full bg-white/40 animate-pulse"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black pb-32">

      {/* Header */}
      <div className="px-6 md:px-10 pt-10 pb-7 border-b border-white/8">
        <button
          onClick={() => router.push('/')}
          className="text-white/30 text-[9px] tracking-[0.45em] uppercase mb-5 block hover:text-white/60 transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          ← Scentesia
        </button>
        <h1
          className="text-3xl md:text-4xl font-light text-white"
          style={{ fontFamily: 'var(--font-cormorant), serif' }}
        >
          Build your vibe board
        </h1>
        <p
          className="text-white/30 text-sm mt-2 leading-relaxed"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Choose up to 5 images. Let instinct guide you.
        </p>
        {/* Tab toggle */}
        <div className="flex gap-0 mt-6 border-b border-white/8">
          {(['curated', 'pinterest'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[9px] tracking-[0.35em] uppercase pb-3 pr-6 transition-colors duration-200 ${
                activeTab === tab
                  ? 'text-white border-b border-white -mb-px'
                  : 'text-white/25 hover:text-white/50'
              }`}
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              {tab === 'curated' ? 'Curated' : 'Pinterest'}
            </button>
          ))}
        </div>
      </div>

      {/* Uploaded images strip */}
      {uploadedImages.length > 0 && (
        <div className="px-6 pt-5 flex gap-3 overflow-x-auto pb-1">
          {uploadedImages.map(img => (
            <div key={img.id} className="relative flex-shrink-0 w-20 h-[60px] rounded-xl overflow-hidden border border-white/20">
              <img src={img.url} alt="uploaded" className="w-full h-full object-cover" />
              <button
                onClick={() => removeUploaded(img.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black border border-white/20 rounded-full text-white/50 text-xs flex items-center justify-center hover:text-white transition-colors"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Counter + upload */}
      <div className="px-6 pt-5 flex items-center justify-between">
        <span
          className="text-white/40 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          <span className="text-white font-medium">{totalSelected}</span>
          <span className="text-white/20">/{MAX_IMAGES}</span>
          <span className="ml-2 text-white/25 text-xs">selected</span>
        </span>
        {totalSelected < MAX_IMAGES && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[9px] text-white/50 tracking-[0.2em] uppercase border border-white/15 px-4 py-2 hover:border-white/40 hover:text-white/80 transition-all"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              + Upload yours
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 border border-white/10 bg-white/4 text-white/50 text-xs"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          {error}
        </div>
      )}

      {/* Blind vibe grid */}
      {activeTab === 'curated' && (
        <div className="pt-5">
          <div className="vibe-grid">
            {CURATED_IMAGES.map((img) => {
              const isSelected = selected.includes(img.id)
              const isDisabled = !isSelected && totalSelected >= MAX_IMAGES

              return (
                <button
                  key={img.id}
                  onClick={() => toggleCurated(img.id)}
                  disabled={isDisabled}
                  className={`relative overflow-hidden group transition-all duration-300 rounded-xl aspect-[4/3] ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'opacity-100'}`}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className={`absolute inset-0 transition-all duration-300 ${isSelected ? 'bg-white/10' : 'bg-black/30 group-hover:bg-black/5'}`} />
                  {isSelected && <div className="absolute inset-0 border border-white/60 rounded-xl" />}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-white flex items-center justify-center">
                      <svg width="7" height="5" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                const pasted = e.clipboardData.getData('text')
                setPinterestUrl(pasted)
                if (isValidPinterestUrl(pasted)) {
                  handlePinterestImport(pasted)
                }
              }}
              onKeyDown={e => e.key === 'Enter' && handlePinterestImport()}
              placeholder="Paste a Pinterest board URL"
              className="flex-1 bg-transparent border border-white/15 px-4 py-2.5 text-white/70 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/35 transition-colors rounded-xl"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            />
            <button
              onClick={() => handlePinterestImport()}
              disabled={!isValidPinterestUrl(pinterestUrl) || pinterestLoading}
              className="text-[9px] tracking-[0.25em] uppercase border border-white/15 px-5 py-2.5 rounded-xl text-white/50 hover:border-white/40 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              {pinterestLoading ? '···' : 'Import'}
            </button>
          </div>

          {/* Error */}
          {pinterestError && (
            <p
              className="text-white/35 text-xs mb-5"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              {pinterestError}
            </p>
          )}

          {/* Pinterest image grid */}
          {pinterestImages.length > 0 && (
            <div className="vibe-grid -mx-6">
              {pinterestImages.map((img, index) => {
                const isSelected = selected.includes(img.id)
                const isDisabled = !isSelected && totalSelected >= MAX_IMAGES
                return (
                  <button
                    key={img.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelected(prev => prev.filter(s => s !== img.id))
                      } else if (!isDisabled) {
                        setSelected(prev => [...prev, img.id])
                      }
                    }}
                    disabled={isDisabled}
                    className={`relative overflow-hidden group transition-all duration-300 rounded-xl aspect-[4/3] ${
                      isDisabled ? 'opacity-20 cursor-not-allowed' : 'opacity-100'
                    }`}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 animate-fade-in"
                    />
                    <div className={`absolute inset-0 transition-all duration-300 ${isSelected ? 'bg-white/10' : 'bg-black/30 group-hover:bg-black/5'}`} />
                    {isSelected && <div className="absolute inset-0 border border-white/60 rounded-xl" />}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-white flex items-center justify-center">
                        <svg width="7" height="5" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-black/95 backdrop-blur-sm border-t border-white/8">
        <button
          onClick={handleDiscover}
          disabled={totalSelected === 0}
          className="w-full py-4 bg-white text-black text-[9px] tracking-[0.35em] uppercase font-medium rounded-xl disabled:opacity-15 disabled:cursor-not-allowed hover:bg-white/88 active:scale-[0.99] transition-all duration-200"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          {totalSelected === 0 ? 'Select at least one image' : `Discover My Scent — ${totalSelected} selected`}
        </button>
      </div>

    </main>
  )
}
