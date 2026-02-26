# Instagram Post Import — Design Document
**Date:** 2026-02-26
**Status:** Approved

---

## Overview

Allow users to import images from a public Instagram post or reel directly into the Scentesia vibe board. Single posts and reels are committed directly (no selection step). Carousel posts show a selection grid so the user can pick up to 5 slides.

---

## Tab Isolation Model

The three tabs — **Curated**, **Pinterest**, **Instagram** — are fully mutually exclusive import methods. Only the active tab's images go to analysis when the user clicks "Discover My Scent."

- Switching tabs clears the previous tab's selections to prevent confusion
- `handleDiscover` routes to the right image source based on `activeTab`
- The 5-image cap applies per tab independently

---

## Instagram Tab UX

**URL input** accepts:
- `https://www.instagram.com/p/CODE/` (post)
- `https://www.instagram.com/reel/CODE/` (reel)
- Short links: `https://instagr.am/p/CODE/`

Auto-import fires on paste (same stale-closure fix as Pinterest: pass pasted value directly to handler).

**Two rendering modes depending on post type:**

| Mode | Trigger | UI |
|---|---|---|
| Single / reel | `type === 'single'` | Non-interactive image preview. Discover button enables immediately. |
| Carousel | `type === 'carousel'` | Selection grid (same vibe-grid class). User picks up to 5 slides. |

A **✕ Clear** button resets the import and re-shows the URL input in its empty state.

---

## API Route

**`GET /api/instagram?url=<post-url>`**

### Steps

1. **Validate** — extract shortcode from `/p/CODE/` or `/reel/CODE/` path segments. Detect and reject profile URLs with a specific error.
2. **Fetch embed page** — `https://www.instagram.com/p/{shortcode}/embed/captioned/` with full browser headers (Chrome UA, Accept-Language, etc.). Parse `<img>` tags whose `src` points to `cdninstagram.com` or `scontent` CDN domains.
3. **Detect carousel** — if the embed HTML contains carousel/slider markup (multiple slide elements), attempt a second fetch of the main post page (`https://www.instagram.com/p/{shortcode}/`) and parse its embedded JSON (`<script type="application/json">` tags) for all slide image URLs.
4. **Cap at 5** — return at most 5 images regardless of carousel size.
5. **Return** `{ images: Array<{ id: string; url: string }>, type: 'single' | 'carousel' }`

### Response shape
```json
{
  "images": [
    { "id": "ig_0", "url": "https://cdninstagram.com/..." },
    { "id": "ig_1", "url": "https://cdninstagram.com/..." }
  ],
  "type": "carousel"
}
```

---

## Client Integration

### New state variables
```ts
const [instagramUrl, setInstagramUrl]       = useState('')
const [instagramImages, setInstagramImages] = useState<{ id: string; url: string }[]>([])
const [instagramType, setInstagramType]     = useState<'single' | 'carousel' | null>(null)
const [instagramLoading, setInstagramLoading] = useState(false)
const [instagramError, setInstagramError]   = useState<string | null>(null)
```

### Tab type update
```ts
const [activeTab, setActiveTab] = useState<'curated' | 'pinterest' | 'instagram'>('curated')
```

### Tab switch — clear selections
```ts
function switchTab(tab: 'curated' | 'pinterest' | 'instagram') {
  setActiveTab(tab)
  setSelected([])
}
```

### handleDiscover — tab-aware routing
```ts
// Curated
if (activeTab === 'curated') {
  urls = selected.map(id => CURATED_IMAGES.find(c => c.id === id)?.url).filter(Boolean)
}
// Pinterest
if (activeTab === 'pinterest') {
  urls = selected.map(id => pinterestImages.find(p => p.id === id)?.url).filter(Boolean)
}
// Instagram
if (activeTab === 'instagram') {
  if (instagramType === 'carousel') {
    urls = instagramImages.filter(img => selected.includes(img.id)).map(img => img.url)
  } else {
    urls = instagramImages.map(img => img.url)
  }
}
```

### Discover button enabled condition
```ts
const canDiscover =
  (activeTab === 'instagram' && instagramType === 'single' && instagramImages.length > 0) ||
  (activeTab === 'instagram' && instagramType === 'carousel' && selected.length > 0) ||
  (activeTab !== 'instagram' && selected.length > 0)
```

---

## Error Handling

| Scenario | Detection | User message |
|---|---|---|
| Profile URL | Client-side path check (`/p/` or `/reel/` absent) | "Paste a post or reel link, not a profile page." |
| Private post | 0 images parsed from embed | "This post is private or couldn't be reached." |
| Network / timeout | fetch throws | "Instagram couldn't be reached. Try again later." |
| Invalid URL | Client-side `isValidInstagramUrl` | Import button stays disabled |

---

## Out of Scope

- Profile import (not a hard requirement for launch)
- Video playback / reel thumbnails beyond the cover frame
- Instagram OAuth or account connection
- Saving imported posts for re-use
