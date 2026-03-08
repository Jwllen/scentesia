'use client'

import Image from 'next/image'

const logos = [
  { src: '/logos/essec.png', alt: 'ESSEC Business School', width: 85, height: 80 },
  { src: '/logos/loreal-luxe.png', alt: "L'Oreal Luxe", width: 175, height: 48 },
  { src: '/logos/brandstorm.png', alt: "L'Oreal Brandstorm 2026", width: 194, height: 60 },
  { src: '/logos/fragrantica.png', alt: 'Fragrantica', width: 200, height: 40 },
]

const testimonials = [
  {
    quote: 'I always knew what I liked but never how to describe it. Scentesia just got it.',
    name: 'Sarah M.',
    title: 'Fashion Student',
    initials: 'SM',
    gradient: 'from-brand-teal to-cyan-600',
  },
  {
    quote: 'Showed me perfumes I never would have found. My new signature scent came from here.',
    name: 'Alex K.',
    title: 'Creative Director',
    initials: 'AK',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    quote: "The vibe board concept is genius. It's like Spotify Wrapped but for fragrance.",
    name: 'Mia L.',
    title: 'Beauty Editor',
    initials: 'ML',
    gradient: 'from-amber-500 to-rose-500',
  },
]

export function SocialProof() {
  return (
    <section className="relative z-10 w-full max-w-4xl mx-auto px-6 py-16 md:py-24 space-y-16">

      {/* Stat Line */}
      <div className="text-center space-y-4">
        <div className="border-t border-white/8 w-24 mx-auto" />
        <p className="text-base md:text-lg">
          <span className="text-white font-bold">50,000+</span>{' '}
          <span className="text-brand-subtitle/80">people from TikTok tried it and loved it</span>
        </p>
        <div className="border-t border-white/8 w-24 mx-auto" />
      </div>

      {/* Backer Logos */}
      <div className="text-center space-y-6">
        <p className="text-brand-subtitle/70 text-base tracking-[0.3em] uppercase">
          Supported by
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {logos.map((logo) => (
            <Image
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              className="opacity-50 hover:opacity-80 transition-opacity duration-300"
            />
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="glass-card rounded-2xl p-6 space-y-4"
          >
            <p className="text-base text-white/70 leading-relaxed">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-sm font-medium shrink-0`}
              >
                {t.initials}
              </div>
              <div>
                <p className="text-base text-white/90">{t.name}</p>
                <p className="text-base text-brand-subtitle/70">{t.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </section>
  )
}
