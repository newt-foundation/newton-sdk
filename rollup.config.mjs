import builtins from 'builtin-modules';

// Rollup plugins
import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import externals from 'rollup-plugin-node-externals';
import tscAlias from 'rollup-plugin-tsc-alias';
import typescript from 'rollup-plugin-typescript2';

function createOutput(format) {
  return {
    dir: `dist/${format}`,
    format,
    preserveModules: true,
    exports: 'named',
    assetFileNames: '[name][extname]',
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
      },
      useTsconfigDeclarationDir: true,
    }),

    tscAlias(),

    esbuild({
      minify: true,
    }),
  ],
};
