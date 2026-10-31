import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// O app não acessa a internet: tudo vem do próprio pacote.
// 'unsafe-inline' em script-src é necessário porque o Capacitor injeta a ponte nativa
// como script inline em WebViews antigas; o jogo em si não usa scripts inline.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    // Chrome 69+ cobre WebViews de Android antigos que ainda recebem atualização.
    target: ['es2019', 'chrome69'],
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  plugins: [
    {
      name: 'inject-csp',
      apply: 'build', // em desenvolvimento o Vite precisa de scripts inline
      transformIndexHtml: (html) => html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}">`),
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
