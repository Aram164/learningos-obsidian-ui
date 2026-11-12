import type { JsonRecord } from '../../contracts/manifest';
import { isRecord, optionalString } from '../../projection/readers';

/**
 * Core's closed shelving item schema (`system/schema/study-map.schema.json`,
 * `properties.shelving.properties.items`). Core refuses any other field, and so
 * does the validated manifest; this list is what the screen can show.
 */
export const SHELVING_ITEM_FIELDS = [
  'id', 'kind', 'title', 'destination', 'rationale', 'diff', 'content', 'metadata', 'selected',
] as const;

/**
 * What Core acts on when it applies an item. `id` is the item's identity and
 * `selected` is only the proposer's default, so neither belongs to what a
 * learner's tick approves.
 */
export const SHELVING_ACTED_FIELDS = [
  'kind', 'title', 'destination', 'rationale', 'diff', 'content', 'metadata',
] as const;

const KNOWN_FIELDS: ReadonlySet<string> = new Set(SHELVING_ITEM_FIELDS);

export interface ShelvingProposalItem {
  readonly id: string;
  readonly title: string;
  readonly kind?: string | undefined;
  readonly destination?: string | undefined;
  readonly rationale?: string | undefined;
  readonly diff?: string | undefined;
  /** The text Core writes on apply. Core refuses an item without it. */
  readonly content?: string | undefined;
  readonly metadata?: JsonRecord | undefined;
  readonly selected?: boolean | undefined;
  /** Fields outside the closed schema. Any makes the item unapprovable here. */
  readonly unknownFields: readonly string[];
}

/** The packet as Core recorded it, reduced to what the screen distinguishes. */
export type ShelvingPacket =
  | {
    readonly state: 'proposed';
    readonly summary?: string | undefined;
    readonly items: readonly ShelvingProposalItem[];
  }
  | {
    /** Prepare ran without items: Core wrote the review packet and waits. */
    readonly state: 'draft';
    readonly summary?: string | undefined;
    readonly proposalPath?: string | undefined;
  }
  | { readonly state: 'none' };

function readItem(candidate: unknown): ShelvingProposalItem[] {
  if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.title !== 'string') {
    return [];
  }
  return [{
    id: candidate.id,
    title: candidate.title,
    kind: optionalString(candidate.kind),
    destination: optionalString(candidate.destination),
    rationale: optionalString(candidate.rationale),
    diff: optionalString(candidate.diff),
    content: optionalString(candidate.content),
    metadata: isRecord(candidate.metadata) ? candidate.metadata : undefined,
    selected: typeof candidate.selected === 'boolean' ? candidate.selected : undefined,
    unknownFields: Object.keys(candidate).filter((field) => !KNOWN_FIELDS.has(field)).sort(),
  }];
}

/**
 * Read `study_maps[].shelving`. A `draft` is shown as a draft even if an
 * earlier `items` key survived the re-prepare: Core's own state says it waits
 * for a proposal, and its review queue lists only `proposed` packets.
 */
export function readShelvingPacket(value: unknown): ShelvingPacket {
  if (!isRecord(value)) return { state: 'none' };
  const summary = optionalString(value.summary);
  if (value.state === 'draft') {
    return { state: 'draft', summary, proposalPath: optionalString(value.proposal_path) };
  }
  if (value.state !== 'proposed' || !Array.isArray(value.items)) return { state: 'none' };
  const items = value.items.flatMap(readItem);
  return items.length ? { state: 'proposed', summary, items } : { state: 'none' };
}

const KIND_LABELS: Readonly<Record<string, string>> = {
  'durable-note': 'Durable note',
  garden: 'Garden note',
  'concept-relation': 'Concept relation',
  'archive-map': 'Archive map',
};

export function shelvingKindLabel(kind: string | undefined): string {
  return kind ? KIND_LABELS[kind] ?? kind : '';
}
