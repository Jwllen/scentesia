'use client'

import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'

export default function LandingPage() {
  const router = useRouter()
  const { spray } = useMist()

  return (
    <main className="grain-layer relative h-screen w-screen bg-black overflow-hidden flex flex-col">

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 md:px-12 pt-8">
        <span
          className="text-white/25 text-[9px] tracking-[0.55em] uppercase"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Scentesia
        </span>
        <span
          className="text-white/12 text-[9px] tracking-[0.3em] uppercase hidden md:block"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Est. 2026
        </span>
      </nav>

      {/* Hero — vertically centered in remaining space */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">

        <p
          className="animate-fade-in text-white/20 text-[9px] tracking-[0.7em] uppercase mb-10 md:mb-14"
          style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            animationDelay: '0ms',
          }}
        >
          Fragrance discovery
        </p>

        <div className="flex flex-col items-center gap-0">
          <h1
            className="animate-fade-up text-white font-light leading-[0.85] tracking-[-0.02em]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(4.5rem, 13vw, 11rem)',
              animationDelay: '120ms',
            }}
          >
            your vibe,
          </h1>
          <h1
            className="animate-fade-up text-white/55 font-light italic leading-[0.85] tracking-[-0.02em]"
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(4.5rem, 13vw, 11rem)',
              animationDelay: '260ms',
            }}
          >
            your scent.
          </h1>
        </div>

        <p
          className="animate-fade-up text-white/30 text-sm font-light leading-relaxed max-w-[26rem] mt-10 md:mt-14"
          style={{
            fontFamily: 'var(--font-dm-sans), sans-serif',
            animationDelay: '400ms',
          }}
        >
          Upload images that capture your world — we translate your aesthetic into the perfumes made for you.
        </p>

        <div
          className="animate-fade-up mt-10 md:mt-12"
          style={{ animationDelay: '540ms' }}
        >
          <button
            onClick={(e) => {
              spray(e.currentTarget.getBoundingClientRect())
              setTimeout(() => router.push('/build'), 320)
            }}
            className="group relative bg-white text-black px-10 py-4 text-[9px] tracking-[0.45em] uppercase font-medium rounded-xl overflow-hidden transition-all duration-300 hover:bg-white/88 active:scale-[0.975]"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            <span className="relative z-10">
              Discover Your Scent
              <span className="inline-block ml-3 transition-transform duration-300 group-hover:translate-x-1.5">→</span>
            </span>
          </button>
        </div>

      </div>

      {/* Bottom footnote */}
      <p
        className="animate-fade-in relative z-10 text-center text-white/10 text-[9px] tracking-wider pb-8"
        style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          animationDelay: '800ms',
        }}
      >
        Images analyzed by AI · Not stored or retained
      </p>

    </main>
  )
}
