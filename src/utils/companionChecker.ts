import { PLANT_MAP, WATER_NEED_META } from '../data/plants';
import {
  CellEvaluation,
  GardenBed,
  GardenLayout,
  NeighborRelation,
  PlantInfo,
} from '../types/garden';

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
    return col === splitCol - 1 || col === splitCol;
  }
  if (bed.bedType === 'tomato_arch') {
    return col === 0 || col === bed.width - 1;
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

const NEIGHBOR_DELTAS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

export function evaluateBedCells(bed: GardenBed): Record<string, CellEvaluation> {
  const evaluations: Record<string, CellEvaluation> = {};
  const isArchBox = bed.bedType === 'arch_box';
  const splitCol = Math.max(1, Math.floor(bed.width / 2));

  for (const [coord, plantId] of Object.entries(bed.cells)) {
    const plant = PLANT_MAP[plantId];
    if (!plant) continue;

    const [colStr, rowStr] = coord.split(',');
    const col = parseInt(colStr, 10);
    const row = parseInt(rowStr, 10);

    const conflicts: NeighborRelation[] = [];
    const waterMismatches: NeighborRelation[] = [];
    const synergies: NeighborRelation[] = [];

    for (const [dx, dy] of NEIGHBOR_DELTAS) {
      const nCol = col + dx;
      const nRow = row + dy;
      if (nCol < 0 || nCol >= bed.width || nRow < 0 || nRow >= bed.height) continue;

      if (isArchBox) {
        const isLeftA = col < splitCol;
        const isLeftB = nCol < splitCol;
        if (isLeftA !== isLeftB) continue;
      }

      const nCoord = `${nCol},${nRow}`;
      const neighborPlantId = bed.cells[nCoord];
      if (!neighborPlantId) continue;

      const neighborPlant = PLANT_MAP[neighborPlantId];
      if (!neighborPlant) continue;

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
  const totalPlanted = Object.keys(bed.cells).length;

  for (let r = 0; r < bed.height; r++) {
    for (let c = 0; c < bed.width; c++) {
      const coord = `${c},${r}`;
      if (doesCellHaveDrip(bed, coord)) {
        dripTileCount++;
      }
    }
  }

  for (const [coord, plantId] of Object.entries(bed.cells)) {
    const plant = PLANT_MAP[plantId];
    if (doesCellHaveCage(bed, coord, plant)) {
      cagedTileCount++;
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
