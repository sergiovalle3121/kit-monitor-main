/**
 * Pure multi-level BOM explosion + roll-up. Side-effect free so the recursion,
 * scrap math, cost roll-up and cycle detection are unit-testable in isolation
 * (no DB). The service loads the scoped graph and delegates the math here.
 *
 * Multilevel emerges from materials referencing materials: a BOM line points to
 * a child material; if that child has its OWN BOM (it is an assembly), we recurse
 * — accumulating effective quantities (qty × (1 + scrap%) × parent multiplier).
 */

export interface ExplodeLine {
  materialId: string;
  quantity: number;
  scrapPct?: number;
  findNumber?: string | null;
  refDes?: string | null;
  phantom?: boolean;
  uom?: string | null;
}

export interface ExplodeMaterial {
  id: string;
  partNumber: string;
  description: string;
  itemType: string; // PURCHASED | MANUFACTURED | PHANTOM | NON_STOCK | DOCUMENT
  makeBuy: string; // MAKE | BUY
  baseUom: string;
  standardCost: number;
}

export interface ExplodedNode {
  materialId: string;
  partNumber: string;
  description: string;
  itemType: string;
  makeBuy: string;
  uom: string;
  findNumber: string | null;
  refDes: string | null;
  level: number;
  /** Effective qty per ONE unit of the immediate parent (includes scrap). */
  perParentQty: number;
  /** Effective qty for the whole requested top build. */
  extendedQty: number;
  unitCost: number;
  /** unitCost × extendedQty (leaf cost; assemblies sum their children). */
  extendedCost: number;
  isAssembly: boolean;
  phantom: boolean;
  /** True if this branch was cut because the material repeats on its own path. */
  cyclic?: boolean;
  children: ExplodedNode[];
}

export interface FlatDemand {
  materialId: string;
  partNumber: string;
  description: string;
  uom: string;
  totalQty: number;
  unitCost: number;
  extendedCost: number;
}

export interface ExplodeResult {
  tree: ExplodedNode[];
  /** Leaf (purchased / non-assembly) net demand, summed across the tree. */
  flat: FlatDemand[];
  /** Total rolled-up material cost for the requested build. */
  totalCost: number;
  /** Max depth reached (0 = only the root, no components). */
  maxDepth: number;
  /** materialIds where a cycle was detected and the branch was cut. */
  cycles: string[];
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;

function isAssemblyType(itemType: string): boolean {
  return itemType === 'MANUFACTURED' || itemType === 'PHANTOM';
}

/**
 * Explode `rootMaterialId` for `rootQty` units.
 * @param getLines    component lines of an assembly material (single level).
 * @param getMaterial material master lookup.
 */
export function explodeBom(
  rootMaterialId: string,
  rootQty: number,
  getLines: (materialId: string) => ExplodeLine[],
  getMaterial: (materialId: string) => ExplodeMaterial | undefined,
): ExplodeResult {
  const flat = new Map<string, FlatDemand>();
  const cycles = new Set<string>();
  let maxDepth = 0;

  const root = getMaterial(rootMaterialId);
  if (!root) {
    return { tree: [], flat: [], totalCost: 0, maxDepth: 0, cycles: [] };
  }

  const qty = rootQty > 0 ? rootQty : 1;

  // Build the children of a given assembly material at the given accumulated qty.
  function walk(
    line: ExplodeLine,
    level: number,
    parentExtended: number,
    path: Set<string>,
  ): ExplodedNode {
    const mat = getMaterial(line.materialId);
    const scrap = Math.max(0, line.scrapPct ?? 0);
    const perParentQty = round((line.quantity || 0) * (1 + scrap / 100));
    const extendedQty = round(perParentQty * parentExtended);
    maxDepth = Math.max(maxDepth, level);

    const partNumber = mat?.partNumber ?? '(desconocido)';
    const description = mat?.description ?? 'Material no encontrado en el maestro';
    const itemType = mat?.itemType ?? 'PURCHASED';
    const makeBuy = mat?.makeBuy ?? 'BUY';
    const uom = line.uom || mat?.baseUom || 'EA';
    const unitCost = mat?.standardCost ?? 0;
    const assembly = isAssemblyType(itemType) && (getLines(line.materialId)?.length ?? 0) > 0;

    const node: ExplodedNode = {
      materialId: line.materialId,
      partNumber,
      description,
      itemType,
      makeBuy,
      uom,
      findNumber: line.findNumber ?? null,
      refDes: line.refDes ?? null,
      level,
      perParentQty,
      extendedQty,
      unitCost: round(unitCost),
      extendedCost: round(unitCost * extendedQty),
      isAssembly: assembly,
      phantom: !!line.phantom || itemType === 'PHANTOM',
      children: [],
    };

    // Cycle guard: the same material appearing on its own ancestry.
    if (path.has(line.materialId)) {
      node.cyclic = true;
      cycles.add(line.materialId);
      return node;
    }

    if (assembly) {
      const nextPath = new Set(path).add(line.materialId);
      const childLines = getLines(line.materialId) ?? [];
      for (const cl of childLines) {
        node.children.push(walk(cl, level + 1, extendedQty, nextPath));
      }
      // Assembly cost = sum of children's extended cost (its own parts), unless a
      // standard cost is set on the assembly itself (then keep the explicit one).
      if (unitCost === 0) {
        node.extendedCost = round(
          node.children.reduce((s, c) => s + c.extendedCost, 0),
        );
      }
    } else {
      // Leaf demand roll-up.
      const prev = flat.get(line.materialId);
      if (prev) {
        prev.totalQty = round(prev.totalQty + extendedQty);
        prev.extendedCost = round(prev.unitCost * prev.totalQty);
      } else {
        flat.set(line.materialId, {
          materialId: line.materialId,
          partNumber,
          description,
          uom,
          totalQty: extendedQty,
          unitCost: round(unitCost),
          extendedCost: round(unitCost * extendedQty),
        });
      }
    }
    return node;
  }

  const rootPath = new Set<string>([rootMaterialId]);
  const tree = (getLines(rootMaterialId) ?? []).map((l) =>
    walk(l, 1, qty, rootPath),
  );

  const totalCost = round(tree.reduce((s, n) => s + n.extendedCost, 0));

  return {
    tree,
    flat: Array.from(flat.values()).sort((a, b) =>
      a.partNumber.localeCompare(b.partNumber),
    ),
    totalCost,
    maxDepth,
    cycles: Array.from(cycles),
  };
}
