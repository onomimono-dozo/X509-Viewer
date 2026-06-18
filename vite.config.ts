import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 完全クライアントサイドのSPA。GitHub Pages（プロジェクトページ）公開を想定し
// base をリポジトリ名に合わせる。ローカル開発時は '/' を使う。
// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/X509-Viewer/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
  },
}));
