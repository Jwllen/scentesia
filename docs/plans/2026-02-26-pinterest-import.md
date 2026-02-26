# Pinterest Board Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Pinterest board URL import tab to the build page that fetches images from the board's RSS feed and populates the vibe grid.

**Architecture:** A new `GET /api/pinterest` route fetches and parses the board's RSS feed server-side, returning image URLs. The build page gains a Curated/Pinterest tab toggle; the Pinterest tab shows a URL input that fires the API on paste/enter, then streams images into the existing grid with staggered fade-in. Selections are shared across tabs toward the existing 5-image cap.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, no new dependencies.

---

### Task 1: API route — `/api/pinterest`

**Files:**
- Create: `src/app/api/pinterest/route.ts`

**Step 1: Create the route file with URL normalisation**

```ts
import { NextRequest, NextResponse } from 'next/server'

function normaliseToPinterestRss(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    // Accept any pinterest.* domain
    if (!url.hostname.includes('pinterest')) return null
    // Must have at least /username/board-name path segments
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    return `https://www.pinterest.com/${parts[0]}/${parts[1]}.rss`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  const rssUrl = normaliseToPinterestRss(raw)
  if (!rssUrl) return NextResponse.json({ error: 'Invalid Pinterest board URL' }, { status: 400 })

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    const xml = await res.text()

    // Extract <img> tags from each <item>'s <description>
    const imgRegex = /<img[^>]+src="([^"]+)"/g
    const seen = new Set<string>()
    const images: { id: string; url: string }[] = []
    let match: RegExpExecArray | null

    // Only look inside <item> blocks
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let item: RegExpExecArray | null
    let idx = 0

    while ((item = itemRegex.exec(xml)) !== null) {
      const block = item[1]
      imgRegex.lastIndex = 0
      while ((match = imgRegex.exec(block)) !== null) {
        // Upgrade thumbnail size: 236x → 736x
        const url = match[1].replace('/236x/', '/736x/')
        if (!seen.has(url)) {
          seen.add(url)
          images.push({ id: `pin_${idx++}`, url })
        }
        break // one image per pin
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images found. The board may be private or empty.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch board' }, { status: 502 })
  }
}
```

**Step 2: Verify the route builds cleanly**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/tsc --noEmit
```
Expected: no errors.

**Step 3: Manual smoke test**

Start dev server (`npm run dev`) and visit:
```
http://localhost:3000/api/pinterest?url=https://www.pinterest.com/pinterest/official-news/
```
Expected: JSON with `images` array containing objects like `{ id: "pin_0", url: "https://i.pinimg.com/736x/..." }`.

Test error cases:
- Missing url param → `{ error: 'Missing url' }`
- Non-Pinterest URL → `{ error: 'Invalid Pinterest board URL' }`
- Only username, no board → `{ error: 'Invalid Pinterest board URL' }`

**Step 4: Commit**

```bash
git add src/app/api/pinterest/route.ts
git commit -m "feat: add /api/pinterest RSS scraping route"
```

---

### Task 2: Tab toggle UI on build page

**Files:**
- Modify: `src/app/build/page.tsx`

**Step 1: Add tab state and type**

At the top of the `BuildPage` component, after existing state declarations, add:

```ts
const [activeTab, setActiveTab] = useState<'curated' | 'pinterest'>('curated')
```

**Step 2: Add the tab toggle markup**

Replace the existing header section's closing `</div>` (after the `"Choose up to 5 images..."` paragraph) with a tab toggle. Insert immediately after the `<p>` tag for the subtitle:

```tsx
{/* Tab toggle */}
<div className="flex gap-0 mt-6 border-b border-white/8">
  {(['curated', 'pinterest'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`text-[9px] tracking-[0.35em] uppercase pb-3 pr-6 transition-colors duration-200 ${
        activeTab === tab
          ? 'text-white border-b border-white -mb-px'
          : 'text-white/25 hover:text-white/50'
      }`}
      style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
    >
      {tab === 'curated' ? 'Curated' : 'Pinterest'}
    </button>
  ))}
</div>
```

**Step 3: Wrap the curated grid in a conditional**

Find the `{/* Blind vibe grid */}` section and wrap it:

```tsx
{activeTab === 'curated' && (
  <div className="pt-5">
    <div className="vibe-grid">
      {/* existing grid content unchanged */}
    </div>
  </div>
)}
```

**Step 4: Verify TypeScript**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/build/page.tsx
git commit -m "feat: add curated/pinterest tab toggle to build page"
```

---

### Task 3: Pinterest tab — URL input and fetch logic

**Files:**
- Modify: `src/app/build/page.tsx`

**Step 1: Add Pinterest state**

After the `activeTab` state, add:

```ts
const [pinterestUrl, setPinterestUrl]     = useState('')
const [pinterestImages, setPinterestImages] = useState<{ id: string; url: string }[]>([])
const [pinterestLoading, setPinterestLoading] = useState(false)
const [pinterestError, setPinterestError]   = useState<string | null>(null)
```

**Step 2: Add URL validation helper**

Above the component return, add:

```ts
function isValidPinterestUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (!u.hostname.includes('pinterest')) return false
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    return parts.length >= 2
  } catch {
    return false
  }
}
```

**Step 3: Add fetch handler**

```ts
async function handlePinterestImport() {
  if (!isValidPinterestUrl(pinterestUrl)) return
  setPinterestLoading(true)
  setPinterestError(null)
  setPinterestImages([])

  try {
    const res = await fetch(`/api/pinterest?url=${encodeURIComponent(pinterestUrl)}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch board')
    setPinterestImages(data.images)
  } catch (err) {
    setPinterestError(err instanceof Error ? err.message : 'Something went wrong.')
  } finally {
    setPinterestLoading(false)
  }
}
```

**Step 4: Add Pinterest tab UI**

After the curated grid conditional block, add:

```tsx
{activeTab === 'pinterest' && (
  <div className="pt-5 px-6">
    {/* URL input row */}
    <div className="flex gap-3 mb-5">
      <input
        type="url"
        value={pinterestUrl}
        onChange={e => setPinterestUrl(e.target.value)}
        onPaste={e => {
          const pasted = e.clipboardData.getData('text')
          setPinterestUrl(pasted)
          if (isValidPinterestUrl(pasted)) {
            setTimeout(handlePinterestImport, 0)
          }
        }}
        onKeyDown={e => e.key === 'Enter' && handlePinterestImport()}
        placeholder="Paste a Pinterest board URL"
        className="flex-1 bg-transparent border border-white/15 px-4 py-2.5 text-white/70 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/35 transition-colors rounded-xl"
        style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
      />
      <button
        onClick={handlePinterestImport}
        disabled={!isValidPinterestUrl(pinterestUrl) || pinterestLoading}
        className="text-[9px] tracking-[0.25em] uppercase border border-white/15 px-5 py-2.5 rounded-xl text-white/50 hover:border-white/40 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
      >
        {pinterestLoading ? '···' : 'Import'}
      </button>
    </div>

    {/* Error */}
    {pinterestError && (
      <p
        className="text-white/35 text-xs mb-5"
        style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
      >
        {pinterestError}
      </p>
    )}

    {/* Pinterest image grid — same vibe-grid class */}
    {pinterestImages.length > 0 && (
      <div className="vibe-grid -mx-6">
        {pinterestImages.map((img, index) => {
          const isSelected = selected.includes(img.id)
          const isDisabled = !isSelected && totalSelected >= MAX_IMAGES
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
    )}
  </div>
)}
```

**Step 5: Wire Pinterest selections into the analyze flow**

In `handleDiscover`, the current code builds `allImages` from curated URLs and uploaded base64. Add Pinterest URLs:

```ts
// Find this line:
const curatedUrls = selected.map(id => CURATED_IMAGES.find(c => c.id === id)!.url)

// Replace with:
const curatedUrls = selected
  .map(id => {
    const curated = CURATED_IMAGES.find(c => c.id === id)
    if (curated) return curated.url
    const pin = pinterestImages.find(p => p.id === id)
    if (pin) return pin.url
    return null
  })
  .filter((u): u is string => u !== null)
```

**Step 6: Verify TypeScript**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/app/build/page.tsx
git commit -m "feat: add Pinterest board import tab with RSS scraping"
```

---

### Task 4: Final verification

**Step 1: Full build check**

```bash
PATH="/opt/homebrew/bin:$PATH" node node_modules/.bin/next build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`

**Step 2: End-to-end manual test**

1. Open `http://localhost:3000/build`
2. Click **Pinterest** tab — URL input appears
3. Paste a public Pinterest board URL — import fires automatically on paste
4. Images stream into the grid with fade-in
5. Select up to 5 images (mixing curated + Pinterest if desired)
6. Hit **Discover My Scent** — confirm results page loads correctly

**Step 3: Test error states**

- Paste a private board URL → error message appears
- Paste a non-Pinterest URL → Import button stays disabled
- Clear the input → Import button disables again

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: Pinterest board import complete"
```
