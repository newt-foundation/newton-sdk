# Mintlify → Vocs + Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the published docs site (`site/`, 96 MDX pages, currently Mintlify-hosted at docs.newton.xyz) to a self-hosted Vocs + Vercel setup with faithful content/nav/brand parity and zero live Mintlify residue.

**Architecture:** `site/` becomes a standalone Vocs package (own `pnpm-lock.yaml`; Vercel Root Directory = `site`). Pages move to `src/pages/` (URLs unchanged); assets to `public/`. `docs.json` navigation/theme/redirects port to `vocs.config.ts`. ~300 Mintlify component instances convert to native Vocs directives + Vocs React exports. An automated parity harness (frozen route/redirect baselines) is the acceptance gate. Cutover is staged with rollback.

**Tech Stack:** Vocs `^2.0.12`, React `^19.2.4`, react-dom `^19.2.4`, react-server-dom-webpack `~19.2.3`, Vite `^8.0.14`, Tailwind CSS `^4.1.16`, Waku `1.0.0-beta.1`, `@types/react`/`@types/react-dom` `^19`. Node ≥ 20. pnpm.

**Spec:** `docs/migrations/2026-07-23-mintlify-to-vocs-migration-design.md` (commit `d031801`).

## Global Constraints

- **Package manager:** pnpm. Vercel install: `npx pnpm@10 install --frozen-lockfile`.
- **Versions (pin exactly, from neobank's proven set):** `vocs@^2.0.12`, `react@^19.2.4`, `react-dom@^19.2.4`, `react-server-dom-webpack@~19.2.3`, `vite@^8.0.14`, `tailwindcss@^4.1.16`, `waku@1.0.0-beta.1`, `@types/react@^19.2.14`, `@types/react-dom@^19.2.3`.
- **Node:** ≥ 20.12 for the docs build (Vocs' rolldown toolchain uses `util.styleText`, added in Node 20.12 / 21.7). The repo root pins 20.10 for the SDK; the docs site pins its own `site/.nvmrc` = `22` (Vercel-supported, current). Vercel rounds `.nvmrc` to its latest supported major, so 22 (or any ≥20.12) builds cleanly.
- **No new content / no redesign:** faithful port only. Preserve every URL, all 18 redirects, brand (colors `#19191a`/`#ffffff`/`#303030`, light-default, logos, favicon, OG, GA4 `G-JFG7Z812VK`).
- **No AI attribution in commits** (`.claude/rules/git-hygiene.md`): no `Co-Authored-By`, no "Claude/Anthropic/AI-generated". Conventional commits, subject ≤ 72 chars (enforced by a commit hook).
- **Scrub depth:** operational only. `CHANGELOG.md` history + git commit history left factual.
- **Cutover-safety ordering:** the `site/docs.json` DELETE (Task 13) merges to `main` only after cutover Stage 3 confirms health. Every other change can merge earlier.
- **Residue gate (must return empty post-migration):**
  ```bash
  git grep -niE "mintlify|mint\.json|\.mintignore" -- \
    ':(exclude)CHANGELOG.md' ':(exclude)docs/migrations/' ':(exclude)pnpm-lock.yaml'
  ```
- **Component-residue gate (must return empty post-migration):** lists only the
  Mintlify components that must be GONE. `Card`/`Cards`/`Tabs`/`Tab` are NOT listed —
  they are legitimate Vocs React exports that remain after Task 9 (only `CardGroup`→`Cards`
  and `<Frame>` are removed). The word-boundary `[ />]` means `<Cards>` never matches the
  `CardGroup` arm.
  ```bash
  grep -rE "<(CardGroup|Note|Tip|Info|Warning|Steps|Step|Accordion|AccordionGroup|CodeGroup|Frame|Expandable)[ />]" site/src
  ```

---

## File Structure

**Created:**
- `site/package.json` — standalone private Vocs package manifest.
- `site/tsconfig.json` — TS config for `vocs.config.ts` + any TSX.
- `site/.gitignore` — `dist/`, `.vocs/`, `node_modules/`, `cache/`, `*.log`.
- `site/vercel.json` — install command + 2 external redirects.
- `site/pnpm-lock.yaml` — generated on install.
- `site/vocs.config.ts` — nav, theme, logo, socials, redirects, head/SEO/GA4.
- `site/styles.css` — brand-parity CSS (carries over + extends old `style.css`).
- `site/DESIGN.md` — design tokens + rationale.
- `site/scripts/gen-baseline.mjs` — generates route/redirect baselines from current site.
- `site/scripts/expected-routes.json` — frozen route manifest (baseline).
- `site/scripts/expected-redirects.json` — frozen redirect manifest (baseline).
- `site/scripts/verify-parity.mjs` — automated parity harness (the acceptance gate).
- `site/scripts/convert-components.mjs` — MDX component → directive codemod.
- `docs/migrations/2026-07-23-vocs-cutover-runbook.md` — user-only dashboard/DNS runbook.

**Moved (git mv, content unchanged in the move step):**
- `site/**/*.mdx` → `site/src/pages/**/*.mdx` (96 files; nesting preserved).
- `site/images/`, `site/logo/`, `site/og/`, `site/favicon.svg`, `site/llms.txt` → `site/public/`.

**Modified (content transformation):**
- All 96 `.mdx` under `site/src/pages/` (component conversion).
- `site/styles.css` (extends old `style.css`).

**Deleted:**
- `site/docs.json` (Task 13, cutover-gated), `site/.mintlify/`, `site/.mintignore`, `site/agent.md`, `site/README.md` (empty), `site/style.css` (renamed to `styles.css`), `scripts/check-docs-twoslash.sh`.

**Scrubbed (Mintlify references removed/rewritten):**
- Root `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/AGENTS.md`, `.claude/codex/AGENTS.md`.
- Skill `sdk-site-mintlify` → renamed `sdk-site-vocs` (×3 copies: `.agents/skills/`, `.claude/.agents/skills/`, `.claude/skills/`).
- Skill `sdk-site-agent-guide` de-Mintlify'd (×3 copies).
- `.codex/config.toml`, `.claude/.codex/config.toml` (`[mcp_servers.Mintlify]`), `.claude/settings.local.json` (`"Mintlify"`).
- `docs/zktls-twitter/README.md`, `RAL.md`, `.omc/project-memory.json`, `.claude/.omc/project-memory.json`.
- Root `package.json` (`docs:*` scripts).

---

## Task 0: Scaffold standalone Vocs package

**Files:**
- Create: `site/package.json`, `site/tsconfig.json`, `site/.gitignore`, `site/src/pages/index.mdx` (temporary placeholder), `site/vercel.json`
- Generated: `site/pnpm-lock.yaml`

**Interfaces:**
- Produces: a buildable Vocs package rooted at `site/`; scripts `dev`/`build`/`preview`; build output `site/dist/`.

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "@newton-xyz/sdk-docs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Vocs documentation site for the Newton SDK",
  "scripts": {
    "dev": "vocs dev",
    "build": "vocs build",
    "preview": "vocs preview",
    "gen-baseline": "node scripts/gen-baseline.mjs",
    "verify": "node scripts/verify-parity.mjs"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-server-dom-webpack": "~19.2.3",
    "tailwindcss": "^4.1.16",
    "vite": "^8.0.14",
    "vocs": "^2.0.12",
    "waku": "1.0.0-beta.1"
  }
}
```

- [ ] **Step 2: Create `site/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["react", "react-dom"]
  },
  "include": ["vocs.config.ts", "src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create `site/.gitignore`**

```
node_modules/
dist/
.vocs/
cache/
*.log
```

- [ ] **Step 4: Create a temporary placeholder page so the build has content**

Create `site/src/pages/index.mdx`:

```mdx
# Newton SDK Docs

Placeholder — replaced during migration.
```

- [ ] **Step 5: Create `site/vercel.json` (install command only for now; redirects added in Task 6)**

```json
{
  "installCommand": "npx pnpm@10 install --frozen-lockfile"
}
```

- [ ] **Step 6: Install dependencies (generates the lockfile)**

Run: `cd site && pnpm install`
Expected: completes; `site/pnpm-lock.yaml` and `site/node_modules/` created.

- [ ] **Step 7: Verify the scaffold builds**

Run: `cd site && pnpm build`
Expected: exits 0; `site/dist/` created containing an `index.html`.

- [ ] **Step 8: Commit**

```bash
git add site/package.json site/tsconfig.json site/.gitignore site/vercel.json site/src/pages/index.mdx site/pnpm-lock.yaml
git commit -m "chore(docs): scaffold standalone Vocs package in site/"
```

---

## Task 1: Freeze the parity baseline

**Files:**
- Create: `site/scripts/gen-baseline.mjs`, `site/scripts/expected-routes.json`, `site/scripts/expected-redirects.json`

**Interfaces:**
- Consumes: current `site/docs.json` (redirects), current `site/**/*.mdx` tree (routes). MUST run BEFORE any page move or `docs.json` delete, while the Mintlify layout still exists.
- Produces: `expected-routes.json` = `string[]` of URL paths (leading `/`, no extension); `expected-redirects.json` = `Array<{source,destination,status}>`. Consumed by `verify-parity.mjs` (Task 2).

- [ ] **Step 1: Write `site/scripts/gen-baseline.mjs`**

```js
// Generates the frozen parity baseline from the CURRENT Mintlify site.
// Run once, before pages move. Reads site/docs.json + site/**/*.mdx.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const siteRoot = join(here, '..') // site/

// 1. Routes: every .mdx under site/ (excluding node_modules/dist/src) -> URL path.
const routes = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (['node_modules', 'dist', '.vocs', 'src', 'scripts', 'public'].includes(name)) continue
    const s = statSync(full)
    if (s.isDirectory()) walk(full)
    else if (name.endsWith('.mdx')) {
      const rel = relative(siteRoot, full).replace(/\\/g, '/').replace(/\.mdx$/, '')
      routes.push('/' + rel)
    }
  }
}
walk(siteRoot)
routes.sort()

// 2. Redirects: from docs.json, split internal vs external, tag the EXPECTED status
//    that the harness will actually observe (not docs.json's implied permanence).
//    - Internal redirects are served by Vocs, which emits 307 by default.
//    - External redirects are served by Vercel (vercel.json permanent:true => 308).
//    - The home redirect is Vercel permanent:false => 307.
//    These are the codes the harness asserts EXACTLY. If a value here proves wrong on the
//    real build (Task 2 Step 2 will reveal it), correct the constant to the observed code
//    ONCE and re-freeze — the baseline must match reality, not the other way around.
const INTERNAL_REDIRECT_STATUS = 307 // Vocs default; confirm in Task 2 against the real build
const EXTERNAL_REDIRECT_STATUS = 308 // Vercel permanent:true
const docs = JSON.parse(readFileSync(join(siteRoot, 'docs.json'), 'utf8'))
const redirects = (docs.redirects ?? []).map((r) => {
  const external = /^https?:\/\//.test(r.destination)
  return {
    source: r.source,
    destination: r.destination,
    external,
    status: external ? EXTERNAL_REDIRECT_STATUS : INTERNAL_REDIRECT_STATUS,
  }
})
// The home redirect (Vercel permanent:false => 307):
redirects.push({ source: '/', destination: '/developers/overview/about', external: true, status: 307 })

writeFileSync(join(here, 'expected-routes.json'), JSON.stringify(routes, null, 2) + '\n')
writeFileSync(join(here, 'expected-redirects.json'), JSON.stringify(redirects, null, 2) + '\n')
console.log(`baseline: ${routes.length} routes, ${redirects.length} redirects`)
```

- [ ] **Step 2: Run it and verify the counts**

Run: `cd site && node scripts/gen-baseline.mjs`
Expected: prints `baseline: 96 routes, 19 redirects` (18 from docs.json + 1 home). If routes ≠ 96, STOP and reconcile before proceeding.

- [ ] **Step 3: Sanity-check a few known routes are present**

Run: `cd site && node -e "const r=require('./scripts/expected-routes.json'); for (const p of ['/developers/overview/about','/whitepaper/introduction','/protocol/governance/governance-model','/developers/vaults/shield/architecture']) console.log(p, r.includes(p))"`
Expected: all four print `true` (confirms Shield orphan pages are captured too).

- [ ] **Step 4: Commit the frozen baseline**

```bash
git add site/scripts/gen-baseline.mjs site/scripts/expected-routes.json site/scripts/expected-redirects.json
git commit -m "test(docs): freeze route+redirect parity baseline from Mintlify site"
```

---

## Task 2: Build the parity harness

**Files:**
- Create: `site/scripts/verify-parity.mjs`

**Interfaces:**
- Consumes: `expected-routes.json`, `expected-redirects.json` (Task 1); a running static server for `site/dist/` at a base URL (default `http://localhost:4173`).
- Produces: exit 0 = all routes 2xx + have a title + local assets resolve + all redirects exact; exit 1 = prints every failure. This is THE acceptance gate reused in Tasks 11 and 13.

- [ ] **Step 1: Write `site/scripts/verify-parity.mjs`**

```js
// Automated parity gate. Serve the built site first:
//   pnpm build && npx serve -l 4173 dist   (or `pnpm preview`)
// then: node scripts/verify-parity.mjs http://localhost:4173
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '')
const here = dirname(fileURLToPath(import.meta.url))
const routes = JSON.parse(readFileSync(join(here, 'expected-routes.json'), 'utf8'))
const redirects = JSON.parse(readFileSync(join(here, 'expected-redirects.json'), 'utf8'))
const failures = []

// Map a current Mintlify route to its Vocs URL. Pages move verbatim, so the
// path is identical EXCEPT the leading segment: site/<x>.mdx -> src/pages/<x>.mdx -> /<x>.
// No transform needed — URLs are preserved by design.
const toUrl = (p) => p

// 1. Per-route: 2xx, has <title>/<h1>, local assets resolve.
for (const route of routes) {
  const url = base + toUrl(route)
  let res
  try { res = await fetch(url) } catch (e) { failures.push(`FETCH ${route}: ${e.message}`); continue }
  if (!res.ok) { failures.push(`STATUS ${route}: ${res.status}`); continue }
  const html = await res.text()
  if (!/<title>[^<]+<\/title>/.test(html) && !/<h1[^>]*>[^<]+<\/h1>/.test(html))
    failures.push(`NOTITLE ${route}: no <title> or <h1>`)
  // local assets referenced by src="/..." or href="/...(png|jpg|svg|webp|gif)"
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:png|jpe?g|svg|webp|gif))"/g)].map((m) => m[1])
  for (const a of [...new Set(assets)]) {
    const ar = await fetch(base + a, { method: 'HEAD' })
    if (!ar.ok) failures.push(`ASSET ${route}: ${a} -> ${ar.status}`)
  }
}

// 2. Per-redirect: EXACT destination AND EXACT status (no auto-follow).
for (const r of redirects) {
  if (r.external) continue // external redirects live in vercel.json; asserted on Vercel preview in cutover Stage 1
  const res = await fetch(base + r.source, { redirect: 'manual' })
  const loc = res.headers.get('location')
  if (res.status !== r.status)
    failures.push(`REDIR ${r.source}: status ${res.status}, expected ${r.status}`)
  if (loc !== r.destination && loc !== base + r.destination)
    failures.push(`REDIR ${r.source}: -> ${loc}, expected ${r.destination}`)
}

if (failures.length) {
  console.error(`PARITY FAIL (${failures.length}):`)
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log(`PARITY OK: ${routes.length} routes, ${redirects.filter((r) => !r.external).length} internal redirects`)
```

- [ ] **Step 2: Prove the harness WORKS by running it against the placeholder build (must FAIL)**

Run:
```bash
cd site && pnpm build && (npx serve -l 4173 dist &) && sleep 2 && node scripts/verify-parity.mjs http://localhost:4173; kill %1 2>/dev/null
```
Expected: `PARITY FAIL` with ~96 `STATUS .../404` lines (only `/` exists in the placeholder). This proves the harness detects missing routes — a harness that can't fail is worthless.

- [ ] **Step 3: Commit**

```bash
git add site/scripts/verify-parity.mjs
git commit -m "test(docs): add automated route+redirect parity harness"
```

---

## Task 3: Move assets to `public/`

**Files:**
- Move: `site/images/`, `site/logo/`, `site/og/`, `site/favicon.svg`, `site/llms.txt` → `site/public/`

**Interfaces:**
- Produces: assets served at site root (`/images/…`, `/logo/…`, `/og/…`, `/favicon.svg`, `/llms.txt`) — the exact paths pages already reference.

- [ ] **Step 1: Move assets with git mv (preserves history)**

```bash
cd site
mkdir -p public
git mv images public/images
git mv logo public/logo
git mv og public/og
git mv favicon.svg public/favicon.svg
git mv llms.txt public/llms.txt
```

- [ ] **Step 2: Verify the placeholder build serves an asset**

Run:
```bash
cd site && pnpm build && (npx serve -l 4173 dist &) && sleep 2 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/logo/light.svg; kill %1 2>/dev/null
```
Expected: `200`.

- [ ] **Step 3: Commit**

```bash
git add -A site/public
git commit -m "chore(docs): move site assets into public/ for Vocs"
```

---

## Task 4: Move the 96 pages to `src/pages/`

**Files:**
- Move: `site/developers/`, `site/whitepaper/`, `site/protocol/` → `site/src/pages/` (content unchanged). Delete the temporary `site/src/pages/index.mdx` placeholder.

**Interfaces:**
- Produces: all 96 `.mdx` under `site/src/pages/` at their URL-preserving paths. Component conversion happens later (Tasks 8–9); this task is a pure move.

- [ ] **Step 1: Move page trees with git mv**

```bash
cd site
rm src/pages/index.mdx          # remove placeholder
git mv developers src/pages/developers
git mv whitepaper src/pages/whitepaper
git mv protocol src/pages/protocol
```

- [ ] **Step 2: Confirm the count moved intact**

Run: `cd site && find src/pages -name '*.mdx' | wc -l`
Expected: `96`.

- [ ] **Step 3: Commit (content-neutral move; build may not fully pass yet — no config/components)**

```bash
git add -A site/src/pages site/developers site/whitepaper site/protocol
git commit -m "chore(docs): move MDX pages into src/pages/ (URLs preserved)"
```

---

## Task 5: Write `vocs.config.ts` (nav + theme + branding)

**Files:**
- Create: `site/vocs.config.ts`
- Reference (do not delete yet): `site/docs.json` for verbatim nav transcription.

**Interfaces:**
- Consumes: page paths under `src/pages/`; `docs.json` nav/theme.
- Produces: `topNav` (4 tabs + Blog anchor), path-keyed `sidebar` for `/developers`, `/developers/vaults`, `/whitepaper`, `/protocol`; theme (accentColor, colorScheme light-default), `logoUrl`, `iconUrl`, `socials`, `baseUrl`, `title`, `description`. Redirects + head added in Tasks 6–7.

- [ ] **Step 1: Transcribe `docs.json` navigation into a config.** Create `site/vocs.config.ts`. The sidebar keys use **longest-prefix** matching so `/developers/vaults/*` (VaultKit tab) resolves separately from other `/developers/*` (Developers tab). Every group/page below is copied 1:1 from `docs.json`.

```ts
import { defineConfig } from 'vocs/config'

export default defineConfig({
  title: 'Newton Protocol Docs',
  description:
    'Newton Protocol is a decentralized policy engine for onchain transaction authorization, built as an EigenLayer AVS.',
  baseUrl: 'https://docs.newton.xyz',
  logoUrl: { light: '/logo/light.svg', dark: '/logo/dark.svg' },
  iconUrl: '/favicon.svg',
  accentColor: '#19191a',
  colorScheme: 'light dark', // light default matches docs.json appearance.default = "light"
  socials: [{ icon: 'x', link: 'https://x.com/newtfoundation' }],
  topNav: [
    { text: 'Developers', link: '/developers/overview/about', match: '/developers' },
    { text: 'VaultKit', link: '/developers/vaults/overview', match: '/developers/vaults' },
    { text: 'Whitepaper', link: '/whitepaper/introduction', match: '/whitepaper' },
    { text: 'Protocol', link: '/protocol/overview/project-and-protocol', match: '/protocol' },
    { text: 'Blog', link: 'https://blog.newton.xyz' },
  ],
  sidebar: {
    '/developers/vaults': [
      {
        text: 'Overview',
        items: [
          { text: 'Overview', link: '/developers/vaults/overview' },
          { text: 'Policy Packs', link: '/developers/vaults/policy-packs' },
          { text: 'Concepts', link: '/developers/vaults/protocol/concepts' },
          { text: 'Attestation Flow', link: '/developers/vaults/protocol/attestation-flow' },
          { text: 'Guarantees', link: '/developers/vaults/protocol/guarantees' },
        ],
      },
      {
        text: 'Policy Packs',
        items: [
          { text: 'vaults.fyi', link: '/developers/vaults/policies/vaultsfyi' },
          { text: 'Chainalysis', link: '/developers/vaults/policies/chainalysis' },
          { text: 'RedStone', link: '/developers/vaults/policies/redstone' },
          { text: 'Webacy', link: '/developers/vaults/policies/webacy' },
        ],
      },
      {
        text: 'SDK',
        items: [
          { text: 'Overview', link: '/developers/vaults/sdk/overview' },
          { text: 'Integration Guide', link: '/developers/vaults/sdk/integration-guide' },
          { text: 'Examples', link: '/developers/vaults/sdk/examples' },
          { text: 'Reference', link: '/developers/vaults/sdk/reference' },
          { text: 'Errors', link: '/developers/vaults/sdk/errors' },
          { text: 'Morpho', link: '/developers/vaults/sdk/morpho' },
          { text: 'Euler Vault', link: '/developers/vaults/sdk/euler-vault' },
          { text: 'Euler', link: '/developers/vaults/sdk/euler' },
          { text: 'Composite Policy Packs', link: '/developers/vaults/sdk/composite-policy-packs' },
        ],
      },
      {
        text: 'Resources',
        items: [{ text: 'Legal Terms', link: '/developers/vaults/resources/legal-terms' }],
      },
    ],
    '/developers': [
      {
        text: 'Getting Started',
        items: [
          { text: 'What is Newton?', link: '/developers/overview/about' },
          { text: 'Core Concepts', link: '/developers/overview/core-concepts' },
          { text: 'Quickstart', link: '/developers/overview/quickstart' },
          { text: 'Dashboard & API Keys', link: '/developers/overview/dashboard-api-keys' },
        ],
      },
      {
        text: 'Verifiable Credential',
        items: [
          { text: 'Overview', link: '/developers/verified-credential/overview' },
          { text: 'Integration Guide', link: '/developers/verified-credential/integration-guide' },
          { text: 'Reference', link: '/developers/verified-credential/reference' },
          { text: 'Identity Policy Reference', link: '/developers/verified-credential/identity-policy-reference' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Integration Guide', link: '/developers/guides/integration-guide' },
          { text: 'Writing Data Oracles', link: '/developers/guides/writing-data-oracles' },
          { text: 'Writing Policies', link: '/developers/guides/writing-policies' },
          { text: 'Secrets in Oracles', link: '/developers/guides/secrets-in-oracles' },
          { text: 'Chaining Data Oracles', link: '/developers/guides/chaining-data-oracles' },
          { text: 'Policy Packs', link: '/developers/guides/policy-packs' },
          { text: 'Deploying with CLI', link: '/developers/guides/deploying-with-cli' },
          { text: 'Smart Contract Integration', link: '/developers/guides/smart-contract-integration' },
          { text: 'Frontend SDK Integration', link: '/developers/guides/frontend-sdk-integration' },
          { text: 'Using the Dashboard', link: '/developers/guides/using-the-dashboard' },
          { text: 'Testing Policies', link: '/developers/guides/testing-policies' },
          { text: 'Privacy Flows', link: '/developers/guides/privacy-flows' },
          { text: 'zkTLS Twitter', link: '/developers/guides/zktls-twitter' },
        ],
      },
      {
        text: 'Use Cases',
        items: [
          { text: 'Stablecoins & Payments', link: '/developers/use-cases/stablecoins-and-payments' },
          { text: 'Agent Security', link: '/developers/use-cases/agent-security' },
          { text: 'Institutional DeFi', link: '/developers/use-cases/institutional-defi' },
        ],
      },
      {
        text: 'Deep Dives',
        items: [
          { text: 'Architecture', link: '/developers/concepts/architecture' },
          { text: 'Privacy Layer', link: '/developers/concepts/privacy-layer' },
          { text: 'Consensus Security', link: '/developers/concepts/consensus-security' },
          { text: 'Multichain', link: '/developers/concepts/multichain' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'SDK Reference', link: '/developers/reference/sdk-reference' },
          { text: 'RPC API', link: '/developers/reference/rpc-api' },
          { text: 'Command Line Tool', link: '/developers/reference/command-line-tool' },
          { text: 'Contract Addresses', link: '/developers/reference/contract-addresses' },
          { text: 'Error Reference', link: '/developers/reference/error-reference' },
          { text: 'Glossary', link: '/developers/reference/glossary' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Rego Syntax Guide', link: '/developers/advanced/rego-syntax-guide' },
          { text: 'Encrypting Secrets', link: '/developers/advanced/encrypting-secrets' },
          { text: 'Policy Data Oracles', link: '/developers/advanced/policy-data-oracles' },
          { text: 'Python WASM Guide', link: '/developers/advanced/python-wasm-guide' },
          { text: 'JavaScript WASM Guide', link: '/developers/advanced/javascript-wasm-guide' },
          { text: 'Rust WASM Guide', link: '/developers/advanced/rust-wasm-guide' },
        ],
      },
      {
        text: 'Resources',
        items: [
          { text: 'FAQ', link: '/developers/resources/faq' },
          { text: 'Testing & Debugging', link: '/developers/resources/testing-debugging' },
          { text: 'Deployment Checklist', link: '/developers/resources/deployment-checklist' },
          { text: 'Newton Explorer', link: '/developers/resources/newton-explorer' },
          { text: 'Developer Terms of Service', link: '/developers/resources/developer-terms-of-service' },
          { text: 'Context File', link: '/developers/reference/context-file' },
        ],
      },
    ],
    '/whitepaper': [
      {
        text: 'Technical Whitepaper',
        items: [
          { text: 'Introduction', link: '/whitepaper/introduction' },
          { text: 'Privacy Architecture', link: '/whitepaper/privacy-architecture' },
          { text: 'BLS Attestation', link: '/whitepaper/bls-attestation' },
          { text: 'Streaming Consensus', link: '/whitepaper/streaming-consensus' },
          { text: 'Cross-Chain', link: '/whitepaper/cross-chain' },
          { text: 'Slashing & Challenge', link: '/whitepaper/slashing-challenge' },
          { text: 'Policy Engine', link: '/whitepaper/policy-engine' },
          { text: 'Decentralization', link: '/whitepaper/decentralization' },
          { text: 'Security Properties', link: '/whitepaper/security-properties' },
          { text: 'References', link: '/whitepaper/references' },
        ],
      },
    ],
    '/protocol': [
      {
        text: 'Overview',
        items: [
          { text: 'Project & Protocol', link: '/protocol/overview/project-and-protocol' },
          { text: 'Bug Bounty', link: '/protocol/overview/bug-bounty' },
        ],
      },
      {
        text: 'Foundation',
        items: [
          { text: 'Structure & Key Contributors', link: '/protocol/foundation/structure-and-key-contributors' },
          { text: 'Conflict of Interest & Code of Conduct', link: '/protocol/foundation/conflict-of-interest-and-code-of-conduct' },
        ],
      },
      {
        text: 'Token',
        items: [
          { text: 'Characteristics & Utility', link: '/protocol/token/characteristics-and-utility' },
          { text: 'Distribution & Vesting', link: '/protocol/token/distribution-and-vesting' },
        ],
      },
      {
        text: 'Transparency Reports',
        items: [{ text: 'Reports', link: '/protocol/transparency-reports/reports' }],
      },
      {
        text: 'Governance',
        items: [{ text: 'Governance Model', link: '/protocol/governance/governance-model' }],
      },
    ],
  },
})
```

- [ ] **Step 2: Build (pages still contain Mintlify components → build MAY warn/fail on MDX; that is expected until Tasks 8–9).** First confirm the config itself is valid by type-checking it:

Run: `cd site && npx tsc --noEmit -p tsconfig.json`
Expected: no type errors from `vocs.config.ts` (config field names valid). If a field name is rejected, consult installed `node_modules/vocs` types and correct it before proceeding.

- [ ] **Step 3: Commit**

```bash
git add site/vocs.config.ts
git commit -m "feat(docs): add Vocs config with 4-tab nav and brand theme"
```

---

## Task 6: Redirects (internal in config, external + home in vercel.json)

**Files:**
- Modify: `site/vocs.config.ts` (add `redirects` for the 16 internal), `site/vercel.json` (add 2 external + the home redirect at the hosting layer)

**Interfaces:**
- Consumes: `expected-redirects.json` (source of truth for exact source/destination).
- Produces: 16 internal redirects resolved by Vocs; 2 external + `/`→`/developers/overview/about` resolved by Vercel. The harness (Task 2) asserts the 16 internal against the preview; the 3 hosting-layer ones assert on the Vercel preview URL in cutover Stage 1.

- [ ] **Step 1: Add the 16 internal redirects to `vocs.config.ts`** (append this field to the `defineConfig` object, copied verbatim from `docs.json`):

```ts
  redirects: [
    { source: '/newton-protocol/overview', destination: '/protocol/overview/project-and-protocol' },
    { source: '/newton-protocol/:path*', destination: '/protocol/overview/:path*' },
    { source: '/foundation/foundation-structure-and-key-contributors', destination: '/protocol/foundation/structure-and-key-contributors' },
    { source: '/foundation/conflict-of-interest-and-code-of-conduct', destination: '/protocol/foundation/conflict-of-interest-and-code-of-conduct' },
    { source: '/token/token-characteristics-and-utility', destination: '/protocol/token/characteristics-and-utility' },
    { source: '/token/token-distribution-and-vesting', destination: '/protocol/token/distribution-and-vesting' },
    { source: '/transparency-reports/transparency-reports', destination: '/protocol/transparency-reports/reports' },
    { source: '/governance/governance-model', destination: '/protocol/governance/governance-model' },
    { source: '/developers/overview/integration-guide', destination: '/developers/guides/integration-guide' },
    { source: '/developers/advanced/policy-client-guide', destination: '/developers/guides/smart-contract-integration' },
    { source: '/developers/advanced/building-policies', destination: '/developers/guides/writing-policies' },
    { source: '/developers/vaults/policies', destination: '/developers/vaults/policy-packs' },
    { source: '/developers/vaults/policies/overview', destination: '/developers/vaults/policy-packs' },
    { source: '/developers/vaults/vault-sdk', destination: '/developers/vaults/sdk/overview' },
    { source: '/developers/overview/newton-explorer', destination: '/developers/resources/newton-explorer' },
    { source: '/developers/advanced/kms-encryption', destination: '/developers/advanced/encrypting-secrets' },
  ],
```

- [ ] **Step 2: Update `site/vercel.json` with external redirects + the home redirect.** (Vercel `redirects` use `permanent: true` → 308, `false` → 307; the two blog links match docs.json's intent as permanent.)

```json
{
  "installCommand": "npx pnpm@10 install --frozen-lockfile",
  "redirects": [
    { "source": "/", "destination": "/developers/overview/about", "permanent": false },
    { "source": "/how-to-guides/newt-token-staking", "destination": "https://blog.newton.xyz/how-to-stake-newt/", "permanent": true },
    { "source": "/references/newt-token-airdrop", "destination": "https://blog.newton.xyz/newt-airdrop-claiming-staking/", "permanent": true }
  ]
}
```

- [ ] **Step 3: Verify the two external + home redirects are NOT lost.** Because `pnpm preview` does not apply `vercel.json`, add a note to the runbook (Task 14) to assert these three on the Vercel preview URL. For now, confirm the JSON is valid:

Run: `cd site && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"`
Expected: `vercel.json OK`.

- [ ] **Step 4: Commit**

```bash
git add site/vocs.config.ts site/vercel.json
git commit -m "feat(docs): port 18 redirects (internal to Vocs, external+home to Vercel)"
```

---

## Task 7: Head — SEO, OG, and GA4

**Files:**
- Modify: `site/vocs.config.ts` (add `head`)

**Interfaces:**
- Consumes: GA4 id `G-JFG7Z812VK`; google-site-verification `z93uJU02uM0Z9bdqWDxN2dV1HHAlsaqDy-LwCHYSuGA`; OG images `/og/opengraph-image.jpg`, `/og/twitter-image.jpg`.
- Produces: `<head>` meta + GA4 script in every built page.

- [ ] **Step 1: Add a `head` object to `vocs.config.ts`** (append field). Use the **non-JSX object form** — the config file is `vocs.config.ts`, and JSX syntax is invalid in a `.ts` file regardless of the `jsx` compiler option (that option controls *transformation*, not whether the parser *accepts* JSX; JSX requires a `.tsx` file). The object form keeps the config a plain `.ts` file and injects the same site verification, author, OG/Twitter meta, and GA4 gtag pair:

```ts
  head: {
    meta: [
      { name: 'google-site-verification', content: 'z93uJU02uM0Z9bdqWDxN2dV1HHAlsaqDy-LwCHYSuGA' },
      { name: 'author', content: 'Newton' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Newton Protocol Docs' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:image', content: 'https://docs.newton.xyz/og/opengraph-image.jpg' },
      { name: 'twitter:site', content: '@newtfoundation' },
      { name: 'twitter:creator', content: '@newtfoundation' },
      { name: 'twitter:image', content: 'https://docs.newton.xyz/og/twitter-image.jpg' },
    ],
    script: [
      { src: 'https://www.googletagmanager.com/gtag/js?id=G-JFG7Z812VK', async: true },
      {
        children:
          "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-JFG7Z812VK');",
      },
    ],
  },
```

Note: `head` shape can vary slightly by Vocs minor version. Before editing, confirm the exact field names against the installed types — `grep -rE "head|HeadOptions|HeadMeta|Script" site/node_modules/vocs/**/*.d.ts | head -30`. The object above uses the documented unhead-style `meta[]`/`script[]` arrays (`{ name|property, content }` for meta; `{ src, async }` and `{ children }` for scripts). If a field name differs (e.g. inline-script key is `innerHTML` rather than `children`), use whatever the installed `.d.ts` declares. Do NOT switch to JSX or rename the file to `.tsx` — the object form is the single supported path here. If Vocs' installed `head` type is strictly a function, use `head() { return { meta: [...], script: [...] } }` returning the SAME object (still no JSX).

Security note (SRI intentionally omitted on gtag): the GA4 `gtag/js` tag deliberately has NO `integrity="sha384-…"`/`crossorigin` attributes. `gtag.js` is a bootstrap loader that fetches further Google code at runtime, the file rotates, and Google publishes no stable hash — an SRI hash would break analytics on Google's next update. The current Mintlify site already loads GA4 without SRI (via its `ga4` config), so omitting it preserves parity and is the correct choice. Do not add SRI here to satisfy a generic linter; if you must, gate it behind a verified, Google-published hash (none exists today).

- [ ] **Step 2: Type-check the config**

Run: `cd site && npx tsc --noEmit -p tsconfig.json`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add site/vocs.config.ts
git commit -m "feat(docs): inject SEO/OG meta and GA4 via Vocs head"
```

---

## Task 8: Component codemod — directive-style conversions

**Files:**
- Create: `site/scripts/convert-components.mjs`
- Modify: all `.mdx` under `site/src/pages/` that use `<Note>/<Info>/<Tip>/<Warning>`, `<CodeGroup>`, `<Accordion>/<Expandable>/<AccordionGroup>`, `<Steps>/<Step>`.

**Interfaces:**
- Produces: those Mintlify components replaced by Vocs directives. `<Card>/<CardGroup>/<Tabs>/<Tab>/<Frame>` are handled in Task 9 (they need JS imports / are JSX-preserving), so this codemod leaves them untouched.

Conversion rules (applied by the script, then spot-verified):

| Mintlify | Vocs |
|---|---|
| `<Note>…</Note>` | `:::note` … `:::` |
| `<Info>…</Info>` | `:::info` … `:::` |
| `<Tip>…</Tip>` | `:::tip` … `:::` |
| `<Warning>…</Warning>` | `:::warning` … `:::` |
| `<CodeGroup>` with `` ```lang title `` blocks | `:::code-group` with `` ```lang [title] `` blocks |
| `<Accordion title="X">…</Accordion>` | `:::details[X]` … `:::` |
| `<Expandable title="X">…</Expandable>` | `:::details[X]` … `:::` |
| `<AccordionGroup>…</AccordionGroup>` | unwrap (drop the wrapper; inner `:::details` stand alone) |
| `<Steps>` + `<Step title="X">…</Step>` | `::::steps` + `### X` heading per step … `::::` |

- [ ] **Step 1: Write `site/scripts/convert-components.mjs`**

```js
// Mintlify -> Vocs directive codemod. Idempotent-ish: run once, review the diff.
// Handles the container/callout components. Card/Cards/Tabs/Tab/Frame are NOT touched here.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages')
const files = []
;(function walk(d) {
  for (const n of readdirSync(d)) {
    const f = join(d, n)
    statSync(f).isDirectory() ? walk(f) : n.endsWith('.mdx') && files.push(f)
  }
})(root)

const callout = (tag, kind) => (s) =>
  s.replace(new RegExp(`<${tag}>\\s*`, 'g'), `:::${kind}\n`).replace(new RegExp(`\\s*</${tag}>`, 'g'), `\n:::`)

function convert(src) {
  let s = src
  s = callout('Note', 'note')(s)
  s = callout('Info', 'info')(s)
  s = callout('Tip', 'tip')(s)
  s = callout('Warning', 'warning')(s)
  // Accordion / Expandable with a title -> :::details[title]
  s = s.replace(/<(Accordion|Expandable)\s+title=(?:"([^"]*)"|'([^']*)')\s*>/g, (_m, _t, a, b) => `:::details[${a ?? b}]`)
  s = s.replace(/<\/(Accordion|Expandable)>/g, ':::')
  // AccordionGroup wrapper -> unwrap
  s = s.replace(/<\/?AccordionGroup>\s*/g, '')
  // CodeGroup -> :::code-group ; convert "```lang title" fence labels to "```lang [title]"
  s = s.replace(/<CodeGroup>\s*/g, ':::code-group\n').replace(/\s*<\/CodeGroup>/g, '\n:::')
  // inside code-group, Mintlify writes ```bash pnpm (recommended) -> ```bash [pnpm (recommended)]
  s = s.replace(/```(\w+)[ \t]+([^\n[][^\n]*)\n/g, (_m, lang, label) => `\`\`\`${lang} [${label.trim()}]\n`)
  // Steps: wrapper -> ::::steps ; each <Step title="X"> -> "### X"
  s = s.replace(/<Steps>\s*/g, '::::steps\n').replace(/\s*<\/Steps>/g, '\n::::')
  s = s.replace(/<Step\s+title=(?:"([^"]*)"|'([^']*)')\s*>/g, (_m, a, b) => `### ${a ?? b}`)
  s = s.replace(/<\/Step>\s*/g, '\n')
  return s
}

let changed = 0
for (const f of files) {
  const before = readFileSync(f, 'utf8')
  const after = convert(before)
  if (after !== before) { writeFileSync(f, after); changed++ }
}
console.log(`converted ${changed} files (directive components)`)
```

- [ ] **Step 2: Run the codemod**

Run: `cd site && node scripts/convert-components.mjs`
Expected: prints a count (dozens of files). Review with `git diff --stat site/src/pages`.

- [ ] **Step 3: Verify the directive-style components are gone**

Run: `grep -rE "<(Note|Info|Tip|Warning|CodeGroup|Accordion|AccordionGroup|Expandable|Steps|Step)[ />]" site/src | wc -l`
Expected: `0`. If nonzero, the remaining cases have irregular formatting (e.g. attributes on `<Note>`); hand-fix those specific files, then re-run this check.

- [ ] **Step 4: Spot-check three converted pages render as valid MDX by building**

Run: `cd site && pnpm build 2>&1 | tail -20`
Expected: build proceeds past MDX parsing for the converted components. Card/Tabs/Frame may still error (handled in Task 9) — that is acceptable here; confirm no errors reference note/steps/code-group/details.

- [ ] **Step 5: Commit**

```bash
git add site/scripts/convert-components.mjs site/src/pages
git commit -m "refactor(docs): convert callout/steps/code-group/accordion to Vocs directives"
```

---

## Task 9: Component conversion — Card, Tabs, Frame

**Files:**
- Modify: all `.mdx` under `site/src/pages/` using `<Card>/<CardGroup>/<Tabs>/<Tab>/<Frame>`.

**Interfaces:**
- Consumes: Vocs React exports `Card`, `Cards`, `Tabs`, `Tab` (imported per file from `vocs`).
- Produces: component-residue gate returns empty; build passes fully.

Conversion rules:

| Mintlify | Vocs | Notes |
|---|---|---|
| `<CardGroup cols={n}>…</CardGroup>` | `<Cards>…</Cards>` | drop `cols`; import `Cards` |
| `<Card title="T" icon="i" href="U">body</Card>` | `<Card title="T" href="U">body</Card>` | Vocs `Card` uses `href`; keep `icon` if the installed `Card` supports it, else drop |
| `<Tabs>…</Tabs>`, `<Tab title="T">` | same tag names, imported from `vocs` | Vocs `Tab` uses `title`; add import |
| `<Frame><img src=… alt=…/></Frame>` | `<img src=… alt=… />` (bare) | frame styling handled by `styles.css` |

- [ ] **Step 1: Verify the exact `Card` prop names in the installed package** (do not guess):

Run: `grep -rE "title|icon|href|to|description" site/node_modules/vocs/**/Card*.d.ts | head -20`
Expected: shows the `Card` prop interface. Use whatever the types say (`href` vs `to`); the current Mintlify usage is `title`/`icon`/`href`. Record the exact mapping before editing.

- [ ] **Step 2: Add `import { Card, Cards, Tabs, Tab } from 'vocs'` to each file that uses any of them.** Find them:

Run: `grep -rlE "<(Card|CardGroup|Tabs|Tab)[ />]" site/src/pages`
For each listed file, add the import line at the top (after frontmatter). Only import the symbols actually used in that file.

- [ ] **Step 3: Rename `<CardGroup …>`→`<Cards>` and drop `cols`; adjust `Card` props to the verified names; unwrap `<Frame>`.** Apply across the listed files (small, reviewable set — `<CardGroup>`×11, `<Tabs>`×6, `<Frame>`×8; `<Card>`×120 mostly need only the prop check + the file-level import). A helper codemod is acceptable, but review every diff.

```bash
cd site
# CardGroup -> Cards (open + close), drop cols attribute
grep -rlE "<CardGroup" src/pages | while read -r f; do
  perl -0pi -e 's/<CardGroup[^>]*>/<Cards>/g; s/<\/CardGroup>/<\/Cards>/g' "$f"
done
# Frame unwrap
grep -rlE "<Frame>" src/pages | while read -r f; do
  perl -0pi -e 's/<Frame>\s*//g; s/\s*<\/Frame>//g' "$f"
done
```

- [ ] **Step 4: Component-residue gate**

Run: `grep -rE "<(Card|CardGroup|Note|Tip|Info|Warning|Steps|Step|Tabs|Tab|Accordion|AccordionGroup|CodeGroup|Frame|Expandable)[ />]" site/src`
Expected: only `<Card`, `<Cards`, `<Tabs`, `<Tab` lines remain (these ARE the Vocs components now, imported per file) and ZERO of `Note|Info|Tip|Warning|Steps|Step|CodeGroup|Accordion|AccordionGroup|Frame|Expandable|CardGroup`. Confirm each remaining `<Card>/<Tabs>/<Tab>` file has the `import … from 'vocs'` line.

- [ ] **Step 5: Full build must pass**

Run: `cd site && pnpm build`
Expected: exits 0; no MDX/JSX errors.

- [ ] **Step 6: Commit**

```bash
git add site/src/pages
git commit -m "refactor(docs): convert Card/Tabs to Vocs exports, unwrap Frame"
```

---

## Task 10: Brand CSS + DESIGN.md

**Files:**
- Create: `site/styles.css` (from the old `site/style.css` + brand tokens), `site/DESIGN.md`
- Modify: `site/vocs.config.ts` (reference the stylesheet if the installed Vocs requires explicit registration; otherwise place per Vocs convention)
- Delete: `site/style.css`

**Interfaces:**
- Produces: brand-parity styling loaded by the site; a DESIGN.md capturing tokens.

- [ ] **Step 1: Fetch the design principles** referenced in the spec (for DESIGN.md authoring): `https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md` and `https://github.com/VoltAgent/awesome-claude-design`. Extract the token/spacing/type principles; do not copy branding.

- [ ] **Step 2: Create `site/styles.css`** carrying over the old overrides (responsive images) plus brand tokens. Determine how Vocs consumes a custom stylesheet in the installed version (check `node_modules/vocs` docs/types: likely a `theme`/`css` config field or an import in a Root/`_mdx-wrapper`). Wire it via that mechanism.

```css
/* Newton docs brand parity. Extends the former site/style.css. */
:root {
  --newton-ink: #19191a;
  --newton-paper: #ffffff;
  --newton-dark: #303030;
}

/* Responsive images (carried over from the old style.css) */
p img { width: 100%; height: auto; }

/* Card/callout/steps spacing tuned toward the former maple look — calibrate visually. */
/* ponytail: start minimal; escalate only where an element reads visibly off vs old docs. */
```

- [ ] **Step 3: Register the stylesheet** per the mechanism found in Step 2 (config field or Root import). Build to confirm it loads:

Run: `cd site && pnpm build`
Expected: exits 0.

- [ ] **Step 4: Delete the old `style.css`**

```bash
cd site && git rm style.css
```

- [ ] **Step 5: Write `site/DESIGN.md`** documenting: color tokens (`#19191a`/`#ffffff`/`#303030`), light-default, logo usage (light/dark SVG), type scale, spacing scale, and per-component styling intent (callout, card, steps), with the stated ceiling (not pixel-identical to maple). Cite the two design references.

- [ ] **Step 6: Commit**

```bash
git add site/styles.css site/DESIGN.md site/vocs.config.ts
git commit -m "feat(docs): add brand-parity styles and DESIGN.md"
```

---

## Task 11: Full parity verification

**Files:**
- None (runs the Task 2 harness against the finished build).

**Interfaces:**
- Consumes: the built site + harness + baselines.
- Produces: green parity gate (all 96 routes, 16 internal redirects).

- [ ] **Step 1: Build and serve**

Run: `cd site && pnpm build && (npx serve -l 4173 dist &) && sleep 2`

- [ ] **Step 2: Run the parity harness**

Run: `cd site && node scripts/verify-parity.mjs http://localhost:4173; kill %1 2>/dev/null`
Expected: `PARITY OK: 96 routes, 16 internal redirects`. On any failure, fix the offending page/redirect and re-run until green.

- [ ] **Step 3: Deadlink check**

Run: `cd site && pnpm build 2>&1 | grep -iE "dead|broken|missing" || echo "no deadlink warnings"`
Expected: `no deadlink warnings` (or Vocs' explicit "0 dead links"). Enable `checkDeadlinks` in `vocs.config.ts` if not already surfacing.

- [ ] **Step 4: Visual spot-check (human)**

Run: `cd site && pnpm dev`
Open one page per component type (callout, steps, code-group, details, card, tabs, image) and compare against the live Mintlify site. Note any visibly-off element and adjust `styles.css` (Task 10) — re-commit CSS only.

- [ ] **Step 5: Commit any fixes made during verification** (grouped logically; if none, skip).

---

## Task 12: Update root tooling scripts

**Files:**
- Create: `scripts/check-residue.sh` (explicit-control-flow residue gate)
- Modify: root `package.json` (`docs:*` scripts)
- Delete: `scripts/check-docs-twoslash.sh`

**Interfaces:**
- Produces: `docs:dev`/`docs:build`/`docs:verify`/`docs:check` driving the Vocs package + gates. `docs:check` returns nonzero on build failure OR on any Mintlify residue (no failure masking).

- [ ] **Step 1: Create `scripts/check-residue.sh`** with explicit control flow. `git grep` exits 1 when there are NO matches (that is the pass case) and 0 when there ARE matches (fail); any other exit code is a real error. This inverts cleanly WITHOUT a trailing `|| true` that would swallow failures:

```bash
#!/usr/bin/env bash
# Fails (exit 1) if any live Mintlify residue remains in tracked files.
# Excludes immutable history (CHANGELOG.md), the migration/design docs, and the lockfile.
set -euo pipefail

git grep -niE "mintlify|mint\.json|\.mintignore" -- \
  ':(exclude)CHANGELOG.md' \
  ':(exclude)docs/migrations/' \
  ':(exclude)pnpm-lock.yaml' \
  && matched=1 || rc=$?

# git grep: 0 = matches found (FAIL), 1 = no matches (PASS), >1 = error.
if [ "${matched:-0}" = "1" ]; then
  echo "residue check: FAIL — Mintlify references found above." >&2
  exit 1
fi
if [ "${rc:-1}" != "1" ]; then
  echo "residue check: ERROR — git grep exited ${rc}." >&2
  exit "${rc}"
fi
echo "residue check: PASS — no live Mintlify residue."
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/check-residue.sh
```

- [ ] **Step 3: Replace the `docs:*` scripts in root `package.json`.** Current (verified):

```json
    "docs:dev": "cd site && mintlify dev",
    "docs:check": "./scripts/check-docs-twoslash.sh",
    "docs:broken-links": "cd site && mintlify broken-links",
```

Replace with (note: `docs:check` chains build AND residue with `&&`, so ANY failure propagates — no `|| true`):

```json
    "docs:dev": "cd site && pnpm dev",
    "docs:build": "cd site && pnpm build",
    "docs:verify": "cd site && pnpm build && (npx serve -l 4173 dist & SVPID=$!; sleep 2; node scripts/verify-parity.mjs http://localhost:4173; R=$?; kill $SVPID; exit $R)",
    "docs:check": "pnpm run docs:build && ./scripts/check-residue.sh",
```

- [ ] **Step 4: Delete the twoslash script**

```bash
git rm scripts/check-docs-twoslash.sh
```

- [ ] **Step 5: NEGATIVE TEST — prove the residue gate actually fails.** Before the scrub (Task 13) removes residue, run the gate against the current repo, which still HAS live Mintlify references:

Run: `./scripts/check-residue.sh; echo "exit=$?"`
Expected: prints the residue lines + `residue check: FAIL`, then `exit=1`. This proves the gate is not masking failures (directly refutes the reviewed bug). If it prints `PASS` / `exit=0` here, the control flow is wrong — fix before proceeding.

- [ ] **Step 6: NEGATIVE TEST — prove build failure propagates through `docs:check`.** Temporarily break the build (append `import 'this-does-not-exist'` to `site/vocs.config.ts`), then:

Run: `pnpm run docs:check; echo "exit=$?"`
Expected: build fails, `docs:check` exits nonzero (`exit` ≠ 0), and the residue check never runs. Revert the temporary break immediately: `git checkout site/vocs.config.ts`.

- [ ] **Step 7: Verify `docs:build` works from repo root** (positive path)

Run: `pnpm run docs:build`
Expected: Vocs build exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/check-residue.sh
git commit -m "chore(docs): point docs scripts at Vocs, add residue gate"
```

---

## Task 13: Repo-wide Mintlify scrub

**Files (delete):**
- `site/docs.json` (cutover-gated — see Global Constraints), `site/.mintlify/`, `site/.mintignore`, `site/agent.md`, `site/README.md`

**Files (rewrite/rename):**
- `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/AGENTS.md`, `.claude/codex/AGENTS.md`
- Skill `sdk-site-mintlify` → `sdk-site-vocs` (×3: `.agents/skills/`, `.claude/.agents/skills/`, `.claude/skills/`)
- Skill `sdk-site-agent-guide` de-Mintlify (×3)
- `.codex/config.toml`, `.claude/.codex/config.toml`, `.claude/settings.local.json`
- `docs/zktls-twitter/README.md`, `RAL.md`, `.omc/project-memory.json`, `.claude/.omc/project-memory.json`

**Interfaces:**
- Produces: the residue gate returns empty.

- [ ] **Step 1: Delete Mintlify-only site files** (except `docs.json`, which is cutover-gated):

```bash
cd /Users/dennis.won/projects/newton-sdk
git rm -r site/.mintlify site/.mintignore site/agent.md site/README.md
```

- [ ] **Step 2: Rewrite both CLAUDE.md docs sections.** In `CLAUDE.md` and `.claude/CLAUDE.md`: replace the "Documentation Site (`site/`)" Mintlify description with Vocs; change Key Commands (`mintlify dev`→`pnpm dev`, drop `mintlify broken-links`), deployment paragraph (Mintlify GitHub App → Vercel Git integration, Root Directory `site`), and the skills table entry `sdk-site-mintlify`→`sdk-site-vocs`. Rewrite `docs:check` references. Verify no "Twoslash via twoslash-cli" claim remains that is now false (Vocs' twoslash is built-in).

- [ ] **Step 3: Rename and rewrite the Mintlify skill (×3 copies).** For each of `.agents/skills/`, `.claude/.agents/skills/`, `.claude/skills/`:

```bash
git mv .agents/skills/sdk-site-mintlify .agents/skills/sdk-site-vocs
git mv .claude/.agents/skills/sdk-site-mintlify .claude/.agents/skills/sdk-site-vocs
git mv .claude/skills/sdk-site-mintlify .claude/skills/sdk-site-vocs
```
Then rewrite each `SKILL.md`: name/description → Vocs; replace Mintlify component docs (`<Card>`, `<Note>`, `<CodeGroup>`, frontmatter, `docs.json`) with Vocs equivalents (`:::note`, `:::code-group`, `::::steps`, `Card`/`Cards`/`Tabs` imports, `vocs.config.ts`, redirects, `head`). Update the frontmatter `name:` field to `sdk-site-vocs`.

- [ ] **Step 4: De-Mintlify `sdk-site-agent-guide` (×3 copies).** Replace `mintlify broken-links`/`mintlify dev` with Vocs build/`docs:verify`; replace "Mintlify" mentions; update the docs-SDK sync references to point at `vocs.config.ts` instead of `docs.json`.

- [ ] **Step 5: Remove the Mintlify MCP server.** In `.codex/config.toml` and `.claude/.codex/config.toml`, delete the `[mcp_servers.Mintlify]` block. In `.claude/settings.local.json`, remove the `"Mintlify"` array entry (and fix trailing-comma JSON validity).

- [ ] **Step 6: Scrub the remaining docs/memory files.** `docs/zktls-twitter/README.md` (remove the "Mintlify docs-site follow-up" section or reword to Vocs); `RAL.md` (Mintlify roadmap/xref lines); both `.omc/project-memory.json` files (docs script + `Assistant.md` path references → Vocs paths or remove).

- [ ] **Step 7: Run the residue gate — must PASS**

Run: `./scripts/check-residue.sh; echo "exit=$?"`
Expected: `residue check: PASS — no live Mintlify residue.` and `exit=0`. Any printed residue line + `FAIL`/`exit=1` means references remain — fix and re-run. (This is the same script whose failure path was proven in Task 12 Step 5, now proving the pass path after the scrub.)

- [ ] **Step 8: Delete `site/docs.json` (cutover-gated).** Per Global Constraints, do this on the migration branch but keep it as the LAST content commit; it merges to `main` only after cutover Stage 3. If executing pre-cutover on a branch, proceed; if on `main` pre-cutover, defer this single deletion.

```bash
git rm site/docs.json
```

- [ ] **Step 9: Final full build + parity after scrub** (scrub must not have broken the site):

Run: `pnpm run docs:verify`
Expected: `PARITY OK`.

- [ ] **Step 10: Commit** (two commits: one for the general scrub, one cutover-gated for docs.json)

```bash
git add -A
git commit -m "chore: remove Mintlify tooling, MCP, and skill references"
git add site/docs.json
git commit -m "chore(docs): remove docs.json (Vocs config supersedes)"
```

---

## Task 14: Cutover runbook (user-only actions)

**Files:**
- Create: `docs/migrations/2026-07-23-vocs-cutover-runbook.md`

**Interfaces:**
- Produces: a step-by-step runbook for the Vercel/DNS actions only the user can perform, transcribing §12 of the spec (staged cutover + rollback + abort thresholds), plus the reminder that the 3 hosting-layer redirects (2 external + home) are asserted on the Vercel preview URL, since `pnpm preview` does not apply `vercel.json`.

- [ ] **Step 1: Write the runbook** with Stage 0–3 + rollback exactly as in the spec §12, and a preflight checklist: create project, Root Directory `site`, confirm framework preset + build `vocs build` + output `dist`, run `verify-parity.mjs` against the `*.vercel.app` URL, assert the 3 hosting-layer redirects there, then the mapped-domain preflight, ≥24h monitor with abort thresholds, then disconnect Mintlify + restore TTL.

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/2026-07-23-vocs-cutover-runbook.md
git commit -m "docs: add Vocs cutover runbook for Vercel/DNS actions"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- §3 standalone package → Task 0. §4 pages/assets/home → Tasks 3, 4, 6. §5 nav → Task 5. §6 components → Tasks 8, 9. §7 config → Tasks 5–7. §8 redirects → Task 6. §9 theming/DESIGN.md → Task 10. §10 scrub → Task 13. §11 tooling → Task 12. §12 deployment/cutover → Task 14 (+ Global Constraints ordering). §13 verification harness → Tasks 1, 2, 11. §14 risks (VaultKit prefix, external redirects) → Task 5 note, Task 6.
- Baseline (§13.1) frozen BEFORE moves → Task 1 ordering enforced.

**Placeholder scan:** the two `head`-form and `styles.css`-registration steps say "verify against installed types and pick" rather than hardcoding — this is deliberate (the installed Vocs minor version determines the exact API), not a placeholder; each gives the concrete fallback. All other steps carry real code/commands.

**Type/name consistency:** harness reads `expected-routes.json`/`expected-redirects.json` (Task 1 writes them, Task 2 reads them — names match). `verify-parity.mjs` used identically in Tasks 2, 11, 13 (`docs:verify`). Sidebar/redirect values copied verbatim from `docs.json`. `Cards` (not `CardGroup`) is the Vocs export used consistently in Task 9.

**Known residual risks (flagged, not placeholders):**
- Vocs `Card` prop names (`href` vs `to`, `icon` support) — Task 9 Step 1 verifies against installed types first.
- `head` JSX vs object form — Task 7 Step 1 gives both; pick per installed types.
- Custom stylesheet registration mechanism — Task 10 Step 2 resolves against installed docs.
- `docs:check` inline shell residue-fail semantics — Task 12 Step 1 notes extracting to `check-residue.sh` if fragile.
