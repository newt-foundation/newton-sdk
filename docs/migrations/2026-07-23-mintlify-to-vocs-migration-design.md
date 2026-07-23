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
- **No live Mintlify residue:** the scoped, executable gate below returns **empty**. It
  searches only tracked files, and excludes the two immutable/allowed records
  (`CHANGELOG.md` history) and this design/migration doc set (`docs/migrations/`), so a
  clean repo yields zero hits and the gate is reproducible in CI:
  ```bash
  git grep -niE "mintlify|mint\.json|\.mintignore" -- \
    ':(exclude)CHANGELOG.md' \
    ':(exclude)docs/migrations/' \
    ':(exclude)pnpm-lock.yaml'
  # exits nonzero (no matches) = pass; any printed line = residue to clean
  ```
  (`docs.json` is intentionally omitted from the pattern — it is a generic filename;
  the check that `site/docs.json` is gone is covered by the delete list in §10 and the
  build itself. Searching for the literal string `docs.json` would false-positive on
  this design doc and any Vocs config comments.)
- **No Mintlify-only components remain:** the gate lists only components that must be
  GONE. `Card`/`Cards`/`Tabs`/`Tab` are excluded — they remain as native Vocs React
  exports after conversion (only `CardGroup`→`Cards` and `<Frame>` are removed).
  `grep -rE "<(CardGroup|Note|Tip|Info|Warning|Steps|Step|Accordion|AccordionGroup|CodeGroup|Frame|Expandable)[ />]" site/src`
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
- **Cutover-safety ordering:** the migration lands on a branch/PR; the `docs.json` delete
  merges to `main` only after cutover Stage 3 (§12) confirms the Vocs site healthy, so
  `main` can always redeploy Mintlify during the rollback window. All other scrub edits
  can merge earlier — only the `site/docs.json` removal is gated on cutover.

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

**Staged cutover (user-only dashboard/DNS actions; provided as an exact runbook). The
order is deliberate: the new site is proven healthy on Vercel-owned hosts BEFORE any DNS
change, and Mintlify is disconnected LAST, only after a monitoring window passes.**

- **Stage 0 — record current state (rollback baseline):** before touching anything,
  capture the existing `docs.newton.xyz` DNS record(s) — type, value, and TTL —
  (`dig +noall +answer docs.newton.xyz CNAME A`) and the current Mintlify configuration.
  Note the record verbatim in the cutover ticket; this is the rollback target.
- **Stage 1 — build & host preflight (no DNS change):**
  1. Create the Vercel project from the repo; set **Root Directory = `site`**.
  2. Confirm framework auto-detects Vocs; build `vocs build`, output `dist`.
  3. Validate against the **Vercel deployment URL** (`*.vercel.app`), not the production
     domain: run the automated route/redirect parity harness (§13) against it. All 96
     routes 2xx, all 18 redirects hit their exact destination, no broken assets.
- **Stage 2 — mapped-domain preflight (low-TTL, reversible):**
  4. Lower the `docs.newton.xyz` DNS TTL to 300s and wait out the old TTL, so a rollback
     propagates fast.
  5. Add `docs.newton.xyz` as a domain in the Vercel project and point DNS at Vercel.
     Re-run the parity harness against `https://docs.newton.xyz` itself. Confirm TLS,
     canonical `baseUrl`, GA4 firing, and OG tags.
- **Stage 3 — monitor, then decommission:**
  6. **Monitoring window (≥24h):** watch for 4xx/5xx and broken-link reports.
     **Abort thresholds:** any 5xx on a top-level route, >2% of routes non-2xx, or a
     broken primary-nav path → execute rollback.
  7. Only after the window passes clean: **disconnect the Mintlify GitHub App** from the
     repo and restore the production TTL.
- **Rollback (any stage):** repoint `docs.newton.xyz` DNS to the Stage-0 recorded target
  (Mintlify). Because the Mintlify GitHub App stays connected until Stage 3, the old site
  remains live and DNS reversion is the only action needed. Do **not** delete `docs.json`
  from `main` (§10) until Stage 3 completes — keep the scrub commit on a branch/PR that
  merges only after cutover is confirmed, so `main` can always redeploy Mintlify if
  rollback is needed after the source is otherwise migrated.

---

## 13. Verification Plan

Verification is **automated and exhaustive**, not spot-check. A small script
(`site/scripts/verify-parity.mjs`, run against a served production build) is the gate.

**13.1 Expected-route manifest (source of truth = current site).** Before conversion,
generate the canonical list of routes from today's Mintlify content:
`find site -name '*.mdx'` → strip `.mdx`, map to URL paths (e.g.
`developers/overview/about`). Also extract the **18 redirects** (source → destination →
expected status) from `docs.json`. Commit both as `site/scripts/expected-routes.json`
and `site/scripts/expected-redirects.json` — the frozen baseline the harness asserts
against, so parity can't silently drift.

**13.2 Build gate.** `cd site && pnpm build` exits 0; static output present in `dist/`.
Vocs deadlink check passes. Twoslash (if any block uses it) passes.

**13.3 Per-route parity (all 96, not a sample).** Serve the production build
(`pnpm preview` or `npx serve dist`) and request **every** route in the manifest. For
each, assert:
- HTTP **2xx** (fail on any non-2xx or Vocs/Waku error page),
- the rendered HTML contains a non-empty `<title>` / `<h1>` (catches broken-MDX pages
  that "exist" but render an error),
- every **local** asset the page references (`/images/…`, `/logo/…`, `src=/…`) resolves
  2xx (catches assets missed in the `public/` move).
Any failure fails the gate and prints the offending route + reason.

**13.4 Per-redirect parity (all 18).** For each entry in `expected-redirects.json`,
request the source and assert the response is a redirect to the **exact** destination
with the expected status (internal via Vocs; the 2 external `blog.newton.xyz` ones via
`vercel.json` — the external two are asserted against the Vercel preview URL in cutover
Stage 1, since `pnpm preview` doesn't apply `vercel.json`). Include the `/` →
`/developers/overview/about` home redirect and the `:path*` wildcard cases.

**13.5 Residue & component gates.**
- Mintlify-residue: the scoped `git grep` from §1 returns empty.
- Component-residue: the `site/src` component grep from §1 returns empty.
- Both wired into `docs:check` so they're reproducible in CI, not manual.

**13.6 Visual spot-check (human, supplementary).** `cd site && pnpm dev` — eyeball one
page per component type (callout, steps, code-group, details, card, tabs, frame/image)
against current docs for the close-visual-match goal (§9). This is a design check on top
of the automated correctness gates above, not a substitute for them.

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
