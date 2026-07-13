# Home hero — layered logo/portrait composition

## Context

The user asked for the About Me (home) page to feel "premium"/"wow", especially on mobile. Brainstormed through the visual companion (three mockups, real site assets): the diagnosis was that the current hero has **no visual focal point** — the logo block (logo + mouse illustration) and the portrait block (portrait + lily illustration) sit side by side (mobile: stacked) with roughly equal visual weight, so the eye doesn't know where to look first.

Approved direction ("Option C" from the mockups): the logo becomes a large, faded background texture instead of a standalone element; the portrait becomes the single dominant focal point in front of it; a small, crisp copy of the logo sits below the portrait as a signature/wordmark. The existing botanical flourishes (lily, mouse) stay, small and decorative, in the corners.

This is a **static, layout-only** change — no new entrance/idle animation. The user separately tried and rejected a motion-based "wow" attempt earlier in this project; the diagnosis this time explicitly pointed at composition, not motion.

## What stays the same (out of scope)

- The "About me" `<h1>` + bio paragraphs section above the hero — untouched, stays a separate section.
- All other home sections (Dal Portfolio, Prossimo Workshop, CTA Shop) — untouched.
- No new image assets — reuses `cover.logo.src` (`images/logo/title-plum.webp`), `cover.main.src` (`images/about_me/silvia.webp`), `images/elementi botanici/giglio1.webp`, `images/animali/topo.webp`.
- No animation of any kind on this hero (fade-in, float, parallax) — purely a static composition change.
- `Home` component TypeScript (`home.ts`) — no logic changes; this is template + CSS only.

## Design

### Layout structure

Replace the current `<header>` block (two-column `grid` with `md:grid-cols-[1.05fr_0.95fr]`, logo+mouse on one side, portrait+lily on the other, reordered on mobile) with a single centered stack, same composition at **every breakpoint** (mobile, tablet, desktop) — just scaling proportionally. No more side-by-side grid, no more `order-*` breakpoint juggling.

Three layers, back to front (via `position: relative` container + `position: absolute` for layers 1 and 3, matching the existing pattern already used elsewhere in this file for decorative overlays):

1. **Background texture (layer 1):** `cover.logo.src`, enlarged (roughly 1.3–1.5× the portrait's width) and centered, low opacity (~0.15–0.18, tuned in-browser against the `bg-blush` header background — the mockup used 0.16 as a starting point). Purely decorative: `aria-hidden`, empty `alt=""`, `pointer-events-none`.
2. **Portrait (layer 2, dominant):** unchanged frame treatment (white border, shadow, `hover:scale-[1.02]`) from the current markup, just re-centered instead of living in its own grid column. This is the single visual focus — sized larger, proportionally, than it is today on mobile (today's portrait column is capped `max-w-56`/`sm:max-w-55`; this pass can size it more generously since it no longer shares horizontal space with the logo column).
3. **Signature logo (layer 3):** a second, small, crisp instance of `cover.logo.src` positioned just below/overlapping the bottom edge of the portrait frame, full opacity — reads as a wordmark/signature, not a competing hero element. Has the real `alt="Blooming Wild ART"` (this is the one accessible instance of the logo in the hero; the background texture copy is decorative/`alt=""`).

Botanical flourishes (`giglio1.webp`, `topo.webp`): kept, repositioned to corners of the new centered composition (top corner / bottom corner, similar spirit to today's placement), small, `pointer-events-none`, decorative (`alt=""`). Existing flip (`-scale-x-100` on the mouse) and rotation (`rotate-30` on the lily) are preserved as-is.

### Responsive scaling

Since the same composition now applies at all breakpoints, sizing is driven by a consistent set of breakpoint steps on the portrait (the sizing anchor — texture logo and flourishes scale relative to it via proportionally-matched breakpoint classes), rather than the current split between a mobile stack and an `md:` two-column grid. Concretely this means the `<header>`'s inner `grid grid-cols-1 md:grid-cols-[...]` wrapper is removed and replaced with a single `relative flex flex-col items-center justify-center` (or equivalent) container sized per breakpoint.

### Accessibility

- Background texture logo and corner flourishes: `alt=""` (decorative), already the existing convention for the flourishes in this file.
- Signature logo: keeps a real `alt="Blooming Wild ART"` since it's the one accessible/meaningful logo instance in this hero (today both logo instances would have been redundant — this design consolidates to one accessible instance).
- No `prefers-reduced-motion` concerns — nothing animates.

## Files touched

- `src/app/features/home/home.html` — replace the `<header>` block's internal structure only. Nothing else in the file changes.

No changes to `home.ts`, `content.service.ts`, `styles.css`, or any other component.
