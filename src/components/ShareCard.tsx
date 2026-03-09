'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PerfumeRecommendation } from '@/types'

interface ShareCardProps {
  perfume: PerfumeRecommendation
  onClose: () => void
}

const W = 1080
const H = 1920

const BG_DARK = '#0a1018'
const LABEL_BG_TOP = '#f5f2ed'
const LABEL_BG_BOT = '#ebe8e2'
const LABEL_TEXT = '#1a1a1a'
const LABEL_DIM = '#6b6b6b'
const LABEL_RULE = 'rgba(0,0,0,0.10)'
const ACCENT_GOLD = '#c9a84c'
const SLAB_FILL_TOP = 'rgba(160,175,190,0.10)'
const SLAB_FILL_BOT = 'rgba(120,135,150,0.06)'

/* ── helpers ─────────────────────────────────────────────── */

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function formatName(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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

/* ── staggered mosaic (9 images, Pinterest-style) ────────── */

interface MosaicCell { x: number; y: number; w: number; h: number }

function computeStaggeredMosaic(
  areaX: number, areaY: number, areaW: number, areaH: number,
): MosaicCell[] {
  const gap = 12
  const cols = 3
  const colW = (areaW - gap * (cols - 1)) / cols

  // Varying heights per column for organic Pinterest feel
  const colHeights = [
    [0.38, 0.30, 0.32],
    [0.30, 0.38, 0.32],
    [0.34, 0.32, 0.34],
  ]
  // Stagger offsets (masonry-style, like build page curated tab)
  const colOffsets = [0, -50, 25]

  const cells: MosaicCell[] = []
  for (let col = 0; col < cols; col++) {
    const cx = areaX + col * (colW + gap)
    let cy = areaY + colOffsets[col]
    for (let row = 0; row < 3; row++) {
      const cellH = areaH * colHeights[col][row]
      cells.push({ x: cx, y: cy, w: colW, h: cellH })
      cy += cellH + gap
    }
  }
  return cells
}

/* ── canvas drawing ──────────────────────────────────────── */

async function drawCard(
  canvas: HTMLCanvasElement,
  perfume: PerfumeRecommendation,
) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ─── BACKGROUND ──────────────────────────────────────────
  ctx.fillStyle = BG_DARK
  ctx.fillRect(0, 0, W, H)

  for (let i = 0; i < 12000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.012})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
  }

  // ─── SLAB OUTER CASING ───────────────────────────────────
  const slabX = 50
  const slabY = 50
  const slabW = W - 100
  const slabH = H - 100
  const slabR = 20

  const slabGrad = ctx.createLinearGradient(slabX, slabY, slabX, slabY + slabH)
  slabGrad.addColorStop(0, SLAB_FILL_TOP)
  slabGrad.addColorStop(1, SLAB_FILL_BOT)
  roundRect(ctx, slabX, slabY, slabW, slabH, slabR)
  ctx.fillStyle = slabGrad
  ctx.fill()

  const slabBorder = ctx.createLinearGradient(slabX, slabY, slabX + slabW, slabY + slabH)
  slabBorder.addColorStop(0, 'rgba(255,255,255,0.18)')
  slabBorder.addColorStop(0.5, 'rgba(255,255,255,0.08)')
  slabBorder.addColorStop(1, 'rgba(255,255,255,0.12)')
  roundRect(ctx, slabX, slabY, slabW, slabH, slabR)
  ctx.strokeStyle = slabBorder
  ctx.lineWidth = 2
  ctx.stroke()

  roundRect(ctx, slabX + 5, slabY + 5, slabW - 10, slabH - 10, slabR - 3)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.save()
  roundRect(ctx, slabX, slabY, slabW, slabH, slabR)
  ctx.clip()
  const lightCatch = ctx.createLinearGradient(slabX, slabY, slabX + 300, slabY + 300)
  lightCatch.addColorStop(0, 'rgba(255,255,255,0.08)')
  lightCatch.addColorStop(0.5, 'rgba(255,255,255,0.02)')
  lightCatch.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = lightCatch
  ctx.fillRect(slabX, slabY, 300, 300)
  ctx.restore()

  // ─── GRADING LABEL (cream panel) ─────────────────────────
  const labelPad = 24
  const labelX = slabX + labelPad
  const labelY = slabY + labelPad
  const labelW = slabW - labelPad * 2
  const labelR = 10
  const lPad = 24
  const lx = labelX + lPad
  const rx = labelX + labelW - lPad

  const topPad = 20
  const secGap = 14

  // ── Pre-measure perfume name ──
  ctx.font = '700 26px "Archivo", sans-serif'
  const displayName = formatName(perfume.name)
  const nameMaxW = labelW - lPad * 2
  const nameWords = displayName.split(' ')
  const nameLines: string[] = []
  let curLine = ''
  for (const word of nameWords) {
    const test = curLine ? `${curLine} ${word}` : word
    if (ctx.measureText(test).width > nameMaxW) {
      if (curLine) nameLines.push(curLine)
      curLine = word
    } else {
      curLine = test
    }
  }
  if (curLine) nameLines.push(curLine)

  // Section heights
  const row1H = 110  // logo+wordmark (left) + score (right)
  const nameBlockH = nameLines.length * 30
  const brandLineH = 24
  const row2H = nameBlockH + brandLineH + 4
  const row3H = 100  // notes only

  const labelH = topPad + row1H + secGap + row2H + secGap + row3H + topPad

  // ── Draw label background ──
  const labelGrad = ctx.createLinearGradient(labelX, labelY, labelX, labelY + labelH)
  labelGrad.addColorStop(0, LABEL_BG_TOP)
  labelGrad.addColorStop(1, LABEL_BG_BOT)
  roundRect(ctx, labelX, labelY, labelW, labelH, labelR)
  ctx.fillStyle = labelGrad
  ctx.fill()

  roundRect(ctx, labelX, labelY, labelW, labelH, labelR)
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  ctx.stroke()

  // ── ROW 1: Logo+wordmark (left) + Score (right) — same height ──
  let cy = labelY + topPad
  const row1Y = cy

  // Logo + "Scentesia" wordmark (left side)
  try {
    const logoImg = await loadImage('/scentesia-logo-black.svg')
    const logoH = 72
    const logoW = logoH * (454 / 465)
    // Center logo and wordmark vertically in row1
    const centerY = row1Y + row1H / 2
    const logoY = centerY - logoH / 2
    ctx.drawImage(logoImg, lx, logoY, logoW, logoH)

    // Wordmark — black, vertically centered with logo
    ctx.textAlign = 'left'
    ctx.font = '400 76px "Archivo", sans-serif'
    ctx.fillStyle = '#000000'
    ctx.letterSpacing = '14px'
    const capH = 76 * 0.72
    ctx.fillText('SCENTESIA', lx + logoW + 16, centerY + capH / 2)
    ctx.letterSpacing = '0px'
  } catch { /* skip */ }

  // Score (right side, vertically centered with logo+wordmark)
  const scoreNum = Math.min(perfume.match_score, 100)
  const scoreCenterY = row1Y + row1H / 2
  const scoreCapH = 76 * 0.72
  const scoreBaseline = scoreCenterY + scoreCapH / 2

  // Draw number
  ctx.textAlign = 'right'
  ctx.font = '800 76px "Archivo", sans-serif'
  ctx.fillStyle = '#000000'
  const numStr = `${scoreNum}`
  const pctFont = '700 38px "Archivo", sans-serif'
  // Measure % width to reserve space
  ctx.font = pctFont
  const pctW = ctx.measureText('%').width
  // Draw number right-aligned leaving room for %
  ctx.font = '800 76px "Archivo", sans-serif'
  ctx.fillText(numStr, rx - pctW, scoreBaseline)
  const numW = ctx.measureText(numStr).width

  // Draw % as superscript (smaller, raised)
  ctx.font = pctFont
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'left'
  ctx.fillText('%', rx - pctW, scoreCenterY - scoreCapH * 0.05)

  // Gold bar under full score
  const totalScoreW = numW + pctW
  ctx.fillStyle = ACCENT_GOLD
  ctx.fillRect(rx - totalScoreW - 4, scoreBaseline + 6, totalScoreW + 8, 3)

  // "MATCH" label
  ctx.textAlign = 'right'
  ctx.font = '600 14px "Archivo", sans-serif'
  ctx.fillStyle = LABEL_DIM
  ctx.letterSpacing = '4px'
  ctx.fillText('MATCH', rx, scoreBaseline + 24)
  ctx.letterSpacing = '0px'

  cy += row1H

  // ── DIVIDER 1 ──
  ctx.beginPath()
  ctx.moveTo(lx, cy)
  ctx.lineTo(rx, cy)
  ctx.strokeStyle = LABEL_RULE
  ctx.lineWidth = 1.5
  ctx.stroke()
  cy += secGap

  // ── ROW 2: Perfume name + brand ──
  ctx.textAlign = 'left'
  ctx.font = '700 26px "Archivo", sans-serif'
  ctx.fillStyle = LABEL_TEXT
  nameLines.forEach((line) => {
    ctx.fillText(line, lx, cy + 20)
    cy += 30
  })

  ctx.font = '400 16px "Archivo", sans-serif'
  ctx.fillStyle = LABEL_DIM
  ctx.fillText(formatName(perfume.brand).toUpperCase(), lx, cy + 14)
  cy += brandLineH + 4

  // ── DIVIDER 2 ──
  ctx.beginPath()
  ctx.moveTo(lx, cy)
  ctx.lineTo(rx, cy)
  ctx.strokeStyle = LABEL_RULE
  ctx.lineWidth = 1.5
  ctx.stroke()
  cy += secGap

  // ── ROW 3: Notes (TOP / HEART / BASE in 3 columns, full width) ──
  const notesY = cy
  const noteColW = (rx - lx) / 3
  const noteCategories = [
    { label: 'TOP', notes: perfume.top_notes },
    { label: 'HEART', notes: perfume.heart_notes },
    { label: 'BASE', notes: perfume.base_notes },
  ]

  noteCategories.forEach((cat, i) => {
    const colX = lx + i * noteColW

    ctx.textAlign = 'left'
    ctx.font = '600 12px "Archivo", sans-serif'
    ctx.fillStyle = LABEL_DIM
    ctx.letterSpacing = '2px'
    ctx.fillText(cat.label, colX + 2, notesY + 14)
    ctx.letterSpacing = '0px'

    ctx.font = '400 15px "Archivo", sans-serif'
    ctx.fillStyle = LABEL_TEXT
    const displayed = cat.notes.slice(0, 3)
    displayed.forEach((note, j) => {
      const maxNoteW = noteColW - 8
      let txt = note
      while (ctx.measureText(txt).width > maxNoteW && txt.length > 3) {
        txt = txt.slice(0, -1)
      }
      if (txt !== note) txt += '...'
      ctx.fillText(txt, colX + 2, notesY + 34 + j * 20)
    })
  })

  // ─── CARD AREA (mosaic fills entire card) ─────────────────
  const cardGap = 16
  const cardX = slabX + labelPad
  const cardY = labelY + labelH + cardGap
  const cardW = slabW - labelPad * 2
  const footerH = 44
  const cardH = slabY + slabH - labelPad - footerH - cardY
  const cardR = 10

  // Card background
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.fillStyle = '#080c12'
  ctx.fill()

  roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Staggered mosaic fills ENTIRE card ──
  let hasMosaic = false

  try {
    const raw = typeof window !== 'undefined'
      ? sessionStorage.getItem('scentesia_vibe_images')
      : null
    if (raw) {
      const urls: string[] = JSON.parse(raw)
      console.log('[ShareCard] Vibe images found:', urls.length)

      // 9 images, repeat if needed
      const imageUrls: string[] = []
      for (let i = 0; i < 9; i++) {
        imageUrls.push(urls[i % urls.length])
      }

      // Mosaic fills entire card
      const cells = computeStaggeredMosaic(cardX, cardY, cardW, cardH)

      const images = await Promise.allSettled(
        imageUrls.map((u) => {
          const src = u.startsWith('/') || u.startsWith('data:')
            ? u
            : `/api/proxy-image?url=${encodeURIComponent(u)}`
          return loadImage(src)
        }),
      )

      // Clip to card boundary — staggered cells that extend past edges get clipped naturally
      ctx.save()
      roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
      ctx.clip()

      let loadedCount = 0
      images.forEach((result, i) => {
        if (result.status !== 'fulfilled' || !cells[i]) return
        loadedCount++
        const img = result.value
        const cell = cells[i]

        ctx.save()
        const cellR = 16
        roundRect(ctx, cell.x, cell.y, cell.w, cell.h, cellR)
        ctx.clip()

        const scale = Math.max(cell.w / img.width, cell.h / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        ctx.drawImage(img, cell.x - (sw - cell.w) / 2, cell.y - (sh - cell.h) / 2, sw, sh)

        ctx.fillStyle = 'rgba(0,0,0,0.06)'
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
        ctx.restore()
      })

      if (loadedCount > 0) {
        hasMosaic = true
        // Strong vignette — starts earlier for deeper fade over bottle area
        const vig = ctx.createLinearGradient(0, cardY + cardH * 0.25, 0, cardY + cardH)
        vig.addColorStop(0, 'rgba(8,12,18,0)')
        vig.addColorStop(0.25, 'rgba(8,12,18,0.45)')
        vig.addColorStop(0.5, 'rgba(8,12,18,0.80)')
        vig.addColorStop(0.7, 'rgba(8,12,18,0.95)')
        vig.addColorStop(1, 'rgba(8,12,18,1)')
        ctx.fillStyle = vig
        ctx.fillRect(cardX, cardY + cardH * 0.25, cardW, cardH * 0.75)
      }

      ctx.restore()
    }
  } catch (err) { console.warn('[ShareCard] Mosaic error:', err) }

  // ── Bottle image (overlapping mosaic, centered in bottom half) ──
  const bottleZoneY = cardY + cardH * 0.42
  const bottleZoneEndY = cardY + cardH - 16
  const bottleMaxH = bottleZoneEndY - bottleZoneY

  // Glow
  const glowCY = bottleZoneY + bottleMaxH * 0.45
  const glow = ctx.createRadialGradient(
    cardX + cardW / 2, glowCY, 10,
    cardX + cardW / 2, glowCY, 300,
  )
  glow.addColorStop(0, 'rgba(30,69,91,0.20)')
  glow.addColorStop(0.5, 'rgba(30,69,91,0.06)')
  glow.addColorStop(1, 'rgba(30,69,91,0)')
  ctx.save()
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.clip()
  ctx.fillStyle = glow
  ctx.fillRect(cardX, bottleZoneY - 40, cardW, bottleMaxH + 80)
  ctx.restore()

  const bottleImgUrl = getPerfumeImageUrl(perfume.url)
  if (bottleImgUrl) {
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(bottleImgUrl)}`
      const bottleImg = await loadImage(proxyUrl)
      const aspect = bottleImg.width / bottleImg.height
      let bh = bottleMaxH
      let bw = bh * aspect
      if (bw > cardW * 0.6) {
        bw = cardW * 0.6
        bh = bw / aspect
      }
      const bx = cardX + (cardW - bw) / 2
      const by = bottleZoneY + (bottleMaxH - bh) / 2
      ctx.save()
      roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
      ctx.clip()
      ctx.drawImage(bottleImg, bx, by, bw, bh)
      ctx.restore()
    } catch (err) {
      console.warn('[ShareCard] Bottle load failed:', err)
    }
  }

  // ─── FOOTER ───────────────────────────────────────────────
  const footerY = slabY + slabH - labelPad - 10
  ctx.textAlign = 'center'
  ctx.font = 'italic 20px "Archivo", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('Fragrance, finally in your language. — Scentesia.com', W / 2, footerY)
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
          title: `${formatName(perfume.name)} by ${formatName(perfume.brand)}`,
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
      <div
        className="relative flex max-h-[92vh] w-full max-w-sm flex-col items-center gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1820]/95 p-4 shadow-2xl backdrop-blur-md"
        style={{ scrollbarWidth: 'none' }}
      >
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
        <div className="relative w-full shrink-0 overflow-hidden rounded-xl border border-white/5 mt-8">
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-base text-white/60">
              Generating...
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>

        {/* Social share buttons */}
        <div className="flex w-full gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-base font-medium text-white transition hover:bg-white/10 cursor-pointer min-h-[44px]"
            title="Download image"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Save
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] py-3 text-base font-medium text-white transition hover:brightness-110 cursor-pointer min-h-[44px]"
            title="Share to Instagram"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Instagram
          </button>
        </div>
        <div className="flex w-full gap-2 shrink-0">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#E60023] py-3 text-base font-medium text-white transition hover:bg-[#ad081b] cursor-pointer min-h-[44px]"
            title="Share to Pinterest"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
            </svg>
            Pinterest
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-black py-3 text-base font-medium text-white transition hover:bg-zinc-800 cursor-pointer min-h-[44px] border border-white/10"
            title="Share to TikTok"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.48a4.85 4.85 0 01-3.58-1.42V6.69h3.58z" />
            </svg>
            TikTok
          </button>
        </div>
      </div>
    </div>
  )
}
