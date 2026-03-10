# Welcome to Newton SDK

TypeScript SDK for the [Newton Protocol](https://docs.newton.xyz/developers/overview/about) — a decentralized policy engine for onchain transaction authorization, built as an EigenLayer AVS.

## Documentation

- [Quickstart](https://docs.newton.xyz/developers/overview/quickstart) — simulate your first policy evaluation in 5 minutes
- [Integration Guide](https://docs.newton.xyz/developers/guides/integration-guide) — full end-to-end integration with policy, contract, and frontend
- [SDK Reference](https://docs.newton.xyz/developers/reference/sdk-reference) — complete API documentation
- [Core Concepts](https://docs.newton.xyz/developers/overview/core-concepts) — policies, intents, tasks, and attestations

## Prerequisites

- Node.js >= 20

## Installation

```bash
# Install dependencies
npm install @magicnewton/newton-protocol-sdk viem
```

## Exports

The SDK provides several entry points:

```typescript
// Public Client Actions
import { newtonPublicClientActions } from '@magicnewton/newton-protocol-sdk';
import { createPublicClient, webSocket } from 'viem';
import { sepolia } from 'viem/chains';

const newtonPublicClient = createPublicClient({
  chain: sepolia,
  transport: webSocket('wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY'),
}).extend(
  newtonPublicClientActions({
    policyContractAddress: '0xpolicyContractAddress',
  }),
);

newtonPublicClient.getTaskStatus({ taskId: '0x...' });

// Wallet Client Actions
import { newtonWalletClientActions } from '@magicnewton/newton-protocol-sdk';
import { createWalletClient, webSocket } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const newtonWalletClient = createWalletClient({
  chain: sepolia,
  transport: webSocket('wss://alchemyWebsocketUrl'),
  account: privateKeyToAccount('0xYOUR_PRIVATE_KEY'),
}).extend(newtonWalletClientActions({ apiKey: '<YOUR_API_KEY>' }));

newtonWalletClient.evaluateIntentDirect({...})
```

## Development

### Building the SDK

The SDK uses Rollup for bundling and supports both CommonJS and ES modules.

```bash
# Build the SDK
pnpm build
```

This will generate the following output in the `dist/` directory:

- `dist/cjs/` - CommonJS modules
- `dist/es/` - ES modules
- `dist/types/` - TypeScript declaration files

### Development Build

For development with watch mode:

```bash
# Build and watch for changes
pnpm build --watch
```

### Type Checking

The project includes TypeScript configuration for type checking:

```bash
# Type check without building
npx tsc --noEmit
```

### Linting

```bash
# Lint and auto-fix code
pnpm lint
```

## Privacy Module

The SDK includes a privacy module for client-side HPKE encryption used in privacy-preserving policy evaluation. Key exports:

- `createSecureEnvelope` — HPKE encrypt plaintext into a SecureEnvelope (offline, zero network calls)
- `generateSigningKeyPair` — generate a random Ed25519 key pair
- `signPrivacyAuthorization` — compute dual Ed25519 signatures for privacy-enabled task creation
- `getPrivacyPublicKey` — fetch the gateway's X25519 HPKE public key
- `uploadEncryptedData` — encrypt and upload data to the gateway in one call
- `storeEncryptedSecrets` — upload KMS-encrypted secrets for a PolicyClient's PolicyData

See the [SDK Reference](https://docs.newton.xyz/developers/reference/sdk-reference) for full API documentation.

## Testing

The project uses Vitest for unit testing:

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Testing Locally Built SDK

To test the locally built SDK from a different local project, you can use one of these methods:

### Method 1: Using pnpm link (Recommended)

1. **In the Newton SDK project directory:**

   ```bash
   # Build the SDK first
   pnpm build

   # Create a global link
   pnpm link --global
   ```

2. **In your test project directory:**

   ```bash
   # Link to the globally linked SDK
   pnpm link --global @magicnewton/newton-protocol-sdk
   ```

3. **Import and use in your test project:**

   ```typescript
   import { newtonWalletClientActions } from '@magicnewton/newton-protocol-sdk';
   // Your test code here
   ```

4. **When you make changes to the SDK:**

   ```bash
   # In the SDK directory, rebuild
   pnpm build

   # The changes will be immediately available in your linked test project
   ```

### Method 2: Using local file path

1. **In your test project's package.json, add:**

   ```json
   {
     "dependencies": {
       "@magicnewton/newton-protocol-sdk": "file:../path/to/newton-protocol-sdk"
     }
   }
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Import and use normally:**
   ```typescript
   import { newtonWalletClientActions } from '@magicnewton/newton-protocol-sdk';
   ```

### Method 3: Using npm link (Alternative)

If you prefer npm over pnpm:

1. **In the Newton SDK project directory:**

   ```bash
   npm run build
   npm link
   ```

2. **In your test project directory:**
   ```bash
   npm link @magicnewton/newton-protocol-sdk
   ```

### Unlinking

When you're done testing:

```bash
# In your test project directory
pnpm unlink @magicnewton/newton-protocol-sdk

# In the SDK directory
pnpm unlink --global
```

### Development Workflow with Local Testing

1. **Set up the link** (one-time setup)
2. **Make changes** to the SDK source code
3. **Rebuild**: `pnpm build` (or `pnpm build --watch` for auto-rebuild)
4. **Test immediately** in your linked project
5. **Iterate** on changes
6. **Unlink** when done testing

### Troubleshooting Local Testing

- **Module not found errors**: Ensure the SDK is built (`pnpm build`) before linking
- **Type errors**: The TypeScript declarations are generated in `dist/types/`
- **Import issues**: Make sure your test project can resolve the linked package
- **Version conflicts**: Unlink and reinstall if you encounter dependency conflicts

## Build Output

The build process generates multiple module formats:

- **CommonJS**: `dist/cjs/` - For Node.js environments
- **ES Modules**: `dist/es/` - For modern bundlers and browsers
- **TypeScript**: `dist/types/` - For development and IDE support

## Development Workflow

1. **Install dependencies**: `pnpm install`
2. **Make changes** to source files in `src/`
3. **Build**: `pnpm build` (or `pnpm build --watch` for development)
4. **Lint**: `pnpm lint` to check code quality
5. **Type check**: `pnpm typecheck` for TypeScript validation
6. **Quality checks**: `pnpm check:all` to validate exports and bundle size

## Troubleshooting

### Clean Build

If you encounter build issues, try cleaning and rebuilding:

```bash
pnpm clean
pnpm install
pnpm build
```

### TypeScript Issues

Ensure TypeScript is properly configured:

```bash
npx tsc --noEmit
```

### Linting Issues

Auto-fix common linting problems:

```bash
pnpm lint
```

## Release Process

This repository uses automated releases with the `auto` tool for both production releases (master branch) and canary releases (pull requests).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure linting passes: `pnpm lint`
5. Ensure types check: `pnpm typecheck`
6. Ensure the build passes: `pnpm build`
7. Run quality checks: `pnpm check:all`
8. Run tests: `pnpm test`
9. Submit a pull request

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.
