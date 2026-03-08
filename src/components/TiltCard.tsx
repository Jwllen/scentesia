'use client'

import { useRef, useCallback, useEffect, useState, type ReactNode } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  maxTilt?: number
  glowColor?: string
}

export function TiltCard({ children, className = '', style, onClick, maxTilt = 10, glowColor = 'rgba(30,69,91,0.45)' }: TiltCardProps) {
  const cardRef   = useRef<HTMLDivElement>(null)
  const shineRef  = useRef<HTMLDivElement>(null)
  const borderRef = useRef<HTMLDivElement>(null)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  const applyTilt = useCallback((cx: number, cy: number) => {
    const el     = cardRef.current
    const shine  = shineRef.current
    const border = borderRef.current
    if (!el) return

    const rotX = -(cy - 0.5) * maxTilt * 2
    const rotY =  (cx - 0.5) * maxTilt * 2

    el.style.transform  = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.025, 1.025, 1.025)`
    el.style.transition = 'transform 0.06s linear'
    el.style.zIndex     = '2'

    if (shine) {
      const base = 50 - (rotY / maxTilt) * 30
      const p0 = Math.max(0,   base - 48)
      const p1 = Math.max(0,   base - 22)
      const p2 =               base - 3
      const p3 =               base + 3
      const p4 = Math.min(100, base + 22)
      const p5 = Math.min(100, base + 48)

      const streak = `linear-gradient(135deg, transparent ${p0}%, rgba(30,69,91,0.02) ${p1}%, rgba(30,69,91,0.12) ${p2}%, rgba(30,69,91,0.12) ${p3}%, rgba(30,69,91,0.02) ${p4}%, transparent ${p5}%)`
      const e1     = `radial-gradient(ellipse 20% 14% at ${base - 3}% 24%, rgba(30,69,91,0.06) 0%, transparent 100%)`
      const e2     = `radial-gradient(ellipse 24% 12% at ${base + 2}% 54%, rgba(30,69,91,0.04) 0%, transparent 100%)`
      const e3     = `radial-gradient(ellipse 16% 10% at ${base - 1}% 78%, rgba(30,69,91,0.05) 0%, transparent 100%)`

      shine.style.background = [streak, e1, e2, e3].join(', ')
      shine.style.opacity    = '1'
      shine.style.transition = 'opacity 0.06s linear'
    }

    if (border) {
      border.style.background = `radial-gradient(circle at ${cx * 100}% ${cy * 100}%, ${glowColor} 0%, transparent 55%)`
      border.style.opacity    = '1'
      border.style.transition = 'opacity 0.06s linear'
    }
  }, [maxTilt, glowColor])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouch) return
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    applyTilt(
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top)  / rect.height,
    )
  }, [isTouch, applyTilt])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el || !e.touches[0]) return
    const rect = el.getBoundingClientRect()
    applyTilt(
      (e.touches[0].clientX - rect.left) / rect.width,
      (e.touches[0].clientY - rect.top)  / rect.height,
    )
  }, [applyTilt])

  const resetTilt = useCallback(() => {
    const el     = cardRef.current
    const shine  = shineRef.current
    const border = borderRef.current
    if (!el) return

    el.style.transform  = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'
    el.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)'
    el.style.zIndex     = ''

    if (shine) {
      shine.style.opacity    = '0'
      shine.style.transition = 'opacity 0.35s ease'
    }

    if (border) {
      border.style.opacity    = '0'
      border.style.transition = 'opacity 0.4s ease'
    }
  }, [])

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden cursor-pointer backdrop-blur-md ${className}`}
      style={{ willChange: 'transform', ...style }}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetTilt}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetTilt}
      onClick={onClick}
    >
      {children}

      {/* Specular sheen */}
      <div
        ref={shineRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0, zIndex: 10 }}
      />

      {/* Border glow — radial gradient masked to the 1px border strip only */}
      <div
        ref={borderRef}
        className="absolute inset-0 pointer-events-none rounded-[inherit]"
        style={{
          opacity: 0,
          zIndex: 20,
          padding: '1px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
    </div>
  )
}
