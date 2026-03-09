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
        className="relative flex max-h-[92vh] w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1820]/95 p-4 shadow-2xl backdrop-blur-md"
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
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5 mt-8">
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-base text-white/60">
              Generating...
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            style={{ aspectRatio: `${W} / ${H}`, maxHeight: 'calc(92vh - 120px)' }}
          />
        </div>

        {/* Actions */}
        <div className="flex w-full gap-3 shrink-0">
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
