/**
 * Pure merge for editable Atlas boards (P3, IMPLEMENTATION-PLAN §P3 steps
 * 17-18). No host APIs here: the controller feeds bytes in and writes the
 * result out, so every refusal is testable without Obsidian.
 */

export type CanvasObject = Record<string, unknown> & { id?: unknown };
export interface CanvasData {
  nodes?: CanvasObject[];
  edges?: CanvasObject[];
  [key: string]: unknown;
}
export interface BoardSidecar {
  schema_version: 1;
  template_sha256: string;
  managed_ids: string[];
}
export type MergeResult =
  | { ok: true; canvas: CanvasData; managedIds: string[] }
  | { ok: false; reason: string };

const RESERVED_PREFIXES = ['los-concept-', 'los-rel-', 'los-evidence-', 'los-scope-', 'los-group-'];

function isReserved(id: string): boolean {
  return RESERVED_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function validGeometry(node: CanvasObject): boolean {
  return ['x', 'y', 'width', 'height'].every((key) => {
    const value = node[key];
    return typeof value === 'number' && Number.isFinite(value);
  }) && (node.width as number) > 0 && (node.height as number) > 0;
}

function idsOf(items: CanvasObject[] | undefined): string[] | null {
  const ids: string[] = [];
  for (const item of items ?? []) {
    if (typeof item.id !== 'string' || !item.id) return null;
    if (ids.includes(item.id)) return null; // duplicate
    ids.push(item.id);
  }
  return ids;
}

/**
 * Merge `nextTemplate` into the working board. Surviving managed nodes keep
 * the working geometry; authored objects keep their bytes and order; a
 * managed node referenced by an authored edge survives as a retired layout
 * object until that edge is gone. Any doubt refuses with zero writes.
 */
export function mergeBoards(
  previousManagedIds: readonly string[],
  working: CanvasData,
  nextTemplate: CanvasData,
): MergeResult {
  const workingNodes = working.nodes ?? [];
  const workingEdges = working.edges ?? [];
  const templateNodes = nextTemplate.nodes ?? [];
  const templateEdges = nextTemplate.edges ?? [];
  const workingNodeIds = idsOf(workingNodes);
  const templateNodeIds = idsOf(templateNodes);
  const workingEdgeIds = idsOf(workingEdges);
  const templateEdgeIds = idsOf(templateEdges);
  if (!workingNodeIds || !templateNodeIds || !workingEdgeIds || !templateEdgeIds) {
    return { ok: false, reason: 'Board contains duplicate or missing object ids.' };
  }
  const previous = new Set(previousManagedIds);
  const templateSet = new Set(templateNodeIds);
  if (new Set([...templateNodeIds, ...templateEdgeIds]).size !== templateNodeIds.length + templateEdgeIds.length
      || new Set([...workingNodeIds, ...workingEdgeIds]).size !== workingNodeIds.length + workingEdgeIds.length) {
    return { ok: false, reason: 'Board node and edge ids overlap.' };
  }
  if (templateEdges.some((edge) => typeof edge.fromNode !== 'string'
      || typeof edge.toNode !== 'string' || !templateSet.has(edge.fromNode) || !templateSet.has(edge.toNode))) {
    return { ok: false, reason: 'Board template contains an edge with a missing endpoint.' };
  }
  const incoming = new Set([...templateNodeIds, ...templateEdgeIds]);
  for (const id of [...workingNodeIds, ...workingEdgeIds]) {
    if (isReserved(id) && !previous.has(id) && !incoming.has(id)) {
      return { ok: false, reason: `Board contains an unknown reserved object: ${id}.` };
    }
  }
  for (const node of [...workingNodes, ...templateNodes]) {
    if (!validGeometry(node)) {
      return { ok: false, reason: `Board object ${String(node.id)} has invalid geometry.` };
    }
  }
  const workingById = new Map(workingNodes.map((node) => [node.id as string, node]));
  const templateById = new Map(templateNodes.map((node) => [node.id as string, node]));
  const merged = new Map<string, CanvasObject>();

  // Managed nodes: template semantics, working geometry. The portal target
  // and flag survive only when an accepted file target survives (step 21):
  // the generated template, or the same child's editable working board,
  // whose path the reserved scope id itself names.
  for (const id of templateNodeIds) {
    const template = templateById.get(id)!;
    const current = workingById.get(id);
    const node: CanvasObject = { ...template };
    if (current) {
      node.x = current.x; node.y = current.y;
      node.width = current.width; node.height = current.height;
      if (template.type === 'file' && typeof current.file === 'string') {
        const scopeMatch = /^los-scope-([a-z]+)--(.+)$/.exec(id);
        const editableTarget = scopeMatch
          ? `boards/atlas/${scopeMatch[1]}/${scopeMatch[2]}.canvas` : null;
        if (current.file === template.file || current.file === editableTarget) {
          node.file = current.file;
          if (typeof current.portal === 'boolean') node.portal = current.portal;
        }
      }
    }
    merged.set(id, node);
  }

  // Authored edges decide whether a retired managed node must survive.
  const authoredEdges = workingEdges.filter(
    (edge) => !previous.has(edge.id as string) && !templateEdgeIds.includes(edge.id as string));
  const referenced = new Set<string>();
  for (const edge of authoredEdges) {
    referenced.add(String(edge.fromNode));
    referenced.add(String(edge.toNode));
  }
  for (const node of workingNodes) {
    const id = node.id as string;
    if (merged.has(id)) continue;
    const authored = !previous.has(id);
    const retired = previous.has(id) && referenced.has(id);
    if (authored) {
      merged.set(id, { ...node });
    } else if (retired) {
      merged.set(id, { ...node, losRetired: true });
    }
    // Unreferenced retired/removed managed nodes are dropped.
  }

  const edges: CanvasObject[] = [];
  for (const edge of templateEdges) edges.push({ ...edge });
  for (const edge of authoredEdges) {
    if (!merged.has(String(edge.fromNode)) || !merged.has(String(edge.toNode))) {
      return { ok: false, reason: `Authored edge ${String(edge.id)} references a missing board object.` };
    }
    edges.push({ ...edge });
  }

  // Order: working order for survivors, then new template objects.
  const nodes: CanvasObject[] = [];
  for (const node of workingNodes) {
    const id = node.id as string;
    if (merged.has(id)) nodes.push(merged.get(id)!);
  }
  for (const id of templateNodeIds) {
    if (!workingById.has(id)) nodes.push(merged.get(id)!);
  }

  const canvas: CanvasData = {
    ...working,
    ...Object.fromEntries(Object.entries(nextTemplate).filter(([key]) => key !== 'nodes' && key !== 'edges'
      && !(key in working))),
    nodes,
    edges,
  };
  // The sidecar owns identity history: retired layout objects that survive
  // through an authored edge stay managed until that edge is gone (§P3.17).
  const retiredIds = nodes
    .filter((node) => node.losRetired === true)
    .map((node) => node.id as string);
  return { ok: true, canvas, managedIds: [...templateNodeIds, ...templateEdgeIds, ...retiredIds] };
}

export function parseBoard(text: string): CanvasData | null {
  try {
    const value = JSON.parse(text) as CanvasData;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const objects = (items: unknown): boolean => Array.isArray(items)
      && items.every((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (!objects(value.nodes) || !objects(value.edges)) return null;
    return value;
  } catch {
    return null;
  }
}

export function serializeBoard(canvas: CanvasData): string {
  return JSON.stringify(canvas) + '\n';
}

export function sidecarFor(templateSha256: string, managedIds: readonly string[]): BoardSidecar {
  return { schema_version: 1, template_sha256: templateSha256, managed_ids: [...managedIds] };
}

export function parseSidecar(text: string): BoardSidecar | null {
  try {
    const value = JSON.parse(text) as BoardSidecar;
    if (!value || value.schema_version !== 1
        || typeof value.template_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.template_sha256)
        || !Array.isArray(value.managed_ids)
        || !value.managed_ids.every((id) => typeof id === 'string' && isReserved(id))
        || new Set(value.managed_ids).size !== value.managed_ids.length) return null;
    return value;
  } catch {
    return null;
  }
}
