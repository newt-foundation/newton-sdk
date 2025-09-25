# Welcome to Newton SDK

Initial developer-facing TypeScript SDK for the Newton Protocol.

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
import { createPublicClient, sepolia } from 'viem';

const newtonPublicClient = createPublicClient({
  chain: sepolia,
  transport: webSocket(alchemyRpcWSUrls[network.id]),
}).extend(
  newtonPublicClientActions({
    policyContractAddress: '0xpolicyContractAddress',
  }),
);

newtonPublicClient.getTaskStatus();

// Wallet Client Actions
import { newtonWalletClientActions } from '@magicnewton/newton-protocol-sdk';
import { createWalletClient, sepolia } from 'viem';

const newtonWalletClient = createWalletClient({
  chain: sepolia,
  transport: webSocket('wss://alchemyWebsocketUrl'),
  account: signer,
}).extend(newtonWalletClientActions());

newtonWalletClient.submitEvaluationRequest({...})
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

## Testing

Currently, the project doesn't have unit tests implemented yet. The test script outputs:

```bash
pnpm test
# Output: "No unit tests... yet :("
```

### Future Testing Setup

When tests are added, they will likely be configured to run with:

```bash
# Run tests (when implemented)
pnpm test

# Run tests in watch mode (when implemented)
pnpm test:watch

# Run tests with coverage (when implemented)
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
   import { NewtonSDK } from '@magicnewton/newton-protocol-sdk';
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
       "@magicnewton/newton-sdk": "file:../path/to/newton-protocol-sdk"
     }
   }
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Import and use normally:**
   ```typescript
   import { NewtonSDK } from '@magicnewton/newton-protocol-sdk';
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
5. **Type check**: `npx tsc --noEmit` for TypeScript validation

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
4. Ensure the build passes: `pnpm build`
5. Ensure linting passes: `pnpm lint`
6. Submit a pull request

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.
