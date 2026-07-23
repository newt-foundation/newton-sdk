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
