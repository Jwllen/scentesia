# Instagram Post Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add an Instagram tab to the build page that fetches images from a public post or reel and feeds them into the vibe analysis pipeline.

**Architecture:** A new `GET /api/instagram` route scrapes the Instagram embed page for images, falling back to the main post page for carousels. The build page gains a third tab; single posts commit directly to analysis, carousels show a selection grid. Each tab is fully isolated — only the active tab's images go to analysis.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, no new dependencies.

---

### Task 1: API route — `/api/instagram`

**Files:**
- Create: `src/app/api/instagram/route.ts`

**Context:** Mirror the shape of `src/app/api/pinterest/route.ts`. Return `{ images: Array<{ id: string; url: string }>, type: 'single' | 'carousel' }`. Instagram's embed page (`/p/CODE/embed/captioned/`) is the reliable primary source; the main post page is a fallback for extracting all carousel slides.

**Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

/** Returns the shortcode for /p/ and /reel/ URLs, null for profiles or invalid URLs. */
function extractShortcode(raw: string): { shortcode: string; isProfile: boolean } | null {
  try {
    const url = new URL(raw.trim())
    const h = url.hostname
    const isInstagram =
      h === 'instagram.com' ||
      h === 'www.instagram.com' ||
      h === 'instagr.am' ||
      h === 'www.instagr.am'
    if (!isInstagram) return null
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    if (parts.length === 0) return null
    if (parts[0] === 'p' || parts[0] === 'reel') {
      if (parts.length < 2) return null
      return { shortcode: parts[1], isProfile: false }
    }
    // Single segment = profile (e.g. /username/)
    if (parts.length === 1) return { shortcode: parts[0], isProfile: true }
    return null
  } catch {
    return null
  }
}

/**
 * Extract Instagram CDN image URLs from HTML.
 * Targets scontent / cdninstagram CDN hosts, skips profile pictures.
 */
function extractCdnImages(html: string): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  // Match quoted src/content attributes pointing to Instagram CDN
  const regex = /(?:src|content)="(https:\/\/[^"]*(?:cdninstagram\.com|fbcdn\.net)[^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    const url = m[1]
    // Skip profile pictures, icons, and video thumbnails that are too small
    if (url.includes('150x150') || url.includes('s150x150')) continue
    if (url.includes('/p/') && url.includes('profile')) continue
    if (!seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  const parsed = extractShortcode(raw)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 })
  }
  if (parsed.isProfile) {
    return NextResponse.json(
      { error: 'Paste a post or reel link, not a profile page.' },
      { status: 400 }
    )
  }

  const { shortcode } = parsed

  try {
    // ── Step 1: Embed page (reliable, always works for public posts) ──────────
    const embedRes = await fetch(
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) }
    )
    if (!embedRes.ok) throw new Error(`Instagram returned ${embedRes.status}`)
    const embedHtml = await embedRes.text()

    const embedImages = extractCdnImages(embedHtml)

    // Carousel detection: the word "carousel" or "sidecar" appears in embed markup,
    // or more than one distinct image URL was found.
    const looksLikeCarousel =
      /carousel|sidecar/i.test(embedHtml) || embedImages.length > 1

    // ── Step 2: For carousels try the main post page for all slides ───────────
    if (looksLikeCarousel) {
      try {
        const mainRes = await fetch(
          `https://www.instagram.com/p/${shortcode}/`,
          { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) }
        )
        if (mainRes.ok) {
          const mainHtml = await mainRes.text()
          const mainImages = extractCdnImages(mainHtml)
          if (mainImages.length > 1) {
            const images = mainImages
              .slice(0, 5)
              .map((url, i) => ({ id: `ig_${i}`, url }))
            return NextResponse.json({ images, type: 'carousel' })
          }
        }
      } catch {
        // Fall through to embed images
      }
    }

    // ── Fallback / single post ────────────────────────────────────────────────
    if (embedImages.length === 0) {
      return NextResponse.json(
        { error: 'This post is private or couldn\'t be reached.' },
        { status: 404 }
      )
    }

    const type = looksLikeCarousel ? 'carousel' : 'single'
    const images = embedImages.slice(0, 5).map((url, i) => ({ id: `ig_${i}`, url }))
    return NextResponse.json({ images, type })
  } catch {
    return NextResponse.json(
      { error: 'Instagram couldn\'t be reached. Try again later.' },
      { status: 502 }
    )
  }
}
```

**Step 2: TypeScript check**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/tsc --noEmit
```
Expected: no errors.

**Step 3: Smoke test with dev server running**

```bash
# Single post
curl -s "http://localhost:3000/api/instagram?url=https://www.instagram.com/p/SHORTCODE/" | python3 -m json.tool

# Profile URL (should error)
curl -s "http://localhost:3000/api/instagram?url=https://www.instagram.com/username/" | python3 -m json.tool
```
Expected for single: `{ "images": [{ "id": "ig_0", "url": "https://..." }], "type": "single" }`
Expected for profile: `{ "error": "Paste a post or reel link, not a profile page." }`

**Step 4: Commit**

```bash
git add src/app/api/instagram/route.ts
git commit -m "feat: add /api/instagram scraping route (embed + main page fallback)"
```

---

### Task 2: Build page — tab isolation refactor + Instagram state

**Files:**
- Modify: `src/app/build/page.tsx`

**Context:** Currently `activeTab` is `'curated' | 'pinterest'`. We need to add `'instagram'`, introduce a `switchTab` helper that clears selections on switch, add Instagram state variables, and update `handleDiscover` to route by active tab. The existing `selected` array and `uploadedImages` mechanism are unchanged; uploads remain a universal add-on.

**Step 1: Add `isValidInstagramUrl` above the component (near `isValidPinterestUrl`)**

```ts
function isValidInstagramUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    const h = u.hostname
    if (
      h !== 'instagram.com' &&
      h !== 'www.instagram.com' &&
      h !== 'instagr.am' &&
      h !== 'www.instagr.am'
    ) return false
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    return parts.length >= 2 && (parts[0] === 'p' || parts[0] === 'reel')
  } catch {
    return false
  }
}
```

**Step 2: Extend `activeTab` type and add Instagram state variables**

Find this line (line 52):
```ts
const [activeTab, setActiveTab] = useState<'curated' | 'pinterest'>('curated')
```
Replace with:
```ts
const [activeTab, setActiveTab] = useState<'curated' | 'pinterest' | 'instagram'>('curated')
const [instagramUrl, setInstagramUrl] = useState('')
const [instagramImages, setInstagramImages] = useState<{ id: string; url: string }[]>([])
const [instagramType, setInstagramType] = useState<'single' | 'carousel' | null>(null)
const [instagramLoading, setInstagramLoading] = useState(false)
const [instagramError, setInstagramError] = useState<string | null>(null)
```

**Step 3: Add `switchTab` helper (after the state declarations, before `toggleCurated`)**

```ts
function switchTab(tab: 'curated' | 'pinterest' | 'instagram') {
  setActiveTab(tab)
  setSelected([])
}
```

**Step 4: Add `handleInstagramImport` (after `handlePinterestImport`)**

```ts
async function handleInstagramImport(urlOverride?: string) {
  const urlToUse = urlOverride ?? instagramUrl
  if (!isValidInstagramUrl(urlToUse)) return
  setInstagramLoading(true)
  setInstagramError(null)
  setInstagramImages([])
  setInstagramType(null)

  try {
    const res = await fetch(`/api/instagram?url=${encodeURIComponent(urlToUse)}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch post')
    setInstagramImages(data.images)
    setInstagramType(data.type)
  } catch (err) {
    setInstagramError(err instanceof Error ? err.message : 'Something went wrong.')
  } finally {
    setInstagramLoading(false)
  }
}
```

**Step 5: Update `handleDiscover` to be tab-aware**

Replace the entire `handleDiscover` function body with:

```ts
async function handleDiscover(e: React.MouseEvent<HTMLButtonElement>) {
  // Gate by active tab
  const canDiscover =
    (activeTab === 'instagram' && instagramType === 'single' && instagramImages.length > 0) ||
    (activeTab === 'instagram' && instagramType === 'carousel' && selected.length > 0) ||
    (activeTab !== 'instagram' && totalSelected > 0)
  if (!canDiscover) return

  spray(e.currentTarget.getBoundingClientRect())
  setLoading(true)
  setError(null)

  const texts = ['Reading your vibe...', 'Finding your scent...', 'Almost there...']
  let i = 0
  const interval = setInterval(() => { i = (i + 1) % texts.length; setLoadingText(texts[i]) }, 2500)

  try {
    // Resolve image URLs for the active tab
    let tabUrls: string[] = []
    if (activeTab === 'curated') {
      tabUrls = selected
        .map(id => CURATED_IMAGES.find(c => c.id === id)?.url)
        .filter((u): u is string => u !== undefined)
    } else if (activeTab === 'pinterest') {
      tabUrls = selected
        .map(id => pinterestImages.find(p => p.id === id)?.url)
        .filter((u): u is string => u !== undefined)
    } else if (activeTab === 'instagram') {
      if (instagramType === 'carousel') {
        tabUrls = instagramImages
          .filter(img => selected.includes(img.id))
          .map(img => img.url)
      } else {
        tabUrls = instagramImages.map(img => img.url)
      }
    }

    const uploadedBase64 = uploadedImages.map(img => img.base64)
    const allImages = [...uploadedBase64, ...tabUrls]

    const analyzeRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: allImages }),
    })
    if (!analyzeRes.ok) throw new Error('Analysis failed')
    const { vibe } = await analyzeRes.json()

    const recommendRes = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vibe }),
    })
    if (!recommendRes.ok) throw new Error('Recommendations failed')
    const { recommendations } = await recommendRes.json()

    const layerRes = await fetch('/api/layer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendations }),
    })
    const { layers } = await layerRes.json()

    sessionStorage.setItem('scentesia_results', JSON.stringify({ vibe, recommendations, layers }))
    router.push('/results')
  } catch (err) {
    console.error(err)
    setError('Something went wrong. Please try again.')
    setLoading(false)
  } finally {
    clearInterval(interval)
  }
}
```

**Step 6: Update the tab toggle — replace `setActiveTab(tab)` with `switchTab(tab)` and add instagram to the array**

Find (line 222):
```tsx
{(['curated', 'pinterest'] as const).map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
```
Replace with:
```tsx
{(['curated', 'pinterest', 'instagram'] as const).map(tab => (
  <button
    key={tab}
    onClick={() => switchTab(tab)}
```

**Step 7: Update the tab label mapping**

Find:
```tsx
{tab === 'curated' ? 'Curated' : 'Pinterest'}
```
Replace with:
```tsx
{tab === 'curated' ? 'Curated' : tab === 'pinterest' ? 'Pinterest' : 'Instagram'}
```

**Step 8: Update the Discover button — disable condition and label**

Find (line 411):
```tsx
disabled={totalSelected === 0}
```
Replace with:
```tsx
disabled={
  (activeTab === 'instagram' && instagramType === 'single' && instagramImages.length === 0) ||
  (activeTab === 'instagram' && instagramType === 'carousel' && selected.length === 0) ||
  (activeTab === 'instagram' && instagramType === null) ||
  (activeTab !== 'instagram' && totalSelected === 0)
}
```

Find (line 415):
```tsx
{totalSelected === 0 ? 'Select at least one image' : `Discover My Scent — ${totalSelected} selected`}
```
Replace with:
```tsx
{activeTab === 'instagram' && instagramType === null
  ? 'Import an Instagram post first'
  : activeTab === 'instagram' && instagramType === 'single'
  ? instagramImages.length === 0
    ? 'Import an Instagram post first'
    : 'Discover My Scent'
  : activeTab === 'instagram' && instagramType === 'carousel' && selected.length === 0
  ? 'Select images from the carousel'
  : totalSelected === 0
  ? 'Select at least one image'
  : `Discover My Scent — ${totalSelected} selected`}
```

**Step 9: TypeScript check**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/tsc --noEmit
```
Expected: no errors.

**Step 10: Commit**

```bash
git add src/app/build/page.tsx
git commit -m "feat: tab isolation refactor + Instagram state wiring"
```

---

### Task 3: Instagram tab UI

**Files:**
- Modify: `src/app/build/page.tsx`

**Context:** Add the `{activeTab === 'instagram' && ...}` block after the `{activeTab === 'pinterest' && ...}` block (around line 405). The UI has two modes driven by `instagramType`:
- `null` or loading → URL input only
- `'single'` → non-interactive image preview
- `'carousel'` → selection grid (same `vibe-grid` class as Pinterest)

A ✕ Clear button resets the import.

**Step 1: Add Instagram tab JSX block after the closing `)}` of the Pinterest block**

Insert after line 405 (`</div>` closing the pinterest block):

```tsx
{activeTab === 'instagram' && (
  <div className="pt-5 px-6">
    {/* URL input row — hidden once images are loaded */}
    {instagramImages.length === 0 && (
      <div className="flex gap-3 mb-5">
        <input
          type="url"
          value={instagramUrl}
          onChange={e => setInstagramUrl(e.target.value)}
          onPaste={e => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text')
            setInstagramUrl(pasted)
            if (isValidInstagramUrl(pasted)) {
              handleInstagramImport(pasted)
            }
          }}
          onKeyDown={e => e.key === 'Enter' && handleInstagramImport()}
          placeholder="Paste an Instagram post or reel URL"
          className="flex-1 bg-transparent border border-white/15 px-4 py-2.5 text-white/70 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/35 transition-colors rounded-xl"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        />
        <button
          onClick={() => handleInstagramImport()}
          disabled={!isValidInstagramUrl(instagramUrl) || instagramLoading}
          className="text-[9px] tracking-[0.25em] uppercase border border-white/15 px-5 py-2.5 rounded-xl text-white/50 hover:border-white/40 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          {instagramLoading ? '···' : 'Import'}
        </button>
      </div>
    )}

    {/* Error */}
    {instagramError && (
      <p
        className="text-white/35 text-xs mb-5"
        style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
      >
        {instagramError}
      </p>
    )}

    {/* Single post — non-interactive preview */}
    {instagramType === 'single' && instagramImages.length > 0 && (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-white/25 text-[9px] tracking-[0.35em] uppercase"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            Post imported
          </p>
          <button
            onClick={() => {
              setInstagramImages([])
              setInstagramType(null)
              setInstagramUrl('')
              setInstagramError(null)
            }}
            className="text-white/25 text-[9px] tracking-[0.25em] uppercase hover:text-white/60 transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            ✕ Clear
          </button>
        </div>
        <div className="w-40 aspect-[4/3] rounded-xl overflow-hidden">
          <img
            src={instagramImages[0].url}
            alt=""
            className="w-full h-full object-cover animate-fade-in"
          />
        </div>
      </div>
    )}

    {/* Carousel — selection grid */}
    {instagramType === 'carousel' && instagramImages.length > 0 && (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3 -mx-0">
          <p
            className="text-white/25 text-[9px] tracking-[0.35em] uppercase"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            {selected.length}/{Math.min(instagramImages.length, MAX_IMAGES)} selected
          </p>
          <button
            onClick={() => {
              setInstagramImages([])
              setInstagramType(null)
              setInstagramUrl('')
              setInstagramError(null)
              setSelected([])
            }}
            className="text-white/25 text-[9px] tracking-[0.25em] uppercase hover:text-white/60 transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            ✕ Clear
          </button>
        </div>
        <div className="vibe-grid -mx-6">
          {instagramImages.map((img, index) => {
            const isSelected = selected.includes(img.id)
            const isDisabled = !isSelected && selected.length >= MAX_IMAGES
            return (
              <button
                key={img.id}
                onClick={() => {
                  if (isSelected) {
                    setSelected(prev => prev.filter(s => s !== img.id))
                  } else if (!isDisabled) {
                    setSelected(prev => [...prev, img.id])
                  }
                }}
                disabled={isDisabled}
                className={`relative overflow-hidden group transition-all duration-300 rounded-xl aspect-[4/3] ${
                  isDisabled ? 'opacity-20 cursor-not-allowed' : 'opacity-100'
                }`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 animate-fade-in"
                />
                <div className={`absolute inset-0 transition-all duration-300 ${isSelected ? 'bg-white/10' : 'bg-black/30 group-hover:bg-black/5'}`} />
                {isSelected && <div className="absolute inset-0 border border-white/60 rounded-xl" />}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-white flex items-center justify-center">
                    <svg width="7" height="5" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )}
  </div>
)}
```

**Step 2: TypeScript check**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/app/build/page.tsx
git commit -m "feat: add Instagram tab UI (single preview + carousel selection grid)"
```

---

### Task 4: Final verification

**Step 1: Full TypeScript build**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/next build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`

**Step 2: End-to-end manual test — single post**

1. Open `http://localhost:3000/build`
2. Click **Instagram** tab
3. Paste a public single-image Instagram post URL
4. Import fires automatically
5. Non-interactive preview image appears below input
6. Discover button shows **Discover My Scent** (no count)
7. Click Discover → results page loads

**Step 3: End-to-end manual test — carousel**

1. Click **Instagram** tab
2. Paste a public carousel post URL
3. Import fires automatically
4. Selection grid appears with all slides
5. Select 1–5 images
6. Discover button shows **Discover My Scent — N selected**
7. Click Discover → results page loads

**Step 4: Test tab isolation**

1. On **Curated** tab, select 2 images
2. Switch to **Instagram** tab → selection clears (counter resets to 0)
3. Switch back to **Curated** → still cleared

**Step 5: Test error states**

- Paste a profile URL → error "Paste a post or reel link, not a profile page."
- Paste a private post URL → error "This post is private or couldn't be reached."
- Paste a non-Instagram URL → Import button stays disabled

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: Instagram post import complete"
```
