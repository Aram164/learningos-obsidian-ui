import { SAFE_URL_PROTOCOLS } from '../constants';

export function safeWebUrl(value: unknown): URL | null {
  try {
    const url = new URL(String(value || ''));
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch (_) {
    return null;
  }
}
