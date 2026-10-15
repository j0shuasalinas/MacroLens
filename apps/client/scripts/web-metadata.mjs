import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../dist/index.html', import.meta.url);
let html = readFileSync(path, 'utf8');
html = html.replace('</head>', `<meta name="description" content="Photograph meals, review nutrition estimates and track daily goals with MacroLens."><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"></head>`);
html = html.replace('</body>', `<script>if('serviceWorker' in navigator && location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script></body>`);
writeFileSync(path, html);
