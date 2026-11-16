import { PLANT_MAP, WATER_NEED_META } from '../data/plants';
import {
  CellEvaluation,
  GardenBed,
  GardenLayout,
  NeighborRelation,
  PlantInfo,
} from '../types/garden';

/** Maximum length / width (ft) for any single garden bed */
export const MAX_BED_FT = 50;
/** Maximum width (ft) of each of the two boxes in an Arch Box bed */
export const MAX_ARCH_BOX_EACH_W = 12;
/** Allowed N×N sub-grid options inside a 1 sq ft square */
export const SQUARE_DIVISION_OPTIONS = [1, 2, 3, 4] as const;

const EPS = 1e-6;

// ---------------------------------------------------------------------------
// Planting keys & square subdivisions
// ---------------------------------------------------------------------------

/** Key for a sub-slot inside a split square, e.g. "2,3:1,0" */
export function makeSlotKey(col: number, row: number, sx: number, sy: number): string {
  return `${col},${row}:${sx},${sy}`;
}

export interface ParsedPlantingKey {
  col: number;
  row: number;
  squareCoord: string;
  sx?: number;
  sy?: number;
  isSlot: boolean;
}

/** Parses either a whole-square key ("c,r") or a sub-slot key ("c,r:sx,sy") */
export function parsePlantingKey(key: string): ParsedPlantingKey {
  const [square, slot] = key.split(':');
  const [col, row] = square.split(',').map(Number);
  if (slot) {
    const [sx, sy] = slot.split(',').map(Number);
    return { col, row, squareCoord: square, sx, sy, isSlot: true };
  }
  return { col, row, squareCoord: square, isSlot: false };
}

/** Returns the N of the N×N planting grid in a square (1 = undivided) */
export function getSquareDivision(bed: GardenBed, coord: string): number {
  const n = Number(bed.subdivisions?.[coord] || 1);
  return n >= 2 && n <= 4 ? Math.floor(n) : 1;
}

export interface BedPlanting {
  key: string;         // "c,r" or "c,r:sx,sy"
  squareCoord: string; // "c,r"
  col: number;
  row: number;
  x: number;           // footprint origin in ft
  y: number;
  size: number;        // footprint size in ft (1, 1/2, 1/3, 1/4)
  plant: PlantInfo;
}

/** Lists every planted whole square and sub-slot in a bed with its exact footprint (ft). */
export function getBedPlantings(bed: GardenBed): BedPlanting[] {
  const list: BedPlanting[] = [];
  for (const [coord, plantId] of Object.entries(bed.cells || {})) {
    const plant = PLANT_MAP[plantId];
    if (!plant) continue;
    if (getSquareDivision(bed, coord) > 1) continue;
    const [col, row] = coord.split(',').map(Number);
    if (col >= bed.width || row >= bed.height) continue;
    list.push({ key: coord, squareCoord: coord, col, row, x: col, y: row, size: 1, plant });
  }
  for (const [key, plantId] of Object.entries(bed.subCells || {})) {
    const plant = PLANT_MAP[plantId];
    if (!plant) continue;
    const parsed = parsePlantingKey(key);
    if (!parsed.isSlot) continue;
    const div = getSquareDivision(bed, parsed.squareCoord);
    const sx = parsed.sx!;
    const sy = parsed.sy!;
    if (div <= 1 || sx >= div || sy >= div) continue;
    if (parsed.col >= bed.width || parsed.row >= bed.height) continue;
    list.push({
      key,
      squareCoord: parsed.squareCoord,
      col: parsed.col,
      row: parsed.row,
      x: parsed.col + sx / div,
      y: parsed.row + sy / div,
      size: 1 / div,
      plant,
    });
  }
  return list;
}

/** All plants (with duplicates) occupying a 1 sq ft square, whole or subdivided */
export function getPlantsInSquare(bed: GardenBed, coord: string): PlantInfo[] {
  const div = getSquareDivision(bed, coord);
  if (div <= 1) {
    const p = bed.cells?.[coord] ? PLANT_MAP[bed.cells[coord]] : undefined;
    return p ? [p] : [];
  }
  const [col, row] = coord.split(',').map(Number);
  const plants: PlantInfo[] = [];
  for (let sy = 0; sy < div; sy++) {
    for (let sx = 0; sx < div; sx++) {
      const pid = bed.subCells?.[makeSlotKey(col, row, sx, sy)];
      const p = pid ? PLANT_MAP[pid] : undefined;
      if (p) plants.push(p);
    }
  }
  return plants;
}

/** The plant that drives square-level defaults (e.g. auto cage): a cage-needing plant wins */
export function getSquareRepresentativePlant(
  bed: GardenBed,
  coord: string
): PlantInfo | null {
  const plants = getPlantsInSquare(bed, coord);
  return plants.find((p) => p.needsCage) || plants[0] || null;
}

// ---------------------------------------------------------------------------
// Arch span & legacy migration
// ---------------------------------------------------------------------------

/** Returns the arch span along the bed length in ft: [start, end) */
export function getArchRange(bed: GardenBed): { start: number; end: number; length: number } {
  const h = Math.max(1, bed.height);
  const rawLen = Number(bed.archLength);
  const length = Number.isFinite(rawLen) && rawLen > 0 ? Math.min(h, rawLen) : h;
  const rawStart = Number(bed.archStart);
  const start = Number.isFinite(rawStart)
    ? Math.max(0, Math.min(h - length, rawStart))
    : 0;
  return { start, end: start + length, length };
}

/**
 * Upgrades saved beds to the current schema.
 * - Legacy `tomato_arch` beds become `standard` beds with their outer-column arch cells preserved.
 */
export function normalizeBed(bed: GardenBed): GardenBed {
  if ((bed.bedType as string) === 'tomato_arch') {
    const archCells = { ...(bed.archCells || {}) };
    for (let r = 0; r < bed.height; r++) {
      for (const c of new Set([0, bed.width - 1])) {
        const key = `${c},${r}`;
        if (!(key in archCells)) archCells[key] = true;
      }
    }
    return { ...bed, bedType: 'standard', archCells };
  }
  return bed;
}

export function normalizeLayout(layout: GardenLayout): GardenLayout {
  const needs = (layout.beds || []).some((b) => (b.bedType as string) === 'tomato_arch');
  if (!needs) return layout;
  return { ...layout, beds: layout.beds.map(normalizeBed) };
}

export function getRelationshipReason(
  plantA: PlantInfo,
  plantB: PlantInfo,
  type: 'companion' | 'antagonist'
): string {
  if (type === 'companion') {
    return (
      plantA.companionReasons?.[plantB.id] ||
      plantB.companionReasons?.[plantA.id] ||
      `${plantA.name} and ${plantB.name} grow well together with complementary root depths and pest resistance.`
    );
  }
  return (
    plantA.antagonistReasons?.[plantB.id] ||
    plantB.antagonistReasons?.[plantA.id] ||
    `${plantA.name} and ${plantB.name} compete for nutrients, share pests/blight, or inhibit each other's growth.`
  );
}

export function checkPairCompatibility(
  plantAId: string,
  plantBId: string
): 'companion' | 'antagonist' | 'neutral' {
  const plantA = PLANT_MAP[plantAId];
  const plantB = PLANT_MAP[plantBId];
  if (!plantA || !plantB || plantAId === plantBId) return 'neutral';

  if (plantA.antagonists.includes(plantBId) || plantB.antagonists.includes(plantAId)) {
    return 'antagonist';
  }
  if (plantA.companions.includes(plantBId) || plantB.companions.includes(plantAId)) {
    return 'companion';
  }
  return 'neutral';
}

export function hasWaterNeedMismatch(plantA: PlantInfo, plantB: PlantInfo): boolean {
  return (
    (plantA.waterNeed === 'low' && plantB.waterNeed === 'high') ||
    (plantA.waterNeed === 'high' && plantB.waterNeed === 'low')
  );
}

export function getWaterMismatchReason(plantA: PlantInfo, plantB: PlantInfo): string {
  const lowPlant = plantA.waterNeed === 'low' ? plantA : plantB;
  const highPlant = plantA.waterNeed === 'high' ? plantA : plantB;
  return `${lowPlant.name} prefers drier soil (${WATER_NEED_META.low.shortLabel} Water), while ${highPlant.name} needs frequent moisture (${WATER_NEED_META.high.shortLabel} Water). Use smaller/fewer drip emitters on ${lowPlant.name}.`;
}

/**
 * Returns true if the given cell in the bed has a wire plant cage on top of it.
 */
export function doesCellHaveCage(
  bed: GardenBed,
  coord: string,
  plant?: PlantInfo | null
): boolean {
  if (bed.cagedCells && coord in bed.cagedCells) {
    return Boolean(bed.cagedCells[coord]);
  }
  return Boolean(plant?.needsCage);
}

/**
 * Returns true if the given cell is positioned along an overhead Tomato / Trellis Arch.
 */
export function isCellUnderArch(bed: GardenBed, col: number, row: number): boolean {
  const coord = `${col},${row}`;
  if (bed.archCells && coord in bed.archCells) {
    return Boolean(bed.archCells[coord]);
  }
  if (bed.bedType === 'arch_box') {
    const splitCol = Math.max(1, Math.floor(bed.width / 2));
    if (col !== splitCol - 1 && col !== splitCol) return false;
    const { start, end } = getArchRange(bed);
    // Row r spans [r, r+1) ft — it's under the arch if it overlaps the arch span
    return row + 1 > start + EPS && row < end - EPS;
  }
  return false;
}

/**
 * Returns true if the given cell has active drip irrigation / watering line coverage.
 */
export function doesCellHaveDrip(bed: GardenBed, coord: string): boolean {
  if (bed.dripCells && coord in bed.dripCells) {
    return Boolean(bed.dripCells[coord]);
  }
  return Boolean(bed.irrigationType && bed.irrigationType !== 'none');
}

/** True if two footprints share an edge or corner (the 8-neighbour rule, generalised to sub-slots) */
function footprintsTouch(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number }
): boolean {
  const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.size, b.x + b.size);
  const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.size, b.y + b.size);
  return gapX <= EPS && gapY <= EPS;
}

export interface PlantingIndex {
  list: BedPlanting[];
  bySquare: Map<string, BedPlanting[]>;
}

export function buildPlantingIndex(bed: GardenBed): PlantingIndex {
  const list = getBedPlantings(bed);
  const bySquare = new Map<string, BedPlanting[]>();
  for (const p of list) {
    const arr = bySquare.get(p.squareCoord);
    if (arr) arr.push(p);
    else bySquare.set(p.squareCoord, [p]);
  }
  return { list, bySquare };
}

/**
 * Finds all plantings touching the given footprint (excluding the footprint's own key),
 * respecting the left/right box split of Arch Box beds.
 */
export function findTouchingPlantings(
  bed: GardenBed,
  index: PlantingIndex,
  target: { key: string; col: number; row: number; x: number; y: number; size: number }
): BedPlanting[] {
  const isArchBox = bed.bedType === 'arch_box';
  const splitCol = Math.max(1, Math.floor(bed.width / 2));
  const result: BedPlanting[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nCol = target.col + dc;
      const nRow = target.row + dr;
      if (nCol < 0 || nCol >= bed.width || nRow < 0 || nRow >= bed.height) continue;
      if (isArchBox && target.col < splitCol !== nCol < splitCol) continue;
      const bucket = index.bySquare.get(`${nCol},${nRow}`);
      if (!bucket) continue;
      for (const q of bucket) {
        if (q.key === target.key) continue;
        if (footprintsTouch(target, q)) result.push(q);
      }
    }
  }
  return result;
}

export function evaluateBedCells(bed: GardenBed): Record<string, CellEvaluation> {
  const evaluations: Record<string, CellEvaluation> = {};
  const index = buildPlantingIndex(bed);

  for (const p of index.list) {
    const plant = p.plant;
    const coord = p.key;
    const conflicts: NeighborRelation[] = [];
    const waterMismatches: NeighborRelation[] = [];
    const synergies: NeighborRelation[] = [];

    for (const q of findTouchingPlantings(bed, index, p)) {
      const neighborPlant = q.plant;
      const nCoord = q.key;

      const rel = checkPairCompatibility(plant.id, neighborPlant.id);
      if (rel === 'antagonist') {
        conflicts.push({
          neighborCoord: nCoord,
          neighborPlant,
          type: 'antagonist',
          reason: getRelationshipReason(plant, neighborPlant, 'antagonist'),
        });
      } else if (rel === 'companion') {
        synergies.push({
          neighborCoord: nCoord,
          neighborPlant,
          type: 'companion',
          reason: getRelationshipReason(plant, neighborPlant, 'companion'),
        });
      }

      if (hasWaterNeedMismatch(plant, neighborPlant)) {
        waterMismatches.push({
          neighborCoord: nCoord,
          neighborPlant,
          type: 'water_mismatch',
          reason: getWaterMismatchReason(plant, neighborPlant),
        });
      }
    }

    evaluations[coord] = {
      coord,
      plant,
      conflicts,
      waterMismatches,
      synergies,
    };
  }

  return evaluations;
}

export function getBedSummaryStats(bed: GardenBed) {
  const evaluations = evaluateBedCells(bed);
  let conflictTileCount = 0;
  let waterMismatchTileCount = 0;
  let synergyTileCount = 0;
  let cagedTileCount = 0;
  let dripTileCount = 0;
  const totalPlanted = Object.keys(evaluations).length;

  for (let r = 0; r < bed.height; r++) {
    for (let c = 0; c < bed.width; c++) {
      const coord = `${c},${r}`;
      if (doesCellHaveDrip(bed, coord)) {
        dripTileCount++;
      }
      const plant = getSquareRepresentativePlant(bed, coord);
      if (plant && doesCellHaveCage(bed, coord, plant)) {
        cagedTileCount++;
      }
    }
  }

  for (const evalItem of Object.values(evaluations)) {
    if (evalItem.conflicts.length > 0) {
      conflictTileCount++;
    }
    if (evalItem.waterMismatches.length > 0) {
      waterMismatchTileCount++;
    }
    if (evalItem.synergies.length > 0) {
      synergyTileCount++;
    }
  }

  return {
    totalSquares: bed.width * bed.height,
    totalPlanted,
    conflictTileCount,
    waterMismatchTileCount,
    synergyTileCount,
    cagedTileCount,
    dripTileCount,
    evaluations,
  };
}

export interface PipeCellConnections {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fitting: 'straight_h' | 'straight_v' | 'elbow' | 'tee' | 'cross' | 'end' | 'single';
}

/**
 * Inspects adjacent orthogonal cells in a boolean coordinate map to determine
 * how a routed drip pipe cell connects (straight, 90° elbow, T-fitting, 4-way cross, or end).
 */
export function getPipeCellConnections(
  col: number,
  row: number,
  hasPipeAt: (c: number, r: number) => boolean
): PipeCellConnections {
  const up = hasPipeAt(col, row - 1);
  const down = hasPipeAt(col, row + 1);
  const left = hasPipeAt(col - 1, row);
  const right = hasPipeAt(col + 1, row);

  const count = (up ? 1 : 0) + (down ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0);

  let fitting: PipeCellConnections['fitting'] = 'single';
  if (count === 4) {
    fitting = 'cross';
  } else if (count === 3) {
    fitting = 'tee';
  } else if (count === 2) {
    if (left && right) fitting = 'straight_h';
    else if (up && down) fitting = 'straight_v';
    else fitting = 'elbow';
  } else if (count === 1) {
    fitting = 'end';
  }

  return { up, down, left, right, fitting };
}

/**
 * Calculates total linear feet of drip irrigation tubing and fittings needed
 * across the entire yard layout (both yard-level routed lines and in-bed drip lines).
 */
export function calculateLayoutDripTotals(layout: GardenLayout) {
  const yardCells = layout.yardDripCells || {};
  const activeYardCoords = Object.keys(yardCells).filter((k) => yardCells[k]);

  const hasYardPipe = (c: number, r: number) => Boolean(yardCells[`${c},${r}`]);

  let yardSupplyFeet = activeYardCoords.length;
  let elbowsCount = 0;
  let teesCount = 0;
  let crossCount = 0;

  for (const coord of activeYardCoords) {
    const [c, r] = coord.split(',').map(Number);
    const conn = getPipeCellConnections(c, r, hasYardPipe);
    if (conn.fitting === 'elbow') elbowsCount++;
    if (conn.fitting === 'tee') teesCount++;
    if (conn.fitting === 'cross') crossCount++;
  }

  // Also include any placed 'irrigation_line' yard elements
  for (const el of layout.elements || []) {
    if (el.type === 'irrigation_line') {
      yardSupplyFeet += Math.max(el.width, el.height);
    }
  }

  let inBedEmitterFeet = 0;
  const perBedBreakdown: Array<{
    bedId: string;
    bedName: string;
    dripSquares: number;
    feet: number;
  }> = [];

  for (const bed of layout.beds) {
    let bedDripSquares = 0;
    const hasBedPipe = (c: number, r: number) => {
      if (c < 0 || c >= bed.width || r < 0 || r >= bed.height) return false;
      return doesCellHaveDrip(bed, `${c},${r}`);
    };

    for (let r = 0; r < bed.height; r++) {
      for (let c = 0; c < bed.width; c++) {
        if (hasBedPipe(c, r)) {
          bedDripSquares++;
          const conn = getPipeCellConnections(c, r, hasBedPipe);
          if (conn.fitting === 'elbow') elbowsCount++;
          if (conn.fitting === 'tee') teesCount++;
        }
      }
    }

    // Dual-line preset uses 2 ft of emitter line per 1 sq ft tile; custom routed/soaker uses 1 ft per square
    const multiplier =
      bed.irrigationType === 'drip_lines' &&
      (!bed.dripCells || Object.keys(bed.dripCells).length === 0)
        ? 2
        : 1;
    const bedFeet = bedDripSquares * multiplier;
    inBedEmitterFeet += bedFeet;

    if (bedFeet > 0) {
      perBedBreakdown.push({
        bedId: bed.id,
        bedName: bed.name,
        dripSquares: bedDripSquares,
        feet: bedFeet,
      });
    }
  }

  return {
    yardSupplyFeet,
    inBedEmitterFeet,
    totalDripFeet: yardSupplyFeet + inBedEmitterFeet,
    elbowsCount,
    teesCount,
    crossCount,
    perBedBreakdown,
  };
}
