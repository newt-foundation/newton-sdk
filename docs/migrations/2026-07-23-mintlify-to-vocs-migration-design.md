# Mintlify → Vocs + Vercel Migration Design

**Date:** 2026-07-23
**Repo:** newton-sdk (`@newton-xyz/sdk`)
**Scope:** Migrate the published documentation site (`site/`, 96 MDX pages, currently
hosted by Mintlify at docs.newton.xyz) to a self-hosted Vocs + Vercel setup, with
faithful content/navigation/brand parity and zero live Mintlify residue in the repo.

---

## 1. Goal & Verifiable Success Criteria

The imperative "migrate docs from Mintlify to Vocs + Vercel" is restated as concrete,
checkable goals:

- **Builds:** `cd site && pnpm build` exits 0 and emits a static site (`site/dist/`).
- **Route parity:** all **96** current routes render at their **existing URLs**
  (e.g. `/developers/overview/about`, `/whitepaper/introduction`).
- **No live Mintlify residue:** `grep -rniE "mintlify|docs\.json|mint\.json|\.mintignore" .`
  (excluding `node_modules/`, `dist/`, `.git/`) returns **only** `CHANGELOG.md` history lines.
- **No Mintlify components remain:**
  `grep -rE "<(Card|CardGroup|Note|Tip|Info|Warning|Steps|Step|Tabs|Tab|Accordion|AccordionGroup|CodeGroup|Frame|Expandable)[ />]" site/src`
  returns empty.
- **Redirects preserved:** all 18 current redirects resolve to the same destinations.
- **Deadlinks:** Vocs deadlink check passes (replaces `mintlify broken-links`).
- **Brand preserved:** logo (light/dark), primary colors (`#19191a` / `#303030`),
  light-default appearance, favicon, OG images, and GA4 (`G-JFG7Z812VK`) all intact.
- **UX parity (structural):** left sidebar → content → right outline, 4 top-nav tabs,
  same navigation flow.

**Explicitly NOT a goal:** pixel-identical reproduction of Mintlify's "maple" theme
(different rendering engine — see §8 ceiling).

---

## 2. Context & Findings

### 2.1 Reference template (neobank) — toolchain only, not content strategy
The neobank repo migrated Mintlify → Vocs but did **not** faithfully port its docs: it
kept old docs in `docs/` and hand-wrote a fresh ~15-page Vocs site with **zero
components and no frontmatter**. Neobank is therefore the reference for the **toolchain
and deployment pattern**, not the content approach:

- `vocs ^2.0.12`, `react ^19.2.4`, `react-dom ^19.2.4`, `react-server-dom-webpack ~19.2.3`,
  `vite ^8.0.14`, `tailwindcss ^4.1.16`, `waku 1.0.0-beta.1`, `@types/react*` ^19.
- `package.json` scripts: `dev: vocs dev`, `build: vocs build`, `preview: vocs preview`.
- `vercel.json`: `{ "installCommand": "npx pnpm@10 install --frozen-lockfile" }`.
- Deployed via Vercel Git integration (auto-build on push); no CI secrets.

### 2.2 Current newton-sdk Mintlify site
- `site/` — 96 `.mdx` pages across `developers/` (78), `whitepaper/` (10), `protocol/` (8).
- `site/docs.json` (317 lines): 4 tabs (Developers, VaultKit, Whitepaper, Protocol),
  18 redirects, theme "maple", colors `#19191a`/`#ffffff`/`#303030`, light-default,
  logo light/dark SVGs, favicon.svg, X social, Blog anchor, GA4, SEO/OG metatags.
- Assets: `site/images/` (~75), `site/logo/` (dark.svg, light.svg), `site/og/`,
  `site/favicon.svg`, `site/llms.txt`, `site/style.css` (260B overrides).
- Mintlify-only files: `site/.mintlify/Assistant.md` (48KB), `site/agent.md` (48KB dup),
  `site/.mintignore`, `site/README.md` (empty).
- Component usage (~300 instances): `<Card>`×120, `<Step>`×51, `<Note>`×47,
  `<Accordion>`×46, `<Expandable>`×45, `<CodeGroup>`×23, `<Warning>`×21, `<Steps>`×12,
  `<Tab>`×12, `<Info>`×11, `<CardGroup>`×11, `<AccordionGroup>`×7, `<Tabs>`×6, `<Frame>`×8.
- Frontmatter fields used: `title`, `description`, `keywords`.
- `scripts/check-docs-twoslash.sh` — symlink `.mdx`→`.md` hack running twoslash-cli.
  **0 pages currently use `twoslash` code blocks.**
- Deployment: Mintlify GitHub App, monorepo mode, docs path `/site`, auto-deploy on main.
  No GitHub Actions touch docs.

### 2.3 Repo structure facts (verified)
- **No pnpm workspace at root** (unlike neobank). Root `package.json` has no `workspaces`.
  → `site/` must become a **standalone package with its own `pnpm-lock.yaml`**;
  Vercel Root Directory = `site`. Matches existing nested-package pattern
  (`examples/zktls-twitter/sdk/`).
- `biome.json` / `knip.json` do **not** scope `site/` → no lint/deadcode conflict.
- The 6 site-related skill dirs are **real copies, not symlinks** — each needs editing.
- Mintlify MCP server declared at 3 exact locations (see §9).
- `site/docs.json` has **no root/home key** — Mintlify lands `/` on the first nav page,
  `developers/overview/about`, which is a **plain doc page (not a hero/landing)**.
- Shield pages (`developers/vaults/shield/*.mdx`, 5 pages) are **truly orphaned**: absent
  from nav, and the only external "shield" references are a `shield.policyClientAddress`
  code variable — not links.

### 2.4 Vocs capabilities (verified against installed package + docs)
- Native container directives: `:::note|info|tip|warning|danger|success`, `::::steps`
  (wrapping `###` headings), `:::code-group` (fenced blocks with `[label]`),
  `:::details[Summary]`, `:::file-tree`, `:badge[]{variant}`.
- React exports from `vocs`: `Card`, `Cards`, `Tabs`, `Tab`, `Callout`, `Badge`, `Link`.
  **No global MDX component registry** — custom/React components are imported per file
  (or via directory-scoped `src/pages/_mdx-wrapper.tsx`).
- **Multi-sidebar** keyed by path prefix is native (`sidebar: { '/developers': [...] }`).
- Config supports: `title`, `description`, `logoUrl {light,dark}`, `iconUrl`,
  `accentColor`, `colorScheme`, `topNav` (with `match`), `sidebar`, `socials`, `banner`,
  `editLink`, `redirects` (with `:path*`, internal only), `baseUrl`, `sitemap`,
  `head` (inject meta/scripts — for SEO/OG/GA4), `ogImageUrl`, `twoslash`,
  `checkDeadlinks`, `outDir` (default `dist`).
- Frontmatter supported: `title`, `description`, `author`, `layout`, `outline`,
  `robots`, `searchPriority`, plus arbitrary custom keys.
- Build: `vocs build` → static output in `dist/`. Vite + Waku (RSC). Vercel native.

---

## 3. Target Architecture

`site/` converts **in place** from a Mintlify content folder into a standalone Vocs
package:

```
site/
├── package.json          # @newton-xyz/sdk-docs (private); vocs/react19/vite8/tailwind4
├── pnpm-lock.yaml        # NEW — own lockfile (no root workspace)
├── vocs.config.ts        # replaces docs.json (nav, theme, redirects, SEO/GA4)
├── tsconfig.json         # for vocs.config.ts + any TSX
├── .gitignore            # dist/, .vocs/, node_modules/, cache/, *.log
├── styles.css            # brand-parity CSS (carries over + extends the old style.css; renamed)
├── DESIGN.md             # design tokens & rationale (frontend-design principles)
├── src/
│   └── pages/            # ALL 96 .mdx move here (URLs unchanged)
│       ├── developers/…
│       ├── whitepaper/…
│       └── protocol/…
└── public/               # served at site root "/"
    ├── images/           # (moved from site/images/)
    ├── logo/             # (moved from site/logo/)
    ├── og/               # (moved from site/og/)
    ├── favicon.svg       # (moved from site/favicon.svg)
    └── llms.txt          # (moved from site/llms.txt)
```

**Rationale (thin/lazy):** smallest change that works. No new workspace, no root
lockfile churn. Vercel points Root Directory at `site/`. Consistent with the existing
nested standalone package (`examples/zktls-twitter/sdk/`).

---

## 4. Page & Asset Migration

- **Pages:** move every `.mdx` into `site/src/pages/`, preserving directory nesting →
  **every URL stays identical** (Vocs maps `src/pages/x/y.mdx` → `/x/y`).
- **Assets:** move `images/`, `logo/`, `og/`, `favicon.svg`, `llms.txt` into
  `site/public/`. Vocs serves `public/` at `/`, so existing `/images/…`, `/og/…`,
  `/logo/…` references keep resolving unchanged. Keep the **curated `llms.txt`**
  (honors "no content change"); note Vocs can auto-generate one later if desired.
- **Home (`/`):** add a redirect `/` → `/developers/overview/about` in `vocs.config`
  redirects. This reproduces current behavior with **zero new content**. (Fallback if
  the build requires a physical index route: a minimal `src/pages/index.mdx` that issues
  the same redirect — implementation detail.)

---

## 5. Navigation (4 tabs → topNav + path-keyed sidebars)

Transcribe `docs.json` navigation verbatim into Vocs:

- **`topNav`:** Developers · VaultKit · Whitepaper · Protocol (each with `match` prefix),
  plus the external Blog anchor (`https://blog.newton.xyz`, currently a global anchor).
- **`sidebar`:** path-keyed map — one entry per tab's URL prefix:
  - `'/developers'` (excluding vaults) → Getting Started, Verifiable Credential, Guides,
    Use Cases, Deep Dives, Reference, Advanced, Resources groups.
  - `'/developers/vaults'` (VaultKit tab) → Overview, Policy Packs, SDK, Resources groups.
  - `'/whitepaper'` → Technical Whitepaper group.
  - `'/protocol'` → Overview, Foundation, Token, Transparency Reports, Governance groups.
  - Groups/pages copied 1:1 from `docs.json`; `collapsed`/nesting preserved where present.
- **Note:** VaultKit shares the `/developers/vaults` URL prefix with Developers. Vocs
  path-keyed sidebars resolve by **longest-matching prefix**, so `/developers/vaults/*`
  gets the VaultKit sidebar and other `/developers/*` gets the Developers sidebar. This
  matches the current tab split without moving any files/URLs.

---

## 6. Component Conversion (native Vocs)

Mechanical mapping applied across ~300 instances:

| Mintlify | Vocs native | Notes |
|---|---|---|
| `<Note>` / `<Info>` / `<Tip>` / `<Warning>` | `:::note` / `:::info` / `:::tip` / `:::warning` | container directive |
| `<Steps>` + `<Step title="X">` | `::::steps` + `### X` headings | step title becomes heading |
| `<CodeGroup>` | `:::code-group` + `` ```lang [label] `` | tabbed code blocks |
| `<Accordion title="X">` / `<Expandable title="X">` | `:::details[X]` | collapsible |
| `<AccordionGroup>` | consecutive `:::details` | no wrapper needed |
| `<Card title icon href>` | `Card` (Vocs React export, per-file import) | `href`→`to`; props map |
| `<CardGroup cols>` | `Cards` (Vocs React export) | grid wrapper |
| `<Tabs>` / `<Tab title="X">` | `Tabs` / `Tab` (Vocs React exports) | `title` preserved |
| `<Frame><img/></Frame>` | plain `![alt](src)` or `<img>` | framing via CSS |

- Frontmatter `title` + `description` retained (Vocs-supported). `keywords` is not a
  Vocs frontmatter field; preserve SEO via `head`/meta where it matters, otherwise it is
  a no-op at build (kept in frontmatter harmlessly or moved — decided during impl, no
  content loss).
- Files needing Vocs React exports (`Card`/`Cards`/`Tabs`/`Tab`) get a top-of-file
  `import { ... } from 'vocs'`.

---

## 7. vocs.config.ts (replaces docs.json)

Fields populated from `docs.json`:

- `title`, `description`.
- `logoUrl: { light: '/logo/light.svg', dark: '/logo/dark.svg' }`, `iconUrl` / favicon.
- `accentColor: '#19191a'`, `colorScheme: 'light dark'` with **light default**.
- `topNav` (§5), path-keyed `sidebar` (§5).
- `socials: [{ icon: 'x', link: 'https://x.com/newtfoundation' }]`.
- `baseUrl: 'https://docs.newton.xyz'`, `sitemap`.
- `twoslash`: native (0 pages use it today; the bespoke `check-docs-twoslash.sh` is
  deleted). Enables future ` ```ts twoslash ` verification for free.
- `checkDeadlinks`: enabled (replaces `mintlify broken-links`).
- `head`: inject **GA4** (`G-JFG7Z812VK`), `google-site-verification`
  (`z93uJU02uM0Z9bdqWDxN2dV1HHAlsaqDy-LwCHYSuGA`), `author`, and OG/Twitter meta
  (`/og/opengraph-image.jpg`, `/og/twitter-image.jpg`, `twitter:site`/`creator`
  `@newtfoundation`).

---

## 8. Redirects (split by capability)

- **16 internal redirects** → `vocs.config` `redirects` (supports `:path*` wildcards,
  e.g. `/newton-protocol/:path*` → `/protocol/overview/:path*`).
- **2 external redirects** (→ `blog.newton.xyz/...`) → `site/vercel.json` `redirects`.
  Vocs internal redirects target in-site routes only; external destinations belong at the
  Vercel layer.

---

## 9. Theming + DESIGN.md (close visual match)

- **`site/DESIGN.md`:** brand tokens & rationale — colors (`#19191a`, `#303030`,
  `#ffffff`), light-default, logo usage, type scale, spacing, and callout/card/steps
  styling. Authored against the frontend-design principles referenced by the user:
  - https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
  - https://github.com/VoltAgent/awesome-claude-design
  (fetched during implementation).
- **`site/styles.css`:** implements the DESIGN.md tokens to bring Vocs' chrome close to
  the maple look (typography, spacing, callout/card/steps treatment), extending the
  current 260B `style.css` (dark-mode text fixes, responsive images).
- **Ceiling (stated):** Vocs ≠ Mintlify's renderer. Target is brand + layout + component
  look convincingly close, **not pixel-identical**. `ponytail:` deliberate corner —
  DESIGN.md + styles.css are the calibration knobs; escalate CSS only where a specific
  element reads visibly off.

---

## 10. Repo-wide Mintlify Scrub (operational only)

Enumerated targets (all live/operational; history left factual per decision):

**Delete:**
- `site/docs.json`, `site/.mintlify/`, `site/.mintignore`, `site/agent.md`,
  `site/README.md` (empty), `scripts/check-docs-twoslash.sh`.

**Rewrite for Vocs:**
- Root `CLAUDE.md` + `.claude/CLAUDE.md` — Documentation Site sections, Key Commands
  (`mintlify dev`/`broken-links` → `pnpm dev`/build), deployment description, docs-sync
  pointers.
- Rename skill **`sdk-site-mintlify` → `sdk-site-vocs`** (rewrite content for Vocs
  components/config) and de-Mintlify **`sdk-site-agent-guide`**, across **all 3 copies
  each**: `.agents/skills/`, `.claude/.agents/skills/`, `.claude/skills/`. Update the
  skills tables in both CLAUDE.md files.
- `docs/zktls-twitter/README.md` (Mintlify follow-up section), `RAL.md` (roadmap/xref
  lines), both `.omc/project-memory.json` (docs script + Assistant.md path references).

**Remove Mintlify MCP server:**
- `.codex/config.toml` (`[mcp_servers.Mintlify]`), `.claude/.codex/config.toml`
  (`[mcp_servers.Mintlify]`), `.claude/settings.local.json` (`"Mintlify"` entry).

**Final sweep:** the §1 grep proves zero live residue (CHANGELOG history exempt).

**Left factual (per decision):** `CHANGELOG.md` `@mintlify[bot]` entries and past git
commit messages.

---

## 11. Tooling & Scripts

Root `package.json`:
- `docs:dev` → `cd site && pnpm dev`
- `docs:check` → `cd site && pnpm build` (build gates twoslash + deadlinks)
- **Drop** `docs:broken-links` (folded into build); delete `scripts/check-docs-twoslash.sh`.

`site/package.json` (standalone, private): scripts `dev`/`build`/`preview`; devDeps
matching neobank's proven set (§2.1).

---

## 12. Deployment (Vercel Git integration)

- **In-repo (this migration):** `site/vercel.json` =
  `{ "installCommand": "npx pnpm@10 install --frozen-lockfile" }`; `site/pnpm-lock.yaml`
  generated; `.gitignore` excludes `dist/`, `.vocs/`.
- **Dashboard steps (user-only; provided as an exact checklist):**
  1. Create a Vercel project from the repo; set **Root Directory = `site`**.
  2. Confirm framework auto-detects Vocs; build `vocs build`, output `dist`.
  3. Point `docs.newton.xyz` DNS/domain at the Vercel project.
  4. Disconnect the Mintlify GitHub App from the repo.

---

## 13. Verification Plan

- `cd site && pnpm build` exits 0; static output present.
- Route count = 96; spot-check representative URLs.
- Deadlink check clean.
- Component-residue grep (§1) empty; Mintlify-residue grep (§1) empty sans CHANGELOG.
- `cd site && pnpm dev` — visual spot-check one page per component type
  (callout, steps, code-group, details, card, tabs, frame/image) vs current docs.
- Redirect table matches all 18 destinations.

---

## 14. Risks & Ceilings

- **Renderer parity** — see §9 ceiling; mitigated by DESIGN.md + styles.css.
- **External redirects** — handled at Vercel layer (§8), not Vocs.
- **Build weight** — Vocs' Waku/RSC build is heavier/slower than Mintlify's; acceptable.
- **React 19 / Vite 8 / Tailwind 4** — pinned to neobank's proven, working versions.
- **VaultKit sidebar resolution** — relies on longest-prefix matching; validated during
  impl by loading a `/developers/vaults/*` page and a sibling `/developers/*` page.

---

## 15. Decisions (resolved with user)

- **Target:** `site/` only (96 pages). `docs/` internal markdown stays unpublished; only
  its Mintlify mentions are scrubbed.
- **Scrub depth:** operational only; CHANGELOG history + git commits left factual.
- **Deploy:** Vercel Git integration (minimal `vercel.json`).
- **Components:** native Vocs (directives + Vocs React exports).
- **Theming:** close visual match via DESIGN.md + styles.css (ceiling in §9).
- **DESIGN.md location:** inside `site/`.
- **Home page:** root redirect `/` → `/developers/overview/about` (no new content).
- **Shield pages:** migrate as reachable pages, keep out of sidebar (preserve status quo).

---

## 16. Out of Scope

Publishing internal `docs/`; rewriting git/CHANGELOG history; content edits or new pages;
redesign beyond brand/layout parity; API playground (none exists today).
