# UnityAlgo Design System

Living reference for the visual language, tokens, and component inventory used across the site and admin panel. The single source of truth for every value here is [`app/globals.css`](app/globals.css) — this file documents and explains it, but `globals.css` wins if the two ever disagree.

For a **live, rendered** view of most of this (color swatches, typography samples, buttons, forms, cards), see the `/theme-preview` route (`app/theme-preview/page.tsx`) when running the app locally.

---

## 1. Brand colors

Defined once under `@theme` in `app/globals.css`, consumed everywhere via Tailwind utilities (`bg-brand`, `text-brand`, `border-brand/15`, etc.).

| Token | Value | Contrast on white | Role |
|---|---|---|---|
| `--color-brand` | `#8C181B` (crimson) | 9.29:1 | Links, icons, badges, small accents |
| `--color-brand-deep` | `#711316` | 11.62:1 | Hover state for brand text/icons |
| `--color-brand-press` | `#591013` | 13.92:1 | Active/pressed state |
| `--color-brand-soft` | `#BC292E` | 6.01:1 | Decorative only (dots, shadows) |
| `--color-brand-subdued` | `#F8E9EA` | — | Light tint background (badges, active nav items) — feeds `--color-accent` |
| `--color-link` | `#0066CC` | 5.57:1 | Hyperlink-styled text only (Button's `link` variant, inline links) — deliberately decoupled from brand |
| `--color-gold` | `#B45309` | 5.02:1 | Secondary accent — gradient-fill headline words, CTA/underline accents. **Sparingly** |

> **Brand is not the button fill.** The system follows a Red Hat / Oracle-style monochrome direction: primary buttons and cards fill with neutral `ink-900`, and `--color-primary` maps to `ink-900`, *not* to brand. Brand is reserved for links, icons, badges, and small accents. This is the single most commonly-missed rule in this palette.

**Five explicit named roles, not a computed scale.** Earlier iterations had a precomputed `brand-50…950` scale, but it conflated actual branding with "near-black for headings/dark sections". Now hover/active states are explicit tokens (`brand-deep`, `brand-press`), light tints use `brand-subdued` or opacity (`border-brand/15`), and anything needing "near-black" uses the **`ink`** scale — see §2.

```css
--color-brand: #8C181B;
--color-brand-deep: #711316;
--color-brand-press: #591013;
--color-brand-soft: #BC292E;
--color-brand-subdued: #F8E9EA;
--color-link: #0066CC;
--color-gold: #B45309;
```

## 2. Neutral scale — `ink`

A single 11-step **true grayscale** (0% saturation) scale. A monochrome black/white system — where buttons and cards fill with neutral ink rather than brand — needs a genuinely neutral black, not one carrying a leftover hue from a brand that has since changed.

| Token | Value | Contrast on white | Typical use |
|---|---|---|---|
| `ink-50` | `#F7F7F7` | — | Tint backgrounds, table stripes |
| `ink-100` | `#F0F0F0` | — | Muted backgrounds, dividers |
| `ink-200` | `#E0E0E0` | — | Borders (`--color-input`) |
| `ink-300` | `#CCCCCC` | — | Stronger borders |
| `ink-400` | `#9E9E9E` | ~2.8:1 | Decorative/placeholder text only (below AA — icons, low-emphasis) |
| `ink-500` | `#707070` | 4.95:1 | Muted text |
| `ink-600` | `#575757` | 7.23:1 | Secondary text |
| `ink-700` | `#404040` | — | Emphasis text |
| `ink-800` | `#2B2B2B` | — | Primary button hover fill |
| `ink-900` | `#1F1F1F` | 16.48:1 | **Heading/body text default** (`--color-foreground`) **and primary button fill** (`--color-primary`) |
| `ink-950` | `#151515` | 18.26:1 | Darkest chrome — footer, dark section backgrounds |

## 3. Status colors

Semantic, independent of the brand hue on purpose — see the inline comment in `globals.css` for the reasoning (error needed to stay visually distinct from a crimson-era brand; kept as-is after the indigo pivot since it still reads clearly as "not brand").

| Status | 50 | 100 | 500 | 600 | 700 |
|---|---|---|---|---|---|
| Success | `#F0FDF4` | `#DCFCE7` | `#16A34A` (icons, 3.30:1) | `#15803D` (text, 5.01:1) | `#166534` (high-emphasis, 7.13:1) |
| Warning | `#FFFBEB` | — | `#F59E0B` | `#D97706` | `#B45309` (text, 5.02:1) — same hex as `--color-gold` |
| Error | `#FEF2F2` | `#FEE2E2` | `#EF4444` | `#DC2626` | `#B91C1C` (text, 6.47:1) |
| Info | `#EFF6FF` | — | `#3B82F6` | `#2563EB` | — |

## 4. Base tokens (shadcn-style)

These map the shadcn/ui convention names onto the brand/ink scales above — this is the layer most components actually reference (`bg-primary`, `text-muted-foreground`, etc.) rather than the raw `brand-*`/`ink-*` tokens directly.

| Token | Value |
|---|---|
| `--color-background` | `#FFFFFF` (stark white — Red Hat/Oracle register, not an off-white) |
| `--color-foreground` | `var(--color-ink-900)` |
| `--color-primary` / `-foreground` | `var(--color-ink-900)` / `#FFFFFF` — **monochrome, not brand**; hover uses `ink-800` via Button's own variant |
| `--color-secondary` / `-foreground` | `var(--color-ink-100)` / `var(--color-ink-900)` |
| `--color-accent` / `-foreground` | `var(--color-brand-subdued)` / `var(--color-brand)` — the explicit subdued value, not a `color-mix()` derivation |
| `--color-destructive` | `var(--color-error-600)` |
| `--color-muted` / `-foreground` | `var(--color-ink-50)` / `var(--color-ink-500)` |
| `--color-ring` | `var(--color-primary)` — was brand, but crimson focus rings read as an error state next to the red error colors |
| `--color-input` | `var(--color-ink-200)` |
| `--color-popover` / `-foreground` | `#FFFFFF` / `var(--color-foreground)` |

### Sidebar tokens

The shadcn Sidebar primitive (used by the customer panel shell) has its own token group, mirroring the white-sidebar / brand-tinted-active-item look rather than introducing a separate dark theme:

| Token | Value |
|---|---|
| `--color-sidebar` | `#FFFFFF` |
| `--color-sidebar-foreground` | `var(--color-ink-700)` |
| `--color-sidebar-primary` / `-foreground` | `var(--color-ink-900)` / `#FFFFFF` |
| `--color-sidebar-accent` / `-foreground` | `var(--color-accent)` / `var(--color-brand)` |
| `--color-sidebar-border` | `var(--color-ink-200)` |
| `--color-sidebar-ring` | `var(--color-ring)` |

## 5. Typography

| Purpose | Font | Loaded via |
|---|---|---|
| Body / headings | Geist | `next/font/google` in `app/layout.tsx` (`--font-geist`); applied by `body {}` and `h1,h2,h3 {}` in `globals.css` |
| Logo wordmark only | Poppins | `.font-logo` utility class, used solely by `components/Logo.tsx` |
| Hero-scale display type | *(none loaded)* | `.font-display` utility class — an opt-in hook that currently falls back to Geist |

> **Both previously-flagged font bugs are now fixed:**
> 1. `layout.tsx` used to load Inter *and* apply `inter.className` to `<body>`, but `globals.css`'s `body { font-family: var(--font-geist) }` always won the cascade — so Inter was downloaded on every page load and never rendered. Inter has been removed; Geist is now loaded and applied consistently, with no change to what renders.
> 2. `.font-display` (on the homepage hero `<h1>`) referenced an undefined `--font-display` and silently resolved to nothing. It now declares an explicit fallback: `var(--font-display, var(--font-geist))`. Rendering is unchanged — to introduce a real display face, load it in `layout.tsx` and expose it as `--font-display`, and this rule will pick it up automatically.

**Scale** (Tailwind defaults, as used in practice across marketing pages):
- Hero H1: `text-5xl sm:text-7xl lg:text-8xl`, `leading-[0.95]`, `font-semibold`
- Section H2: `text-4xl md:text-5xl`, `font-bold`
- Card/subsection H3: `text-2xl` / `text-3xl`, `font-bold`
- Lead paragraph: `text-lg` or `text-xl`, `text-ink-600`, `leading-relaxed`
- Body: `text-base`, `text-ink-600`
- Caption/meta: `text-sm` / `text-xs`, `text-ink-500` or `text-ink-400`
- Eyebrow label: `text-xs uppercase tracking-wide font-semibold text-brand`

## 6. Spacing, radius & shadows

No custom spacing scale — Tailwind's default `4px` step is used directly.

| Radius | Where |
|---|---|
| `rounded-md` | Admin form inputs, compact controls |
| `rounded-lg` / `rounded-xl` | Nav pills, sidebar items |
| `rounded-2xl` | Standard cards, badges wrapper |
| `rounded-3xl` | Feature/marketing cards, hero panels |
| `rounded-full` | Buttons, pills, avatars, dots |

| Shadow | Where |
|---|---|
| `shadow-sm` → `shadow-xl` (standard Tailwind scale) | Card elevation, hover states |
| `shadow-ink-900/5` | Generic soft card hover shadow (neutral, not brand-tinted) |
| `shadow-brand/20`–`/25` | Brand-tinted shadow, reserved for genuine CTA/highlight moments (e.g. the recommended pricing plan, primary buttons) |

## 7. Motion

Built on `motion/react` (Framer Motion). Conventions used throughout:

- Section/card entrances: `initial={{ opacity: 0, y: 20 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true }}` — staggered via `transition={{ delay: index * 0.05–0.1 }}`
- Hero headline: line-by-line reveal via `y: '110%' → '0%'` inside `overflow-hidden` wrappers
- Magnetic buttons: `useMotionValue` + `useSpring` tracking cursor offset (`components/website/hero-section.tsx`'s `MagneticButton`)
- Ambient blobs: `@keyframes blob` (translate + scale loop, `--animate-blob: blob 7s infinite`)
- Orbit rings (`orbital-sphere-background.tsx`): plain CSS `animate-spin` at custom durations (40s/55s) with negative `animation-delay` offsets, no JS needed
- All decorative background effects (particle/wave/orbit canvases) respect `prefers-reduced-motion` and pause via `IntersectionObserver` when scrolled off-screen

## 8. Component inventory

### `components/ui/` — shadcn primitives
`accordion` · `alert-dialog` · `breadcrumb` · `button` · `checkbox` · `dialog` · `input` · `label` · `popover` · `select` · `table` · `tabs` · `textarea`

All follow the same convention: `data-slot` attributes, `cn()` for class merging, Radix primitives underneath where interactive state/accessibility is needed (dialog, select, checkbox, tabs, accordion, popover, alert-dialog, label), plain semantic HTML where it isn't (table, textarea, breadcrumb).

### `components/website/` — marketing site sections
`hero-section` · `how-we-build-section` · `services-section` · `contact-section` · `faq-section` · `pricing-table` · `project-flow` · `features-grid` · `blog-card` · `module-page-content` · `sidebar-overview` · `orbital-sphere-background` (decorative hero background)

### `components/admin/` — admin panel
`admin-sidebar` · `admin-breadcrumbs` · `delete-button` (shadcn `AlertDialog`-based confirm-before-delete, shared across Blogs/Contacts/Users) · `quill-editor` (Quill.js-based rich text editor, dynamically imported client-only) · `cover-image-field` (URL/upload toggle via shadcn `Tabs`) · `pagination`

### `components/layouts/`
`header` · `footer`

### Logo
`components/Logo.tsx` — SVG mark + Poppins wordmark, two size presets in practice (`h-9`–`h-12` depending on context: header, footer, admin sidebar). Wraps a `Link` to `/`.

## 9. Key dependencies

| Library | Used for |
|---|---|
| `motion` (Framer Motion) | All animation/transitions |
| `@radix-ui/react-*` | Accessible primitives under `components/ui/` |
| `class-variance-authority` | Variant styling for `Button` |
| `lucide-react` | Icon set, site-wide |
| `simplex-noise` | Procedural wave-line canvas backgrounds |
| `quill` | Admin blog post rich text editor (replaced TipTap) |

## 10. Where to look things up

- **Tokens**: `app/globals.css` (`@theme` block) — always the source of truth
- **Live visual reference**: `/theme-preview` route
- **Font loading**: `app/layout.tsx`
- **Tailwind config**: none separate — Tailwind v4, config lives entirely in `globals.css`
