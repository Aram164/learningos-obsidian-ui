/** Host-side SHA-256 hashing helper so feature modules never import `node:crypto`. */
import { createHash } from 'node:crypto';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');
}
