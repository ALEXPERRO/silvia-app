# Home Hero Layered Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the About Me (home) page's two-column hero (logo+mouse beside portrait+lily) with a single centered, layered composition — faded logo texture behind, portrait dominant in front, small crisp logo as a signature below — applied at every breakpoint.

**Architecture:** Template-only change to one Angular component (`Home`). No new components, no TypeScript/logic changes, no new assets — reuses the four existing images (`cover.logo.src`, `cover.main.src`, `giglio1.webp`, `topo.webp`) with new positioning/sizing/opacity via Tailwind utility classes on a `relative` + `absolute` stack, replacing the current `grid grid-cols-1 md:grid-cols-[...]` two-column layout.

**Tech Stack:** Angular 20 (standalone components, `NgOptimizedImage`), Tailwind CSS v4.

## Global Constraints

- Reuses existing assets only: `cover.logo.src` (`images/logo/title-plum.webp`), `cover.main.src` (`images/about_me/silvia.webp`), `images/elementi botanici/giglio1.webp`, `images/animali/topo.webp` — no new image files.
- Same composition at every breakpoint (mobile, tablet, desktop) — no separate mobile-only vs. desktop-only layout.
- No animation of any kind (no fade-in, no float, no parallax) — purely static.
- Decorative-only images (background logo texture, corner flourishes) get `alt=""`; the one accessible logo instance (the small signature copy) keeps `alt="Blooming Wild ART"`.
- Only `src/app/features/home/home.html` changes. `home.ts`, `content.service.ts`, `styles.css`, and every other file are untouched.
- Verification method for this codebase: `npx ng build` (SSR + prerender must succeed) plus manual visual check in a mobile-width browser viewport — this project has no unit/template test suite, so build success + visual confirmation is the established acceptance check (see prior work in this session).

---

### Task 1: Replace the hero `<header>` with the layered composition

**Files:**
- Modify: `src/app/features/home/home.html:13-31` (the `<header>` block only — everything above and below it is untouched)

**Interfaces:**
- Consumes: `cover.logo.src`, `cover.main.src`, `cover.main.scale` from `Home.cover` (already exposed as `protected readonly cover = this.content.cover;` in `home.ts` — unchanged, just re-read here).
- Produces: nothing consumed elsewhere — this is a leaf template block.

- [ ] **Step 1: Read the current file to confirm line numbers haven't drifted**

Run a read of `src/app/features/home/home.html` lines 1-32 and confirm the `<header>` block still matches:

```html
<header class="relative bg-blush flex items-center px-4 pt-5 pb-18 sm:py-16 md:py-24 mt-4 sm:mt-10 overflow-x-clip">
  <div class="relative w-full max-w-5xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-3 sm:gap-8 md:gap-16 items-center">
      <div class="relative flex justify-center order-2 md:order-1">
        <img ngSrc="images/animali/topo.webp" width="250" height="250" alt="" class="absolute bottom-10 -left-6 w-28 sm:w-56 sm:-left-24 sm:-bottom-52 md:-bottom-72 md:-left-70 md:w-72 -scale-x-100 pointer-events-none select-none" />
        <img [ngSrc]="cover.logo.src" width="1447" height="899" alt="Blooming Wild ART" class="relative z-10 w-44 sm:w-48 md:w-80 lg:w-lg" />
      </div>

      <div class="order-1 md:order-2 flex justify-center">
        <div class="relative w-full max-w-56 sm:max-w-55 md:max-w-sm">
          <img ngSrc="images/elementi botanici/giglio1.webp" width="300" height="300" alt="" class="absolute -top-18 -right-22 w-44 sm:-top-24 sm:-right-32 sm:w-80 md:-top-40 md:-right-48 md:w-96 rotate-30 pointer-events-none select-none" />
          <div class="relative z-10 aspect-3/4 border-[6px] border-white shadow-2xl hover:scale-[1.02] transition-transform duration-300 ease-out overflow-hidden">
            <img [ngSrc]="cover.main.src" [style.transform]="'scale(' + cover.main.scale + ')'" fill priority alt="Silvia" class="object-cover" />
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
```

If it doesn't match (someone else edited it since this plan was written), stop and reconcile before continuing — don't blindly overwrite.

- [ ] **Step 2: Replace the block with the layered composition**

Replace the entire `<header>...</header>` block above with:

```html
<header class="relative bg-blush flex items-center justify-center px-4 py-16 sm:py-20 md:py-28 mt-4 sm:mt-10 overflow-x-clip">
  <div class="relative w-full max-w-md sm:max-w-lg md:max-w-2xl mx-auto flex flex-col items-center">
    <!-- Layer 1: logo come texture di sfondo, sfumato -->
    <img
      [ngSrc]="cover.logo.src"
      width="1447"
      height="899"
      alt=""
      class="absolute z-0 w-[140%] max-w-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15 pointer-events-none select-none"
    />

    <!-- Flourish: topo, angolo basso -->
    <img
      ngSrc="images/animali/topo.webp"
      width="250"
      height="250"
      alt=""
      class="absolute z-10 bottom-2 -left-4 w-20 sm:w-28 md:w-36 -scale-x-100 pointer-events-none select-none"
    />

    <!-- Flourish: giglio, angolo alto -->
    <img
      ngSrc="images/elementi botanici/giglio1.webp"
      width="300"
      height="300"
      alt=""
      class="absolute z-10 -top-4 -right-4 w-24 sm:w-32 md:w-40 rotate-30 pointer-events-none select-none"
    />

    <!-- Layer 2: ritratto, protagonista -->
    <div class="relative z-20 w-56 sm:w-64 md:w-80 aspect-3/4 border-[6px] border-white shadow-2xl hover:scale-[1.02] transition-transform duration-300 ease-out overflow-hidden">
      <img [ngSrc]="cover.main.src" [style.transform]="'scale(' + cover.main.scale + ')'" fill priority alt="Silvia" class="object-cover" />
    </div>

    <!-- Layer 3: logo firma, piccolo e nitido -->
    <img
      [ngSrc]="cover.logo.src"
      width="1447"
      height="899"
      alt="Blooming Wild ART"
      class="relative z-20 w-32 sm:w-36 md:w-44 -mt-2"
    />
  </div>
</header>
```

Notes on values carried over unchanged from the current markup (don't second-guess these, they're deliberate):
- `-scale-x-100` on the topo image and `rotate-30` on the giglio image — preserves their existing flip/rotation exactly.
- `[style.transform]="'scale(' + cover.main.scale + ')'"` on the portrait `<img>` — preserves the existing per-image zoom hook from `content.service.ts`.
- `priority` on the portrait `<img>` — this is still the LCP candidate, keep it.
- The border/shadow/hover-scale treatment on the portrait frame div is unchanged from today.

- [ ] **Step 3: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.` — same as every prior successful build in this project. If NgOptimizedImage warns about the background-texture or signature `<img>` (e.g. "priority" suggestions, or fixed-size warnings), read the exact warning text and adjust only if it's an error — informational NgOptimizedImage suggestions (not errors) can be left as-is, this project already has precedent for this (the corner flourishes have always been positioned this way without `priority`).

- [ ] **Step 4: Visual check on a mobile-width viewport**

Use the `run` skill (or `npm start` + a browser resized to ~375–430px width, or DevTools mobile emulation) to view the `/` route. Confirm, in order:
1. The portrait is the clear focal point — larger and more prominent than the logo.
2. The background logo texture is visible but subtle (legible as "there's a logo back there," not competing for attention). If it reads too strong or too weak, adjust only the `opacity-15` class on the layer-1 image (try `opacity-10` through `opacity-20`) — this is the one value the spec explicitly called out as needing in-browser tuning.
3. The small signature logo below the portrait is crisp and fully opaque (not affected by the texture layer's opacity — it's a separate `<img>`).
4. The topo and giglio flourishes are visible at the corners, not overlapping the portrait itself, and keep their existing flip/rotation.
5. Resize to tablet/desktop widths and confirm the same composition scales up proportionally (no more side-by-side two-column layout at `md:`).

If step 2's opacity value needs adjusting per this check, edit the `opacity-*` class on the layer-1 `<img>` and re-run Step 3's build before moving on.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/home/home.html
git commit -m "$(cat <<'EOF'
feat(home): layered hero composition — logo texture behind, portrait as focal point

Replaces the two-column hero (logo+mouse beside portrait+lily) with a
single centered composition at every breakpoint: faded logo as a
background texture, portrait as the dominant focal point, a small
crisp logo as a signature below. Diagnosed via brainstorming (see
docs/superpowers/specs/2026-07-13-home-hero-layered-composition-design.md)
that the prior layout had no clear visual focus on mobile.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review notes

- **Spec coverage:** background texture layer ✓ (Step 2), dominant portrait ✓ (Step 2), signature logo ✓ (Step 2), flourishes kept/repositioned ✓ (Step 2), same composition at all breakpoints ✓ (single container, no `md:grid-cols`), no animation ✓ (no `transition`/`animate-*` added beyond the pre-existing hover scale), accessibility (`alt=""` vs `alt="Blooming Wild ART"`) ✓ (Step 2), only `home.html` touched ✓ (Task 1 is the only task, one file).
- **No placeholders:** every step has literal code or literal commands, no "add appropriate X".
- **Type/interface consistency:** N/A beyond the `cover.*` property names, which are read as-is from the existing `Home` component with no changes.
