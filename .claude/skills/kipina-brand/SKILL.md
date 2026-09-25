---
name: kipina-brand
description: Kipinä visual identity (taken from kipina.fi) for the CV bank UI and the CV PDF. Use when choosing colors, type, spacing, logos, icons, UI copy or layout for any page, component, or the PDF template, and when reviewing whether something "looks like Kipinä".
---

# Kipinä brand

Source: kipina.fi site CSS and assets (read 2026-09-25). The site is the reference. When in
doubt, match it, and don't invent new brand elements. A human must approve the logo files
(the PNG in `public/brand/` was taken from kipina.fi; ask for SVG masters).

## Core idea

**"Digital realities. _Added humanity._"** Precise, technical and calm, with one human, warm
accent. The look is **quiet and confident**: lots of white, big *light* headings, a single
electric-lime spark, deep teal for depth. It is not playful, not corporate-blue, and has no
decorative gradients. The only exceptions are the logo grid and the soft forest glow of the hero band.

## Palette (tokens in `src/styles/app.css` `@theme` and `src/pdf/template/theme.ts`)

| Token | Hex | Site variable | Use |
|---|---|---|---|
| `ink` | `#2B2B2B` | `--black` | Body text, headings, dark sections, primary buttons |
| `lime` (spark) | `#CBFF2B` | `--accent` | Highlights, focus rings, active states, markers, quote marks. **Fill only** |
| `teal` | `#006D5E` | `--darkAccent` | Links, secondary emphasis, icons, selected chips' text on white |
| `mist` | `#F7FAFC` | `--lightAccent` | App background, panels, table stripes |
| `white` | `#FFFFFF` | `--white` | Cards, paper, the PDF page |
| `line` | `#E3E8EC` | derived | Hairline borders (1px) |
| `muted` | `#5E6468` | derived | Secondary text (7:1 on white) |
| `forest-deep` / `forest` / `moss` | `#0C241D` / `#16392F` / `#4C5D36` | hero photo | The dark, photographic green of the site hero. Used for hero bands and the PDF cover band, with white light text |
| logo grid | `#FFF200 → #CBFF2B → #7CF03C → #4DF5A0 → #00A896` | logo | **Only** in the logo mark / 3×3 grid motif |

Contrast rules (checked):
- Ink on lime is **12:1**. Lime is the *background* behind dark text: `<mark>`, active pill,
  primary call-to-action on dark sections.
- **Never use lime text on white or mist (1.2:1)**. Lime text is only allowed on ink.
- Teal on white is 6.3:1, fine for body-size links and labels. Teal on lime is 5.3:1.
- Focus ring: 3px lime outline with a 1px ink offset (visible on white and on ink).
- Status colors (error/success) are functional, not brand: error `#B42318`, success
  `#067647`. They always come with text or an icon, never color alone.

## Typography

- **Noto Sans** (variable, self-hosted via `@fontsource-variable/noto-sans`) for everything.
  - Display/H1: weight **300**, letter-spacing **-0.03em**, line-height 1.1. This is the
    signature look.
  - H2/H3: weight 300–400, -0.02em.
  - Body: 400, 16px in the app (15–16), 9.5–10pt in the PDF, line-height 1.5.
  - Labels/meta: 500–600, 12–13px, **uppercase with +0.08em tracking** only for small
    section eyebrows.
- **Noto Serif** weight **200–300**, used *only* for one emphasised word or phrase inside
  a heading (the site styles `<em>` this way: serif, upright, -0.02em). Example:
  `Find the right <em>expert.</em>` Use it at most once per view. It's never for body text.
- Numbers in tables: `font-variant-numeric: tabular-nums`.
- No other fonts. No CDN (CSP and PDF need self-hosted fonts; the PDF template embeds them
  as `data:` URIs).

## Layout and shape

- Generous whitespace: 8px base grid. Section padding 48–96px on marketing-like surfaces,
  24–32px in dense app views.
- Corners: small radius, **4–6px** on inputs and cards, and fully rounded (pill) only for
  chips/tags. no heavy shadows: use a 1px `line` border, or at most
  `0 1px 2px rgb(43 43 43 / 0.06)`.
- Dark sections are for strong moments: the page hero, the PDF cover band, empty states.
  Use one per view. The hero uses `.hero-forest`: `forest-deep` with soft moss and teal
  radial glows that imitate the site's blurred forest photo. Other dark sections use
  `ink`. White light-weight type goes on top, and lime is the only accent.
- Calls to action on dark or open areas use `.cta-underline` (text with a 3px lime
  underline bar, as on the site). Inside dense forms and toolbars, use solid ink buttons.
- Navigation is uppercase regular text with a little tracking, like the site's top menu.
- Motif: the **3×3 pixel grid** from the logo (yellow → lime → teal). It may appear small, as
  a section marker or a loading indicator. Never make it big or decorative wallpaper.
- Quote marks for testimonials: a large lime `“` (the site uses lime quote glyphs).

## Logo

- `public/brand/kipina-logo.png` (positive, for light backgrounds). Minimum height 24px in
  the app and 10mm in the PDF. Clear space is at least the height of one grid square on all
  sides.
- Never recolor, stretch, outline, or put the positive logo on ink (ask for the negative
  version).
- Alt text: `Kipinä`.

## Voice (UI copy)

- Short, human and direct: "Find the right expert.", "Saved.", "Nothing matches yet. Try
  fewer words." Site examples: *"Tiimikavereita, jotka välittävät."*, *"Katse yhteiseen
  maaliin."*
- Sentence case everywhere. No exclamation marks, no buzzwords ("synergy",
  "leverage", "world-class"), no emoji.
- Buttons are verbs: "Save", "Export PDF", "Create variant".
- The UI language is English for now (CVs are English). Keep strings in components simple
  so i18n can be added.

## Don't

- Don't use generic SaaS looks: purple/blue gradients, glassmorphism, big drop shadows,
  stock illustrations, icon soup.
- Don't use more than one lime element competing in the same area.
- Don't use bold (700+) headings. Kipinä headings are light.
- Don't use lime as a large background behind body text on the page.
- Don't put decorative serif in body text or buttons.

## Checklist for a new screen or PDF change

- [ ] Only palette tokens are used (no ad-hoc hex values in components)
- [ ] One H1 in light 300 Noto Sans; at most one serif `<em>` accent
- [ ] Lime is used only as a fill behind ink text, or on ink
- [ ] The focus ring is visible (lime + ink offset); text passes AA contrast
- [ ] Whitespace follows the 8px grid; borders are hairlines, not shadows
- [ ] Copy is short, sentence case, with no filler
