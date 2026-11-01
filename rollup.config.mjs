import builtins from 'builtin-modules';
import { access, copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareSingleFileReplaceTscAliasPaths } from 'tsc-alias';

// Rollup plugins
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import externals from 'rollup-plugin-node-externals';
import typescript from 'rollup-plugin-typescript2';

function createOutput(format) {
  const isEsm = format === 'es';
  return {
    dir: `dist/${format}`,
    format,
    preserveModules: true,
    exports: 'named',
    assetFileNames: '[name][extname]',
    entryFileNames: isEsm ? '[name].mjs' : '[name].js',
    chunkFileNames: isEsm ? '[name].mjs' : '[name].js',
  };
}

async function listFiles(dir, suffix) {
  const names = await readdir(dir, { recursive: true });
  return names.filter((name) => name.endsWith(suffix)).map((name) => path.join(dir, name));
}

async function replaceDtsAliases(dir) {
  const replaceAliases = await prepareSingleFileReplaceTscAliasPaths({ outDir: dir });
  const files = await listFiles(dir, '.d.ts');
  await Promise.all(
    files.map(async (filePath) => {
      const fileContents = await readFile(filePath, 'utf8');
      const updated = replaceAliases({ fileContents, filePath });
      if (updated !== fileContents) {
        await writeFile(filePath, updated);
      }
    }),
  );
}

async function assertNoAliasImports(dir) {
  const files = [...(await listFiles(dir, '.d.ts')), ...(await listFiles(dir, '.d.mts'))];
  const contents = await Promise.all(files.map((filePath) => readFile(filePath, 'utf8')));
  const unresolved = files.filter((_, i) => /['"]@core\//.test(contents[i]));
  if (unresolved.length > 0) {
    const names = unresolved.map((filePath) => path.relative(dir, filePath)).join(', ');
    throw new Error(`@core/ imports left in ${dir}: ${names}`);
  }
}

async function copyDtsToDmts(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await copyDtsToDmts(fullPath);
        return;
      }

      if (entry.isFile() && entry.name.endsWith('.d.ts')) {
        await copyFile(fullPath, fullPath.replace(/\.d\.ts$/, '.d.mts'));
      }
    }),
  );
}

// Returns a .mjs specifier: TypeScript resolves it to the .d.mts next to it, while a value import of a
// .d.mts path fails with TS2846 for consumers that type-check libraries.
async function resolveRelativeDmtsImport(baseDir, specifier) {
  const fileTarget = path.resolve(baseDir, `${specifier}.d.mts`);
  try {
    await access(fileTarget);
    return `${specifier}.mjs`;
  } catch {
    // Continue to try index file in folder.
  }

  const indexTarget = path.resolve(baseDir, specifier, 'index.d.mts');
  try {
    await access(indexTarget);
    return `${specifier}/index.mjs`;
  } catch {
    return null;
  }
}

async function rewriteDmtsImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await rewriteDmtsImports(fullPath);
        return;
      }

      if (!entry.isFile() || !entry.name.endsWith('.d.mts')) {
        return;
      }

      const content = await readFile(fullPath, 'utf8');
      const matches = [...content.matchAll(/((?:from\s+|import\()['"])(\.\.?\/[^'"]+)(['"])/g)];
      if (matches.length === 0) {
        return;
      }

      let updated = content;
      for (const match of matches) {
        const fullMatch = match[0];
        const prefix = match[1];
        const specifier = match[2];
        const suffix = match[3];

        if (/\.(d\.mts|d\.ts|mjs|js|json)$/.test(specifier)) {
          continue;
        }

        const resolved = await resolveRelativeDmtsImport(path.dirname(fullPath), specifier);
        if (!resolved) {
          continue;
        }

        const replacement = `${prefix}${resolved}${suffix}`;
        updated = updated.replace(fullMatch, replacement);
      }

      if (updated !== content) {
        await writeFile(fullPath, updated);
      }
    }),
  );
}

export default {
  input: ['src/index.ts', 'src/types/index.ts'],

  output: [createOutput('cjs'), createOutput('es')],

  external: [...builtins],

  watch: {
    include: 'src/**',
  },

  plugins: [
    externals(),

    json(),

    resolve(),

    typescript({
      tsconfigOverride: {
        compilerOptions: {
          rootDir: 'src',
        },
        exclude: ['node_modules', 'src/**/*.test.ts', 'src/**/*.test-d.ts'],
      },
      useTsconfigDeclarationDir: true,
    }),

    esbuild({
      minify: true,
    }),
    {
      name: 'copy-dts-to-dmts',
      async closeBundle() {
        const typesDir = path.resolve('dist/types');
        // rollup-plugin-typescript2 rewrites the .d.ts files on every output, so resolve aliases once,
        // after all outputs, and await it: nothing may still be writing them while they are copied.
        await replaceDtsAliases(typesDir);
        await copyDtsToDmts(typesDir);
        await rewriteDmtsImports(typesDir);
        await assertNoAliasImports(typesDir);
      },
    },
  ],
};
