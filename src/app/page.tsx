'use client'

import { useRouter } from 'next/navigation'
import { useMist } from '@/components/MistEffect'
import { Logo } from '@/components/Logo'
import { VibePreview } from '@/components/VibePreview'
import { SocialProof } from '@/components/SocialProof'

export default function LandingPage() {
  const router = useRouter()
  const { spray } = useMist()

  return (
    <main
      className="grain-layer relative w-screen bg-organic overflow-x-hidden"
      style={{ minHeight: '100dvh', position: 'relative', zIndex: 1 }}
    >

      {/* Hero — 55dvh */}
      <div
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center"
        style={{ minHeight: '55dvh', paddingTop: '6rem' }}
      >

        <div className="animate-fade-in mb-6" style={{ animationDelay: '0ms' }}>
          <Logo size={80} className="text-white" />
        </div>

        <h1
          className="animate-fade-up wordmark text-white text-4xl md:text-5xl mb-10 md:mb-14"
          style={{ animationDelay: '120ms' }}
        >
          Scentesia
        </h1>

        <p
          className="animate-fade-in text-brand-subtitle/80 text-lg md:text-2xl tracking-[0.4em] uppercase mb-10 md:mb-14"
          style={{ animationDelay: '260ms' }}
        >
          Fragrance, finally in your language.
        </p>

        <p
          className="animate-fade-up text-brand-subtitle/80 text-lg font-light leading-relaxed max-w-[26rem]"
          style={{ animationDelay: '400ms' }}
        >
          Your aesthetic has a scent. We found it.
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
            className="btn-glass-primary group relative px-10 py-4 rounded-xl overflow-hidden"
          >
            <span className="relative z-10">
              Discover Your Scent
              <span className="inline-block ml-3 transition-transform duration-300 group-hover:translate-x-1.5">&rarr;</span>
            </span>
          </button>
        </div>

      </div>

      {/* VibePreview Tutorial */}
      <VibePreview />

      {/* Social Proof */}
      <SocialProof />

      {/* Bottom footnote */}
      <p
        className="animate-fade-in relative z-10 text-center text-brand-subtitle/70 text-base tracking-wider pb-8"
        style={{ animationDelay: '800ms' }}
      >
        Images analyzed by AI &middot; Not stored or retained
      </p>

    </main>
  )
}
