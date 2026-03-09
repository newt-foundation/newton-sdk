import builtins from 'builtin-modules';
import { copyFile, readdir } from 'node:fs/promises';
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
        await copyDtsToDmts(path.resolve('dist/types'));
      },
    },
  ],
};
