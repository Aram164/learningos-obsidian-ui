import {
  asRecord,
  asString,
  asStrings,
} from '../../projection/readers';
import { conceptLabel, type AtlasGraph, type AtlasGraphStore } from './graph';

/**
 * The learner's own questions, read back out of the notes that carry them.
 *
 * A question is a `role: question` note with an `atlas_question` block
 * (ADR-017). It is not a second store and not a graph edge: recording "I do not
 * understand why these two connect" asserts nothing about whether they do. That
 * is the whole point of keeping it beside the graph rather than in it.
 *
 * Nothing here infers a target. A question names either concepts or one exact
 * relation tuple, and if what it names is gone, this module says so rather than
 * quietly attaching the question to the nearest surviving thing.
 */

export type AtlasQuestionTarget =
  | { readonly kind: 'concepts'; readonly conceptIds: readonly string[] }
  | {
    readonly kind: 'relation';
    readonly relationId: string;
    readonly from: string;
    readonly type: string;
    readonly to: string;
  };

export interface AtlasQuestion {
  readonly noteId: string;
  readonly title: string;
  readonly body: string;
  readonly path: string;
  readonly state: 'open' | 'resolved';
  readonly target: AtlasQuestionTarget;
  readonly answerNotes: readonly string[];
  /**
   * Whether everything the target names still exists. False is a real state to
   * show, not an error to recover from: the question was asked about something,
   * and the honest report is that the something is no longer authored.
   */
  readonly targetPresent: boolean;
}

function readTarget(value: unknown): AtlasQuestionTarget | null {
  const target = asRecord(value);
  if (!target) return null;

  const concepts = asStrings(target.concepts);
  if (concepts.length) return { kind: 'concepts', conceptIds: concepts };

  const from = asString(target.from);
  const type = asString(target.type);
  const to = asString(target.to);
  if (!from || !type || !to) return null;

  return { kind: 'relation', relationId: `${from}--${type}--${to}`, from, type, to };
}

function present(graph: AtlasGraph, target: AtlasQuestionTarget): boolean {
  return target.kind === 'concepts'
    ? target.conceptIds.every((id) => graph.conceptById.has(id))
    : graph.relationByIdentity.has(target.relationId);
}

/** Open questions first, then by title — the unanswered ones are the point. */
function compare(left: AtlasQuestion, right: AtlasQuestion): number {
  if (left.state !== right.state) return left.state === 'open' ? -1 : 1;
  return left.title.localeCompare(right.title) || left.noteId.localeCompare(right.noteId);
}

export function collectQuestions(
  store: AtlasGraphStore,
  graph: AtlasGraph,
): readonly AtlasQuestion[] {
  const questions: AtlasQuestion[] = [];

  for (const record of store.of('note')) {
    const block = asRecord(record.atlas_question);
    if (!block) continue;

    const noteId = asString(record.id);
    const state = asString(block.state);
    const target = readTarget(block.target);
    if (!noteId || !target) continue;
    if (state !== 'open' && state !== 'resolved') continue;

    questions.push({
      noteId,
      title: asString(record.title) ?? noteId,
      body: asString(record.summary) ?? '',
      path: asString(record.path) ?? '',
      state,
      target,
      answerNotes: asStrings(block.answer_notes),
      targetPresent: present(graph, target),
    });
  }

  return questions.sort(compare);
}

/** Only what the question explicitly names — a relation question is not a concept question. */
export function questionsForConcept(
  questions: readonly AtlasQuestion[],
  conceptId: string,
): readonly AtlasQuestion[] {
  return questions.filter((question) => question.target.kind === 'concepts'
    && question.target.conceptIds.includes(conceptId));
}

export function questionsForRelation(
  questions: readonly AtlasQuestion[],
  relationId: string,
): readonly AtlasQuestion[] {
  return questions.filter((question) => question.target.kind === 'relation'
    && question.target.relationId === relationId);
}

export function openQuestions(
  questions: readonly AtlasQuestion[],
): readonly AtlasQuestion[] {
  return questions.filter((question) => question.state === 'open');
}

/**
 * The target in words. A relation reads as its authored sentence so the
 * question and the connection are described the same way everywhere.
 */
export function targetSentence(
  graph: AtlasGraph,
  target: AtlasQuestionTarget,
): string {
  if (target.kind === 'concepts') {
    return target.conceptIds.map((id) => conceptLabel(graph, id)).join(' and ');
  }

  const verb = target.type.replace(/-/g, ' ');
  return `${conceptLabel(graph, target.from)} ${verb} ${conceptLabel(graph, target.to)}`;
}

/** Where clicking the question should land, or null when its target is gone. */
export function questionDestination(
  target: AtlasQuestionTarget,
): string | null {
  if (target.kind === 'concepts') return target.conceptIds[0] ?? null;
  return target.from;
}
