# Design System

Direction: a premium, dark, technical conference site in the manner of Linear, Vercel and Raycast. Calm surfaces, one strong idea per screen, motion that explains rather than decorates.

The brief specifies a purple-and-cyan palette; the Technova poster is teal on near-black. Purple is the hackathon's primary accent and cyan the secondary, which keeps the site visibly related to the poster and sponsor lockups without copying it.

## 1. Colour tokens

Defined once in `src/app/globals.css` under Tailwind 4 `@theme`.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--color-bg` | `#070812` | Page background |
| `--color-surface` | `#101225` | Cards, panels |
| `--color-surface-2` | `#171A33` | Raised surfaces, inputs |
| `--color-border` | `rgba(148,163,184,0.14)` | Hairlines |
| `--color-primary` | `#8B5CF6` | Accent, borders, glow, focus ring |
| `--color-primary-strong` | `#7C3AED` | Filled buttons carrying white text |
| `--color-primary-soft` | `#A78BFA` | Highlights, links on dark |
| `--color-secondary` | `#06B6D4` | Secondary accent, data |
| `--color-text` | `#F8FAFC` | Body and headings |
| `--color-muted` | `#94A3B8` | Secondary text |
| `--color-success` | `#34D399` | Verified, confirmed |
| `--color-warning` | `#FBBF24` | Pending |
| `--color-danger` | `#F87171` | Rejected, errors |
| `--color-gold`, `--color-silver`, `--color-bronze` | `#FACC15`, `#CBD5E1`, `#D97706` | Podium only |

Computed WCAG contrast on `#070812`: text 19.1:1, muted 7.8:1, primary-soft 7.3:1, secondary 8.2:1, primary 4.7:1. White on primary `#8B5CF6` is only 4.2:1, which fails AA for normal text, so filled buttons use `--color-primary-strong` `#7C3AED` (white on it: 5.7:1) and `#8B5CF6` is kept for borders, glows, focus rings and large display text. Status is never conveyed by colour alone: every badge has a label and an icon.

Signature gradient: `linear-gradient(135deg, #8B5CF6 0%, #6366F1 45%, #06B6D4 100%)`, used for the hero headline accent, primary button hover glow and animated borders. Not used for body text.

## 2. Typography

Geist Sans for everything, Geist Mono for IDs, countdown digits, scores and transaction IDs. Loaded with `next/font`, self-hosted, `display: swap`.

| Role | Size (mobile → desktop) | Weight | Tracking |
| :--- | :--- | :--- | :--- |
| Display (hero) | 44 → 104 px, `clamp()` | 700 | −0.04em |
| H1 | 36 → 64 px | 650 | −0.03em |
| H2 | 28 → 44 px | 600 | −0.02em |
| H3 | 20 → 26 px | 600 | −0.01em |
| Body | 16 → 17 px, line-height 1.65 | 400 | 0 |
| Small | 14 px | 400 | 0 |
| Eyebrow | 12 px, uppercase, mono | 500 | 0.14em |

Headlines are set tight and large; paragraphs are capped at 65 characters wide.

## 3. Space, radius, elevation

- Spacing on Tailwind's 4 px scale. Section padding 80 px mobile, 144 px desktop. Content width 1200 px; reading width 720 px.
- Radius: 8 px inputs, 12 px buttons, 20 px cards, 28 px hero panels.
- Elevation is expressed with a 1 px border and a faint inner top highlight, not drop shadows. Glow (`0 0 40px rgba(139,92,246,0.25)`) is reserved for the primary call to action and the champion card.
- Glass (`backdrop-filter: blur(16px)` over 4% white) only on the sticky header and floating panels that sit over the hero. Blur on large scrolling areas is avoided for performance.

## 4. Background treatment

Three layers, all CSS or a single small asset:
1. Base colour.
2. A 48 px grid drawn with `linear-gradient`, masked to fade radially.
3. Two slow-drifting radial gradients (purple, cyan) at low opacity, and a 3% noise texture from one tiled 4 KB image.

## 5. Components

Built on shadcn/ui primitives restyled with the tokens.

| Component | Notes |
| :--- | :--- |
| Button | Primary (filled gradient), secondary (bordered), ghost, danger. 44 px minimum height. Loading state replaces the label with a spinner and sets `aria-busy`. |
| GlowCard | Animated conic-gradient border on hover and focus-within; static border when motion is reduced. |
| SectionHeader | Eyebrow, headline, lead paragraph. |
| Countdown | Mono digits; `aria-live="off"` with a visually hidden text updated once a minute. |
| Stepper | Five steps, shows numbers and labels on desktop, "Step 2 of 5" on mobile; `aria-current="step"`. |
| FormField | Label, hint, error text tied by `aria-describedby`; errors announced with `role="alert"`. |
| FileDropzone | Click, drag or keyboard; progress bar; thumbnail for images; replace and remove. |
| StatusTimeline | Vertical on mobile, horizontal on desktop; done, current and upcoming states. |
| StatusBadge | Icon + label, one per team and payment state. |
| PrizeCard, Podium | Podium columns rise on entry; champion in the centre. |
| DataTable | Sortable headers, sticky first column on mobile, pagination, empty and loading states. |
| ConfirmDialog | Destructive or irreversible admin actions; optional typed confirmation. |
| Toast | Success and error feedback; errors persist until dismissed. |
| Skeleton, EmptyState, ErrorState | One of each, used everywhere. |

## 6. Motion

| Use | Spec |
| :--- | :--- |
| Scroll reveal | Fade and 16 px rise, 500 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, staggered 60 ms, once only |
| Hover | 150–200 ms colour and border; cards lift 2 px |
| Page and step transitions | 250 ms cross-fade with 8 px slide |
| Hero | Canvas neural field reacting to the pointer, capped at 60 nodes on mobile, paused when off-screen or the tab is hidden |
| Podium | Columns grow in sequence; one confetti burst on first view |
| Smooth scroll | Lenis on public pages only, synchronised with the animation frame loop |

Rules:
- Only `transform` and `opacity` are animated.
- With `prefers-reduced-motion: reduce`: Lenis is not initialised, reveals become instant, the hero canvas renders one static frame, confetti is skipped, animated borders are static.
- The admin panel has no scroll effects and no Lenis.
- The hero canvas and confetti are loaded with dynamic import after first paint.

## 7. Home page structure

1. Header: Technova and hackathon lockup, navigation, Register button.
2. Hero: eyebrow "CoU Technova 2026 · Faculty of Engineering", headline "BUILD THE FUTURE. IN SIX HOURS.", tagline, date and venue, Register and Explore buttons, countdown, neural canvas.
3. Sponsor strip: Gigabyte AORUS (title sponsor), IT Palace (powered by).
4. Key numbers: 6 hours, BDT 25,000, top 30 teams, teams of 1–3.
5. About and why participate.
6. Registration timeline with the current phase highlighted from the server clock.
7. Problem domains.
8. Prizes.
9. Schedule preview.
10. Rules summary and team formation.
11. FAQ.
12. Organising team and contact.
13. Footer.

## 8. Accessibility

- Semantic landmarks, one `h1` per page, skip link.
- Visible focus ring: 2 px primary-soft with 2 px offset, on every interactive element.
- All functionality available by keyboard; dialogs trap focus and restore it.
- Touch targets at least 44 × 44 px.
- Form errors are text, tied to their field, and summarised at the top of a step on failed submit.
- Decorative canvases and gradients are `aria-hidden`.

## 9. Voice

Direct and confident; short sentences. Buttons say what happens ("Submit registration", "Verify payment"). Errors say what went wrong and what to do next. Brand lines for headings and social cards: "Build Beyond Imagination.", "Your Idea Could Change Tomorrow.", "From Imagination to Innovation."

## 10. Email

600 px single column, dark header band with the event wordmark, white body for client compatibility, one primary button, plain-text alternative, footer with event date, venue and contact. System fonts only.
