import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
export default function Html({ children }: PropsWithChildren) {
 return <html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>MacroLens — Nutrition in focus</title><meta name="description" content="Photograph meals, review nutrition estimates and track your daily goals with MacroLens."/><meta name="theme-color" content="#0a1110"/><meta name="apple-mobile-web-app-capable" content="yes"/><link rel="manifest" href="/manifest.json"/><link rel="apple-touch-icon" href="/icon-192.png"/><ScrollViewStyleReset/></head><body>{children}<script dangerouslySetInnerHTML={{__html:`if ('serviceWorker' in navigator && location.protocol === 'https:') { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {})); }`}}/></body></html>;
}
