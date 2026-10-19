/**
 * The plugin's own compiled-source identity, injected at build time.
 *
 * `build.mjs` runs a first bundling pass to resolve the real module graph,
 * computes `source_fingerprint` from that graph plus the other declared
 * direct build inputs, and then rebuilds with these two constants replaced
 * by esbuild's `define` — so the *running* bundle can state its own
 * fingerprint and contract version without embedding a commit SHA, a
 * timestamp, or the bundle's own output hash, any of which would make the
 * bundle a function of itself (a rebuild after a commit would then change the
 * bundle again, and a clean, reproducible commit would be impossible).
 *
 * Diagnostics compares these runtime values against the `build-info.json`
 * written beside the bundle on disk. If they ever disagree, an older
 * in-memory plugin is still running against newer installed metadata (or the
 * reverse) — exactly the failure a disk-only check cannot see, because the
 * disk file it reads may itself be the newer one.
 *
 * The offline TypeScript-fallback bundler (see build.mjs) does not perform
 * this substitution — it is a development/verification path only, never used
 * for a release build (`scripts/check-build.mjs` requires esbuild in CI).
 * Under that bundler these read as `'unavailable'` / `0`, which is honest:
 * the fallback bundle genuinely carries no attested identity.
 */
declare const __LEARNINGOS_SOURCE_FINGERPRINT__: string;
declare const __LEARNINGOS_CONTRACT_VERSION__: number;

export function runtimeSourceFingerprint(): string {
  return typeof __LEARNINGOS_SOURCE_FINGERPRINT__ === 'string'
    ? __LEARNINGOS_SOURCE_FINGERPRINT__
    : 'unavailable';
}

export function runtimeContractVersion(): number {
  return typeof __LEARNINGOS_CONTRACT_VERSION__ === 'number'
    ? __LEARNINGOS_CONTRACT_VERSION__
    : 0;
}
