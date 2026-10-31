// Ponte com o Android via Capacitor. No navegador tudo cai em alternativas web ou vira no-op.
import { Capacitor, SystemBars } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();

export function setupPlatform({ onBack, onBackground, onForeground }) {
  document.addEventListener('visibilitychange', () => (document.hidden ? onBackground() : onForeground()));
  if (!isNative) return;
  SystemBars.hide().catch(() => {});
  App.addListener('backButton', onBack);
  App.addListener('pause', onBackground);
  App.addListener('resume', () => {
    // O Android pode reexibir as barras do sistema ao voltar para o app.
    SystemBars.hide().catch(() => {});
    onForeground();
  });
}

export function exitApp() {
  if (isNative) App.exitApp();
}

const STYLES = { light: ImpactStyle.Light, heavy: ImpactStyle.Heavy };

export function haptic(kind) {
  if (isNative) {
    Haptics.impact({ style: STYLES[kind] || ImpactStyle.Medium }).catch(() => {});
    return;
  }
  try { if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 200 : 30); } catch { /* sem suporte */ }
}
