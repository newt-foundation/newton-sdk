// Automated parity gate. Serve the built site first:
//   cd site && pnpm build && pnpm preview --port 4173
// then: node site/scripts/verify-parity.mjs http://localhost:4173
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '')
const here = dirname(fileURLToPath(import.meta.url))
const routes = JSON.parse(readFileSync(join(here, 'expected-routes.json'), 'utf8'))
const redirects = JSON.parse(readFileSync(join(here, 'expected-redirects.json'), 'utf8'))
const failures = []

// Map a source route to its Vocs URL. Pages moved verbatim, so the path is
// identical. No transform needed — URLs preserved by design.
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
