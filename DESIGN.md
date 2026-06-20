# Design

## Visual Theme

A high-density, dark-by-default operations aesthetic with cyan as the primary signal color. The marketing surface treats typography and 3D as the medium; the operator dashboard treats data and status as the medium. They share one typeface family, one ink ramp, one motion grammar — but they don't share a layout reflex.

Color strategy: **Committed**. One saturated cyan (~OKLCH `0.78 0.16 215`) carries 30-50% of the visible surface on the marketing site through accents, links, key motion glows, and the loop's animated path. Operator surfaces keep it to 8-12% — used only on the active task and unread state. The rest of the canvas is a near-black blue-tinted neutral.

The aesthetic family is **operations control room** — radar screens, dispatch consoles, ATC dark mode — modernized with 2026-era variable fonts and WebGL. The trap to refuse: cream/paper SaaS backgrounds, gradient-mesh hero blobs, "AI co-pilot" copy, hand-drawn SVGs, gradient text, glassmorphism as default.

## Color Palette

All colors in OKLCH for perceptual uniformity. The hex values shown are for reference only — design from the OKLCH values.

### Ink (dark surfaces)

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--ink-base` | `oklch(0.13 0.012 250)` | `#0b0f17` | Page background |
| `--ink-deep` | `oklch(0.08 0.010 250)` | `#070a11` | Section break, footer, modal scrim |
| `--ink-raised` | `oklch(0.18 0.014 250)` | `#131825` | Card, table row hover |
| `--ink-edge` | `oklch(0.24 0.014 250)` | `#1d2233` | Borders, dividers, focus rings |
| `--ink-overlay` | `oklch(0.05 0.008 250)` | `#050709` | Behind WebGL canvas |

### Foreground (text)

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--fg-primary` | `oklch(0.97 0.005 250)` | `#f4f6fb` | Body text on ink (contrast 14:1) |
| `--fg-secondary` | `oklch(0.78 0.010 250)` | `#c2c8d6` | Secondary text, captions (contrast 8.4:1) |
| `--fg-tertiary` | `oklch(0.62 0.012 250)` | `#9097a8` | Meta, timestamps, labels (contrast 4.8:1) |
| `--fg-muted` | `oklch(0.48 0.012 250)` | `#6c7286` | Disabled, placeholder (contrast 3.0:1 — large text only) |

### Brand (cyan)

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--brand-cyan` | `oklch(0.78 0.16 215)` | `#3dd5f3` | Primary CTA, links, active state, loop glow |
| `--brand-cyan-deep` | `oklch(0.62 0.18 215)` | `#0fa6cf` | Hover, focus, pressed state |
| `--brand-cyan-soft` | `oklch(0.42 0.10 215)` | `#1d6478` | Subtle bg tint, badge fill |
| `--brand-cyan-glow` | `oklch(0.85 0.14 215 / 0.45)` | — | WebGL bloom, motion trails |

### Signal

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--signal-danger` | `oklch(0.66 0.22 25)` | `#ed5d4a` | Overdue, escalation, paired with `AlertTriangle` icon |
| `--signal-warn` | `oklch(0.78 0.16 80)` | `#f0c14a` | Pending review, awaiting approval |
| `--signal-success` | `oklch(0.74 0.18 150)` | `#5dd39e` | Done, delivered, sent |
| `--signal-violet` | `oklch(0.68 0.18 295)` | `#b478f0` | AI classification accent (draft, suggestion) |

## Typography

Two families, both variable. Pairing is **monospace humanist + grotesque display**.

| Role | Family | Weights | Source |
|---|---|---|---|
| Display (H1/H2 hero) | **Inter Display** | 300, 400, 500, 600, 700 | `next/font/google` |
| Body | **Inter** | 400, 500, 600 | `next/font/google` |
| Mono (codes, IDs, time) | **JetBrains Mono** | 400, 500 | `next/font/google` |

System font fallback: `ui-sans-serif, system-ui, sans-serif`.

### Scale

| Token | Size | Line height | Letter spacing | Usage |
|---|---|---|---|---|
| `text-display-xl` | `clamp(3.5rem, 8vw, 6rem)` | 0.95 | -0.035em | Hero H1 only |
| `text-display-lg` | `clamp(2.5rem, 5vw, 4rem)` | 1.02 | -0.03em | Section H2 |
| `text-display-md` | `clamp(1.75rem, 3vw, 2.5rem)` | 1.1 | -0.025em | Sub H2, page H1 |
| `text-h3` | `1.5rem` | 1.25 | -0.015em | Card title |
| `text-h4` | `1.125rem` | 1.35 | 0 | List heading |
| `text-body-lg` | `1.125rem` | 1.6 | 0 | Lead paragraph |
| `text-body` | `1rem` | 1.6 | 0 | Default |
| `text-body-sm` | `0.875rem` | 1.55 | 0.005em | Caption, helper |
| `text-eyebrow` | `0.75rem` | 1 | 0.18em uppercase | Section label, kicker (used once per page, not per section) |
| `text-mono` | `0.875rem` | 1.5 | 0 | IDs, timestamps, code |

Body line length capped at **68ch**. Display H1 ceiling is `6rem` (~96px). Display letter-spacing floor is **-0.035em** (looser than default codex templates; never tighter).

## Components

Each component is a single responsibility, in its own file under `src/components/`.

- **`Button`** — primary (cyan filled), secondary (ink-raised + edge border), ghost (text only). No `border + shadow` ghost cards. Radius 10px.
- **`Badge`** — solid fill in `signal.*` or `brand-cyan-soft`. Caps + tracked, never gradient text.
- **`Card`** — flat `ink-raised` bg, single 1px `ink-edge` border (no shadow), 12px radius. No nested cards.
- **`Stat`** — number + label + delta. Used on dashboard only, never on marketing.
- **`NavBar`** — sticky top, 64px, backdrop blur on scroll. Contains logo, primary links, CTA. Used on marketing only.
- **`Footer`** — 4-column grid, ink-deep bg. Used on marketing only.
- **`SectionLabel`** — one per page (not per section). Tracks `-0.015em`, never `0.18em`.
- **`Hero`** — full-bleed canvas + display copy + dual CTA. Used on landing only.
- **`LoopScene`** — `<canvas>` wrapping the `@react-three/fiber` scene. Used on landing hero.
- **`FeatureRow`** — alternating image/text rows with sticky-scroll. Used on landing only.
- **`PricingCard`** — vertical card, single border, no shadow, 12px radius.
- **`DocSidebar`** — left nav, collapsible, sticky. Used on docs.
- **`DocArticle`** — max 68ch prose, code blocks with syntax-highlight, copy button.
- **`CodeBlock`** — JetBrains Mono, dark surface, copy-to-clipboard button.
- **`Toast`** — bottom-right, signal color border-left, auto-dismiss 4s. Stacking supported.

## Layout

Marketing surface is 12-column grid, max-width 1280px, 24px gutter. Dashboard is single-column flex with fixed left rail (240px) + main content + optional right rail (320px). All section spacing uses the 8px scale: 8, 16, 24, 32, 48, 64, 96, 128. Section padding is `py-24 md:py-32` on marketing, `py-6` on dashboard.

Grid on marketing: `repeat(auto-fit, minmax(280px, 1fr))` for feature grids (no breakpoint), explicit `grid-cols-12` for hero compositions.

## Motion

Motion is intentional and committed. The signature motion is the **loop arc** — a curve from message to action to follow-up that draws itself when content enters view. Used on hero, on the "how it works" section, and on the dashboard's "what fires next" panel.

| Motion | Trigger | Curve | Duration |
|---|---|---|---|
| Page enter (marketing) | Route change | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) | 400ms |
| Section reveal (scroll) | IntersectionObserver `threshold: 0.2` | Same ease-out-quart | 600ms, stagger 60ms |
| Hover lift (cards, buttons) | `:hover` | `ease-out-quint` | 180ms |
| WebGL hero | Continuous | Linear at 60fps, motion blurred with bloom | — |
| Toast slide-in | Mount | ease-out-expo | 280ms |
| Toast slide-out | Unmount | ease-in-quart | 200ms |
| Reduced motion | `prefers-reduced-motion: reduce` | Crossfade 120ms OR instant | — |

All reveal animations enhance an already-visible default. Content is never hidden by a class trigger. Reduced motion replaces WebGL with a static gradient and disables stagger.

## Z-Index Scale

| Token | Value | Usage |
|---|---|---|
| `z-base` | 0 | Default stacking |
| `z-raised` | 10 | Sticky nav |
| `z-dropdown` | 20 | Menus, popovers |
| `z-modal-backdrop` | 40 | Modal scrim |
| `z-modal` | 50 | Modal dialog |
| `z-toast` | 60 | Notifications |
| `z-tooltip` | 70 | Hints |

## Anti-patterns Banned

- `border-left/right: >1px` colored accent on any element.
- `background-clip: text` + gradient (gradient text).
- `backdrop-filter: blur` as default decorative.
- Big-number-above-small-label-above-3-stats template.
- 4-card-icon-row-grid template (used more than twice on the site).
- `0.18em uppercase` eyebrow on every section (max one per page).
- `01 · About / 02 · Process / 03 · Pricing` numbered scaffolding on every section.
- `repeating-linear-gradient` diagonal stripe backgrounds.
- `border: 1px` + `box-shadow` paired on the same element.
- `border-radius: >16px` on cards, inputs, or sections.
- Hand-drawn / sketchy SVG illustrations.
- Emoji as UI decoration (only allowed in user content).