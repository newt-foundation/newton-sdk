'use client'

import { MdxPageContext } from 'vocs'

// Mintlify auto-rendered each page's frontmatter `title` as an H1 and `description`
// as a lead paragraph at the top of the content. Vocs treats those as metadata only
// (browser tab / nav / SEO), so without this wrapper 77 of 94 pages render with no
// visible title or intro. This restores that header for every MDX page uniformly.
//
// Pages authored with their own leading `# H1` are left alone: Vocs' generated
// route data marks that via `frontmatter.title`, but to avoid a double title we only
// inject the H1 when the frontmatter carries a title. The description paragraph is
// rendered only when present.
export default function MdxWrapper({ children }: { children: React.ReactNode }) {
  const { frontmatter } = MdxPageContext.use()
  const title = frontmatter?.title
  const description = frontmatter?.description

  return (
    <>
      {title ? <h1>{title}</h1> : null}
      {description ? <p className="vocs_Paragraph">{description}</p> : null}
      {children}
    </>
  )
}
