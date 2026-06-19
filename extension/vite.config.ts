import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// 拡張機能のビルド設定。
// - viewer.html: React 製の同梱ビューア（既存 src/ を @app で再利用）
// - background.ts: MV3 Service Worker（単一ファイル background.js として出力）
// 拡張ページのアセットは相対パスで解決させるため base を './' にする。
const root = import.meta.dirname;

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@app': resolve(root, '../src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        viewer: resolve(root, 'viewer.html'),
        background: resolve(root, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
