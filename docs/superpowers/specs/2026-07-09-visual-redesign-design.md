# Blooming Wild ART — Ground-up visual redesign

## Context

The site (silvia-app, Angular 20 standalone + Tailwind v4) already went through one incremental "nature-witch" re-theme in an earlier session (palette override, icon component, background texture). The user then asked for a full ground-up graphic rebuild instead: same four sections and their underlying logic, entirely new visual system — because the previous result felt too generic/safe and not distinctly "nature-witch" enough.

The site's actual logo (`public/images/logo/logo.png` — a hand-lettered olive-green script "Blooming Wild" + tracked "ART", framed by a watercolor deer-antler wreath with dusty mauve florals and sage leaves, on a blush background) was discovered to be unused anywhere in the app. It became the anchor for this redesign: every color and much of the visual language is derived from it rather than invented.

This spec was produced via `superpowers:brainstorming`, validated with the user through a series of targeted questions and a visual mockup (Claude Artifact) covering palette, typography, icons, navbar, and the About Me hero. The user approved that direction, including a follow-up change (page background moved from the lighter "parchment" to the warmer "blush" tone, with matching hover states), and confirmed the remaining three pages (Portfolio, Eventi, Shop) should extend the same language — no further mockups needed for those.

## What stays the same (out of scope for this redesign)

Only the visual layer changes. Preserve as-is:
- Routing (`app.routes.ts`), the four routes/components (`Home`, `Portfolio`, `Eventi`, `Shop`) and their `.ts` logic — gallery category filtering, lightbox state, event slider/scroll behavior, the reactive booking form + Supabase submission + seat-decrement logic, shop product grid data.
- `ContentService` as the single data source (event/product/gallery content). Fields may be *read differently* by new templates but the service's data shape and Supabase integration are not being redesigned here.
- The portfolio illustration library and photo assets (`public/images/**`) — reused, not replaced.

## Design system

### Palette (sampled from the logo, one intentional deviation)

| Token | Hex | Source | Role |
|---|---|---|---|
| `parchment` | `#F7EFDF` | Lightened blush | Secondary surfaces: navbar bar, alternating panels |
| `blush` | `#EEDCC7` | Logo background circle | **Page background**, used everywhere as the base |
| `surface` (card) | `#FBF6EC` | Lightened parchment | Card/panel fills (hero, event card, product card, type blocks) — sits lighter than the blush page bg |
| `moss` | `#5C6B33` | Logo script color | Primary accent — links, active nav state, primary CTA fills, icon strokes |
| `moss-hover` | `#47531F` | Darkened moss | Hover state for moss text/links |
| `sage` | `#8A9A6E` | Logo leaves | Secondary green — icon accents, muted details |
| `bark` | `#7C6248` | Logo antlers / "ART" wordmark | Borders, secondary text, rules |
| `plum` | `#6E4F6B` | Logo flower petals, **shifted from dusty-rose toward violet** | Rare accent — kickers/eyebrows, one hover/active treatment, the "viola" the user asked for explicitly |
| `plum-hover` | `#5A3F58` | Darkened plum | Hover state for plum accents |
| `ink` | `#2C2415` | — | Headings, primary text |
| `ink-soft` | `#6B5842` | — | Body text |
| `ink-faint` | `#8F7852` | — | Captions, meta text, hex-label-style detail |
| `rule` | `#CDAF80` | — | Hairline dividers/borders (needs to read clearly against the blush bg) |

`plum` is the one color not lifted 1:1 from the logo — the real petals are dustier/pinker. It was deliberately pushed toward violet so the palette has a genuine, legible purple accent rather than reading as pink, per the original brief ("accenti viola"). Confirmed with the user in the artifact review.

No dark theme is needed — the user confirmed the site ships in this single light/blush world only.

### Typography

- **Display serif** (headings, page titles, event/product titles): **Fraunces**, weight ~450–550, used upright for structural headings.
- **Script accent** (small, sparing use only — a kicker phrase, a pull-quote, never long-form): **Fraunces italic**. No separate handwriting/script webfont — the italic optical-size axis of Fraunces itself supplies the calligraphic feel the logo's script suggests, without juggling a third typeface.
- **Body / UI / labels**: **Work Sans**, regular/medium/semibold. Uppercase labels (nav, eyebrows, meta) get ~0.12–0.16em letter-spacing.
- Both load from Google Fonts in `index.html`, replacing the current Bodoni Moda + Montserrat `<link>` — same mechanism already in use, just swapped families. Update `--font-title`/`--font-body` in `styles.css` accordingly.

### Icons

Replace the existing `Icon` component's Lucide-style geometric SVGs with a redrawn **organic line-icon** set: same ~1.6–1.8px stroke weight and rounded caps, but hand-adjusted curves (slightly irregular, less mechanically perfect) so they read as sketched rather than app-generated. Same icon inventory as today (calendar, map-pin, map, ticket, sparkles→leaf-sparkle, alert-triangle, ban, x, chevrons) — this is a redraw of `icon.html`'s SVG paths, not a new component API. Icon color defaults to `moss`; on hover (where the icon sits inside an interactive control) it shifts to `plum` with a small lift/rotate, per the artifact.

### Layout principle: "editorial herbarium"

- Asymmetric, editorial composition — not everything centered. Generous whitespace on the blush ground.
- One focal botanical/line-art detail per section (a single small corner sprig, etc.), not a repeating background pattern tiled everywhere (the previous session's tiled `.bg-botanical` texture is retired in favor of this sparser, more editorial use of decoration).
- Photos are treated like pressed specimens: thin-bordered frame, small uppercase caption beneath (e.g. "Silvia, nel suo studio"), slight rotation allowed for a hand-placed feel — not full-bleed, not heavily cropped into geometric containers.
- Cards (event, product, type/quote blocks) share one language: `surface` fill, 1px `rule` border, soft shadow, 4px radius, hover = lift + border shifts to `plum`.

### Branding

The logo (`public/images/logo/logo.png`) is introduced into the navbar for the first time (it exists in the repo but has never been used). Navbar becomes: logo mark (small, circular crop) + "Blooming Wild" in moss italic + "ART" tracked small-caps in `ink-faint`, sitting on the `parchment` bar, with the four section links to its right/below per current responsive behavior. Nav link hover/active states use `moss`/`moss-hover` with an underline, replacing the current green underline treatment (same mechanism, new colors).

## Page-by-page

### Navbar / Footer
- Navbar: `parchment` bar (distinct from the `blush` page body), logo + wordmark added (see Branding), links restyled per the type/color system above.
- Footer: restyle to match — `surface` background, `rule` top border in `plum-soft`-adjacent tone (as already partially done in the prior session), text in `ink`/`ink-faint`.

### Home / About Me
Per the approved artifact hero: asymmetric two-column layout (copy left, framed photo right on desktop; stacked on mobile — must keep the photo fully visible at all breakpoints, this was a real bug fixed in the prior session and must not regress). Kicker ("Illustratrice · Blooming Wild ART") in `plum` uppercase, name in large Fraunces, the pending bio placeholder text in a `surface` pull-quote block, one small corner line-art detail (sage). The bouncing "Prossimi Eventi" button and the old rotated sticky-note headline cards remain removed (per the prior session) — this redesign does not reintroduce them.

### Portfolio
- Filter control becomes underlined serif tabs (moss when active) instead of filled pill buttons.
- Gallery grid: each tile is a small specimen card — thin `rule` frame, image with breathing room (not edge-to-edge), a caption label below the image (not a hover overlay) showing the illustration title in small-caps Work Sans.
- Lightbox: backdrop becomes `ink`-tinted (not pure black), the enlarged image keeps a thin frame consistent with the grid tiles, caption below in the same style, close control uses the redrawn `x` icon.

### Eventi
- Keep the "definition block" (whim·sy / ar·tis·try / …) — it already fits the editorial-herbarium voice; restyle its card to the shared `surface`/`rule` language.
- Event cards: shared card language (frame, corner detail optional), meta row (date/location) using the redrawn organic icons, CTA buttons recolored — primary action in `moss` fill, "Mappa" secondary in outline `bark`/`ink-soft`, sold-out state keeps a clearly different (desaturated) treatment.
- Booking form: section headers as small-caps labels over a thin `rule` divider (replacing the current bordered block look), inputs keep rounded fields but recolored borders (`rule`/`moss` focus), submit button in `moss` (replacing the near-black `gray-950` fill).

### Shop
- Product cards: square framed photo (specimen-label treatment matching Portfolio tiles), title in Fraunces, price in Work Sans semibold, "Vedi su Etsy" link in `moss`.
- Etsy CTA banner: recolored from near-black `gray-900` to `ink`/`moss`-based dark fill so it reads as part of this palette rather than a generic dark UI block.

## Non-goals / explicitly out of scope
- No dark theme.
- No changes to the booking/Supabase logic, gallery data model, or routing.
- No new bio copy is invented — the About Me text box stays a clearly-marked placeholder until the user supplies real copy.
- No new decorative photography/illustration is commissioned; only the existing asset library and the logo are used.
