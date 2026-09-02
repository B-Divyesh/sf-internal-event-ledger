# Internal Event Ledger — visual thesis

## Direction and rationale

**Art-deco transit control room.** This product turns scattered operational signals into an orderly route map: sources are lines, event groups are arrivals, and acknowledgment is a conductor's punched ticket. The look borrows the confidence and geometry of 1930s rail posters without turning the working timeline into decoration. Strong rules, clipped corners, numbered markers, and a quiet paper texture make the ledger feel durable and calm rather than urgent or chat-like.

The working application is intentionally single-mode: a warm, ink-on-ticket-stock light treatment. The explicitly painted background, high-contrast ink, and restrained signal colors are central to the poster premise. A second dark mode would weaken the physical-paper metaphor, so it is omitted deliberately.

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#F3E9D2` | canvas, aged timetable stock |
| `--paper-deep` | `#E5D4AF` | secondary surface |
| `--ink` | `#162B35` | primary text and rules (12.3:1 on paper) |
| `--ink-muted` | `#526066` | secondary copy (5.7:1 on paper) |
| `--night` | `#10242D` | navigation and high-emphasis fields |
| `--signal` | `#B63A2B` | primary action, active route, errors |
| `--signal-dark` | `#8E291E` | hover/pressed state |
| `--brass` | `#9A6A16` | warning and decorative route nodes |
| `--green` | `#276A55` | acknowledged/healthy state |
| `--white` | `#FFFDF7` | text on dark fills |

State is never communicated by color alone: every status has a word, icon, and/or shape. The signal red is reserved for current selection, destructive actions, and actionable failures.

## Typography

- **Display:** `Arial Narrow`, `Roboto Condensed`, `Franklin Gothic Medium`, system sans-serif. Uppercase, tracked station-sign headings; no network font request.
- **Text and data:** `Inter`, `Avenir Next`, `Segoe UI`, system sans-serif. Sentence-case prose with tabular numerals for counts and timestamps.
- Scale: 12px overline, 14px utility, 16px body, 20px section title, fluid 32–48px page title. Body leading is 1.55; reading measure stays below 72 characters.

System fonts are intentional: the narrow display face recalls enameled station lettering, while the UI stack keeps dense event payloads readable. No third-party font or runtime CDN is used.

## Spacing and structure

An 8px base grid with 4px micro-spacing. Working gutters are 24px desktop and 16px mobile. The shell uses a 248px route-board sidebar and a fluid ledger. Event rows group by proximity; borders and panels appear only for real independent objects. Clipped top-right corners echo punched tickets. All controls are at least 44×44px.

At 390px the sidebar becomes a compact masthead, secondary descriptions disappear, filters stack in a two-column control deck, payload previews collapse by default, and the event action rail wraps below the summary.

## Interaction grammar

- Primary actions are solid signal-red lozenges; secondary actions are ink-outlined ticket buttons.
- Selecting a source moves the red route indicator and filters the ledger immediately.
- Event details open in place like unfolding a timetable, preserving context and keyboard order.
- Acknowledge is immediate and reversible; archive requires a named confirmation when applied in bulk.
- Toasts appear as small stamped notices in an `aria-live` region. Loading uses static route placeholders; empty and offline states always give a next step.
- Transit history informs the geometry and artwork only. Working navigation uses literal labels such as “Ledger sections,” “Sources,” and “Source setup.”

## Motion policy

UI state changes use 180–220ms opacity and transform transitions. New rows enter once with an 8px upward settle, and detail panels unfold from their originating row. Nothing loops. Under `prefers-reduced-motion: reduce`, animation and smooth scrolling are removed and state changes are instant; hierarchy remains through borders, scale, and contrast.

## Original asset plan and prompt sheet

One generated hero/empty-state illustration depicts a midnight central dispatch hall whose route lines converge into a physical ledger, making the product metaphor legible without claiming unsupported functionality. It is used in the onboarding/empty-state panel, not as filler in the dense event view. Hand-authored SVG line symbols are used for UI icons and the product mark.

**Canonical prompt:** “Landscape art-deco transit poster, an imaginary midnight operations dispatch hall viewed front-on, five clean colored rail lines converging from small signal towers into a single open paper ledger on a brass desk, geometric 1930s travel-poster forms, flat screen-print texture, warm cream ticket paper, deep petrol navy, oxide red and aged brass palette, symmetrical architectural framing, strong negative space, soft raking light, calm and orderly mood, no people, no text, no letters, no numbers, no watermark, no logos, no real brands, no photorealism, no gradients, no UI screenshot.”

**Negative list:** illegible pseudo-text, real transport marks, corporate logos, people, alarm imagery, glowing cyberpunk neon, generic SaaS dashboard, glossy 3D, stock-photo lighting.

**Provenance:** generated for this product with the Factory Azure OpenAI image deployment (`factory-image`) on 2026-08-27. The resulting image is original AI-generated artwork; prompt sidecar is stored with the source. Web delivery uses optimized WebP at ≤300 KB with explicit dimensions. The 1200×630 social card and 180px touch icon are crops of that same original asset, produced locally on 2026-08-30 without a new model call. Footer disclosure: “Poster artwork generated for Internal Event Ledger.”
