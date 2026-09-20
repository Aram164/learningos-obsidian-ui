/*
 * Shared Ajv construction for the contract prototype (Point 3).
 *
 * The emitter (generate-contract.mjs) and the differential verdict helper
 * (ajv-verdict.mjs --subschema mode) must validate with identical semantics,
 * so the Ajv class, the Draft 2020-12 dialect, the format vocabulary and the
 * standalone-code options live here exactly once.
 *
 * Identity registration mirrors Core's schema_registry(): every resource is
 * reachable under both its declared $id and its filename alias, because the
 * manifest root references older resources (whose $ids are relative
 * `learning-os/...` identifiers) exclusively through the alias namespace.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function createAjv2020() {
  /*
   * strictSchema is off for one reason only: the closure carries the
   * annotation keyword `x-governs` (9 occurrences), which Python's plain
   * Draft202012Validator ignores and Ajv's strict mode rejects. Every other
   * strict check stays on, so any further strictness finding is real and
   * must be investigated, never silenced here.
   *
   * The standalone module is CJS (Ajv's default), not ESM: with ESM output
   * the ajv-formats code snippet still emits require(), which is unusable
   * in module scope (verified 2026-09-20). Module format is irrelevant to
   * the equivalence experiment; revisit ESM only at a production cutover.
   */
  const ajv = new Ajv2020({ code: { source: true }, strictSchema: false });
  addFormats(ajv);
  return ajv;
}

export function registerBundleIdentities(ajv, bundle) {
  ajv.addSchema(bundle.root);
  for (const resource of bundle.resources || []) {
    ajv.addSchema(resource.schema);
    for (const alias of resource.aliases || []) {
      if (alias !== resource.declared_id) ajv.addSchema(resource.schema, alias);
    }
  }
}
