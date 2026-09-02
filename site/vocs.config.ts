import { defineConfig } from 'vocs/config'
// Rego (Open Policy Agent) has no Shiki-bundled grammar. Register the official OPA
// TextMate grammar (Apache-2.0, vendored under syntaxes/) so ```rego blocks highlight.
import regoGrammar from './syntaxes/rego.tmLanguage.json' with { type: 'json' }

export default defineConfig({
  title: 'Newton Protocol Docs',
  description:
    'Newton Protocol is a decentralized policy engine for onchain transaction authorization, built as an EigenLayer AVS.',
  baseUrl: 'https://docs.newton.xyz',
  logoUrl: { light: '/logo/light.svg', dark: '/logo/dark.svg' },
  iconUrl: '/favicon.svg',
  titleTemplate: '%s · Newton',
  accentColor: 'light-dark(#19191a, #ffffff)',
  colorScheme: 'light dark', // light default (preserves the previous docs appearance)
  // Vendored TextMate grammar is a valid Shiki LanguageRegistration, but TS can't infer that from
  // the imported JSON, and @shikijs/types isn't a direct dep to import the type. Shiki validates
  // the grammar at runtime (rego highlights correctly), so an `as any` cast here is the pragmatic fit.
  codeHighlight: { langs: [{ ...regoGrammar, name: 'rego', scopeName: 'source.rego' } as any] },
  // Twoslash hover tooltips surface viem JSDoc links (valid on viem.sh, not ours). Viem's
  // `createPublicClient` and `.extend()` JSDoc carry viem-site `/docs/*` links; Vocs 2.6.2 has no
  // per-link exclude API, and even cutting the import above `---cut---` does not remove the
  // return-type hover. We accept 'warn' mode to allow honest `createPublicClient` twoslash examples
  // without breaking the build on viem's JSDoc dead links.
  // Restore hard internal-link gate tracked: https://linear.app/newton-xyz/issue/NEWT-2065
  checkDeadlinks: 'warn',
  editLink: {
    link: 'https://github.com/newt-foundation/newton-sdk/edit/main/site/src/pages/:path',
    text: 'Suggest changes to this page',
  },
  search: {
    boostDocument(documentId: string) {
      return documentId.startsWith('/developers') ? 3 : 1
    },
  },
  socials: [
    { icon: 'github', link: 'https://github.com/newt-foundation/newton-sdk' },
    { icon: 'x', link: 'https://x.com/newtfoundation' },
  ],
  head: {
    meta: {
      googleSiteVerification: 'z93uJU02uM0Z9bdqWDxN2dV1HHAlsaqDy-LwCHYSuGA',
      author: 'Newton',
      ogType: 'website',
      ogSiteName: 'Newton Protocol Docs',
      ogLocale: 'en_US',
      ogImage: 'https://docs.newton.xyz/og/opengraph-image.jpg',
      twitterSite: '@newtfoundation',
      twitterCreator: '@newtfoundation',
      twitterImage: 'https://docs.newton.xyz/og/twitter-image.jpg',
    },
    script: [
      { src: 'https://www.googletagmanager.com/gtag/js?id=G-JFG7Z812VK', async: true },
      {
        textContent:
          "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-JFG7Z812VK');",
      },
    ],
  },
  topNav: [
    { text: 'Developers', link: '/developers/overview/about', match: '/developers' },
    { text: 'VaultKit', link: '/developers/vaults/overview', match: '/developers/vaults' },
    { text: 'Whitepaper', link: '/whitepaper/introduction', match: '/whitepaper' },
    { text: 'Protocol', link: '/protocol/overview/project-and-protocol', match: '/protocol' },
    { text: 'Blog', link: 'https://blog.newton.xyz' },
  ],
  redirects: [
    // Note: the home redirect (/ -> /developers/overview/about) lives in vercel.json,
    // not here. Vocs generates a root route that shadows a config `/` redirect in
    // dev/preview, so the root redirect only fires reliably at the Vercel edge.
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
    { source: '/developers/vaults/sdk/composite-policy-packs', destination: '/developers/vaults/sdk/policies' },
    { source: '/developers/overview/newton-explorer', destination: '/developers/resources/newton-explorer' },
    { source: '/developers/advanced/kms-encryption', destination: '/developers/advanced/encrypting-secrets' },
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
          { text: 'Arkham: Entity', link: '/developers/vaults/policies/arkham-entity' },
          {
            text: 'Arkham: Counterparty',
            link: '/developers/vaults/policies/arkham-counterparty',
          },
          { text: 'Arkham: Risk', link: '/developers/vaults/policies/arkham-risk' },
          { text: 'Pharos: Treasury', link: '/developers/vaults/policies/pharos-treasury' },
          { text: 'Pharos: Safe Mode', link: '/developers/vaults/policies/pharos-safe-mode' },
          {
            text: 'Pharos: Redemption',
            link: '/developers/vaults/policies/pharos-redemption',
          },
        ],
      },
      {
        text: 'SDK',
        items: [
          { text: 'Overview', link: '/developers/vaults/sdk/overview' },
          { text: 'Integration Guide', link: '/developers/vaults/sdk/integration-guide' },
          { text: 'Policies', link: '/developers/vaults/sdk/policies' },
          { text: 'Custom Oracles', link: '/developers/vaults/sdk/custom-oracles' },
          { text: 'Examples', link: '/developers/vaults/sdk/examples' },
          { text: 'Reference', link: '/developers/vaults/sdk/reference' },
          { text: 'Errors', link: '/developers/vaults/sdk/errors' },
          { text: 'Morpho', link: '/developers/vaults/sdk/morpho' },
          { text: 'Morpho Blue', link: '/developers/vaults/sdk/morpho-blue' },
          { text: 'Euler Vault', link: '/developers/vaults/sdk/euler-vault' },
          { text: 'Euler', link: '/developers/vaults/sdk/euler' },
          { text: 'Superform', link: '/developers/vaults/sdk/superform' },
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
