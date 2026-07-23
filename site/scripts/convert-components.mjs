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
