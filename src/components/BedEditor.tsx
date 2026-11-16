import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Eraser,
  AlertTriangle,
  Sparkles,
  Search,
  Settings,
  Trash2,
  Info,
  CheckCircle2,
  XCircle,
  BookOpen,
  ChevronUp,
  ChevronDown,
  CircleDot,
  Columns,
  Droplets,
  Grid3x3,
  Paintbrush,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import {
  BedConfig,
  BedIrrigationType,
  GardenBed,
  PlantFamilyId,
  PlantInfo,
  WaterNeedLevel,
} from '../types/garden';
import {
  FAMILY_MAP,
  PLANT_FAMILIES,
  PLANT_MAP,
  PLANTS,
  WATER_NEED_META,
} from '../data/plants';
import {
  buildPlantingIndex,
  checkPairCompatibility,
  doesCellHaveCage,
  doesCellHaveDrip,
  evaluateBedCells,
  findTouchingPlantings,
  getArchRange,
  getPipeCellConnections,
  getRelationshipReason,
  getSquareDivision,
  getSquareRepresentativePlant,
  hasWaterNeedMismatch,
  isCellUnderArch,
  makeSlotKey,
  parsePlantingKey,
  SQUARE_DIVISION_OPTIONS,
} from '../utils/companionChecker';
import { NewBedModal } from './NewBedModal';
import {
  ArchCellOverlay,
  CageOverlay,
  DripCellOverlay,
} from './PlantSupportOverlay';

interface BedEditorProps {
  beds: GardenBed[];
  activeBed: GardenBed;
  onSelectBed: (bedId: string) => void;
  onBackToOverview: () => void;
  onOpenPlantGuide: (plantId?: string) => void;
  onPlacePlant: (bedId: string, coord: string, plantId: string | null) => void;
  onToggleCage: (bedId: string, coord: string) => void;
  onToggleArchCell: (bedId: string, coord: string) => void;
  onToggleDripCell: (bedId: string, coord: string) => void;
  onChangeBedIrrigation: (
    bedId: string,
    irrigationType: BedIrrigationType
  ) => void;
  onClearBed: (bedId: string) => void;
  onResizeOrRenameBed: (bedId: string, config: BedConfig) => void;
  onSetSquareDivision: (bedId: string, coord: string | 'all', n: number) => void;
}

type ToolMode = 'plant' | 'drip' | 'cage' | 'arch' | 'split' | 'inspect' | 'erase';
type CellScale = 'compact' | 'normal' | 'large';
type PlacementHint = 'conflict' | 'water_mismatch' | 'synergy' | 'neutral';

/** Tools that act on a whole 1 sq ft square even when the square is subdivided */
const SQUARE_LEVEL_TOOLS: ToolMode[] = ['drip', 'cage', 'arch', 'split'];

const CELL_SCALE_MINMAX: Record<CellScale, string> = {
  compact: 'minmax(52px, 64px)',
  normal: 'minmax(66px, 82px)',
  large: 'minmax(84px, 104px)',
};

/** Approximate rendered square size (px) per zoom level, used to scale sub-slot emojis */
const CELL_SCALE_PX: Record<CellScale, number> = {
  compact: 60,
  normal: 78,
  large: 100,
};

const fmtFt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

export const BedEditor: React.FC<BedEditorProps> = ({
  beds,
  activeBed,
  onSelectBed,
  onBackToOverview,
  onOpenPlantGuide,
  onPlacePlant,
  onToggleCage,
  onToggleArchCell,
  onToggleDripCell,
  onChangeBedIrrigation,
  onClearBed,
  onResizeOrRenameBed,
  onSetSquareDivision,
}) => {
  const [selectedPlantId, setSelectedPlantId] = useState<string>('tomato');
  const [toolMode, setToolMode] = useState<ToolMode>('plant');
  const [inspectedCoord, setInspectedCoord] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<PlantFamilyId | 'all'>(
    'all'
  );
  const [selectedWaterFilter, setSelectedWaterFilter] = useState<
    WaterNeedLevel | 'all'
  >('all');
  const [showHydroZoneColors, setShowHydroZoneColors] =
    useState<boolean>(false);
  const [isEditBedModalOpen, setIsEditBedModalOpen] = useState(false);
  const [splitSize, setSplitSize] = useState<number>(3);

  // Mobile sheets & collapsible banners
  const [showMobilePlantSheet, setShowMobilePlantSheet] = useState(false);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  // Default to compact cells on narrow mobile screens so wide beds & arch boxes fit
  const [cellScale, setCellScale] = useState<CellScale>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640
      ? 'compact'
      : 'normal'
  );
  const [touchSwipePaint, setTouchSwipePaint] = useState<boolean>(false);

  const isStrokeActiveRef = useRef<boolean>(false);
  const visitedStrokeCoordsRef = useRef<Set<string>>(new Set());

  const selectedPlant: PlantInfo | undefined = PLANT_MAP[selectedPlantId];
  const isArchBox = activeBed.bedType === 'arch_box';
  const splitCol = Math.max(1, Math.floor(activeBed.width / 2));
  const walkwayFt = activeBed.walkwayWidth || 2;
  const archRange = getArchRange(activeBed);
  const isPartialArch = archRange.length < activeBed.height - 1e-6;

  const evaluations = useMemo(() => evaluateBedCells(activeBed), [activeBed]);

  // Collect all active antagonist conflicts in the bed
  const allConflicts = useMemo(() => {
    const list: Array<{
      coord: string;
      plant: PlantInfo;
      neighborCoord: string;
      neighborPlant: PlantInfo;
      reason: string;
    }> = [];
    const seenPairs = new Set<string>();

    for (const [coord, ev] of Object.entries(evaluations)) {
      for (const c of ev.conflicts) {
        const pairKey = [coord, c.neighborCoord].sort().join('--');
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          list.push({
            coord,
            plant: ev.plant,
            neighborCoord: c.neighborCoord,
            neighborPlant: c.neighborPlant,
            reason: c.reason,
          });
        }
      }
    }
    return list;
  }, [evaluations]);

  // Collect all active Hydro-Zone / Watering Mismatches (Low Water next to High Water)
  const allWaterMismatches = useMemo(() => {
    const list: Array<{
      coord: string;
      plant: PlantInfo;
      neighborCoord: string;
      neighborPlant: PlantInfo;
      reason: string;
    }> = [];
    const seenPairs = new Set<string>();

    for (const [coord, ev] of Object.entries(evaluations)) {
      for (const wm of ev.waterMismatches) {
        const pairKey = [coord, wm.neighborCoord].sort().join('--');
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          list.push({
            coord,
            plant: ev.plant,
            neighborCoord: wm.neighborCoord,
            neighborPlant: wm.neighborPlant,
            reason: wm.reason,
          });
        }
      }
    }
    return list;
  }, [evaluations]);

  // Compute live preview compatibility for each square / sub-slot if the user places `selectedPlant` there
  const previewHints = useMemo(() => {
    const hints: Record<string, PlacementHint> = {};
    if (toolMode !== 'plant' || !selectedPlant) return hints;

    const index = buildPlantingIndex(activeBed);

    const hintFor = (target: {
      key: string;
      col: number;
      row: number;
      x: number;
      y: number;
      size: number;
    }): PlacementHint => {
      let hasAntagonist = false;
      let hasWaterMismatch = false;
      let hasCompanion = false;
      for (const q of findTouchingPlantings(activeBed, index, target)) {
        const rel = checkPairCompatibility(selectedPlant.id, q.plant.id);
        if (rel === 'antagonist') hasAntagonist = true;
        if (rel === 'companion') hasCompanion = true;
        if (hasWaterNeedMismatch(selectedPlant, q.plant)) hasWaterMismatch = true;
      }
      if (hasAntagonist) return 'conflict';
      if (hasWaterMismatch) return 'water_mismatch';
      if (hasCompanion) return 'synergy';
      return 'neutral';
    };

    for (let r = 0; r < activeBed.height; r++) {
      for (let c = 0; c < activeBed.width; c++) {
        const coord = `${c},${r}`;
        const div = getSquareDivision(activeBed, coord);
        if (div <= 1) {
          hints[coord] = hintFor({ key: coord, col: c, row: r, x: c, y: r, size: 1 });
        } else {
          for (let sy = 0; sy < div; sy++) {
            for (let sx = 0; sx < div; sx++) {
              const key = makeSlotKey(c, r, sx, sy);
              hints[key] = hintFor({
                key,
                col: c,
                row: r,
                x: c + sx / div,
                y: r + sy / div,
                size: 1 / div,
              });
            }
          }
        }
      }
    }
    return hints;
  }, [activeBed, selectedPlant, toolMode]);


  const filteredPlants = useMemo(() => {
    return PLANTS.filter((p) => {
      const matchesFamily =
        selectedFamily === 'all' || p.family === selectedFamily;
      const matchesWater =
        selectedWaterFilter === 'all' || p.waterNeed === selectedWaterFilter;
      const matchesQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        FAMILY_MAP[p.family].name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      return matchesFamily && matchesWater && matchesQuery;
    });
  }, [selectedFamily, selectedWaterFilter, searchQuery]);

  const handleCellClick = (coord: string) => {
    if (toolMode === 'erase') {
      onPlacePlant(activeBed.id, coord, null);
      if (inspectedCoord === coord) setInspectedCoord(null);
      return;
    }

    // Square-level tools always act on the parent 1 sq ft square, even when it is subdivided
    const squareCoord = parsePlantingKey(coord).squareCoord;

    if (toolMode === 'drip') {
      onToggleDripCell(activeBed.id, squareCoord);
      return;
    }

    if (toolMode === 'cage') {
      onToggleCage(activeBed.id, squareCoord);
      return;
    }

    if (toolMode === 'arch') {
      onToggleArchCell(activeBed.id, squareCoord);
      return;
    }

    if (toolMode === 'split') {
      onSetSquareDivision(activeBed.id, squareCoord, splitSize);
      setInspectedCoord(null);
      return;
    }

    if (toolMode === 'inspect') {
      setInspectedCoord((prev) => (prev === coord ? null : coord));
      return;
    }

    const parsedCoord = parsePlantingKey(coord);
    const existingPlantId = parsedCoord.isSlot
      ? activeBed.subCells?.[coord]
      : activeBed.cells[coord];
    if (existingPlantId === selectedPlantId) {
      // Tapping an already-planted square with the same plant opens its inspector
      setInspectedCoord((prev) => (prev === coord ? null : coord));
    } else {
      onPlacePlant(activeBed.id, coord, selectedPlantId);
    }
  };

  // The stroke-dedupe key: square-level tools should only fire once per square while dragging
  const strokeKeyFor = (coord: string) =>
    SQUARE_LEVEL_TOOLS.includes(toolMode) ? parsePlantingKey(coord).squareCoord : coord;

  // Continuous drag-to-paint / drag-to-route handler for mouse & touch Swipe-Paint mode
  const handleGridPointerDown = (e: React.PointerEvent, coord: string) => {
    const isTouch = e.pointerType === 'touch';
    if (isTouch && !touchSwipePaint) return;

    e.preventDefault();
    isStrokeActiveRef.current = true;
    visitedStrokeCoordsRef.current = new Set([strokeKeyFor(coord)]);
    handleCellClick(coord);
  };

  const handleGridPointerMove = (e: React.PointerEvent) => {
    if (!isStrokeActiveRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cellBtn = el?.closest('[data-bed-coord]') as HTMLElement | null;
    if (!cellBtn) return;
    const coord = cellBtn.getAttribute('data-bed-coord');
    if (!coord) return;
    const strokeKey = strokeKeyFor(coord);
    if (visitedStrokeCoordsRef.current.has(strokeKey)) return;

    visitedStrokeCoordsRef.current.add(strokeKey);
    handleCellClick(coord);
  };

  const handleGridPointerUp = () => {
    isStrokeActiveRef.current = false;
    visitedStrokeCoordsRef.current.clear();
  };

  const cycleCellScale = (dir: 'in' | 'out') => {
    setCellScale((prev) => {
      if (dir === 'in') {
        return prev === 'compact' ? 'normal' : 'large';
      }
      return prev === 'large' ? 'normal' : 'compact';
    });
  };

  const inspectedEval = inspectedCoord ? evaluations[inspectedCoord] : null;
  const inspectedSquare = inspectedCoord
    ? parsePlantingKey(inspectedCoord).squareCoord
    : null;
  const inspectedCaged =
    inspectedSquare && inspectedEval
      ? doesCellHaveCage(
          activeBed,
          inspectedSquare,
          getSquareRepresentativePlant(activeBed, inspectedSquare)
        )
      : false;
  const inspectedDrip = inspectedSquare
    ? doesCellHaveDrip(activeBed, inspectedSquare)
    : false;
  const inspectedArch = useMemo(() => {
    if (!inspectedSquare) return false;
    const [c, r] = inspectedSquare.split(',').map(Number);
    return isCellUnderArch(activeBed, c, r);
  }, [activeBed, inspectedSquare]);
  const inspectedDivision = inspectedSquare
    ? getSquareDivision(activeBed, inspectedSquare)
    : 1;

  // Compact grid-size picker shown in the inspector cards (desktop + mobile)
  const renderInspectorSplit = (dark: boolean) =>
    inspectedSquare ? (
      <div
        className={`flex items-center gap-0.5 rounded-lg p-0.5 shrink-0 ${
          dark ? 'bg-stone-800' : 'bg-stone-100 border border-stone-200'
        }`}
        title="Planting grid inside this square"
      >
        <Grid3x3
          className={`w-3.5 h-3.5 mx-1 ${dark ? 'text-violet-300' : 'text-violet-700'}`}
        />
        {SQUARE_DIVISION_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSetSquareDivision(activeBed.id, inspectedSquare, n)}
            className={`px-1.5 py-1 rounded-md text-[11px] font-bold font-mono ${
              inspectedDivision === n
                ? 'bg-violet-600 text-white'
                : dark
                ? 'text-stone-300'
                : 'text-stone-600'
            }`}
          >
            {n}×{n}
          </button>
        ))}
      </div>
    ) : null;

  const formatCoordLabel = (coord: string) => {
    const { col: c, row: r, isSlot, sx, sy } = parsePlantingKey(coord);
    const slotSuffix =
      isSlot && sx !== undefined && sy !== undefined
        ? ` · slot ${sy + 1},${sx + 1}`
        : '';
    if (isArchBox) {
      const boxSide = c < splitCol ? 'Left Box' : 'Right Box';
      const localCol = c < splitCol ? c + 1 : c - splitCol + 1;
      return `${boxSide} Col ${localCol}, Row ${r + 1}${slotSuffix}`;
    }
    return `Col ${c + 1}, Row ${r + 1}${slotSuffix}`;
  };

  // Render one 1 sq ft square that has been split into an N×N grid of plantable slots
  const renderSplitSquare = (cIdx: number, rIdx: number, n: number) => {
    const squareCoord = `${cIdx},${rIdx}`;
    const hasArch = isCellUnderArch(activeBed, cIdx, rIdx);
    const hasDrip = doesCellHaveDrip(activeBed, squareCoord);
    const squarePlant = getSquareRepresentativePlant(activeBed, squareCoord);
    const hasCage = doesCellHaveCage(activeBed, squareCoord, squarePlant);
    const emojiPx = Math.max(9, Math.floor((CELL_SCALE_PX[cellScale] / n) * 0.62));

    const slots: React.ReactNode[] = [];
    for (let sy = 0; sy < n; sy++) {
      for (let sx = 0; sx < n; sx++) {
        const key = makeSlotKey(cIdx, rIdx, sx, sy);
        const plantId = activeBed.subCells?.[key];
        const plant = plantId ? PLANT_MAP[plantId] : null;
        const ev = evaluations[key];
        const hasConflict = Boolean(ev && ev.conflicts.length > 0);
        const hasWaterWarning = Boolean(ev && ev.waterMismatches.length > 0);
        const hasSynergy = Boolean(ev && ev.synergies.length > 0);
        const hint = previewHints[key];
        const isInspected = inspectedCoord === key;

        let tone = 'bg-amber-950/35 border-amber-900/50 hover:border-amber-500';
        if (hasConflict) tone = 'bg-red-600/85 border-red-200 ring-1 ring-red-400/80';
        else if (showHydroZoneColors && plant) {
          tone =
            plant.waterNeed === 'high'
              ? 'bg-blue-700/85 border-blue-300'
              : plant.waterNeed === 'medium'
              ? 'bg-sky-700/80 border-sky-300'
              : 'bg-amber-600/85 border-amber-200';
        } else if (hasWaterWarning) tone = 'bg-amber-700/85 border-amber-300';
        else if (hasSynergy) tone = 'bg-emerald-700/85 border-emerald-300';
        else if (plant) tone = 'bg-amber-950/70 border-amber-700/60 hover:border-amber-400';
        else if (hint === 'conflict') tone = 'bg-amber-950/35 border-dashed border-red-400/80';
        else if (hint === 'water_mismatch')
          tone = 'bg-amber-950/35 border-dashed border-amber-400/80';
        else if (hint === 'synergy')
          tone = 'bg-amber-950/35 border-dashed border-emerald-400/80';

        slots.push(
          <button
            key={key}
            type="button"
            data-bed-coord={key}
            title={plant ? plant.name : 'Empty slot'}
            onPointerDown={(e) => handleGridPointerDown(e, key)}
            onClick={() => {
              if (!isStrokeActiveRef.current) handleCellClick(key);
            }}
            style={{ touchAction: touchSwipePaint ? 'none' : 'manipulation' }}
            className={`relative flex items-center justify-center rounded-md border select-none overflow-hidden transition active:scale-90 ${tone} ${
              isInspected ? 'ring-2 ring-white z-20' : ''
            }`}
          >
            {plant && (
              <span style={{ fontSize: `${emojiPx}px` }} className="leading-none z-10">
                {plant.emoji}
              </span>
            )}
          </button>
        );
      }
    }

    return (
      <div
        key={squareCoord}
        className="relative aspect-square rounded-xl p-0.5 soil-pattern border-2 border-amber-600/80 overflow-hidden"
      >
        {hasDrip && (
          <DripCellOverlay
            mode={
              activeBed.irrigationType && activeBed.irrigationType !== 'none'
                ? activeBed.irrigationType
                : 'drip_lines'
            }
            compact
          />
        )}
        {hasArch && <ArchCellOverlay compact />}
        {hasCage && <CageOverlay compact />}
        <div
          className="relative z-10 w-full h-full grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`,
          }}
        >
          {slots}
        </div>
        <span className="absolute bottom-0 right-0 z-20 pointer-events-none bg-black/60 text-amber-100 text-[8px] font-mono font-bold px-1 rounded-tl-md leading-tight">
          {n}×{n}
        </span>
      </div>
    );
  };

  // Render a single 1 sq ft cell button
  const renderCellButton = (cIdx: number, rIdx: number) => {
    const division = getSquareDivision(activeBed, `${cIdx},${rIdx}`);
    if (division > 1) return renderSplitSquare(cIdx, rIdx, division);
    const coord = `${cIdx},${rIdx}`;
    const plantId = activeBed.cells[coord];
    const plant = plantId ? PLANT_MAP[plantId] : null;
    const evalItem = evaluations[coord];
    const hasConflict = evalItem && evalItem.conflicts.length > 0;
    const hasWaterWarning = evalItem && evalItem.waterMismatches.length > 0;
    const hasSynergy = evalItem && evalItem.synergies.length > 0;
    const isInspected = inspectedCoord === coord;
    const placementHint = previewHints[coord];
    const hasCage = doesCellHaveCage(activeBed, coord, plant);
    const hasArch = isCellUnderArch(activeBed, cIdx, rIdx);
    const hasDrip = doesCellHaveDrip(activeBed, coord);
    const hasCustomRoutedBedDrip = Boolean(
      activeBed.dripCells && Object.keys(activeBed.dripCells).length > 0
    );
    const bedPipeConnections =
      hasDrip && (hasCustomRoutedBedDrip || toolMode === 'drip')
        ? getPipeCellConnections(cIdx, rIdx, (nx, ny) => {
            if (
              nx < 0 ||
              nx >= activeBed.width ||
              ny < 0 ||
              ny >= activeBed.height
            )
              return false;
            return doesCellHaveDrip(activeBed, `${nx},${ny}`);
          })
        : undefined;

    let hydroZoneBg = '';
    if (showHydroZoneColors && plant && !hasConflict) {
      if (plant.waterNeed === 'high') {
        hydroZoneBg = 'bg-blue-700/85 border-2 border-blue-300 text-white';
      } else if (plant.waterNeed === 'medium') {
        hydroZoneBg = 'bg-sky-700/80 border-2 border-sky-300 text-white';
      } else {
        hydroZoneBg = 'bg-amber-600/85 border-2 border-amber-200 text-white';
      }
    }

    return (
      <button
        key={coord}
        type="button"
        data-bed-coord={coord}
        onPointerDown={(e) => handleGridPointerDown(e, coord)}
        onClick={() => {
          if (!isStrokeActiveRef.current) {
            handleCellClick(coord);
          }
        }}
        style={{
          touchAction: touchSwipePaint ? 'none' : 'manipulation',
        }}
        className={`relative aspect-square rounded-xl p-1 sm:p-1.5 flex flex-col items-center justify-between transition-all select-none group overflow-hidden active:scale-95 ${
          hasConflict
            ? 'bg-red-600/85 border-2 border-red-300 text-white shadow-md ring-2 ring-red-400/80'
            : hydroZoneBg
            ? hydroZoneBg
            : hasWaterWarning
            ? 'bg-amber-700/85 border-2 border-amber-300 text-white shadow-md ring-2 ring-amber-400/70'
            : hasSynergy
            ? 'bg-emerald-700/85 border-2 border-emerald-300 text-white shadow-md ring-2 ring-emerald-400/60'
            : plant
            ? 'soil-pattern border-2 border-amber-700 text-amber-50 hover:border-amber-400'
            : placementHint === 'conflict'
            ? 'soil-pattern border-2 border-dashed border-red-400/80 hover:bg-red-950/60'
            : placementHint === 'water_mismatch'
            ? 'soil-pattern border-2 border-dashed border-amber-400/80 hover:bg-amber-950/60'
            : placementHint === 'synergy'
            ? 'soil-pattern border-2 border-dashed border-emerald-400/80 hover:bg-emerald-950/60'
            : 'soil-pattern border border-amber-800/80 hover:border-amber-500'
        } ${isInspected ? 'ring-4 ring-white scale-[1.03] z-20' : ''}`}
      >
        {hasDrip && (
          <DripCellOverlay
            mode={
              activeBed.irrigationType && activeBed.irrigationType !== 'none'
                ? activeBed.irrigationType
                : 'drip_lines'
            }
            connections={bedPipeConnections}
          />
        )}

        {hasArch && <ArchCellOverlay />}
        {hasCage && <CageOverlay />}

        {/* Top Row of Tile */}
        <div className="w-full flex items-center justify-between text-[9px] sm:text-[10px] leading-none z-25">
          {plant ? (
            <span
              className={`px-1 py-0.5 rounded font-mono font-bold flex items-center gap-0.5 ${
                hasConflict
                  ? 'bg-red-900/70 text-red-100'
                  : hasSynergy
                  ? 'bg-emerald-900/70 text-emerald-100'
                  : 'bg-black/45 text-amber-100'
              }`}
            >
              <span>×{plant.perSquareFoot}</span>
            </span>
          ) : (
            <span className="text-amber-500/35 font-mono text-[8px]">1ft²</span>
          )}

          {hasConflict && (
            <span className="bg-white text-red-600 rounded-full p-0.5 shadow animate-bounce">
              <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
          )}
          {!hasConflict && hasWaterWarning && (
            <span className="bg-amber-300 text-amber-950 rounded-full px-1 text-[8px] font-extrabold shadow">
              💧!
            </span>
          )}
          {!hasConflict && !hasWaterWarning && hasSynergy && (
            <span className="bg-white text-emerald-600 rounded-full p-0.5 shadow">
              <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
          )}
        </div>

        {/* Center Plant Emoji or Empty Placement Hint */}
        {plant ? (
          <div className="text-xl sm:text-3xl leading-none drop-shadow-sm my-auto z-10">
            {plant.emoji}
          </div>
        ) : (
          <div className="my-auto flex flex-col items-center z-10">
            {placementHint === 'conflict' && (
              <span className="text-[9px] font-bold text-red-300 bg-red-950/80 px-1 py-0.5 rounded">
                Avoid
              </span>
            )}
            {placementHint === 'water_mismatch' && (
              <span className="text-[8px] font-bold text-amber-200 bg-amber-950/85 px-1 py-0.5 rounded">
                💧Diff
              </span>
            )}
            {placementHint === 'synergy' && (
              <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded">
                Great!
              </span>
            )}
          </div>
        )}

        {/* Bottom Plant Name */}
        <div className="w-full text-center truncate text-[9px] sm:text-[11px] font-semibold leading-tight z-25">
          {plant ? plant.name : ''}
        </div>
      </button>
    );
  };

  // Reusable Plant Picker Content (used in Desktop Right Sidebar & Mobile Slide-Up Sheet)
  const renderPlantPickerContent = () => (
    <>
      <div className="p-2.5 border-b border-stone-100 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plants or families..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Water Need Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedWaterFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition ${
              selectedWaterFilter === 'all'
                ? 'bg-sky-700 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Water
          </button>
          {(['low', 'medium', 'high'] as WaterNeedLevel[]).map((wn) => (
            <button
              key={wn}
              onClick={() => setSelectedWaterFilter(wn)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition ${
                selectedWaterFilter === wn
                  ? 'bg-sky-700 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {WATER_NEED_META[wn].drops} {WATER_NEED_META[wn].shortLabel} Water
            </button>
          ))}
        </div>

        {/* Family Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => setSelectedFamily('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition ${
              selectedFamily === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Families
          </button>
          {PLANT_FAMILIES.map((fam) => (
            <button
              key={fam.id}
              onClick={() => setSelectedFamily(fam.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition ${
                selectedFamily === fam.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {fam.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Plant Grid Picker */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2 content-start">
        {filteredPlants.map((plant) => {
          const isSelected =
            selectedPlantId === plant.id && toolMode === 'plant';
          return (
            <button
              key={plant.id}
              type="button"
              onClick={() => {
                setSelectedPlantId(plant.id);
                setToolMode('plant');
                setShowMobilePlantSheet(false);
              }}
              className={`p-2.5 rounded-2xl border text-left flex flex-col items-center justify-between transition active:scale-95 ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-2xs'
                  : 'bg-white border-stone-200 hover:border-emerald-300 hover:bg-stone-50'
              }`}
            >
              <div className="w-full flex items-center justify-between text-[9px] text-stone-400 font-mono">
                <span>×{plant.perSquareFoot}</span>
                <div className="flex items-center gap-0.5">
                  <span>{WATER_NEED_META[plant.waterNeed].drops}</span>
                  {plant.needsCage && (
                    <span className="px-1 rounded bg-slate-200 text-slate-800 text-[8px] font-bold">
                      CAGE
                    </span>
                  )}
                </div>
              </div>
              <span className="text-2xl my-1">{plant.emoji}</span>
              <span className="text-xs font-semibold text-stone-800 text-center leading-tight line-clamp-1">
                {plant.name}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  const totalAlertCount = allConflicts.length + allWaterMismatches.length;

  return (
    <div
      className="flex flex-col lg:flex-row app-workspace-height bg-stone-100 overflow-hidden relative"
      onPointerMove={handleGridPointerMove}
      onPointerUp={handleGridPointerUp}
      onPointerCancel={handleGridPointerUp}
    >
      {/* LEFT / MAIN AREA: Clean 2-Strip Header + Full-Height Bed Grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* ROW 1: Bed Switcher, Irrigation & Bed Settings (Single clean row) */}
        <div className="bg-white border-b border-stone-200 px-2.5 sm:px-5 h-11 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              onClick={onBackToOverview}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 text-xs font-semibold flex items-center gap-1 shrink-0"
              title="Back to Yard Map"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Yard</span>
            </button>

            <select
              value={activeBed.id}
              onChange={(e) => {
                onSelectBed(e.target.value);
                setInspectedCoord(null);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0 flex-1 max-w-xs truncate"
            >
              {beds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.width}′×{b.height}′
                  {b.bedType === 'arch_box' ? ' • Arch Box' : ''})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact Bed Irrigation Selector */}
            <div className="flex items-center gap-1 bg-sky-50 border border-sky-200 rounded-xl px-2 py-1">
              <Droplets className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <select
                value={activeBed.irrigationType || 'none'}
                onChange={(e) =>
                  onChangeBedIrrigation(
                    activeBed.id,
                    e.target.value as BedIrrigationType
                  )
                }
                className="bg-transparent text-[11px] font-semibold text-sky-900 focus:outline-none cursor-pointer max-w-[95px] sm:max-w-none"
                title="Bed Irrigation System"
              >
                <option value="none">No Drip</option>
                <option value="drip_lines">Drip Lines</option>
                <option value="soaker_hose">Soaker</option>
                <option value="micro_sprayers">Sprayers</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowHydroZoneColors((p) => !p)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition active:scale-95 ${
                showHydroZoneColors
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-stone-100 text-stone-600 border-stone-200'
              }`}
              title="Color-code squares by plant water needs"
            >
              <Droplets className="w-4 h-4" />
              <span className="hidden md:inline">Water Zones</span>
            </button>

            <button
              onClick={() => setIsEditBedModalOpen(true)}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700"
              title="Resize or Configure Bed"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (Object.keys(activeBed.cells).length > 0) {
                  onClearBed(activeBed.id);
                  setInspectedCoord(null);
                }
              }}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-red-50 active:scale-95 text-stone-600 hover:text-red-600"
              title="Clear Bed"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ROW 2: Single Horizontal Tool Strip + Swipe Paint & Cell Zoom */}
        <div className="bg-stone-50 border-b border-stone-200 px-2.5 sm:px-5 h-10 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setToolMode('plant')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                toolMode === 'plant'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <span>{selectedPlant?.emoji || '🌱'}</span>
              <span>Plant</span>
            </button>
            <button
              onClick={() => setToolMode('drip')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                toolMode === 'drip'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Drip</span>
            </button>
            <button
              onClick={() => setToolMode('cage')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                toolMode === 'cage'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>Cage</span>
            </button>
            <button
              onClick={() => setToolMode('arch')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                toolMode === 'arch'
                  ? 'bg-cyan-700 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Arch</span>
            </button>
            <button
              id="tool-split"
              onClick={() => setToolMode('split')}
              title="Split squares into a finer planting grid (e.g. 3×3 = 9 plants per sq ft)"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                toolMode === 'split'
                  ? 'bg-violet-700 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            {toolMode === 'split' && (
              <div className="flex items-center gap-1 pl-1 ml-0.5 border-l border-stone-300">
                {SQUARE_DIVISION_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    id={`split-size-${n}`}
                    onClick={() => setSplitSize(n)}
                    className={`px-1.5 py-1 rounded-md text-[11px] font-bold font-mono transition ${
                      splitSize === n
                        ? 'bg-violet-600 text-white'
                        : 'bg-white text-stone-600 border border-stone-200'
                    }`}
                  >
                    {n}×{n}
                  </button>
                ))}
                <button
                  type="button"
                  id="split-apply-all"
                  onClick={() => {
                    onSetSquareDivision(activeBed.id, 'all', splitSize);
                    setInspectedCoord(null);
                  }}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-violet-100 text-violet-900 border border-violet-300 hover:bg-violet-200 whitespace-nowrap"
                >
                  Apply to whole bed
                </button>
              </div>
            )}
            <button
              onClick={() => setToolMode('inspect')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                toolMode === 'inspect'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Info</span>
            </button>
            <button
              onClick={() => setToolMode('erase')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                toolMode === 'erase'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Erase</span>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setTouchSwipePaint((p) => !p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                touchSwipePaint
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-stone-600 border-stone-200'
              }`}
              title="Toggle 1-finger Swipe Painting across squares"
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Swipe Paint</span>
            </button>

            <div className="flex items-center bg-white rounded-lg border border-stone-200">
              <button
                type="button"
                onClick={() => cycleCellScale('out')}
                disabled={cellScale === 'compact'}
                className="p-1 text-stone-600 disabled:opacity-30"
                title="Smaller Squares"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => cycleCellScale('in')}
                disabled={cellScale === 'large'}
                className="p-1 text-stone-600 disabled:opacity-30"
                title="Larger Squares"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible 1-Line Conflict & Watering Alert Pill (Never hogs half the phone screen) */}
        {totalAlertCount > 0 && (
          <div className="mx-2.5 sm:mx-5 mt-2 shrink-0 z-20">
            <button
              type="button"
              onClick={() => setAlertsExpanded((p) => !p)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-300 text-xs font-bold text-red-900 shadow-2xs"
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="truncate">
                  {allConflicts.length > 0 &&
                    `${allConflicts.length} Companion Conflict${
                      allConflicts.length > 1 ? 's' : ''
                    }`}
                  {allConflicts.length > 0 &&
                    allWaterMismatches.length > 0 &&
                    ' • '}
                  {allWaterMismatches.length > 0 &&
                    `💧 ${allWaterMismatches.length} Water Mismatch${
                      allWaterMismatches.length > 1 ? 'es' : ''
                    }`}
                </span>
              </div>
              <span className="text-[11px] text-red-700 flex items-center gap-0.5 shrink-0">
                <span>{alertsExpanded ? 'Hide' : 'Details'}</span>
                {alertsExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </span>
            </button>

            {alertsExpanded && (
              <div className="mt-1.5 bg-white rounded-xl border border-red-200 p-2.5 shadow-lg max-h-36 overflow-y-auto space-y-1.5 text-xs">
                {allConflicts.map((item, idx) => (
                  <div
                    key={`c-${idx}`}
                    onClick={() => {
                      setInspectedCoord(item.coord);
                      setAlertsExpanded(false);
                    }}
                    className="p-2 rounded-lg bg-red-50 text-red-900 border border-red-200 cursor-pointer"
                  >
                    <strong>
                      {item.plant.emoji} {item.plant.name}
                    </strong>{' '}
                    ({formatCoordLabel(item.coord)}) +{' '}
                    <strong>
                      {item.neighborPlant.emoji} {item.neighborPlant.name}
                    </strong>
                    : {item.reason}
                  </div>
                ))}
                {allWaterMismatches.map((item, idx) => (
                  <div
                    key={`w-${idx}`}
                    onClick={() => {
                      setInspectedCoord(item.coord);
                      setAlertsExpanded(false);
                    }}
                    className="p-2 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 cursor-pointer"
                  >
                    <strong>💧 Water Mismatch:</strong> {item.plant.emoji}{' '}
                    {item.plant.name} next to {item.neighborPlant.emoji}{' '}
                    {item.neighborPlant.name} — {item.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main 1 Sq Ft Grid Plotter Area — Gets Full Remaining Height on Mobile! */}
        <div className="flex-1 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 pb-28 lg:pb-6 overflow-auto">
          {/* ================= ARCH BOX MODE (TWO GARDEN BOXES + CENTER TOMATO ARCH BRIDGE) ================= */}
          {isArchBox ? (
            <div className="flex items-stretch gap-0 max-w-full overflow-auto p-1">
              {/* LEFT GARDEN BOX */}
              <div className="bg-amber-900 p-2 sm:p-4 rounded-2xl shadow-xl border-4 border-amber-800">
                <div className="text-center text-[11px] font-bold text-amber-100 mb-1.5 bg-amber-950/60 py-1 px-2 rounded-lg">
                  Left Box ({splitCol}′×{activeBed.height}′)
                </div>
                <div
                  className="grid gap-1 sm:gap-2 mb-1 pl-5"
                  style={{
                    gridTemplateColumns: `repeat(${splitCol}, ${CELL_SCALE_MINMAX[cellScale]})`,
                  }}
                >
                  {Array.from({ length: splitCol }).map((_, cIdx) => (
                    <div
                      key={cIdx}
                      className="text-center text-[10px] font-mono font-bold text-amber-200/90"
                    >
                      {cIdx + 1}′
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1 sm:gap-2">
                  {Array.from({ length: activeBed.height }).map((_, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-1 sm:gap-2">
                      <div className="w-4 text-right text-[10px] font-mono font-bold text-amber-200/90 shrink-0">
                        {rIdx + 1}′
                      </div>
                      <div
                        className="grid gap-1 sm:gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${splitCol}, ${CELL_SCALE_MINMAX[cellScale]})`,
                        }}
                      >
                        {Array.from({ length: splitCol }).map((__, cIdx) =>
                          renderCellButton(cIdx, rIdx)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CENTER WALKWAY + OVERHEAD ARCH (only over its measured span) */}
              <div className="w-12 sm:w-24 flex flex-col p-2 sm:p-4 border-4 border-transparent select-none shrink-0">
                {/* Header slot mirrors the box header height so rows line up */}
                <div
                  title={`${walkwayFt}′ walkway`}
                  className="text-center text-[9px] sm:text-[11px] font-bold mb-1.5 py-1 px-1 rounded-lg bg-cyan-900 text-cyan-50 border border-cyan-500/50 whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  🍅 {isPartialArch
                    ? `${fmtFt(archRange.length)}′@${fmtFt(archRange.start)}′`
                    : `${fmtFt(archRange.length)}′`}
                </div>

                <div className="mb-1 text-[10px] font-mono invisible">x</div>
                <div className="flex-1 flex flex-col gap-1 sm:gap-2 relative min-h-0">
                  {Array.from({ length: activeBed.height }).map((_, rIdx) => {
                    const overlap = Math.max(
                      0,
                      Math.min(rIdx + 1, archRange.end) - Math.max(rIdx, archRange.start)
                    );
                    const topOffset = Math.max(0, archRange.start - rIdx);
                    return (
                      <div
                        key={rIdx}
                        className="flex-1 relative min-h-0 border-x-2 border-dashed border-slate-400/50 bg-stone-300/20"
                      >
                        {overlap > 0 && (
                          <div
                            className="absolute inset-x-0 bg-gradient-to-r from-slate-600/60 via-cyan-200/80 to-slate-600/60 border-y-2 border-slate-300 flex items-center justify-center"
                            style={{
                              top: `${topOffset * 100}%`,
                              height: `${overlap * 100}%`,
                            }}
                          >
                            {overlap >= 1 && (
                              <span className="text-[8px] font-mono font-bold text-slate-900 bg-white/70 px-1 rounded">
                                Arch
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>


              {/* RIGHT GARDEN BOX */}
              <div className="bg-amber-900 p-2 sm:p-4 rounded-2xl shadow-xl border-4 border-amber-800">
                <div className="text-center text-[11px] font-bold text-amber-100 mb-1.5 bg-amber-950/60 py-1 px-2 rounded-lg">
                  Right Box ({activeBed.width - splitCol}′×{activeBed.height}′)
                </div>
                <div
                  className="grid gap-1 sm:gap-2 mb-1"
                  style={{
                    gridTemplateColumns: `repeat(${
                      activeBed.width - splitCol
                    }, ${CELL_SCALE_MINMAX[cellScale]})`,
                  }}
                >
                  {Array.from({ length: activeBed.width - splitCol }).map(
                    (_, idx) => (
                      <div
                        key={idx}
                        className="text-center text-[10px] font-mono font-bold text-amber-200/90"
                      >
                        {idx + 1}′
                      </div>
                    )
                  )}
                </div>
                <div className="flex flex-col gap-1 sm:gap-2">
                  {Array.from({ length: activeBed.height }).map((_, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-1 sm:gap-2">
                      <div
                        className="grid gap-1 sm:gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${
                            activeBed.width - splitCol
                          }, ${CELL_SCALE_MINMAX[cellScale]})`,
                        }}
                      >
                        {Array.from({ length: activeBed.width - splitCol }).map(
                          (__, idx) => renderCellButton(splitCol + idx, rIdx)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ================= STANDARD BED ================= */
            <div className="bg-amber-900 p-2.5 sm:p-4 rounded-2xl shadow-xl border-4 border-amber-800 max-w-full overflow-auto relative">

              <div
                className="grid gap-1.5 sm:gap-2 mb-1.5 pl-6"
                style={{
                  gridTemplateColumns: `repeat(${activeBed.width}, ${CELL_SCALE_MINMAX[cellScale]})`,
                }}
              >
                {Array.from({ length: activeBed.width }).map((_, cIdx) => (
                  <div
                    key={cIdx}
                    className="text-center text-[10px] font-mono font-bold text-amber-200/90"
                  >
                    {cIdx + 1}′
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 sm:gap-2">
                {Array.from({ length: activeBed.height }).map((_, rIdx) => (
                  <div key={rIdx} className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-5 text-right text-[10px] font-mono font-bold text-amber-200/90 shrink-0">
                      {rIdx + 1}′
                    </div>
                    <div
                      className="grid gap-1.5 sm:gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${activeBed.width}, ${CELL_SCALE_MINMAX[cellScale]})`,
                      }}
                    >
                      {Array.from({ length: activeBed.width }).map((__, cIdx) =>
                        renderCellButton(cIdx, rIdx)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desktop Inspection Card */}
          {inspectedEval && inspectedCoord && (
            <div className="hidden lg:block mt-4 w-full max-w-2xl bg-white rounded-2xl p-4 shadow-lg border border-stone-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-3xl border border-stone-200 overflow-hidden">
                    {inspectedEval.plant.emoji}
                    {inspectedDrip && <DripCellOverlay compact />}
                    {inspectedCaged && <CageOverlay compact />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-stone-900">
                        {inspectedEval.plant.name}
                      </h4>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          WATER_NEED_META[inspectedEval.plant.waterNeed].badgeBg
                        } ${WATER_NEED_META[inspectedEval.plant.waterNeed].badgeText}`}
                      >
                        {WATER_NEED_META[inspectedEval.plant.waterNeed].drops}{' '}
                        {WATER_NEED_META[inspectedEval.plant.waterNeed].shortLabel}{' '}
                        Water
                      </span>
                      <span className="text-xs text-stone-500 font-mono">
                        ({formatCoordLabel(inspectedEval.coord)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onToggleDripCell(activeBed.id, parsePlantingKey(inspectedCoord).squareCoord)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border ${
                      inspectedDrip
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    <span>{inspectedDrip ? 'Drip On' : 'Add Drip'}</span>
                  </button>
                  <button
                    onClick={() => onToggleCage(activeBed.id, parsePlantingKey(inspectedCoord).squareCoord)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border ${
                      inspectedCaged
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    <CircleDot className="w-3.5 h-3.5" />
                    <span>{inspectedCaged ? 'Cage On' : 'Add Cage'}</span>
                  </button>
                  <button
                    onClick={() => onToggleArchCell(activeBed.id, parsePlantingKey(inspectedCoord).squareCoord)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border ${
                      inspectedArch
                        ? 'bg-cyan-800 text-white border-cyan-800'
                        : 'bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>{inspectedArch ? 'Arch On' : 'Add Arch'}</span>
                  </button>
                  {renderInspectorSplit(false)}
                  <button
                    onClick={() => {
                      onPlacePlant(activeBed.id, inspectedEval.coord, null);
                      setInspectedCoord(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setInspectedCoord(null)}
                    className="p-1.5 text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= MOBILE FLOATING BOTTOM PLANT DOCK / INSPECTOR (< lg) ================= */}
        <div className="lg:hidden absolute bottom-2.5 inset-x-2.5 z-30 pointer-events-none">
          {inspectedEval && inspectedCoord ? (
            /* When inspecting a square on mobile, show compact Square Inspector Card */
            <div className="pointer-events-auto bg-stone-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-stone-700 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl">{inspectedEval.plant.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate flex items-center gap-1.5">
                      <span>{inspectedEval.plant.name}</span>
                      <span className="text-[10px] text-stone-300 font-mono">
                        ({formatCoordLabel(inspectedEval.coord)})
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-300 truncate">
                      {WATER_NEED_META[inspectedEval.plant.waterNeed].drops}{' '}
                      {WATER_NEED_META[inspectedEval.plant.waterNeed].shortLabel}{' '}
                      Water • ×{inspectedEval.plant.perSquareFoot}/ft²
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedCoord(null)}
                  className="p-1.5 rounded-xl bg-stone-800 text-stone-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => onToggleDripCell(activeBed.id, parsePlantingKey(inspectedCoord).squareCoord)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 ${
                    inspectedDrip
                      ? 'bg-sky-500 text-stone-950'
                      : 'bg-stone-800 text-stone-200'
                  }`}
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{inspectedDrip ? 'Drip On' : '+ Drip'}</span>
                </button>
                <button
                  onClick={() => onToggleCage(activeBed.id, parsePlantingKey(inspectedCoord).squareCoord)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 ${
                    inspectedCaged
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-stone-800 text-stone-200'
                  }`}
                >
                  <CircleDot className="w-3.5 h-3.5" />
                  <span>{inspectedCaged ? 'Cage On' : '+ Cage'}</span>
                </button>
                <button
                  onClick={() => onToggleArchCell(activeBed.id, parsePlantingKey(inspectedCoord).squareCoord)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 ${
                    inspectedArch
                      ? 'bg-cyan-400 text-stone-950'
                      : 'bg-stone-800 text-stone-200'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>{inspectedArch ? 'Arch On' : '+ Arch'}</span>
                </button>
                {renderInspectorSplit(true)}
                <button
                  onClick={() => onOpenPlantGuide(inspectedEval.plant.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-800 text-emerald-300 text-xs font-bold shrink-0"
                >
                  Guide
                </button>
                <button
                  onClick={() => {
                    onPlacePlant(activeBed.id, inspectedEval.coord, null);
                    setInspectedCoord(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-red-900/80 text-red-200 text-xs font-bold shrink-0"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            /* Default Sleek Mobile Active Plant Dock + Quick Plant Strip */
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-stone-200/90 flex items-center gap-2">
              {/* Active Plant Button -> Opens Full Plant Picker Sheet */}
              <button
                type="button"
                onClick={() => setShowMobilePlantSheet(true)}
                className="flex items-center gap-2 bg-emerald-600 active:bg-emerald-700 text-white px-3 py-2 rounded-xl shadow-xs shrink-0"
              >
                <span className="text-xl leading-none">
                  {selectedPlant?.emoji || '🌱'}
                </span>
                <div className="text-left">
                  <div className="text-xs font-extrabold leading-tight flex items-center gap-1">
                    <span>{selectedPlant?.name || 'Plants'}</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[10px] text-emerald-100 leading-tight">
                    ×{selectedPlant?.perSquareFoot || 1}/ft² • Change
                  </div>
                </div>
              </button>

              {/* Quick 1-Tap Plant Carousel right in the dock */}
              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {PLANTS.map((p) => {
                  const active =
                    selectedPlantId === p.id && toolMode === 'plant';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlantId(p.id);
                        setToolMode('plant');
                      }}
                      className={`px-2 py-1.5 rounded-xl border flex items-center gap-1 shrink-0 transition active:scale-95 ${
                        active
                          ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-500 font-bold text-emerald-950'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span className="text-base leading-none">{p.emoji}</span>
                      <span className="text-[11px]">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= DESKTOP RIGHT SIDEBAR (lg+) ================= */}
      <aside className="hidden lg:flex bg-white border-l border-stone-200 w-96 flex-col shrink-0">
        <div className="p-3 border-b border-stone-200 flex items-center justify-between gap-2 bg-stone-50/80">
          <div className="flex items-center gap-2 min-w-0">
            {selectedPlant && (
              <span className="text-2xl shrink-0">{selectedPlant.emoji}</span>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-stone-900 truncate flex items-center gap-1.5">
                <span>
                  {selectedPlant
                    ? `Selected: ${selectedPlant.name}`
                    : 'Select a Plant'}
                </span>
                {selectedPlant && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      WATER_NEED_META[selectedPlant.waterNeed].badgeBg
                    } ${WATER_NEED_META[selectedPlant.waterNeed].badgeText}`}
                  >
                    {WATER_NEED_META[selectedPlant.waterNeed].drops}{' '}
                    {WATER_NEED_META[selectedPlant.waterNeed].shortLabel}
                  </span>
                )}
              </div>
              {selectedPlant && (
                <div className="text-[11px] text-stone-500 truncate">
                  {FAMILY_MAP[selectedPlant.family].name} •{' '}
                  {selectedPlant.perSquareFoot} per sq ft
                </div>
              )}
            </div>
          </div>
        </div>

        {renderPlantPickerContent()}

        {selectedPlant && (
          <div className="p-3 bg-stone-50 border-t border-stone-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <span>{selectedPlant.emoji}</span>
                <span>{selectedPlant.name} Quick Guide</span>
              </span>
              <button
                onClick={() => onOpenPlantGuide(selectedPlant.id)}
                className="text-emerald-700 hover:underline font-semibold text-[11px]"
              >
                Full Family Guide →
              </button>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">
                ✓ Good Companions:
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedPlant.companions.slice(0, 6).map((cid) => {
                  const cp = PLANT_MAP[cid];
                  if (!cp) return null;
                  return (
                    <span
                      key={cid}
                      title={getRelationshipReason(
                        selectedPlant,
                        cp,
                        'companion'
                      )}
                      className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium"
                    >
                      {cp.emoji} {cp.name}
                    </span>
                  );
                })}
              </div>
            </div>
            {selectedPlant.antagonists.length > 0 && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block mb-0.5">
                  ✕ Keep Away From:
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedPlant.antagonists.slice(0, 6).map((aid) => {
                    const ap = PLANT_MAP[aid];
                    if (!ap) return null;
                    return (
                      <span
                        key={aid}
                        title={getRelationshipReason(
                          selectedPlant,
                          ap,
                          'antagonist'
                        )}
                        className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-medium"
                      >
                        {ap.emoji} {ap.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ================= MOBILE SLIDE-UP PLANT PICKER SHEET (< lg) ================= */}
      {showMobilePlantSheet && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setShowMobilePlantSheet(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[82dvh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2.5 pb-2.5 px-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  Choose a Plant to Plot
                </h3>
                <p className="text-[11px] text-stone-500">
                  Filter by water needs or botanical family
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobilePlantSheet(false)}
                className="px-3 py-1.5 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold"
              >
                Close
              </button>
            </div>

            {renderPlantPickerContent()}
          </div>
        </div>
      )}

      <NewBedModal
        isOpen={isEditBedModalOpen}
        onClose={() => setIsEditBedModalOpen(false)}
        title="Configure Garden Bed / Arch Box"
        initialName={activeBed.name}
        initialWidth={activeBed.width}
        initialHeight={activeBed.height}
        initialBedType={activeBed.bedType || 'standard'}
        initialWalkwayWidth={activeBed.walkwayWidth || 2}
        initialArchStart={activeBed.bedType === 'arch_box' ? archRange.start : undefined}
        initialArchLength={activeBed.bedType === 'arch_box' ? archRange.length : undefined}
        onSave={(config) => onResizeOrRenameBed(activeBed.id, config)}
      />
    </div>
  );
};
