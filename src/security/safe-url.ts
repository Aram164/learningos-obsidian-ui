import { SAFE_URL_PROTOCOLS } from '../constants';

export function safeWebUrl(value: unknown): URL | null {
  const text = String(value || '');
  // Most resources carry no URL. `new URL('')` throws, and building one
  // exception per resource made this the hottest frame of a navigator render
  // (about 80 of 120 ms over 498 stages, measured 2026-11-20).
  if (!text.includes(':')) return null;
  try {
    const url = new URL(text);
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch (_) {
    return null;
  }
}
