'use client'

import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'
import { Logo } from '@/components/Logo'

export default function LandingPage() {
  const router = useRouter()
  const { spray } = useMist()

  return (
    <main className="grain-layer relative h-screen w-screen bg-organic overflow-hidden flex flex-col">

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 md:px-12 pt-8">
        <div className="flex items-center gap-3">
          <Logo size={22} className="text-white/25" />
          <span className="wordmark text-white/25 text-[9px]">
            Scentesia
          </span>
        </div>
        <span className="text-white/12 text-[9px] tracking-[0.3em] uppercase hidden md:block">
          Est. 2026
        </span>
      </nav>

      {/* Hero — vertically centered in remaining space */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">

        <p
          className="animate-fade-in text-brand-subtitle/50 text-[9px] tracking-[0.7em] uppercase mb-10 md:mb-14"
          style={{ animationDelay: '0ms' }}
        >
          Redefine the way you discover fragrance
        </p>

        <div className="flex flex-col items-center gap-0">
          <h1
            className="animate-fade-up font-expanded text-white font-light leading-[0.85] tracking-[-0.02em]"
            style={{
              fontSize: 'clamp(3rem, 8vw, 7.5rem)',
              animationDelay: '120ms',
            }}
          >
            You already know
          </h1>
          <h1
            className="animate-fade-up font-expanded text-white font-light leading-[0.85] tracking-[-0.02em]"
            style={{
              fontSize: 'clamp(3rem, 8vw, 7.5rem)',
              animationDelay: '260ms',
            }}
          >
            what you want
          </h1>
          <h1
            className="animate-fade-up font-expanded text-brand-subtitle font-light leading-[0.85] tracking-[-0.02em]"
            style={{
              fontSize: 'clamp(3rem, 8vw, 7.5rem)',
              animationDelay: '400ms',
            }}
          >
            to smell like.
          </h1>
        </div>

        <p
          className="animate-fade-up text-brand-subtitle/60 text-lg font-light leading-relaxed max-w-[26rem] mt-10 md:mt-14"
          style={{ animationDelay: '540ms' }}
        >
          Let us find it.
        </p>

        <div
          className="animate-fade-up mt-10 md:mt-12"
          style={{ animationDelay: '680ms' }}
        >
          <button
            onClick={(e) => {
              spray(e.currentTarget.getBoundingClientRect())
              setTimeout(() => router.push('/build'), 320)
            }}
            className="btn-glass-primary group relative px-10 py-4 rounded-xl overflow-hidden"
          >
            <span className="relative z-10">
              Discover Your Scent
              <span className="inline-block ml-3 transition-transform duration-300 group-hover:translate-x-1.5">&rarr;</span>
            </span>
          </button>
        </div>

      </div>

      {/* Bottom footnote */}
      <p
        className="animate-fade-in relative z-10 text-center text-brand-subtitle/30 text-[9px] tracking-wider pb-8"
        style={{ animationDelay: '800ms' }}
      >
        Images analyzed by AI &middot; Not stored or retained
      </p>

    </main>
  )
}
