'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PerfumeRecommendation } from '@/types'

type CardFormat = 'story' | 'feed'

interface ShareCardProps {
  perfume: PerfumeRecommendation
  onClose: () => void
}

const FORMATS: Record<CardFormat, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Story' },
  feed: { w: 1080, h: 1080, label: 'Feed' },
}

const BRAND_TEAL = '#1e455b'
const BG_TOP = '#0d1820'
const BG_BOT = '#0a1018'
const ACCENT_GOLD = '#c9a84c'
const TEXT_WHITE = '#f0f0f0'
const TEXT_DIM = '#8a9aaa'

/* ── helpers ─────────────────────────────────────────────── */

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function accordColor(name: string): string {
  const n = name.toLowerCase()
  if (/citrus|lemon|bergamot|orange|grapefruit|lime|mandarin/.test(n)) return '#f0c040'
  if (/floral|rose|jasmine|lily|iris|violet|peony|tuberose/.test(n)) return '#e07090'
  if (/woody|cedar|sandalwood|oud|vetiver|patchouli|oak/.test(n)) return '#a07040'
  if (/spicy|cinnamon|pepper|saffron|cardamom|clove/.test(n)) return '#d06030'
  if (/fresh|aquatic|marine|ozonic|green|herbal/.test(n)) return '#50b888'
  if (/sweet|vanilla|caramel|honey|sugar|chocolate/.test(n)) return '#d4a0c0'
  if (/musky|musk|amber|powdery/.test(n)) return '#c0a888'
  if (/leather|smoky|tobacco/.test(n)) return '#806050'
  if (/fruity|berry|apple|peach|plum/.test(n)) return '#e08060'
  return '#7aa0b8'
}

/* ── canvas drawing ──────────────────────────────────────── */

async function drawCard(
  canvas: HTMLCanvasElement,
  perfume: PerfumeRecommendation,
  format: CardFormat,
) {
  const { w, h } = FORMATS[format]
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const pad = 60
  const isStory = format === 'story'

  // background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, BG_TOP)
  grad.addColorStop(1, BG_BOT)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // subtle noise overlay
  for (let i = 0; i < 12000; i++) {
    const nx = Math.random() * w
    const ny = Math.random() * h
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`
    ctx.fillRect(nx, ny, 1, 1)
  }

  let cursorY = pad

  /* ── vibe images strip ─────────────────────────────────── */
  try {
    const raw = typeof window !== 'undefined'
      ? sessionStorage.getItem('scentesia_vibe_images')
      : null
    if (raw) {
      const urls: string[] = JSON.parse(raw)
      const thumbCount = Math.min(urls.length, 5)
      const thumbSize = isStory ? 170 : 150
      const gap = 16
      const stripW = thumbCount * thumbSize + (thumbCount - 1) * gap
      const startX = (w - stripW) / 2
      const radius = 14

      const images = await Promise.allSettled(
        urls.slice(0, thumbCount).map((u) => {
          const src = u.startsWith('/') || u.startsWith('data:')
            ? u
            : `/api/proxy-image?url=${encodeURIComponent(u)}`
          return loadImage(src)
        }),
      )

      images.forEach((result, i) => {
        if (result.status !== 'fulfilled') return
        const img = result.value
        const x = startX + i * (thumbSize + gap)
        const y = cursorY

        ctx.save()
        roundRect(ctx, x, y, thumbSize, thumbSize, radius)
        ctx.clip()

        // cover-fit
        const scale = Math.max(thumbSize / img.width, thumbSize / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        ctx.drawImage(img, x - (sw - thumbSize) / 2, y - (sh - thumbSize) / 2, sw, sh)
        ctx.restore()

        // subtle border
        ctx.save()
        roundRect(ctx, x, y, thumbSize, thumbSize, radius)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      })

      cursorY += thumbSize + (isStory ? 50 : 36)
    }
  } catch { /* no vibe images — skip */ }

  /* ── bottle image (optional) ───────────────────────────── */
  const bottleMaxH = isStory ? 480 : 280
  if (perfume.url) {
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(perfume.url)}`
      const bottleImg = await loadImage(proxyUrl)
      const aspect = bottleImg.width / bottleImg.height
      let bw = bottleMaxH * aspect
      let bh = bottleMaxH
      if (bw > w - pad * 2) {
        bw = w - pad * 2
        bh = bw / aspect
      }
      const bx = (w - bw) / 2
      ctx.drawImage(bottleImg, bx, cursorY, bw, bh)
      cursorY += bh + 30
    } catch {
      cursorY += 20
    }
  }

  /* ── match score ───────────────────────────────────────── */
  const scoreStr = `${Math.min(Math.round(perfume.match_score * 100), 100)}% Match`
  ctx.font = `bold ${isStory ? 42 : 36}px "Archivo", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillStyle = ACCENT_GOLD
  ctx.fillText(scoreStr, w / 2, cursorY + 42)
  cursorY += isStory ? 70 : 60

  /* ── perfume name ──────────────────────────────────────── */
  ctx.font = `bold ${isStory ? 56 : 44}px "Archivo", sans-serif`
  ctx.fillStyle = TEXT_WHITE

  // word-wrap name
  const nameWords = perfume.name.split(' ')
  const nameLines: string[] = []
  let currentLine = ''
  for (const word of nameWords) {
    const test = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(test).width > w - pad * 2) {
      if (currentLine) nameLines.push(currentLine)
      currentLine = word
    } else {
      currentLine = test
    }
  }
  if (currentLine) nameLines.push(currentLine)

  const nameLineH = isStory ? 66 : 52
  for (const line of nameLines) {
    ctx.fillText(line, w / 2, cursorY + nameLineH)
    cursorY += nameLineH
  }
  cursorY += 8

  /* ── brand ─────────────────────────────────────────────── */
  ctx.font = `${isStory ? 34 : 28}px "Archivo", sans-serif`
  ctx.fillStyle = TEXT_DIM
  ctx.fillText(perfume.brand, w / 2, cursorY + 34)
  cursorY += isStory ? 64 : 52

  /* ── accord badges ─────────────────────────────────────── */
  const accords = perfume.accords.slice(0, 6)
  if (accords.length > 0) {
    const badgeH = isStory ? 44 : 38
    const badgePadX = isStory ? 24 : 20
    const badgeGap = 12
    const badgeFont = `${isStory ? 22 : 18}px "Archivo", sans-serif`
    ctx.font = badgeFont

    // measure total width per row
    const badgeWidths = accords.map(
      (a) => ctx.measureText(a).width + badgePadX * 2,
    )

    // layout into rows
    const rows: { accord: string; w: number }[][] = []
    let row: { accord: string; w: number }[] = []
    let rowW = 0
    const maxRowW = w - pad * 2

    for (let i = 0; i < accords.length; i++) {
      const bw = badgeWidths[i]
      if (rowW + bw + (row.length ? badgeGap : 0) > maxRowW && row.length > 0) {
        rows.push(row)
        row = []
        rowW = 0
      }
      row.push({ accord: accords[i], w: bw })
      rowW += bw + (row.length > 1 ? badgeGap : 0)
    }
    if (row.length) rows.push(row)

    for (const r of rows) {
      const totalW = r.reduce((s, b) => s + b.w, 0) + (r.length - 1) * badgeGap
      let x = (w - totalW) / 2

      for (const badge of r) {
        const color = accordColor(badge.accord)

        // pill background
        ctx.save()
        roundRect(ctx, x, cursorY, badge.w, badgeH, badgeH / 2)
        ctx.fillStyle = color + '22'
        ctx.fill()
        ctx.strokeStyle = color + '66'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()

        // text
        ctx.font = badgeFont
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        ctx.fillText(badge.accord, x + badge.w / 2, cursorY + badgeH / 2 + (isStory ? 8 : 6))

        x += badge.w + badgeGap
      }

      cursorY += badgeH + 10
    }
  }

  /* ── branding footer ───────────────────────────────────── */
  const footerY = h - pad
  ctx.textAlign = 'center'

  // tagline
  ctx.font = `italic ${isStory ? 22 : 18}px "Archivo", sans-serif`
  ctx.fillStyle = TEXT_DIM
  ctx.fillText('Fragrance, finally in your language.', w / 2, footerY - (isStory ? 36 : 28))

  // wordmark
  ctx.font = `bold ${isStory ? 30 : 24}px "Archivo", sans-serif`
  ctx.fillStyle = BRAND_TEAL
  ctx.letterSpacing = '6px'
  ctx.fillText('SCENTESIA', w / 2, footerY)
  ctx.letterSpacing = '0px'

  // thin rule above branding
  ctx.beginPath()
  ctx.moveTo(w / 2 - 120, footerY - (isStory ? 60 : 48))
  ctx.lineTo(w / 2 + 120, footerY - (isStory ? 60 : 48))
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/* ── component ───────────────────────────────────────────── */

export default function ShareCard({ perfume, onClose }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [format, setFormat] = useState<CardFormat>('story')
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async () => {
    if (!canvasRef.current) return
    setGenerating(true)
    try {
      await drawCard(canvasRef.current, perfume, format)
    } catch (e) {
      console.error('ShareCard draw error:', e)
    }
    setGenerating(false)
  }, [perfume, format])

  useEffect(() => {
    generate()
  }, [generate])

  const getBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvasRef.current?.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/png',
      )
    })

  const fileName = `scentesia-${slugify(perfume.name)}.png`

  const handleDownload = async () => {
    try {
      const blob = await getBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download failed:', e)
    }
  }

  const handleShare = async () => {
    try {
      const blob = await getBlob()
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${perfume.name} by ${perfume.brand}`,
          text: `My ${Math.min(Math.round(perfume.match_score * 100), 100)}% match on Scentesia`,
        })
      } else {
        await handleDownload()
      }
    } catch (e) {
      // user cancelled share sheet — not an error
      if ((e as DOMException)?.name !== 'AbortError') {
        console.error('Share failed:', e)
        await handleDownload()
      }
    }
  }

  const { w, h } = FORMATS[format]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ position: 'fixed', zIndex: 60 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col items-center gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1820]/95 p-5 shadow-2xl backdrop-blur-md">
        {/* close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-white/40 transition hover:text-white"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        </button>

        {/* format selector */}
        <div className="flex gap-2">
          {(Object.keys(FORMATS) as CardFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
                format === f
                  ? 'bg-[#1e455b] text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {FORMATS[f].label}
            </button>
          ))}
        </div>

        {/* preview */}
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5">
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white/60">
              Generating...
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ aspectRatio: `${w} / ${h}` }}
          />
        </div>

        {/* actions */}
        <div className="flex w-full gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 rounded-xl bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Download
          </button>
          <button
            onClick={handleShare}
            className="flex-1 rounded-xl bg-[#1e455b] py-3 text-sm font-medium text-white transition hover:bg-[#245a73]"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  )
}
