import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

/** Compare the query's producer-owned schema independently of manifest version. */
export function checkAbilityContractMirror(uiRoot, coreRoot) {
  const mirrorPath = path.join(uiRoot, 'contracts/ability-context-v1.schema.json');
  const producerPath = path.join(coreRoot, 'system/schema/ability-context.schema.json');
  const mirror = JSON.parse(fs.readFileSync(mirrorPath, 'utf8'));
  const producer = JSON.parse(fs.readFileSync(producerPath, 'utf8'));
  if (!isDeepStrictEqual(mirror, producer)) {
    throw new Error('Ability context schema drifted between Core and UI; mirror the producer schema in the same release.');
  }
  return mirror;
}
