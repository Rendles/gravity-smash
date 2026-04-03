import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isRelease = mode === 'release';

  return {
    plugins: [react()],
    esbuild: isRelease
      ? {
          drop: ['console', 'debugger'],
          legalComments: 'none',
          minifyIdentifiers: true,
          minifySyntax: true,
          minifyWhitespace: true
        }
      : undefined,
    build: {
      minify: 'esbuild',
      sourcemap: false,
      cssMinify: true,
      reportCompressedSize: false,
      modulePreload: {
        polyfill: false
      },
      rollupOptions: isRelease
        ? {
            output: {
              entryFileNames: 'assets/r[hash].js',
              chunkFileNames: 'assets/c[hash].js',
              assetFileNames: 'assets/a[hash].[ext]',
              manualChunks: undefined
            }
          }
        : undefined
    }
  };
});
