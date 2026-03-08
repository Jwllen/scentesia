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

const LOGO_PATH = 'M43.8 375.4c-.2 0-1.1.3-1.3.4-.3 0-1 .3-1.3.4-.2.1-.9.4-1.1.5-.3.1-.9.5-1.1.6s-.9.5-1.1.7c-.2.1-.7.5-.9.7s-.8.6-.9.8l-.9.9c-.1.2-.6.7-.8.9-.1.2-.5.8-.7 1-.1.2-.5.8-.6 1-.2.2-.5.9-.6 1.1s-.5.9-.6 1.2c-.1.2-.4.9-.4 1.1-.1.3-.4 1-.5 1.3 0 .2-.3 1-.3 1.2-.1.3-.3 1-.3 1.3-.1.3-.3 1.1-.3 1.3 0 .3-.2 1.1-.2 1.4s-.1 1.1-.1 1.4c-.1.2-.1 1.1-.1 1.4-.1.2-.1 1.1-.1 1.4v1.4c0 .3.1 1.2.1 1.4 0 .3.1 1.2.1 1.5s.1 1.2.1 1.4c.1.3.2 1.2.2 1.5.1.3.2 1.2.3 1.5 0 .2.2 1.1.3 1.4s.3 1.2.3 1.4c.1.3.3 1.2.4 1.5s.4 1.1.4 1.4c.1.3.4 1.1.5 1.4s.4 1.1.5 1.4c.1.2.5 1 .6 1.3s.5 1.1.6 1.3c.1.3.5 1.1.6 1.3.2.3.6 1 .7 1.3.1.2.6 1 .7 1.2.2.2.6.9.8 1.2.1.2.6.9.8 1.1.1.2.6.9.8 1.1s.7.8.9 1c.1.2.7.8.9 1 .1.2.7.8.9.9l.9.9c.2.2.8.6 1 .8s.9.6 1.1.7c.2.2.8.6 1 .7s.9.5 1.1.6.9.4 1.1.5.9.3 1.2.4c.2.1.9.3 1.1.4.3 0 1 .2 1.2.2.3.1 1 .2 1.3.2.2 0 1 .1 1.2.1h1.3c.2 0 1-.1 1.3-.2.2 0 1-.1 1.3-.2.3 0 1.1-.2 1.3-.3.3-.1 1.1-.3 1.4-.4s1.1-.4 1.4-.6c.2-.1 1.1-.4 1.3-.6.3-.1 1.1-.5 1.4-.7.3-.1 1.1-.6 1.4-.8.3-.1 1.1-.7 1.3-.9.3-.1 1.1-.7 1.4-.9s1.1-.8 1.3-1c.3-.2 1.1-.9 1.3-1.1.3-.2 1.1-.9 1.3-1.2.3-.2 1-.9 1.3-1.2.2-.2.9-1 1.2-1.2.2-.3.9-1.1 1.1-1.3.3-.3.9-1.1 1.1-1.4.2-.2.9-1.1 1.1-1.3l1-1.5c.2-.3.7-1.1.9-1.4s.7-1.2.9-1.5c.1-.3.6-1.2.7-1.5.2-.3.6-1.2.7-1.5.2-.3.6-1.2.7-1.5s.4-1.2.5-1.6c.1-.3.3-1.2.4-1.5s.3-1.2.3-1.5c.1-.3.2-1.2.3-1.5 0-.3.1-1.3.1-1.6v-1.5c-.1-.2-.1-1.1-.2-1.4 0-.3-.2-1.2-.2-1.5-.1-.3-.3-1.1-.4-1.4s-.4-1.1-.5-1.4c-.2-.3-.6-1.1-.7-1.3-.1-.3-.6-1.1-.7-1.4-.2-.2-.7-1-.9-1.2-.2-.3-.8-1-1-1.3-.2-.2-.8-1-1-1.2-.3-.2-1-.9-1.2-1.2-.2-.2-1-.8-1.2-1.1-.3-.2-1.1-.8-1.3-1-.3-.2-1.1-.9-1.4-1.1s-1.1-.7-1.4-.9-1.2-.8-1.5-.9c-.3-.2-1.2-.7-1.5-.9-.4-.2-1.3-.6-1.6-.8s-1.3-.6-1.6-.7c-.4-.2-1.3-.6-1.7-.7-.3-.2-1.3-.5-1.6-.7-.4-.1-1.4-.4-1.7-.5s-1.3-.4-1.7-.5c-.3-.1-1.3-.4-1.6-.4-.4-.1-1.4-.3-1.7-.4-.3 0-1.3-.2-1.6-.3-.4 0-1.4-.1-1.7-.2-.3 0-1.3-.1-1.6-.1s-1.2-.1-1.6-.1H48c-.3.1-1.2.1-1.5.1-.3.1-1.1.2-1.4.2-.3.1-1.2.3-1.3.3-.2 0 .1 0 0 0m98.9-7.6c-.2.1-1.6.3-2 .3-.4.1-1.5.4-1.9.5s-1.5.4-1.9.5-1.5.5-1.9.7c-.3.1-1.4.6-1.8.8-.4.1-1.4.6-1.8.8-.3.2-1.4.8-1.7 1-.4.2-1.4.8-1.7 1.1-.4.2-1.4.9-1.7 1.1s-1.3 1-1.6 1.2c-.3.3-1.3 1.1-1.6 1.3-.3.3-1.2 1.1-1.5 1.4-.2.3-1.1 1.2-1.4 1.4-.3.3-1.1 1.2-1.3 1.5-.3.3-1.1 1.3-1.3 1.6-.3.3-1 1.3-1.2 1.6-.3.3-1 1.3-1.2 1.6s-.8 1.4-1 1.7-.8 1.4-1 1.7-.7 1.4-.9 1.7c-.2.4-.6 1.4-.8 1.8-.1.3-.6 1.4-.7 1.7-.1.4-.5 1.5-.6 1.8-.1.4-.4 1.4-.5 1.8s-.3 1.4-.3 1.8c-.1.3-.3 1.4-.3 1.7-.1.4-.2 1.5-.2 1.8v1.7c0 .4 0 1.4.1 1.8 0 .3.1 1.3.2 1.7 0 .3.2 1.3.3 1.6s.4 1.3.5 1.6.4 1.3.6 1.6c.1.3.5 1.2.6 1.6.2.3.7 1.2.8 1.4l1 1.5c.1.3.8 1.1 1 1.4s.8 1.1 1.1 1.4c.2.2.9 1 1.2 1.3l1.2 1.2c.3.3 1.1 1 1.4 1.2.3.3 1.1.9 1.4 1.2.3.2 1.2.8 1.5 1.1.3.2 1.3.8 1.6 1s1.3.7 1.6.9c.4.2 1.4.7 1.7.9.4.2 1.4.7 1.8.8.3.2 1.4.7 1.7.8.4.1 1.5.5 1.9.7l1.8.6c.4.1 1.5.4 1.9.5s1.6.4 1.9.5c.4 0 1.6.3 2 .3.4.1 1.6.3 1.9.3.4.1 1.6.2 2 .2s1.6.1 2 .1 1.6.1 2 .1c.4-.1 1.6-.1 2-.1s1.5-.1 1.9-.2c.4 0 1.6-.2 2-.2.4-.1 1.6-.3 1.9-.4.4-.1 1.6-.3 2-.4s1.5-.4 1.9-.5c.4-.2 1.5-.5 1.8-.7.4-.1 1.5-.5 1.9-.7.4-.1 1.4-.6 1.8-.7.3-.2 1.4-.7 1.8-.9.3-.1 1.3-.7 1.7-.9.3-.2 1.3-.8 1.6-1 .4-.2 1.3-.8 1.7-1 .3-.2 1.2-.9 1.5-1.1s1.2-.9 1.5-1.2c.3-.2 1.2-1 1.5-1.2.2-.3 1.1-1 1.3-1.3.3-.2 1.1-1 1.3-1.3.3-.3 1-1.1 1.2-1.4.3-.3 1-1.1 1.2-1.4s.8-1.1 1-1.4l1-1.5c.2-.3.7-1.2.9-1.6.1-.3.6-1.2.7-1.5.2-.3.6-1.3.7-1.6s.5-1.3.6-1.6.3-1.3.4-1.6.3-1.3.3-1.6c.1-.4.2-1.4.3-1.7 0-.3.1-1.3.1-1.6 0-.4 0-1.4-.1-1.7 0-.4-.1-1.4-.1-1.7-.1-.3-.2-1.3-.3-1.7-.1-.3-.3-1.3-.4-1.6-.1-.4-.4-1.4-.6-1.7-.1-.3-.5-1.3-.6-1.6-.2-.4-.6-1.4-.8-1.7s-.7-1.3-.9-1.6-.8-1.3-1-1.6-.9-1.2-1.1-1.5c-.2-.4-.9-1.3-1.2-1.6-.2-.3-1-1.2-1.2-1.5l-1.4-1.4-1.4-1.4c-.3-.3-1.2-1.1-1.5-1.4-.3-.2-1.3-1-1.6-1.3-.3-.2-1.3-.9-1.6-1.2-.4-.2-1.4-.9-1.7-1.2-.4-.2-1.4-.8-1.8-1.1-.3-.2-1.4-.8-1.8-1-.3-.2-1.4-.8-1.8-.9-.4-.2-1.5-.7-1.9-.9s-1.5-.6-1.9-.8c-.4-.1-1.5-.6-1.9-.7s-1.6-.5-2-.6-1.5-.4-1.9-.5-1.6-.3-2-.4-1.6-.2-2-.3c-.4 0-1.6-.1-2-.2h-4c-.4.1-1.7.2-1.9.2s.2 0 0 0'

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  const scale = size / 465
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = BRAND_TEAL
  const path = new Path2D(LOGO_PATH)
  ctx.fill(path)
  ctx.restore()
}

function getPerfumeImageUrl(url?: string): string | null {
  if (!url) return null
  const match = url.match(/(\d+)\.html$/)
  if (!match) return null
  return `https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${match[1]}.webp`
}

function accordColor(name: string): string {
  const n = name.toLowerCase()
  if (/citrus|lemon|bergamot|orange|grapefruit|lime|mandarin/.test(n)) return '#d4a020'
  if (/floral|rose|jasmine|lily|iris|violet|peony|tuberose/.test(n)) return '#c05878'
  if (/woody|cedar|sandalwood|oud|vetiver|patchouli|oak/.test(n)) return '#8a6030'
  if (/spicy|cinnamon|pepper|saffron|cardamom|clove/.test(n)) return '#b84820'
  if (/fresh|aquatic|marine|ozonic|green|herbal/.test(n)) return '#389868'
  if (/sweet|vanilla|caramel|honey|sugar|chocolate/.test(n)) return '#b480a0'
  if (/musky|musk|amber|powdery/.test(n)) return '#a08868'
  if (/leather|smoky|tobacco/.test(n)) return '#685040'
  if (/fruity|berry|apple|peach|plum/.test(n)) return '#c06848'
  return '#5888a0'
}

/* ── mosaic layout ───────────────────────────────────────── */

interface MosaicCell { x: number; y: number; w: number; h: number }

function computeMosaic(
  count: number,
  areaX: number, areaY: number, areaW: number, areaH: number,
): MosaicCell[] {
  if (count === 0) return []

  const gap = 10
  const overlap = 14

  if (count === 1) {
    return [{ x: areaX, y: areaY, w: areaW, h: areaH }]
  }

  if (count === 2) {
    const cellW = (areaW - gap) / 2
    return [
      { x: areaX, y: areaY, w: cellW, h: areaH },
      { x: areaX + cellW + gap, y: areaY + 30, w: cellW, h: areaH - 30 },
    ]
  }

  if (count === 3) {
    const leftW = areaW * 0.52
    const rightW = areaW - leftW - gap
    const rightH = (areaH - gap) / 2
    return [
      { x: areaX, y: areaY + 16, w: leftW, h: areaH - 16 },
      { x: areaX + leftW + gap, y: areaY, w: rightW, h: rightH + overlap },
      { x: areaX + leftW + gap, y: areaY + rightH + gap - overlap, w: rightW, h: rightH + overlap },
    ]
  }

  if (count === 4) {
    const cellW = (areaW - gap) / 2
    const cellH = (areaH - gap) / 2
    return [
      { x: areaX, y: areaY, w: cellW, h: cellH + overlap },
      { x: areaX + cellW + gap, y: areaY + 24, w: cellW, h: cellH + overlap - 24 },
      { x: areaX, y: areaY + cellH + gap - overlap + 8, w: cellW, h: cellH + overlap - 8 },
      { x: areaX + cellW + gap, y: areaY + cellH + gap - overlap - 16, w: cellW, h: cellH + overlap + 16 },
    ]
  }

  // 5-6: three columns, staggered
  const cols = 3
  const colW = (areaW - gap * (cols - 1)) / cols
  const cells: MosaicCell[] = []
  const offsets = [0, 28, 12]
  const heights = count === 5
    ? [[0.55, 0.50], [0.45, 0.60], [0.52]]
    : [[0.50, 0.55], [0.45, 0.58], [0.52, 0.52]]

  for (let col = 0; col < cols; col++) {
    const colX = areaX + col * (colW + gap)
    let cy = areaY + offsets[col]
    for (let row = 0; row < heights[col].length && cells.length < count; row++) {
      const cellH = areaH * heights[col][row]
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

  // ─── BACKGROUND (dark, like holding a slab) ──────────────
  ctx.fillStyle = BG_DARK
  ctx.fillRect(0, 0, W, H)

  // Subtle noise
  for (let i = 0; i < 12000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.012})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
  }

  // ─── SLAB OUTER CASING ───────────────────────────────────
  const slabX = 50
  const slabY = 80
  const slabW = W - 100
  const slabH = H - 160
  const slabR = 20

  // Slab fill — subtle frosted plastic look
  const slabGrad = ctx.createLinearGradient(slabX, slabY, slabX, slabY + slabH)
  slabGrad.addColorStop(0, SLAB_FILL_TOP)
  slabGrad.addColorStop(1, SLAB_FILL_BOT)
  roundRect(ctx, slabX, slabY, slabW, slabH, slabR)
  ctx.fillStyle = slabGrad
  ctx.fill()

  // Slab outer border
  const slabBorder = ctx.createLinearGradient(slabX, slabY, slabX + slabW, slabY + slabH)
  slabBorder.addColorStop(0, 'rgba(255,255,255,0.18)')
  slabBorder.addColorStop(0.5, 'rgba(255,255,255,0.08)')
  slabBorder.addColorStop(1, 'rgba(255,255,255,0.12)')
  roundRect(ctx, slabX, slabY, slabW, slabH, slabR)
  ctx.strokeStyle = slabBorder
  ctx.lineWidth = 2
  ctx.stroke()

  // Inner edge for depth (plastic thickness illusion)
  roundRect(ctx, slabX + 5, slabY + 5, slabW - 10, slabH - 10, slabR - 3)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Top-left light catch (diagonal highlight)
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

  // ─── GRADING LABEL (cream panel at top of slab) ──────────
  const labelX = slabX + 28
  const labelY = slabY + 28
  const labelW = slabW - 56
  const labelH = 300
  const labelR = 10

  // Label background
  const labelGrad = ctx.createLinearGradient(labelX, labelY, labelX, labelY + labelH)
  labelGrad.addColorStop(0, LABEL_BG_TOP)
  labelGrad.addColorStop(1, LABEL_BG_BOT)
  roundRect(ctx, labelX, labelY, labelW, labelH, labelR)
  ctx.fillStyle = labelGrad
  ctx.fill()

  // Label border
  roundRect(ctx, labelX, labelY, labelW, labelH, labelR)
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Label top section: Logo + Perfume info ──
  const lPad = 24 // inner padding
  const lx = labelX + lPad
  const ly = labelY + lPad

  // Scentesia logo mark (top-left)
  drawLogo(ctx, lx, ly - 4, 56)

  // "SCENTESIA" wordmark right of logo
  ctx.textAlign = 'left'
  ctx.font = `700 22px "Archivo", sans-serif`
  ctx.fillStyle = BRAND_TEAL
  ctx.letterSpacing = '5px'
  ctx.fillText('SCENTESIA', lx + 62, ly + 20)
  ctx.letterSpacing = '0px'

  // "VIBE MATCHED" below wordmark
  ctx.font = `500 16px "Archivo", sans-serif`
  ctx.fillStyle = LABEL_DIM
  ctx.letterSpacing = '3px'
  ctx.fillText('VIBE MATCHED', lx + 62, ly + 42)
  ctx.letterSpacing = '0px'

  // Perfume name (right-aligned, large)
  const displayName = formatName(perfume.name)
  const rx = labelX + labelW - lPad
  ctx.textAlign = 'right'
  ctx.font = `700 26px "Archivo", sans-serif`
  ctx.fillStyle = LABEL_TEXT

  // Word-wrap name to max ~500px
  const nameMaxW = labelW * 0.58
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

  nameLines.forEach((line, i) => {
    ctx.fillText(line, rx, ly + 18 + i * 30)
  })

  // Brand below name
  ctx.font = `400 18px "Archivo", sans-serif`
  ctx.fillStyle = LABEL_DIM
  ctx.fillText(formatName(perfume.brand).toUpperCase(), rx, ly + 18 + nameLines.length * 30 + 6)

  // ── Divider line ──
  const dividerY = labelY + 100
  ctx.beginPath()
  ctx.moveTo(lx, dividerY)
  ctx.lineTo(labelX + labelW - lPad, dividerY)
  ctx.strokeStyle = LABEL_RULE
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Label bottom section: Accords left/center + BIG score right ──
  const bottomY = dividerY + 20

  // Logo mark (far left of bottom section)
  drawLogo(ctx, lx, bottomY - 2, 44)

  // "GRADING" below logo
  ctx.textAlign = 'left'
  ctx.font = `500 14px "Archivo", sans-serif`
  ctx.fillStyle = LABEL_DIM
  ctx.letterSpacing = '2px'
  ctx.fillText('GRADING', lx + 2, bottomY + 50)
  ctx.letterSpacing = '0px'

  // Accords in 2-column grid (center area)
  const accords = perfume.matched_accords.length > 0
    ? perfume.matched_accords.slice(0, 4)
    : perfume.accords.slice(0, 4)
  const accordStartX = lx + 140
  const accordColW = 190
  const accordRowH = 28

  ctx.font = `500 18px "Archivo", sans-serif`
  accords.forEach((accord, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const ax = accordStartX + col * accordColW
    const ay = bottomY + 8 + row * accordRowH

    // Colored dot
    const color = accordColor(accord)
    ctx.beginPath()
    ctx.arc(ax, ay + 7, 4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Accord name
    ctx.textAlign = 'left'
    ctx.fillStyle = LABEL_TEXT
    ctx.font = `500 18px "Archivo", sans-serif`
    ctx.fillText(accord, ax + 14, ay + 12)
  })

  // BIG score number (far right)
  const scoreNum = Math.min(perfume.match_score, 100)
  ctx.textAlign = 'right'
  ctx.font = `800 100px "Archivo", sans-serif`
  ctx.fillStyle = LABEL_TEXT
  ctx.fillText(`${scoreNum}`, rx, bottomY + 88)

  // "MATCH" below score
  ctx.font = `600 18px "Archivo", sans-serif`
  ctx.fillStyle = LABEL_DIM
  ctx.letterSpacing = '4px'
  ctx.fillText('MATCH', rx, bottomY + 112)
  ctx.letterSpacing = '0px'

  // Small gold accent bar under the score
  const scoreTextW = ctx.measureText(`${scoreNum}`).width
  ctx.font = `800 100px "Archivo", sans-serif`
  const bigScoreW = ctx.measureText(`${scoreNum}`).width
  ctx.fillStyle = ACCENT_GOLD
  ctx.fillRect(rx - bigScoreW - 4, bottomY + 94, bigScoreW + 8, 3)

  // ─── CARD AREA (the "card" inside the slab) ──────────────
  const cardX = slabX + 28
  const cardY = labelY + labelH + 24
  const cardW = slabW - 56
  const cardH = slabH - labelH - 28 - 24 - 60 // leave room for footer
  const cardR = 10

  // Card background (dark, like the card stock)
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.fillStyle = '#080c12'
  ctx.fill()

  // Card inner border
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Vibe mosaic fills the card ──
  const mosaicPad = 8
  const mosaicX = cardX + mosaicPad
  const mosaicY = cardY + mosaicPad
  const mosaicW = cardW - mosaicPad * 2
  const mosaicH = cardH * 0.65

  let hasMosaic = false

  try {
    const raw = typeof window !== 'undefined'
      ? sessionStorage.getItem('scentesia_vibe_images')
      : null
    if (raw) {
      const urls: string[] = JSON.parse(raw)
      console.log('[ShareCard] Vibe images found:', urls.length)
      const imgCount = Math.min(urls.length, 6)
      const cells = computeMosaic(imgCount, mosaicX, mosaicY, mosaicW, mosaicH)

      const images = await Promise.allSettled(
        urls.slice(0, imgCount).map((u) => {
          const src = u.startsWith('/') || u.startsWith('data:')
            ? u
            : `/api/proxy-image?url=${encodeURIComponent(u)}`
          return loadImage(src)
        }),
      )

      let loadedCount = 0
      images.forEach((result, i) => {
        if (result.status === 'rejected') console.warn('[ShareCard] Image failed:', result.reason)
        if (result.status !== 'fulfilled' || !cells[i]) return
        loadedCount++
        const img = result.value
        const cell = cells[i]

        ctx.save()
        roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 12)
        ctx.clip()

        // Cover-fit
        const scale = Math.max(cell.w / img.width, cell.h / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        ctx.drawImage(img, cell.x - (sw - cell.w) / 2, cell.y - (sh - cell.h) / 2, sw, sh)

        // Subtle dark overlay
        ctx.fillStyle = 'rgba(0,0,0,0.10)'
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
        ctx.restore()

        // Glass border on each cell
        ctx.save()
        roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 12)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      })

      if (loadedCount > 0) {
        hasMosaic = true
        // Vignette at bottom of mosaic → dark card bg
        const vig = ctx.createLinearGradient(0, mosaicY + mosaicH * 0.6, 0, mosaicY + mosaicH + 40)
        vig.addColorStop(0, 'rgba(8,12,18,0)')
        vig.addColorStop(0.6, 'rgba(8,12,18,0.7)')
        vig.addColorStop(1, 'rgba(8,12,18,1)')
        ctx.fillStyle = vig
        ctx.fillRect(cardX, mosaicY + mosaicH * 0.6, cardW, mosaicH * 0.4 + 40)
      }
    }
  } catch (err) { console.warn('[ShareCard] Mosaic error:', err) }

  // ── Bottle image ──
  const bottleZoneY = hasMosaic ? mosaicY + mosaicH - 60 : cardY + 40
  const bottleMaxH = hasMosaic ? cardH * 0.38 : cardH * 0.50

  // Radial glow behind bottle
  const glowCenterY = bottleZoneY + bottleMaxH * 0.5
  const bottleGlow = ctx.createRadialGradient(
    cardX + cardW / 2, glowCenterY, 10,
    cardX + cardW / 2, glowCenterY, 240,
  )
  bottleGlow.addColorStop(0, 'rgba(30,69,91,0.15)')
  bottleGlow.addColorStop(0.5, 'rgba(30,69,91,0.05)')
  bottleGlow.addColorStop(1, 'rgba(30,69,91,0)')
  ctx.save()
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.clip()
  ctx.fillStyle = bottleGlow
  ctx.fillRect(cardX, bottleZoneY - 40, cardW, bottleMaxH + 80)
  ctx.restore()

  const bottleImgUrl = getPerfumeImageUrl(perfume.url)
  let bottleEndY = bottleZoneY + bottleMaxH
  if (bottleImgUrl) {
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(bottleImgUrl)}`
      const bottleImg = await loadImage(proxyUrl)
      const aspect = bottleImg.width / bottleImg.height
      let bw = bottleMaxH * aspect
      let bh = bottleMaxH
      if (bw > cardW - 80) {
        bw = cardW - 80
        bh = bw / aspect
      }
      const bx = cardX + (cardW - bw) / 2
      ctx.save()
      roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
      ctx.clip()
      ctx.drawImage(bottleImg, bx, bottleZoneY, bw, bh)
      ctx.restore()
      bottleEndY = bottleZoneY + bh
    } catch (err) {
      console.warn('[ShareCard] Bottle load failed:', err)
    }
  }

  // ── Perfume name + brand inside card (below bottle) ──
  const textStartY = bottleEndY + 24

  ctx.save()
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.clip()

  // Perfume name
  ctx.textAlign = 'center'
  ctx.font = `700 42px "Archivo", sans-serif`
  ctx.fillStyle = '#f0f0f0'

  const cardNameMaxW = cardW - 60
  const cardNameWords = displayName.split(' ')
  const cardNameLines: string[] = []
  let cardCurLine = ''
  for (const word of cardNameWords) {
    const test = cardCurLine ? `${cardCurLine} ${word}` : word
    if (ctx.measureText(test).width > cardNameMaxW) {
      if (cardCurLine) cardNameLines.push(cardCurLine)
      cardCurLine = word
    } else {
      cardCurLine = test
    }
  }
  if (cardCurLine) cardNameLines.push(cardCurLine)

  let textY = textStartY
  cardNameLines.forEach(line => {
    ctx.fillText(line, cardX + cardW / 2, textY + 42)
    textY += 48
  })

  // Brand
  ctx.font = `300 24px "Archivo", sans-serif`
  ctx.fillStyle = '#8a9aaa'
  ctx.letterSpacing = '6px'
  ctx.fillText(formatName(perfume.brand).toUpperCase(), cardX + cardW / 2, textY + 30)
  ctx.letterSpacing = '0px'
  textY += 50

  // Accord pills row
  const cardAccords = perfume.accords.slice(0, 5)
  if (cardAccords.length > 0) {
    const pillH = 34
    const pillPadX = 18
    const pillGap = 8
    const pillFont = `500 16px "Archivo", sans-serif`
    ctx.font = pillFont
    const pillWidths = cardAccords.map(a => ctx.measureText(a).width + pillPadX * 2)
    const totalPillW = pillWidths.reduce((s, w) => s + w, 0) + (cardAccords.length - 1) * pillGap
    let px = cardX + (cardW - totalPillW) / 2

    cardAccords.forEach((accord, i) => {
      const pw = pillWidths[i]
      const color = accordColor(accord)

      roundRect(ctx, px, textY, pw, pillH, pillH / 2)
      ctx.fillStyle = color + '20'
      ctx.fill()
      roundRect(ctx, px, textY, pw, pillH, pillH / 2)
      ctx.strokeStyle = color + '50'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.font = pillFont
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(accord, px + pw / 2, textY + pillH / 2 + 5.5)

      px += pw + pillGap
    })
  }

  ctx.restore()

  // ─── FOOTER (inside slab, below card) ─────────────────────
  const footerY = slabY + slabH - 36
  ctx.textAlign = 'center'
  ctx.font = `italic 18px "Archivo", sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  ctx.fillText('Fragrance, finally in your language.', W / 2, footerY)
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
        className="relative flex max-h-[90vh] w-full max-w-md flex-col items-center gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1820]/95 p-5 shadow-2xl backdrop-blur-md"
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
