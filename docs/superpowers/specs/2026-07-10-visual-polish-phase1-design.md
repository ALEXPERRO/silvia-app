# Blooming Wild ART — Visual polish, Fase 1 (fondamenta grafiche)

## Context

The ground-up "Blooming Wild ART" redesign (see `2026-07-09-visual-redesign-design.md`) is complete, reviewed, and live on `main`. The user then asked for a further pass to make the site "stupendo" — both graphically and functionally. Because that combined ask spans several independent concerns, it was split into phases, each with its own brainstorm → plan → execution cycle:

1. **Fase 1 (this spec)** — visual foundations: decorative language, section rhythm, showcase-frame treatment, micro-animations, a contrast fix.
2. Fase 2 — content/engagement (social links, newsletter, "dietro le quinte").
3. Fase 3 — Eventi UX (multi-step form, slider position indicator).
4. Fase 4 — Portfolio (lightbox prev/next navigation, image-protection question).
5. Fase 5 — Shop reale (real Etsy integration, depends on external account/data).

This spec covers **only Fase 1**. It was validated with the user through a series of visual mockups (the brainstorming visual companion) covering three directions (A: botanical-minimal, B: editorial-rich, C: illustrated-collage) and two intensity levels of the chosen B+C mix.

## What stays the same (out of scope for this pass)

- Routing, the four route components, and all `.ts` logic (gallery filtering, lightbox state, event slider/scroll, reactive booking form + Supabase submission, shop product grid data) — unchanged.
- `ContentService` data shape — unchanged. No new fields are introduced (see Badges below — deliberately scoped to data that already exists).
- The Portfolio grid's ordered, allineata layout — this phase does **not** touch its structure (see Showcase treatment below).
- The About Me bio text stays the placeholder ("Testo in arrivo...") — no copy is invented here.
- Shop/Etsy content, social links, newsletter, form structure, lightbox navigation — all deferred to their own phases above.

## Design system additions

These extend, not replace, the existing `styles.css` token set (`parchment`, `blush`, `surface`/`white`, `moss`, `moss-hover`, `sage`, `bark`, `plum`, `plum-hover`, `plum-soft`, `gray-*` ink scale).

### 1. Section rhythm — alternating backgrounds

Today every page sits on one uniform `bg-blush` body. Each page's major sections now alternate `blush` / `parchment` so scrolling has a visible rhythm instead of one flat field. Concretely (see Page-by-page below for the exact sequence per page). The `<body>`/`<main>` shell keeps a `blush` base; individual `<section>` elements override with `bg-parchment` where the sequence calls for it.

### 2. Watercolor bloom backgrounds (sobria / subtle intensity)

A reusable background treatment — soft, blurred color patches, not isolated decorative shapes — approved at the "sobria" intensity in the mockup (low opacity, minimal rotation). Implemented as a small CSS utility in `styles.css`:

```css
.bg-bloom {
  background-image:
    radial-gradient(circle at 15% 10%, rgb(92 107 51 / 0.10), transparent 40%),
    radial-gradient(circle at 85% 90%, rgb(110 79 107 / 0.12), transparent 40%);
}
```

Applied as an additional class alongside a section's `bg-blush`/`bg-parchment` (it layers on top via `background-image`, the solid color remains the `background-color`). Used on hero-weight sections only (Home hero, Eventi definition/slider intro, Shop banner area) — not on every section, to avoid visual fatigue.

### 3. Hand-drawn section dividers

A reusable divider between major sections on a page: a thin horizontal rule in `rule` (`#CDAF80`) with a small centered dot, both sides. New shared markup (small enough to inline per-page rather than a new component):

```html
<div class="flex items-center gap-3 w-2/3 max-w-xs mx-auto">
  <span class="flex-1 h-px bg-gray-200"></span>
  <span class="w-1.5 h-1.5 rounded-full bg-bark"></span>
  <span class="flex-1 h-px bg-gray-200"></span>
</div>
```

Placed between sections wherever the background alternates (see Page-by-page).

### 4. Showcase-frame treatment (collage/rotation) — vetrina spots only

Applies **only** to: Home hero photo, Eventi slider's event visual, Shop's Etsy CTA banner accent. **Not** applied to the Portfolio grid (stays ordered/allineata, confirmed with the user) and not to Shop's product grid (same reasoning — many same-size tiles read better aligned).

- Frame keeps the existing thick `border-white` treatment and slight rotation (Home hero already does `-rotate-2` — this phase extends the same idea, doesn't invent a new mechanism).
- New: a small corner flourish on showcase frames only — an L-shaped bracket in `moss`, positioned top-right, ~24px, `border-top`/`border-right` only, rounded outer corner. Pure CSS (`::after` pseudo-element or a small inline `<span>`), no new icon needed.

### 5. Functional badges (plum)

Small uppercase pill/tag in `plum` background, `surface`-colored text, used only where existing data already supports the state — no invented fields:

- **Eventi**: the existing "Solo N posti ancora disponibili" / sold-out warning gets a badge treatment (small plum pill for the urgency message, keeps the existing `red-500`/sold-out distinct treatment for the sold-out case — badges add visual weight, they don't replace the color-coded logic already there).
- **Shop / Portfolio**: no badge is added here in this phase — neither `ContentService` product nor gallery item currently carries a "new"/"featured" flag, and inventing one is out of scope (would require a data-model decision, belongs in a future phase if wanted).

### 6. Micro-animations

- **Scroll reveal**: sections/cards fade + rise slightly (~12px, ~300ms) as they enter the viewport. Implemented with a small reusable `IntersectionObserver`-based directive or a shared host-listener helper (single implementation, applied via a class like `.reveal-on-scroll`) — respects `prefers-reduced-motion` (no motion, just fade, or skip entirely, for users who request it).
- **Hover tilt**: showcase frames only (same scope as §4) get a small additional rotation/lift on hover, layering on top of the existing hover states (e.g. Portfolio/Shop card `border` hover color stays as-is, unaffected — tilt is only for the vetrina frames, not grid tiles).

### 7. Accessibility contrast fix

Measured WCAG contrast ratios of the current caption/meta text colors against the page backgrounds:

| Text token | on `blush` | on `parchment` | on `surface` |
|---|---|---|---|
| `gray-400` (`#A38B62`) | 2.44 | 2.86 | 3.03 |
| `gray-500` (`#8F7852`) | 3.15 | 3.69 | 3.92 |
| `gray-600` (`#6B5842`) | **5.06** | **5.93** | **6.29** |

`gray-400` and `gray-500` — used today for captions/meta text (Portfolio item labels, Shop product descriptions, Eventi meta rows, Home photo caption) — fail WCAG AA (4.5:1) on every page background. `gray-600` clears AA on all three. **Fix: every caption/meta text instance currently on `text-gray-400` or `text-gray-500` moves to `text-gray-600`.** This is a targeted class swap across the affected templates, not a token redefinition (leaves `gray-400`/`gray-500` available for non-text uses like borders/icons where contrast rules don't apply).

## Page-by-page

### Navbar / Footer
Unchanged in structure. Footer's `surface` background already reads fine against the new rhythm; no changes needed here beyond what Fase 1 elsewhere touches.

### Home / About Me
- Hero section: `bg-blush` + `.bg-bloom`, hero photo gets the corner flourish (§4) and hover tilt (§6), bio box gets the same frame language (thin border, small corner accent) while keeping the "Testo in arrivo..." placeholder text verbatim.
- No second section exists on Home today beyond the hero — no divider needed here.

### Portfolio
- Header/intro area: `bg-parchment` (alternation point #1), divider before the grid section which returns to `bg-blush`.
- Grid: **no rotation/collage treatment** (confirmed out of scope, §4) — only the contrast fix (§7) on the caption text, and scroll-reveal (§6) as tiles enter view.
- Lightbox: unchanged (prev/next nav is Fase 4).

### Eventi
- Definition block + slider intro: `bg-blush` + `.bg-bloom`.
- Divider, then booking-form section: `bg-parchment`.
- Slider event visual gets the showcase treatment (§4); urgency/sold-out messaging gets the badge treatment (§5); meta text (date/location, contrast fix §7).
- Form itself: structural/logic untouched (Fase 3 territory) — only the contrast fix applies to any caption-weight text.

### Shop
- Intro + Etsy CTA banner: `bg-blush` + `.bg-bloom` on the banner only, banner keeps its accent corner flourish (§4 scope).
- Divider, then product grid section: `bg-parchment`.
- Product grid: no rotation (confirmed out of scope, same reasoning as Portfolio) — contrast fix (§7) on description/price meta text, scroll-reveal (§6).

## Non-goals / explicitly out of scope for Fase 1
- No changes to any `.ts` logic, routing, or `ContentService` data shape.
- No new "featured"/"new" data fields for Shop or Portfolio badges.
- No Portfolio grid or Shop grid rotation/collage treatment.
- No lightbox prev/next navigation (Fase 4).
- No multi-step Eventi form or slider position indicator (Fase 3).
- No social links, newsletter, or new content sections (Fase 2).
- No real Etsy integration (Fase 5).
- No new bio copy invented for the Home placeholder.
