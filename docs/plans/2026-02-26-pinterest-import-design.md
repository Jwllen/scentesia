# Pinterest Board Import — Design Document
**Date:** 2026-02-26
**Status:** Approved

---

## Overview

Allow users to import images from a public Pinterest board directly into the Scentesia vibe board, giving them a richer and more personal image selection experience.

---

## Approach

RSS feed parsing. Pinterest exposes a public RSS feed for every board at `https://www.pinterest.com/username/board-name.rss`. A server-side `fetch` returns XML that we parse to extract image URLs. No OAuth, no third-party dependencies, free.

---

## UI & Tab Structure

- The build page gets a two-tab toggle below the header: **Curated** | **Pinterest**
- Same minimal tracking-letter-spacing aesthetic as the rest of the page
- Tab selection state is independent from image selection — switching tabs preserves all selected images (curated + Pinterest count toward the shared 5-image cap)

**Pinterest tab state machine:**
1. **Empty** — full-width URL input with placeholder `"Paste a Pinterest board URL"` + disabled import button
2. **Valid URL entered** — import button activates
3. **Loading** — inline pulse spinner on the button, grid area visible underneath
4. **Loaded** — images appear in the vibe grid with staggered fade-in (`animation-delay: index * 60ms`)
5. **Error** — quiet error line below the input, matching existing build page error style

---

## API Route

**`GET /api/pinterest?url=<board-url>`**

### Steps

1. **Validate** — reject if URL doesn't match a Pinterest board pattern
2. **Normalise** — strip trailing slashes, convert international domains (`pinterest.fr`, `pinterest.co.uk`, etc.) to `pinterest.com`, append `.rss`
3. **Fetch** — server-side `fetch` with `User-Agent: Mozilla/5.0` header (same as proxy-image route)
4. **Parse** — regex over `<item>` blocks, extract `<img>` tags from `<description>`, upgrade image URLs from `236x` → `736x`
5. **Return** — `{ images: Array<{ id: string, url: string }> }`

### Response shape
```json
{
  "images": [
    { "id": "pin_123", "url": "https://i.pinimg.com/736x/..." },
    ...
  ]
}
```

---

## Client Integration

- Pinterest images arrive as URLs (not base64)
- The existing `analyzeImages` pipeline already accepts raw URLs — zero changes needed to `/api/analyze`, `/api/recommend`, or `/api/layer`
- On the build page, Pinterest-sourced images are stored alongside uploaded/curated selections and passed to the analyze route identically

---

## Error Handling

| Scenario | Detection | User message |
|---|---|---|
| Private board | RSS returns 0 items or redirect | "This board is private or couldn't be reached." |
| Bad URL | Client-side pattern check | Import button stays disabled |
| No images in feed | 0 items after parsing | "This board is private or couldn't be reached." |
| Network error | fetch throws | "Something went wrong. Please try again." |

---

## Out of Scope

- Pinterest OAuth / account connection (future)
- Saving imported boards for re-use
- Pagination beyond the RSS feed's default (~50 most recent pins)
- Retry logic (user can re-paste and try again)
