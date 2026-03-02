'use client'

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmbientParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  speed: number
  wanderAngle: number
  wanderSpeed: number
  teal: boolean
}

interface SprayParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  maxSize: number
  opacity: number
  life: number
  decay: number
}

// ─── Context ──────────────────────────────────────────────────────────────────

type MistContextType = { spray: (rect: DOMRect) => void }
const MistContext = createContext<MistContextType>({ spray: () => {} })
export const useMist = () => useContext(MistContext)

// ─── Constants ────────────────────────────────────────────────────────────────

const AMBIENT_COUNT = 400   // dense mist field
const REPEL_RADIUS  = 80    // px — elegant, close push
const REPEL_FORCE   = 1.4   // gentle displacement
const VELOCITY_CAP  = 2.2   // slow, gracious max speed
const DAMPING       = 0.94  // slow drift back — unhurried

// ─── Ambient particle factory ─────────────────────────────────────────────────

function makeAmbient(w: number, h: number): AmbientParticle {
  const isTeal = Math.random() < 0.7
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    size: Math.random() * 1.6 + 0.3,
    opacity: isTeal
      ? Math.random() * 0.5 + 0.3   // teal particles: 0.3–0.8
      : Math.random() * 0.15 + 0.1,  // white particles: 0.1–0.25
    speed: Math.random() * 0.08 + 0.02,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderSpeed: (Math.random() - 0.5) * 0.007,
    teal: isTeal,
  }
}

// ─── Atomiser spray factory ───────────────────────────────────────────────────
// Particles emit from the full perimeter of the clicked element, each one
// pointing outward from its edge — like the element exhales mist in all
// directions when pressed.

function makeEdgeParticle(
  x: number,
  y: number,
  baseAngle: number  // perpendicular outward angle for this edge
): SprayParticle {
  // Small spread around the edge's outward direction — mist, not laser
  const spread = (Math.random() - 0.5) * (Math.PI * 0.55)
  const angle  = baseAngle + spread
  const speed  = Math.random() * 2.8 + 0.5

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size:    Math.random() * 1.4 + 0.3,
    maxSize: Math.random() * 2.2 + 0.5,
    opacity: Math.random() * 0.35 + 0.10,
    life:    1,
    decay:   1 / (Math.random() * 50 + 25),
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MistProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ambient   = useRef<AmbientParticle[]>([])
  const sprays    = useRef<SprayParticle[]>([])
  const mouse     = useRef({ x: -9999, y: -9999 })
  const raf       = useRef<number>(0)

  const spray = useCallback((rect: DOMRect) => {
    const { left, top, right, bottom, width, height } = rect
    const perimeter = 2 * (width + height)

    // Scale particle count to element size — bigger element = more mist
    const count = Math.min(Math.round(perimeter * 0.22), 130)

    for (let i = 0; i < count; i++) {
      // Pick a uniformly random position along the perimeter
      const t = Math.random() * perimeter
      let px: number, py: number, angle: number

      if (t < width) {
        // Top edge → outward angle is straight up
        px = left + t
        py = top
        angle = -Math.PI / 2
      } else if (t < width + height) {
        // Right edge → outward angle is rightward
        px = right
        py = top + (t - width)
        angle = 0
      } else if (t < 2 * width + height) {
        // Bottom edge → outward angle is straight down
        px = right - (t - width - height)
        py = bottom
        angle = Math.PI / 2
      } else {
        // Left edge → outward angle is leftward
        px = left
        py = bottom - (t - 2 * width - height)
        angle = Math.PI
      }

      sprays.current.push(makeEdgeParticle(px, py, angle))
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      if (ambient.current.length === 0) {
        ambient.current = Array.from(
          { length: AMBIENT_COUNT },
          () => makeAmbient(canvas.width, canvas.height)
        )
      }
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove)

    const ctx = canvas.getContext('2d')!

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const W  = canvas.width
      const H  = canvas.height
      const mx = mouse.current.x
      const my = mouse.current.y

      // ── Ambient field ──────────────────────────────────────────────────────

      for (const p of ambient.current) {
        // Slowly evolving drift direction
        p.wanderAngle += p.wanderSpeed
        const driftX = Math.cos(p.wanderAngle) * p.speed
        const driftY = Math.sin(p.wanderAngle) * p.speed

        // Cursor repulsion — close, gentle
        const dx   = p.x - mx
        const dy   = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < REPEL_RADIUS && dist > 0.1) {
          const t        = (REPEL_RADIUS - dist) / REPEL_RADIUS
          const strength = t * t * REPEL_FORCE   // quadratic ease — softest at edge
          p.vx += (dx / dist) * strength
          p.vy += (dy / dist) * strength
        }

        // Soft velocity cap
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (spd > VELOCITY_CAP) {
          p.vx = (p.vx / spd) * VELOCITY_CAP
          p.vy = (p.vy / spd) * VELOCITY_CAP
        }

        // Gracious return to drift — long damping tail
        p.vx = p.vx * DAMPING + driftX * (1 - DAMPING)
        p.vy = p.vy * DAMPING + driftY * (1 - DAMPING)
        p.x += p.vx
        p.y += p.vy

        // Seamless edge wrap
        if (p.x < -4)  p.x = W + 4
        if (p.x > W+4) p.x = -4
        if (p.y < -4)  p.y = H + 4
        if (p.y > H+4) p.y = -4

        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.teal ? 'rgb(30,69,91)' : '#ffffff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Atomiser spray ─────────────────────────────────────────────────────
      // Rendered as teal-tinted specks — the spray dissolves seamlessly
      // into the ambient field as it slows to drift speed.

      ctx.fillStyle = '#9cb2bf'
      sprays.current = sprays.current.filter(p => p.life > 0.005)

      for (const p of sprays.current) {
        p.x    += p.vx
        p.y    += p.vy
        p.vy   -= 0.006          // gentle buoyancy — mist rises slightly
        p.vx   *= 0.965
        p.vy   *= 0.965
        p.size  = Math.min(p.size + 0.018, p.maxSize)
        p.life -= p.decay

        const alpha = p.opacity * p.life * p.life
        if (alpha < 0.004) continue

        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      raf.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <MistContext.Provider value={{ spray }}>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 9999, mixBlendMode: 'screen' }}
      />
      {children}
    </MistContext.Provider>
  )
}
