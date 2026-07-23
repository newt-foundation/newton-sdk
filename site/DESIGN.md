# Newton Protocol Docs — Design System

This document captures the visual design tokens, principles, and component styling intent for the Newton Protocol documentation site (Vocs-based). The goal is **brand parity** with the former Mintlify maple theme, not pixel-identical reproduction.

## Visual Theme & Atmosphere

**Tone:** Professional, developer-focused, reading-optimized for technical documentation.

**Density:** Moderate — favors readability over compactness. Generous whitespace around code blocks, clear section separation.

**Mood:** Clean, neutral, approachable. Light-first experience with robust dark mode.

**Ceiling:** Close visual match to the former Mintlify maple theme. Vocs and Mintlify are different renderers with distinct layout engines — structural differences are expected and acceptable where they serve readability.

## Color Palette & Roles

### Brand Tokens

```css
--newton-ink: #19191a       /* Primary text, headings (light mode) */
--newton-paper: #ffffff     /* Primary text (dark mode), backgrounds */
--newton-charcoal: #303030  /* Dark mode background */
```

### Semantic Usage

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| Primary text | `--newton-ink` | `--newton-paper` |
| Background | `--newton-paper` | `--newton-charcoal` |
| Accent | `--newton-ink` (via `accentColor` config) | Inherits from Vocs |

### Design Rationale

Newton's brand uses near-black ink (`#19191a`) for light mode, ensuring high contrast for prolonged reading. Dark mode inverts to pure white text on charcoal background (`#303030`), maintaining accessibility standards (WCAG AA minimum).

## Typography Rules

### Type Scale

Vocs provides a built-in responsive type scale. No custom overrides applied — the default scale is calibrated for technical documentation and aligns with maple's proportions.

### Font Stack

Vocs defaults to system fonts with fallbacks:
- **Sans-serif:** System UI stack (San Francisco on macOS, Segoe UI on Windows, Roboto on Android)
- **Monospace:** Inherits from Vocs code block styling

No custom font declarations — system fonts ensure instant loading and native OS harmony.

## Component Stylings

### Callouts

**Intent:** Match maple callout density and spacing.

**Current state:** Vocs callouts are visually close to maple by default. No overrides applied yet.

**Escalation path (ponytail):** If user feedback indicates visible misalignment, tune padding/margin via CSS custom properties in `_root.css`.

### Cards

**Intent:** Maintain card component visual weight and spacing from maple theme.

**Current state:** Cards converted from Mintlify `<Card>` to Vocs markup (Task 9). Styling defers to Vocs defaults.

**Escalation path:** Tune card border-radius, padding, or shadow if the visual weight reads too heavy/light compared to maple screenshots.

### Steps Component

**Intent:** Preserve numbered-step visual rhythm.

**Current state:** Steps converted from Mintlify `<Steps>` to Vocs markup. Vocs provides native step styling.

**Escalation path:** Adjust step number circle size, spacing, or connector lines if the rhythm feels compressed/stretched vs maple.

### Code Blocks

**Intent:** High readability, syntax highlighting aligned with developer expectations.

**Current state:** Vocs `codeHighlight` configured with `rego: 'text'` alias for Rego policy syntax. Default Shiki theme used.

**Rationale:** Rego is a niche language without native Shiki support. Aliasing to `text` prevents console warnings while preserving code block structure. Future enhancement: custom Rego grammar.

### Images

**Responsive behavior:** All images in `<p>` tags scale to 100% container width via `p img { width: 100%; height: auto; }` (carried over from original `site/style.css`).

**Rationale:** Documentation images (diagrams, screenshots) should adapt to viewport width for mobile readability.

## Layout Principles

### Spacing Scale

Vocs provides a default spacing system via CSS custom properties (`--vocs-space-*`). No custom scale overrides applied — the default scale aligns with maple's visual rhythm.

### Whitespace Rhythm

**Reading optimization:** Generous vertical spacing between sections, code blocks, and callouts to reduce cognitive load during technical reading.

**Current state:** Defers to Vocs defaults, which are calibrated for documentation.

**Escalation path:** If sections feel cramped/loose, tune via `--vocs-space-*` overrides in `_root.css`.

### Grid & Breakpoints

Vocs handles responsive layout internally. No custom breakpoint overrides.

## Depth & Elevation

### Shadow Tokens

No custom shadow overrides applied — Vocs provides subtle elevation for navigation, search, and popovers.

**Rationale:** Maple used minimal shadows; Vocs defaults align with this restrained approach.

### Surface Hierarchy

- **Background:** `--newton-paper` (light) / `--newton-charcoal` (dark)
- **Elevated surfaces:** Sidebar, search dialog, code blocks — inherit Vocs elevation tokens

## Logo Usage

**Light mode:** `/logo/light.svg` (dark Newton wordmark on transparent)
**Dark mode:** `/logo/dark.svg` (light Newton wordmark on transparent)

Configured via `logoUrl: { light, dark }` in `vocs.config.ts`.

**Favicon:** `/favicon.svg` (site icon in browser tabs)

## Color Scheme Default

**Default:** Light mode (matches Mintlify `docs.json` `appearance.default = "light"`).

Configured via `colorScheme: 'light dark'` in `vocs.config.ts` — user can toggle, but light is the initial state.

## Do's and Don'ts

### Do

- Use brand tokens (`--newton-ink`, `--newton-paper`, `--newton-charcoal`) for any color overrides
- Preserve responsive image behavior for diagrams and screenshots
- Maintain high contrast for text (WCAG AA minimum)
- Test both light and dark modes when adding custom styles
- Keep styling overrides minimal — Vocs defaults are well-calibrated

### Don't

- Introduce new brand colors not in the palette
- Override Vocs structural layout (navigation, sidebar, search) without strong justification
- Add decorative elements that reduce readability
- Use fixed pixel widths for content containers (breaks responsive behavior)
- Apply dark mode overrides via `.dark` class — use `color-scheme` attribute selector per Vocs convention

## Responsive Behavior

### Breakpoints

Vocs handles breakpoints internally. Key behaviors:
- **Mobile (<768px):** Sidebar collapses to hamburger menu
- **Tablet (768px-1024px):** Sidebar visible, reduced right-hand margin
- **Desktop (>1024px):** Full sidebar + content + right-hand table-of-contents

### Touch Targets

Vocs ensures 44×44px minimum touch targets for interactive elements (nav links, buttons, search).

### Images

All paragraph images scale to container width via `p img { width: 100%; height: auto; }`.

## Design Reference Sources

This design system draws principles from:

1. **Anthropic Claude Code Frontend Design Skill** — foundational philosophy: "Make intentional, subject-specific choices. Ground design in the subject." Emphasizes restraint, spending boldness in one place, and building compact token systems (color, type, layout, signature).

2. **Awesome Claude Design (VoltAgent)** — DESIGN.md format: "token, rule, and rationale in the same file." Advocates semantic naming, minimal overrides, and documenting the "why" so agents can stay on-system for novel cases.

## Agent Prompt Guide

When generating new documentation pages or components:

- Use brand tokens for any color references: `--newton-ink`, `--newton-paper`, `--newton-charcoal`
- Defer to Vocs built-in components (callouts, code blocks, cards, steps) — they are pre-styled
- If custom styling is needed, add minimal overrides to `src/pages/_root.css` and document rationale here
- Test light and dark modes by toggling the theme switch
- For images, ensure they are wrapped in markdown paragraphs to trigger responsive scaling
- For code samples, use fenced code blocks with language identifiers (TypeScript, JavaScript, Solidity, Bash, Rego)

## Maintenance Notes

**CSS location:** `site/src/pages/_root.css` (auto-loaded by Vocs)

**Build verification:** After CSS changes, run `pnpm build` and grep built output for token presence:
```bash
grep -r "newton-ink" dist/
```

**Escalation threshold (ponytail):** Start minimal. Add overrides only when an element reads visibly off compared to maple screenshots. Document each override in this file with rationale.

**Vocs version:** 2.6.2 (as of 2026-07-23)
