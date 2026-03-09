import builtins from 'builtin-modules';

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
  ],
};
