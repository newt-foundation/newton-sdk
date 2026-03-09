import builtins from 'builtin-modules';
import { access, copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Rollup plugins
import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import externals from 'rollup-plugin-node-externals';
import tscAlias from 'rollup-plugin-tsc-alias';
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

async function resolveRelativeDmtsImport(baseDir, specifier) {
  const fileTarget = path.resolve(baseDir, `${specifier}.d.mts`);
  try {
    await access(fileTarget);
    return `${specifier}.d.mts`;
  } catch {
    // Continue to try index file in folder.
  }

  const indexTarget = path.resolve(baseDir, specifier, 'index.d.mts');
  try {
    await access(indexTarget);
    return `${specifier}/index.d.mts`;
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
      const matches = [...content.matchAll(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g)];
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

    tscAlias(),

    esbuild({
      minify: true,
    }),
    {
      name: 'copy-dts-to-dmts',
      async closeBundle() {
        const typesDir = path.resolve('dist/types');
        await copyDtsToDmts(typesDir);
        await rewriteDmtsImports(typesDir);
      },
    },
  ],
};
