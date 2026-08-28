# Scentesia

Show it your aesthetic, it tells you what you smell like.

Scentesia takes a set of images, a mood board, a Pinterest board, an Instagram grid, and reads the visual language back as fragrance: the accords, notes and families that match the world in the pictures. It exists to answer a question the fragrance industry mostly dodges, which is how someone who cannot name a single note is supposed to find a scent they love.

## Where it came from

Scentesia began as a submission to L'Oréal BrandStorm, the company's international innovation competition. The brief was fragrance discovery, and the concept rests on one observation: most people can describe their taste fluently in images and not at all in the vocabulary the category insists on. Perfume retail asks you to say "chypre" when you would rather point at a photograph.

That origin explains two things in the codebase that would otherwise look odd. The recommendation engine carries an optional bias toward the sponsoring company's fragrance houses, environment-gated and off by default, which was a demonstration requirement of the competition rather than a product opinion. And the curated image set was assembled under a licence scoped to that competition, which is why it is not in this repository.

## How it works

**Vision to accords.** Images go to a vision model (Llama 4 Scout via Groq) behind a structured prompt that extracts palette, texture, setting, objects and mood, rather than asking for a fragrance directly. Ask a vision model to name a perfume and it returns a hallucinated bestseller. Ask it to describe a room, then map that description onto accords, and you get something you can defend.

**Accords to perfumes.** The extracted vibe is scored against the catalogue on accord overlap, weighted so that a rare accord counts for more than a ubiquitous one, then adjusted by a popularity-confidence term so a well-reviewed match outranks an obscure one with a marginally better raw score. Scores are capped, so the interface never claims more than a hundred percent agreement even when the bias multiplier is on.

**Layering.** Beyond the ranked matches, the engine proposes pairs that work together, with copy explaining the effect and how to wear it, drawn from rotating templates so two users never get identical prose.

## Input paths

Four ways in, each with its own extraction problem:

- **Curated grid.** A licensed image set, loaded at runtime from a bucket rather than committed.
- **Pinterest.** Board import through a dual strategy: public RSS parsing with API pagination as a fallback, because the API returns 403 from some server addresses.
- **Instagram.** Server-rendered HTML fetched with a Googlebot user agent to reach real CDN URLs, with carousel posts parsed out of the embedded JSON payload.
- **TikTok.** Pages are fully client-rendered and ship a roughly one-kilobyte shell with no meta tags, so the oEmbed endpoint is the only reliable server-side source. The thumbnail then goes through the same vision pipeline as everything else.

## Stack

Next.js 16 with the App Router, TypeScript, Tailwind CSS v4, Turbopack. Supabase for the catalogue, Groq for inference, Vercel for hosting. Interface built on shadcn/ui with a custom WebGL background: a slow-warping organic shader that accelerates while analysis is running.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

The database schema is in `scripts/create-table.sql`.

### Assets

The curated images and the tutorial clips are licensed and not distributed here. Either point `NEXT_PUBLIC_ASSET_BASE_URL` at a bucket holding them and set `NEXT_PUBLIC_CURATED_COUNT`, or drop your own into `public/curated` and `public/tutorials` and leave the base URL unset. With neither, the curated tab is empty and the other three input paths work normally.

## Design notes

`docs/plans/` holds the design documents written before each significant feature: the Pinterest and Instagram import designs, and the v2 interface overhaul. They are in the repository because the reasoning is more interesting than the diffs.

## Licence

MIT for the source, see `LICENSE`. The perfume catalogue and all imagery are excluded and separately licensed.
