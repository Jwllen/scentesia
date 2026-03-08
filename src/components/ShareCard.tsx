'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PerfumeRecommendation } from '@/types'

interface ShareCardProps {
  perfume: PerfumeRecommendation
  onClose: () => void
}

const W = 1080
const H = 1920

const BRAND_TEAL = '#1e455b'
const BG_DARK = '#0a1018'
const BG_MID = '#0d1820'
const ACCENT_GOLD = '#c9a84c'
const ACCENT_GOLD_DIM = '#a08038'
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

function getPerfumeImageUrl(url?: string): string | null {
  if (!url) return null
  const match = url.match(/(\d+)\.html$/)
  if (!match) return null
  return `https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${match[1]}.webp`
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

/* ── mosaic layout ───────────────────────────────────────── */

interface MosaicCell {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Pinterest-style staggered mosaic with slight overlaps.
 * Returns cell positions for up to 6 images within a given area.
 */
function computeMosaic(count: number, areaW: number, areaH: number, pad: number): MosaicCell[] {
  if (count === 0) return []

  const gap = 12
  const overlap = 16 // slight overlap between cells
  const radius = 18

  if (count === 1) {
    // Single hero image, centered with padding
    return [{ x: pad, y: pad, w: areaW - pad * 2, h: areaH - pad * 2 }]
  }

  if (count === 2) {
    const cellW = (areaW - pad * 2 - gap) / 2
    return [
      { x: pad, y: pad, w: cellW, h: areaH - pad * 2 },
      { x: pad + cellW + gap, y: pad + 40, w: cellW, h: areaH - pad * 2 - 40 },
    ]
  }

  if (count === 3) {
    // Left tall + right two stacked, staggered
    const leftW = (areaW - pad * 2) * 0.52
    const rightW = areaW - pad * 2 - leftW - gap
    const rightH = (areaH - pad * 2 - gap) / 2
    return [
      { x: pad, y: pad + 20, w: leftW, h: areaH - pad * 2 - 20 },
      { x: pad + leftW + gap, y: pad, w: rightW, h: rightH + overlap },
      { x: pad + leftW + gap, y: pad + rightH + gap - overlap, w: rightW, h: rightH + overlap },
    ]
  }

  if (count === 4) {
    // 2x2 grid with stagger
    const cellW = (areaW - pad * 2 - gap) / 2
    const cellH = (areaH - pad * 2 - gap) / 2
    return [
      { x: pad, y: pad, w: cellW, h: cellH + overlap },
      { x: pad + cellW + gap, y: pad + 30, w: cellW, h: cellH + overlap - 30 },
      { x: pad, y: pad + cellH + gap - overlap + 10, w: cellW, h: cellH + overlap - 10 },
      { x: pad + cellW + gap, y: pad + cellH + gap - overlap - 20, w: cellW, h: cellH + overlap + 20 },
    ]
  }

  // 5-6: three columns, staggered
  const cols = 3
  const colW = (areaW - pad * 2 - gap * (cols - 1)) / cols
  const cells: MosaicCell[] = []
  const offsets = [0, 36, 16] // stagger per column
  const heights = count === 5
    ? [[0.55, 0.50], [0.45, 0.60], [0.52]]
    : [[0.50, 0.55], [0.45, 0.58], [0.52, 0.52]]

  for (let col = 0; col < cols; col++) {
    const colX = pad + col * (colW + gap)
    let cy = pad + offsets[col]
    const colHeights = heights[col]
    for (let row = 0; row < colHeights.length && cells.length < count; row++) {
      const cellH = (areaH - pad * 2) * colHeights[row]
      cells.push({ x: colX, y: cy, w: colW, h: cellH })
      cy += cellH + gap - overlap
    }
  }

  return cells.slice(0, count)
}

/* ── canvas drawing ──────────────────────────────────────── */

async function drawCard(
  canvas: HTMLCanvasElement,
  perfume: PerfumeRecommendation,
) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const pad = 56

  // ─── Background gradient ────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, BG_MID)
  grad.addColorStop(0.45, BG_MID)
  grad.addColorStop(0.55, BG_DARK)
  grad.addColorStop(1, BG_DARK)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // ─── Subtle noise ──────────────────────────────────────
  for (let i = 0; i < 15000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.015})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
  }

  // ─── Holographic shimmer strip at top ───────────────────
  const shimmer = ctx.createLinearGradient(0, 0, W, 0)
  shimmer.addColorStop(0, 'rgba(30,69,91,0)')
  shimmer.addColorStop(0.3, 'rgba(30,69,91,0.08)')
  shimmer.addColorStop(0.5, 'rgba(201,168,76,0.12)')
  shimmer.addColorStop(0.7, 'rgba(30,69,91,0.08)')
  shimmer.addColorStop(1, 'rgba(30,69,91,0)')
  ctx.fillStyle = shimmer
  ctx.fillRect(0, 0, W, 4)

  // ─── Card border gradient (teal → gold) ─────────────────
  const borderGrad = ctx.createLinearGradient(0, 0, W, H)
  borderGrad.addColorStop(0, 'rgba(30,69,91,0.3)')
  borderGrad.addColorStop(0.5, 'rgba(201,168,76,0.2)')
  borderGrad.addColorStop(1, 'rgba(30,69,91,0.3)')
  ctx.strokeStyle = borderGrad
  ctx.lineWidth = 2
  roundRect(ctx, 1, 1, W - 2, H - 2, 32)
  ctx.stroke()

  // ─── Inner card border (glass within glass) ─────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  roundRect(ctx, 20, 20, W - 40, H - 40, 24)
  ctx.stroke()

  /* ── VIBE IMAGES MOSAIC (top ~50%) ─────────────────────── */
  const mosaicAreaH = H * 0.48
  const mosaicPad = 36

  try {
    const raw = typeof window !== 'undefined'
      ? sessionStorage.getItem('scentesia_vibe_images')
      : null
    if (raw) {
      const urls: string[] = JSON.parse(raw)
      const imgCount = Math.min(urls.length, 6)
      const cells = computeMosaic(imgCount, W, mosaicAreaH, mosaicPad)

      const images = await Promise.allSettled(
        urls.slice(0, imgCount).map((u) => {
          const src = u.startsWith('/') || u.startsWith('data:')
            ? u
            : `/api/proxy-image?url=${encodeURIComponent(u)}`
          return loadImage(src)
        }),
      )

      images.forEach((result, i) => {
        if (result.status !== 'fulfilled' || !cells[i]) return
        const img = result.value
        const cell = cells[i]
        const radius = 18

        ctx.save()
        roundRect(ctx, cell.x, cell.y, cell.w, cell.h, radius)
        ctx.clip()

        // Cover-fit
        const scale = Math.max(cell.w / img.width, cell.h / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        ctx.drawImage(
          img,
          cell.x - (sw - cell.w) / 2,
          cell.y - (sh - cell.h) / 2,
          sw, sh,
        )

        // Subtle dark overlay for depth
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h)

        ctx.restore()

        // Glass border on each image
        ctx.save()
        roundRect(ctx, cell.x, cell.y, cell.w, cell.h, radius)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      })

      // Heavy vignette fade from mosaic into dark bottom
      const vignette = ctx.createLinearGradient(0, mosaicAreaH * 0.65, 0, mosaicAreaH + 80)
      vignette.addColorStop(0, 'rgba(10,16,24,0)')
      vignette.addColorStop(0.5, 'rgba(10,16,24,0.7)')
      vignette.addColorStop(1, 'rgba(10,16,24,1)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, mosaicAreaH * 0.65, W, mosaicAreaH * 0.35 + 80)

      // Side vignettes for depth
      const leftVig = ctx.createLinearGradient(0, 0, 80, 0)
      leftVig.addColorStop(0, 'rgba(10,16,24,0.6)')
      leftVig.addColorStop(1, 'rgba(10,16,24,0)')
      ctx.fillStyle = leftVig
      ctx.fillRect(0, 0, 80, mosaicAreaH)

      const rightVig = ctx.createLinearGradient(W - 80, 0, W, 0)
      rightVig.addColorStop(0, 'rgba(10,16,24,0)')
      rightVig.addColorStop(1, 'rgba(10,16,24,0.6)')
      ctx.fillStyle = rightVig
      ctx.fillRect(W - 80, 0, 80, mosaicAreaH)
    }
  } catch { /* no vibe images — skip */ }

  /* ── BOTTLE IMAGE — emerges from the vibe ────────────── */
  let cursorY = mosaicAreaH - 40 // overlap into mosaic zone

  // Radial glow behind bottle
  const bottleGlow = ctx.createRadialGradient(W / 2, cursorY + 200, 20, W / 2, cursorY + 200, 280)
  bottleGlow.addColorStop(0, 'rgba(30,69,91,0.12)')
  bottleGlow.addColorStop(0.6, 'rgba(30,69,91,0.04)')
  bottleGlow.addColorStop(1, 'rgba(30,69,91,0)')
  ctx.fillStyle = bottleGlow
  ctx.fillRect(0, cursorY, W, 400)

  const bottleMaxH = 380
  const bottleImgUrl = getPerfumeImageUrl(perfume.url)
  if (bottleImgUrl) {
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(bottleImgUrl)}`
      const bottleImg = await loadImage(proxyUrl)
      const aspect = bottleImg.width / bottleImg.height
      let bw = bottleMaxH * aspect
      let bh = bottleMaxH
      if (bw > W - pad * 2) {
        bw = W - pad * 2
        bh = bw / aspect
      }
      const bx = (W - bw) / 2
      ctx.drawImage(bottleImg, bx, cursorY + 20, bw, bh)
      cursorY += bh + 50
    } catch {
      cursorY += 60
    }
  } else {
    cursorY += 60
  }

  /* ── MATCH SCORE — large editorial gold number ─────────── */
  const scoreNum = Math.min(perfume.match_score, 100)

  // Large number
  ctx.textAlign = 'center'
  ctx.font = `bold 96px "Archivo", sans-serif`
  ctx.fillStyle = ACCENT_GOLD
  ctx.fillText(`${scoreNum}`, W / 2 - 30, cursorY + 80)

  // "% match" beside it, smaller
  ctx.font = `300 32px "Archivo", sans-serif`
  ctx.fillStyle = ACCENT_GOLD_DIM
  const numWidth = ctx.measureText(`${scoreNum}`).width
  // Reset font to measure the number width at the large size
  ctx.font = `bold 96px "Archivo", sans-serif`
  const bigNumW = ctx.measureText(`${scoreNum}`).width
  ctx.font = `300 32px "Archivo", sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('% match', W / 2 - 30 + bigNumW / 2 + 8, cursorY + 80)

  cursorY += 120

  /* ── PERFUME NAME — editorial Archivo expanded ─────────── */
  ctx.textAlign = 'center'
  ctx.font = `bold 54px "Archivo", sans-serif`
  ctx.fillStyle = TEXT_WHITE

  // Word-wrap
  const nameWords = perfume.name.split(' ')
  const nameLines: string[] = []
  let currentLine = ''
  for (const word of nameWords) {
    const test = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(test).width > W - pad * 2 - 40) {
      if (currentLine) nameLines.push(currentLine)
      currentLine = word
    } else {
      currentLine = test
    }
  }
  if (currentLine) nameLines.push(currentLine)

  const nameLineH = 64
  for (const line of nameLines) {
    ctx.fillText(line, W / 2, cursorY + nameLineH)
    cursorY += nameLineH
  }
  cursorY += 12

  /* ── BRAND — tracked uppercase ─────────────────────────── */
  ctx.font = `300 30px "Archivo", sans-serif`
  ctx.fillStyle = TEXT_DIM
  ctx.letterSpacing = '8px'
  ctx.fillText(perfume.brand.toUpperCase(), W / 2, cursorY + 30)
  ctx.letterSpacing = '0px'
  cursorY += 64

  /* ── ACCORD BADGES — glass pills ───────────────────────── */
  const accords = perfume.accords.slice(0, 6)
  if (accords.length > 0) {
    const badgeH = 42
    const badgePadX = 22
    const badgeGap = 10
    const badgeFont = `500 20px "Archivo", sans-serif`
    ctx.font = badgeFont

    const badgeWidths = accords.map(a => ctx.measureText(a).width + badgePadX * 2)

    // Layout into rows
    const rows: { accord: string; w: number }[][] = []
    let row: { accord: string; w: number }[] = []
    let rowW = 0
    const maxRowW = W - pad * 2

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
      let x = (W - totalW) / 2

      for (const badge of r) {
        const color = accordColor(badge.accord)

        // Glass pill background
        ctx.save()
        roundRect(ctx, x, cursorY, badge.w, badgeH, badgeH / 2)
        ctx.fillStyle = color + '18'
        ctx.fill()
        ctx.strokeStyle = color + '44'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()

        // Text
        ctx.font = badgeFont
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        ctx.fillText(badge.accord, x + badge.w / 2, cursorY + badgeH / 2 + 7)

        x += badge.w + badgeGap
      }

      cursorY += badgeH + 10
    }
  }

  /* ── DIVIDER — thin glass line ─────────────────────────── */
  const divY = H - 160
  const divGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0)
  divGrad.addColorStop(0, 'rgba(255,255,255,0)')
  divGrad.addColorStop(0.3, 'rgba(255,255,255,0.06)')
  divGrad.addColorStop(0.5, 'rgba(201,168,76,0.1)')
  divGrad.addColorStop(0.7, 'rgba(255,255,255,0.06)')
  divGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.moveTo(W * 0.15, divY)
  ctx.lineTo(W * 0.85, divY)
  ctx.strokeStyle = divGrad
  ctx.lineWidth = 1
  ctx.stroke()

  /* ── FOOTER — tagline + wordmark ───────────────────────── */
  const footerY = H - pad - 10
  ctx.textAlign = 'center'

  // Tagline
  ctx.font = `italic 22px "Archivo", sans-serif`
  ctx.fillStyle = TEXT_DIM
  ctx.fillText('Fragrance, finally in your language.', W / 2, footerY - 40)

  // Wordmark
  ctx.font = `600 28px "Archivo", sans-serif`
  ctx.fillStyle = BRAND_TEAL
  ctx.letterSpacing = '7px'
  ctx.fillText('SCENTESIA', W / 2, footerY)
  ctx.letterSpacing = '0px'

  // Bottom shimmer
  const bottomShimmer = ctx.createLinearGradient(0, H - 4, W, H - 4)
  bottomShimmer.addColorStop(0, 'rgba(30,69,91,0)')
  bottomShimmer.addColorStop(0.3, 'rgba(30,69,91,0.06)')
  bottomShimmer.addColorStop(0.5, 'rgba(201,168,76,0.1)')
  bottomShimmer.addColorStop(0.7, 'rgba(30,69,91,0.06)')
  bottomShimmer.addColorStop(1, 'rgba(30,69,91,0)')
  ctx.fillStyle = bottomShimmer
  ctx.fillRect(0, H - 3, W, 3)
}

/* ── component ───────────────────────────────────────────── */

export default function ShareCard({ perfume, onClose }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async () => {
    if (!canvasRef.current) return
    setGenerating(true)
    try {
      await drawCard(canvasRef.current, perfume)
    } catch (e) {
      console.error('ShareCard draw error:', e)
    }
    setGenerating(false)
  }, [perfume])

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
          text: `My ${Math.min(perfume.match_score, 100)}% match on Scentesia`,
        })
      } else {
        await handleDownload()
      }
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') {
        console.error('Share failed:', e)
        await handleDownload()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ position: 'fixed', zIndex: 60 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col items-center gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1820]/95 p-5 shadow-2xl backdrop-blur-md">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 w-10 h-10 min-h-[44px] flex items-center justify-center text-white/40 transition hover:text-white rounded-full cursor-pointer"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        </button>

        {/* Preview */}
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5 mt-6">
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-base text-white/60">
              Generating...
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>

        {/* Actions */}
        <div className="flex w-full gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 rounded-xl bg-white/5 py-3 text-base font-medium text-white transition hover:bg-white/10 cursor-pointer min-h-[44px]"
          >
            Download
          </button>
          <button
            onClick={handleShare}
            className="flex-1 rounded-xl bg-[#1e455b] py-3 text-base font-medium text-white transition hover:bg-[#245a73] cursor-pointer min-h-[44px]"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  )
}
