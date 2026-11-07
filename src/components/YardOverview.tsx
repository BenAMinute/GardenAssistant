import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Move,
  Edit3,
  Trash2,
  Copy,
  AlertTriangle,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Compass,
  Maximize2,
  Scaling,
  Search,
  Palette,
  RotateCw,
  Columns,
  Droplets,
  Eraser,
  X,
  Hand,
  Layers,
} from 'lucide-react';
import {
  GardenBed,
  GardenBedType,
  GardenLayout,
  SurfaceStyleId,
  YardElement,
  YardElementCategory,
  YardElementType,
} from '../types/garden';
import { PLANT_MAP } from '../data/plants';
import {
  CUSTOM_COLOR_SWATCHES,
  PATHWAY_STYLE_OPTIONS,
  SURFACE_STYLES,
  YARD_CATALOG,
  YARD_CATALOG_MAP,
  YardCatalogItem,
} from '../data/yardElements';
import {
  calculateLayoutDripTotals,
  doesCellHaveCage,
  doesCellHaveDrip,
  getBedSummaryStats,
  getPipeCellConnections,
} from '../utils/companionChecker';
import { NewBedModal } from './NewBedModal';
import { CageOverlay, DripCellOverlay } from './PlantSupportOverlay';

interface YardOverviewProps {
  layout: GardenLayout;
  beds: GardenBed[];
  elements: YardElement[];
  yardDripCells: Record<string, boolean>;
  selectedBedId: string | null;
  onSelectAndEditBed: (bedId: string) => void;
  onUpdateBedPosition: (bedId: string, x: number, y: number) => void;
  onCreateBed: (
    name: string,
    width: number,
    height: number,
    bedType?: GardenBedType,
    walkwayWidth?: number
  ) => void;
  onDeleteBed: (bedId: string) => void;
  onDuplicateBed: (bedId: string) => void;
  onCreateElement: (
    type: YardElementType,
    name: string,
    width: number,
    height: number,
    surfaceStyle?: SurfaceStyleId
  ) => void;
  onUpdateElement: (elementId: string, updates: Partial<YardElement>) => void;
  onDeleteElement: (elementId: string) => void;
  onDuplicateElement: (elementId: string) => void;
  onSetYardDripCell: (coord: string, active: boolean) => void;
  onClearYardDrip: () => void;
}

const BASE_CELL_PX = 44; // 1 foot = 44px at 100% zoom

const CATEGORY_TABS: Array<{ id: YardElementCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Items' },
  { id: 'pathway', label: 'Pathways' },
  { id: 'ground', label: 'Lawns & Ground' },
  { id: 'structure', label: 'Buildings' },
  { id: 'utility', label: 'Trees & Utilities' },
];

export const YardOverview: React.FC<YardOverviewProps> = ({
  layout,
  beds,
  elements,
  yardDripCells,
  selectedBedId,
  onSelectAndEditBed,
  onUpdateBedPosition,
  onCreateBed,
  onDeleteBed,
  onDuplicateBed,
  onCreateElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onSetYardDripCell,
  onClearYardDrip,
}) => {
  // Start slightly zoomed out on narrow phone screens so the whole yard fits nicely
  const [zoom, setZoom] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 0.72 : 0.95
  );
  const [isNewBedOpen, setIsNewBedOpen] = useState(false);
  const [newBedDefaultType, setNewBedDefaultType] =
    useState<GardenBedType>('standard');

  // Selection states on the yard canvas
  const [focusedBedId, setFocusedBedId] = useState<string | null>(selectedBedId);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Mobile slide-up sheets ('catalog' | 'customize' | null)
  const [mobileSheet, setMobileSheet] = useState<'catalog' | 'customize' | null>(
    null
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    YardElementCategory | 'all'
  >('all');

  // Yard interaction mode: 'arrange' (move/resize), 'pan' (scroll only), 'route_drip', 'erase_drip'
  const [yardMode, setYardMode] = useState<
    'arrange' | 'pan' | 'route_drip' | 'erase_drip'
  >('arrange');
  const [isPaintingDrip, setIsPaintingDrip] = useState(false);
  const [showDripReportModal, setShowDripReportModal] = useState(false);
  const canvasInnerRef = useRef<HTMLDivElement | null>(null);

  // Dragging state for beds or yard elements
  const [dragState, setDragState] = useState<{
    kind: 'bed' | 'element';
    id: string;
    mode: 'move' | 'resize';
    dx: number;
    dy: number;
  } | null>(null);

  const dragRef = useRef<{
    kind: 'bed' | 'element';
    id: string;
    mode: 'move' | 'resize';
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const cellPx = Math.max(22, Math.round(BASE_CELL_PX * zoom));

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedElementId) || null,
    [elements, selectedElementId]
  );

  const focusedBed = useMemo(
    () => beds.find((b) => b.id === focusedBedId) || null,
    [beds, focusedBedId]
  );

  // Calculate total drip footage & fittings across the entire yard layout
  const dripTotals = useMemo(() => calculateLayoutDripTotals(layout), [layout]);

  const filteredCatalog = useMemo(() => {
    return YARD_CATALOG.filter((item) => {
      const matchesCat =
        selectedCategory === 'all' || item.category === selectedCategory;
      const matchesQuery =
        !searchQuery.trim() ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  // Dynamic yard dimensions in feet
  const maxRightFt = Math.max(
    22,
    ...beds.map(
      (b) =>
        b.x + b.width + (b.bedType === 'arch_box' ? b.walkwayWidth || 2 : 0) + 4
    ),
    ...elements.map((el) => el.x + el.width + 4)
  );
  const maxBottomFt = Math.max(
    16,
    ...beds.map((b) => b.y + b.height + 5),
    ...elements.map((el) => el.y + el.height + 5)
  );

  // Convert pointer event on canvas to yard grid (col, row) in feet
  const applyDripAtPointer = (e: React.PointerEvent) => {
    if (!canvasInnerRef.current) return;
    const rect = canvasInnerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const gridCol = Math.floor(relX / cellPx);
    const gridRow = Math.floor(relY / cellPx);
    if (
      gridCol < 0 ||
      gridRow < 0 ||
      gridCol >= maxRightFt ||
      gridRow >= maxBottomFt
    )
      return;
    const coord = `${gridCol},${gridRow}`;
    const shouldBeActive = yardMode === 'route_drip';
    if (Boolean(yardDripCells[coord]) !== shouldBeActive) {
      onSetYardDripCell(coord, shouldBeActive);
    }
  };

  // Pointer handlers for moving & resizing beds/elements
  const startInteraction = (
    e: React.PointerEvent,
    kind: 'bed' | 'element',
    id: string,
    mode: 'move' | 'resize',
    origX: number,
    origY: number,
    origW: number,
    origH: number,
    isGroundLayer = false
  ) => {
    if (yardMode !== 'arrange') return;
    if (mode === 'move' && (e.target as HTMLElement).closest('button')) return;

    // On touch devices, large ground panels (like Main Lawn Grass) only drag
    // if already selected (or resized via handle), so 1-finger swipes scroll the yard smoothly
    if (
      kind === 'element' &&
      mode === 'move' &&
      isGroundLayer &&
      selectedElementId !== id &&
      e.pointerType === 'touch'
    ) {
      return;
    }

    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (kind === 'element') {
      setSelectedElementId(id);
      setFocusedBedId(null);
    } else {
      setFocusedBedId(id);
      setSelectedElementId(null);
    }

    dragRef.current = {
      kind,
      id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX,
      origY,
      origW,
      origH,
    };
    setDragState({ kind, id, mode, dx: 0, dy: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    setDragState({
      kind: dragRef.current.kind,
      id: dragRef.current.id,
      mode: dragRef.current.mode,
      dx,
      dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current || !dragState) return;
    const { kind, id, mode, origX, origY, origW, origH } = dragRef.current;

    const deltaGridX = Math.round(dragState.dx / cellPx);
    const deltaGridY = Math.round(dragState.dy / cellPx);

    if (mode === 'move') {
      const nextX = Math.max(0, origX + deltaGridX);
      const nextY = Math.max(0, origY + deltaGridY);
      if (nextX !== origX || nextY !== origY) {
        if (kind === 'bed') {
          onUpdateBedPosition(id, nextX, nextY);
        } else {
          onUpdateElement(id, { x: nextX, y: nextY });
        }
      }
    } else if (mode === 'resize' && kind === 'element') {
      const nextW = Math.max(1, Math.min(40, origW + deltaGridX));
      const nextH = Math.max(1, Math.min(40, origH + deltaGridY));
      if (nextW !== origW || nextH !== origH) {
        onUpdateElement(id, { width: nextW, height: nextH });
      }
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    dragRef.current = null;
    setDragState(null);
  };

  // Compute yard-wide summary stats
  let totalSquaresAll = 0;
  let totalPlantedAll = 0;
  let totalConflictsAll = 0;

  const bedStatsMap = new Map<string, ReturnType<typeof getBedSummaryStats>>();
  beds.forEach((b) => {
    const st = getBedSummaryStats(b);
    bedStatsMap.set(b.id, st);
    totalSquaresAll += st.totalSquares;
    totalPlantedAll += st.totalPlanted;
    totalConflictsAll += st.conflictTileCount;
  });

  const handleAddFromCatalog = (item: YardCatalogItem) => {
    onCreateElement(
      item.type,
      item.defaultName,
      item.defaultW,
      item.defaultH,
      item.defaultSurfaceStyle
    );
    setMobileSheet(null);
  };

  const resolveElementVisuals = (el: YardElement) => {
    const catalogMeta = YARD_CATALOG_MAP[el.type] || YARD_CATALOG[0];
    const surfaceOpt = el.surfaceStyle ? SURFACE_STYLES[el.surfaceStyle] : null;

    if (el.customColor) {
      return {
        catalogMeta,
        patternClass: 'surface-custom-overlay',
        borderClass: surfaceOpt?.borderClass || catalogMeta.borderClass,
        badgeClass: surfaceOpt?.badgeClass || catalogMeta.badgeClass,
        inlineBgColor: el.customColor,
      };
    }

    if (surfaceOpt) {
      return {
        catalogMeta,
        patternClass: surfaceOpt.patternClass,
        borderClass: surfaceOpt.borderClass,
        badgeClass: surfaceOpt.badgeClass,
        inlineBgColor: undefined,
      };
    }

    return {
      catalogMeta,
      patternClass: catalogMeta.patternClass,
      borderClass: catalogMeta.borderClass,
      badgeClass: catalogMeta.badgeClass,
      inlineBgColor: undefined,
    };
  };

  // Render miniature cell preview inside a bed or arch box half
  const renderMiniBedCell = (
    bed: GardenBed,
    colIdx: number,
    rowIdx: number,
    stats: ReturnType<typeof getBedSummaryStats>
  ) => {
    const coord = `${colIdx},${rowIdx}`;
    const plantId = bed.cells[coord];
    const plant = plantId ? PLANT_MAP[plantId] : null;
    const evalItem = stats.evaluations[coord];
    const hasConflict = evalItem && evalItem.conflicts.length > 0;
    const hasWaterWarning = evalItem && evalItem.waterMismatches.length > 0;
    const hasSynergy = evalItem && !hasConflict && evalItem.synergies.length > 0;
    const hasCage = doesCellHaveCage(bed, coord, plant);
    const hasDrip = doesCellHaveDrip(bed, coord);
    const hasCustomRoutedBedDrip = Boolean(
      bed.dripCells && Object.keys(bed.dripCells).length > 0
    );
    const bedPipeConnections =
      hasDrip && hasCustomRoutedBedDrip
        ? getPipeCellConnections(colIdx, rowIdx, (c, r) =>
            doesCellHaveDrip(bed, `${c},${r}`)
          )
        : undefined;

    return (
      <div
        key={coord}
        className={`rounded-[3px] flex items-center justify-center relative overflow-hidden border transition-colors ${
          hasConflict
            ? 'bg-red-600/85 border-red-300 ring-1 ring-red-400'
            : hasWaterWarning
            ? 'bg-amber-600/85 border-amber-300'
            : hasSynergy
            ? 'bg-emerald-700/80 border-emerald-400/80'
            : plant
            ? 'bg-amber-950/65 border-amber-700/50'
            : 'bg-amber-950/30 border-amber-900/40'
        }`}
      >
        {hasDrip && (
          <DripCellOverlay
            mode={
              bed.irrigationType && bed.irrigationType !== 'none'
                ? bed.irrigationType
                : 'drip_lines'
            }
            connections={bedPipeConnections}
            compact
          />
        )}
        {hasCage && <CageOverlay compact />}
        {plant && (
          <span
            style={{
              fontSize: `${Math.max(10, Math.min(18, Math.floor(cellPx * 0.45)))}px`,
            }}
            className="leading-none select-none drop-shadow-xs z-10"
          >
            {plant.emoji}
          </span>
        )}
      </div>
    );
  };

  const activeYardDripCoords = useMemo(
    () => Object.keys(yardDripCells).filter((k) => yardDripCells[k]),
    [yardDripCells]
  );

  // Reusable Customizer Content for both Desktop Sidebar and Mobile Bottom Sheet
  const renderCustomizerForm = (el: YardElement) => (
    <div className="space-y-3">
      {/* Name & Width/Height Row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className="block text-[10px] font-bold uppercase text-stone-500 mb-0.5">
            Label
          </label>
          <input
            type="text"
            value={el.name}
            onChange={(e) => onUpdateElement(el.id, { name: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-stone-500 mb-0.5">
            Width (ft)
          </label>
          <input
            type="number"
            min={1}
            max={40}
            value={el.width}
            onChange={(e) =>
              onUpdateElement(el.id, {
                width: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="w-full px-2 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-bold"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-stone-500 mb-0.5">
            Length (ft)
          </label>
          <input
            type="number"
            min={1}
            max={40}
            value={el.height}
            onChange={(e) =>
              onUpdateElement(el.id, {
                height: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="w-full px-2 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-bold"
          />
        </div>
      </div>

      {/* Surface Material Presets */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
          Surface Material (Gravel, Mulch, Pavers, Grass)
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {PATHWAY_STYLE_OPTIONS.map((styleId) => {
            const opt = SURFACE_STYLES[styleId];
            const isActive = el.surfaceStyle === styleId && !el.customColor;
            return (
              <button
                key={styleId}
                type="button"
                onClick={() =>
                  onUpdateElement(el.id, {
                    surfaceStyle: styleId,
                    customColor: undefined,
                  })
                }
                className={`px-2.5 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 text-left transition active:scale-95 ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: opt.previewColor }}
                />
                <span className="truncate">{opt.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Swatches + Color Picker */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
          Or Custom Color
        </label>
        <div className="flex items-center flex-wrap gap-2">
          {CUSTOM_COLOR_SWATCHES.map((swatch) => {
            const isActive = el.customColor === swatch.hex;
            return (
              <button
                key={swatch.hex}
                type="button"
                onClick={() =>
                  onUpdateElement(el.id, {
                    customColor: swatch.hex,
                  })
                }
                title={swatch.label}
                style={{ backgroundColor: swatch.hex }}
                className={`w-7 h-7 rounded-full border transition active:scale-95 ${
                  isActive
                    ? 'ring-2 ring-emerald-600 scale-110 border-white'
                    : 'border-black/25'
                }`}
              />
            );
          })}

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 cursor-pointer">
            <input
              type="color"
              value={el.customColor || '#a8a29e'}
              onChange={(e) =>
                onUpdateElement(el.id, {
                  customColor: e.target.value,
                })
              }
              className="w-4 h-4 border-0 p-0 bg-transparent cursor-pointer"
            />
            <span>Picker</span>
          </label>
        </div>
      </div>
    </div>
  );

  // Reusable Catalog Grid for both Desktop Sidebar and Mobile Bottom Sheet
  const renderCatalogContent = () => (
    <>
      <div className="p-2.5 border-b border-stone-100 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search arch box, pathways, sheds, trees..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                selectedCategory === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2.5 content-start">
        {selectedCategory === 'all' && !searchQuery.trim() && (
          <>
            <button
              type="button"
              onClick={() => {
                setNewBedDefaultType('standard');
                setIsNewBedOpen(true);
                setMobileSheet(null);
              }}
              className="p-2.5 rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50/70 active:scale-95 flex flex-col items-center justify-between transition"
            >
              <span className="text-[10px] text-emerald-700 font-bold">+ BED</span>
              <span className="text-2xl my-1">🌱</span>
              <span className="text-xs font-bold text-emerald-900 text-center leading-tight">
                Garden Bed
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewBedDefaultType('arch_box');
                setIsNewBedOpen(true);
                setMobileSheet(null);
              }}
              className="p-2.5 rounded-2xl border-2 border-dashed border-cyan-600 bg-cyan-50/70 active:scale-95 flex flex-col items-center justify-between transition"
            >
              <span className="text-[10px] text-cyan-800 font-bold">2 BOXES</span>
              <span className="text-2xl my-1">🏛️</span>
              <span className="text-xs font-bold text-cyan-950 text-center leading-tight">
                Twin Arch Box
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewBedDefaultType('tomato_arch');
                setIsNewBedOpen(true);
                setMobileSheet(null);
              }}
              className="p-2.5 rounded-2xl border-2 border-dashed border-red-400 bg-red-50/60 active:scale-95 flex flex-col items-center justify-between transition"
            >
              <span className="text-[10px] text-red-700 font-bold">+ ARCH</span>
              <span className="text-2xl my-1">🍅</span>
              <span className="text-xs font-bold text-red-950 text-center leading-tight">
                Tomato Arch
              </span>
            </button>
          </>
        )}

        {filteredCatalog.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => handleAddFromCatalog(item)}
            className="p-2.5 rounded-2xl border border-stone-200 bg-white hover:border-emerald-400 active:scale-95 flex flex-col items-center justify-between transition"
          >
            <div className="w-full flex items-center justify-between text-[10px] text-stone-400 font-mono">
              <span>
                {item.defaultW}×{item.defaultH}′
              </span>
              <span className="text-emerald-600 font-bold">+</span>
            </div>
            <span className="text-2xl my-1">{item.emoji}</span>
            <span className="text-xs font-semibold text-stone-800 text-center leading-tight line-clamp-1">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex flex-col lg:flex-row app-workspace-height bg-stone-100 overflow-hidden relative">
      {/* LEFT / MAIN AREA: Single-Row Top Bar + Full-Height Interactive Yard Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Compact Single-Row Top Bar (Never wraps into messy multiple rows on mobile) */}
        <div className="bg-white border-b border-stone-200 px-2 sm:px-5 h-12 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar shrink-0 z-20">
          {/* Left: Mode Switcher Pill (Move | Pan | Drip) */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200 shrink-0">
            <button
              type="button"
              onClick={() => setYardMode('arrange')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                yardMode === 'arrange'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>Move</span>
            </button>
            <button
              type="button"
              onClick={() => setYardMode('pan')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                yardMode === 'pan'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setYardMode((m) => (m === 'route_drip' ? 'arrange' : 'route_drip'))
              }
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                yardMode === 'route_drip'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Drip</span>
            </button>
            {(yardMode === 'route_drip' ||
              yardMode === 'erase_drip' ||
              activeYardDripCoords.length > 0) && (
              <button
                type="button"
                onClick={() =>
                  setYardMode((m) => (m === 'erase_drip' ? 'arrange' : 'erase_drip'))
                }
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center transition ${
                  yardMode === 'erase_drip'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Erase Drip Pipe"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Drip Footage Badge + Zoom + Desktop Add Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowDripReportModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-900 text-xs font-bold border border-sky-200 flex items-center gap-1 transition"
              title="Tap for Drip Tubing & Fittings Calculator"
            >
              <Droplets className="w-3.5 h-3.5 text-sky-600" />
              <span>{dripTotals.totalDripFeet}′</span>
            </button>

            {totalConflictsAll > 0 && (
              <span className="px-2 py-1.5 rounded-xl bg-red-100 text-red-800 text-xs font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>{totalConflictsAll}</span>
              </span>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center bg-stone-100 rounded-xl p-0.5 border border-stone-200">
              <button
                onClick={() =>
                  setZoom((z) => Math.max(0.45, Number((z - 0.15).toFixed(2))))
                }
                className="p-1.5 text-stone-600 hover:text-stone-900 active:scale-90 rounded-lg"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-stone-700 px-1 min-w-[34px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() =>
                  setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))
                }
                className="p-1.5 text-stone-600 hover:text-stone-900 active:scale-90 rounded-lg"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Desktop-only Quick Add Bed Buttons */}
            <button
              onClick={() => {
                setNewBedDefaultType('arch_box');
                setIsNewBedOpen(true);
              }}
              className="hidden md:flex items-center gap-1 bg-cyan-700 hover:bg-cyan-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>+ Arch Box</span>
            </button>

            <button
              onClick={() => {
                setNewBedDefaultType('standard');
                setIsNewBedOpen(true);
              }}
              className="hidden md:flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Bed</span>
            </button>
          </div>
        </div>

        {/* Active Drip Routing Banner when in `route_drip` or `erase_drip` mode */}
        {(yardMode === 'route_drip' || yardMode === 'erase_drip') && (
          <div className="bg-sky-900 text-sky-50 px-3 py-1.5 flex items-center justify-between gap-2 text-xs z-20 shadow-sm shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <Droplets className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span className="truncate">
                {yardMode === 'route_drip'
                  ? 'Drag across grid to route 1/2″ drip line'
                  : 'Drag across pipe to erase'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-mono font-bold bg-sky-800 px-2 py-0.5 rounded-lg border border-sky-600 text-[11px]">
                {dripTotals.totalDripFeet}′ total
              </span>
              {activeYardDripCoords.length > 0 && (
                <button
                  type="button"
                  onClick={onClearYardDrip}
                  className="px-2 py-0.5 rounded-lg bg-red-600 text-white font-semibold text-[11px]"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setYardMode('arrange')}
                className="px-2.5 py-0.5 rounded-lg bg-white text-sky-950 font-bold text-[11px]"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Main Interactive Yard Canvas — Full Height on Mobile! */}
        <div
          className={`flex-1 relative overflow-auto yard-grid-bg select-none pb-24 lg:pb-0 ${
            yardMode === 'route_drip'
              ? 'cursor-crosshair'
              : yardMode === 'erase_drip'
              ? 'cursor-pointer'
              : yardMode === 'pan'
              ? 'cursor-grab active:cursor-grabbing'
              : ''
          }`}
          style={{
            backgroundSize: `${cellPx}px ${cellPx}px`,
            WebkitOverflowScrolling: 'touch',
          }}
          onClick={() => {
            if (yardMode === 'arrange') {
              setSelectedElementId(null);
              setFocusedBedId(null);
            }
          }}
        >
          {/* Subtle North & Scale Badge */}
          <div className="sticky top-2 left-2 z-20 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-2xs border border-stone-200/80 text-[10px] font-semibold text-stone-600 pointer-events-none m-2">
            <Compass className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>
              N ↑ • 1 sq = 1 ft ({totalPlantedAll}/{totalSquaresAll} ft² planted)
            </span>
          </div>

          <div
            ref={canvasInnerRef}
            onPointerDown={(e) => {
              if (yardMode === 'route_drip' || yardMode === 'erase_drip') {
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                setIsPaintingDrip(true);
                applyDripAtPointer(e);
              }
            }}
            onPointerMove={(e) => {
              if (
                isPaintingDrip &&
                (yardMode === 'route_drip' || yardMode === 'erase_drip')
              ) {
                applyDripAtPointer(e);
              }
            }}
            onPointerUp={(e) => {
              if (isPaintingDrip) {
                setIsPaintingDrip(false);
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(
                    e.pointerId
                  );
                } catch {
                  // ignore
                }
              }
            }}
            className="relative"
            style={{
              width: `${maxRightFt * cellPx}px`,
              height: `${maxBottomFt * cellPx}px`,
              minWidth: '100%',
              minHeight: '100%',
              touchAction:
                yardMode === 'route_drip' || yardMode === 'erase_drip'
                  ? 'none'
                  : 'pan-x pan-y',
            }}
          >
            {/* ================= 1. YARD ELEMENTS (PATHWAYS, LAWNS, BUILDINGS, UTILITIES) ================= */}
            {elements.map((el) => {
              const {
                catalogMeta,
                patternClass,
                borderClass,
                badgeClass,
                inlineBgColor,
              } = resolveElementVisuals(el);

              const isMoving =
                dragState?.kind === 'element' &&
                dragState.id === el.id &&
                dragState.mode === 'move';
              const isResizing =
                dragState?.kind === 'element' &&
                dragState.id === el.id &&
                dragState.mode === 'resize';
              const isSelected = selectedElementId === el.id;

              const leftPx = el.x * cellPx + (isMoving ? dragState.dx : 0);
              const topPx = el.y * cellPx + (isMoving ? dragState.dy : 0);

              const liveW = isResizing
                ? Math.max(1, el.width + Math.round(dragState.dx / cellPx))
                : el.width;
              const liveH = isResizing
                ? Math.max(1, el.height + Math.round(dragState.dy / cellPx))
                : el.height;

              const widthPx = isResizing
                ? Math.max(cellPx, el.width * cellPx + dragState.dx)
                : el.width * cellPx;
              const heightPx = isResizing
                ? Math.max(cellPx, el.height * cellPx + dragState.dy)
                : el.height * cellPx;

              const isGroundLayer = catalogMeta.category === 'ground';
              const isStructureOrUtility =
                catalogMeta.category === 'structure' ||
                catalogMeta.category === 'utility';

              const isRoundCanopy =
                el.type === 'tree_canopy' || el.type === 'fire_pit';

              return (
                <div
                  key={el.id}
                  onClick={(e) => {
                    if (yardMode !== 'arrange') return;
                    e.stopPropagation();
                    setSelectedElementId(el.id);
                    setFocusedBedId(null);
                  }}
                  onPointerDown={(e) =>
                    startInteraction(
                      e,
                      'element',
                      el.id,
                      'move',
                      el.x,
                      el.y,
                      el.width,
                      el.height,
                      isGroundLayer
                    )
                  }
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={{
                    left: `${Math.max(0, leftPx)}px`,
                    top: `${Math.max(0, topPx)}px`,
                    width: `${widthPx}px`,
                    height: `${heightPx}px`,
                    backgroundColor: inlineBgColor,
                    zIndex:
                      isMoving || isResizing
                        ? 35
                        : isSelected
                        ? 28
                        : catalogMeta.zIndex,
                    touchAction:
                      yardMode === 'pan' || (isGroundLayer && !isSelected)
                        ? 'pan-x pan-y'
                        : 'none',
                    pointerEvents: yardMode !== 'arrange' ? 'none' : 'auto',
                  }}
                  className={`absolute ${
                    isRoundCanopy ? 'rounded-3xl' : 'rounded-xl'
                  } transition-shadow group ${patternClass} ${borderClass} ${
                    isMoving || isResizing
                      ? 'shadow-2xl ring-4 ring-emerald-500 cursor-grabbing'
                      : isSelected
                      ? 'shadow-xl ring-3 ring-emerald-600 cursor-grab'
                      : isStructureOrUtility
                      ? 'shadow-md hover:shadow-xl cursor-grab'
                      : 'shadow-2xs hover:ring-2 hover:ring-emerald-500/60 cursor-grab'
                  }`}
                >
                  {/* Top Label Badge */}
                  <div
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-br-lg rounded-tl-lg text-[10px] font-bold shadow-2xs max-w-full ${badgeClass}`}
                  >
                    <span>{catalogMeta.emoji}</span>
                    <span className="truncate">{el.name}</span>
                    <span className="font-mono text-[9px] opacity-85 shrink-0">
                      {liveW}×{liveH}′
                    </span>
                  </div>

                  {/* Center Icon for Larger Structures/Trees */}
                  {isStructureOrUtility && widthPx >= 75 && heightPx >= 65 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                      <span className="text-2xl drop-shadow-xs opacity-90">
                        {catalogMeta.emoji}
                      </span>
                    </div>
                  )}

                  {/* Desktop Floating Quick Action Toolbar when Selected */}
                  {isSelected && yardMode === 'arrange' && (
                    <div
                      className={`hidden lg:flex absolute ${
                        el.y <= 1 ? 'top-7 left-1' : '-top-10 left-0'
                      } items-center gap-1 bg-stone-900 text-white px-2.5 py-1.5 rounded-xl shadow-xl text-xs z-40 whitespace-nowrap`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateElement(el.id, {
                            width: el.height,
                            height: el.width,
                          });
                        }}
                        className="px-2 py-0.5 hover:bg-stone-700 rounded flex items-center gap-1 font-semibold"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Rotate</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateElement(el.id);
                        }}
                        className="px-1.5 py-0.5 hover:bg-stone-700 rounded"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteElement(el.id);
                          setSelectedElementId(null);
                        }}
                        className="px-1.5 py-0.5 hover:bg-red-600 rounded text-red-300 hover:text-white"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Bottom-Right Interactive Resize Handle (↘) */}
                  <div
                    onPointerDown={(e) =>
                      startInteraction(
                        e,
                        'element',
                        el.id,
                        'resize',
                        el.x,
                        el.y,
                        el.width,
                        el.height
                      )
                    }
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    title="Drag corner to resize width & length"
                    style={{ touchAction: 'none' }}
                    className={`absolute bottom-0 right-0 w-7 h-7 rounded-tl-xl rounded-br-lg bg-stone-900/90 hover:bg-emerald-600 text-white flex items-center justify-center cursor-se-resize shadow-md transition ${
                      isSelected || isResizing
                        ? 'opacity-100 scale-105 bg-emerald-600'
                        : 'opacity-70 group-hover:opacity-100'
                    }`}
                  >
                    <Scaling className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}

            {/* ================= 2. ROUTED YARD DRIP IRRIGATION SUPPLY LINES ================= */}
            {activeYardDripCoords.map((coord) => {
              const [c, r] = coord.split(',').map(Number);
              const conn = getPipeCellConnections(c, r, (nx, ny) =>
                Boolean(yardDripCells[`${nx},${ny}`])
              );
              return (
                <div
                  key={`ydrip-${coord}`}
                  style={{
                    left: `${c * cellPx}px`,
                    top: `${r * cellPx}px`,
                    width: `${cellPx}px`,
                    height: `${cellPx}px`,
                    zIndex:
                      yardMode === 'route_drip' || yardMode === 'erase_drip'
                        ? 32
                        : 16,
                  }}
                  className={`absolute pointer-events-none ${
                    yardMode === 'route_drip' || yardMode === 'erase_drip'
                      ? 'bg-sky-400/20 ring-1 ring-sky-400/50 rounded-xs'
                      : ''
                  }`}
                >
                  <DripCellOverlay connections={conn} compact />
                </div>
              );
            })}

            {/* ================= 3. TRUE-TO-SCALE GARDEN BEDS & TWIN ARCH BOXES ================= */}
            {beds.length === 0 && elements.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl p-6 max-w-sm text-center shadow-lg border border-stone-200">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                    <Maximize2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-stone-900 mb-1">
                    Start Mapping Your Yard
                  </h3>
                  <p className="text-xs text-stone-500 mb-4">
                    Add grass panels, gravel/mulch pathways, sheds, and raised garden beds.
                  </p>
                  <button
                    onClick={() => setIsNewBedOpen(true)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
                  >
                    + Create First Garden Bed
                  </button>
                </div>
              </div>
            ) : (
              beds.map((bed) => {
                const isDragging =
                  dragState?.kind === 'bed' &&
                  dragState.id === bed.id &&
                  dragState.mode === 'move';
                const isFocused = focusedBedId === bed.id;
                const stats = bedStatsMap.get(bed.id)!;

                const isArchBox = bed.bedType === 'arch_box';
                const isTomatoArch = bed.bedType === 'tomato_arch';
                const splitCol = Math.max(1, Math.floor(bed.width / 2));
                const walkwayFt = isArchBox ? bed.walkwayWidth || 2 : 0;

                const leftPx = bed.x * cellPx + (isDragging ? dragState.dx : 0);
                const topPx = bed.y * cellPx + (isDragging ? dragState.dy : 0);
                const totalFootprintW = bed.width + walkwayFt;
                const widthPx = totalFootprintW * cellPx;
                const heightPx = bed.height * cellPx;

                return (
                  <div
                    key={bed.id}
                    onClick={(e) => {
                      if (yardMode !== 'arrange') return;
                      e.stopPropagation();
                      setFocusedBedId(bed.id);
                      setSelectedElementId(null);
                    }}
                    onDoubleClick={() => onSelectAndEditBed(bed.id)}
                    onPointerDown={(e) =>
                      startInteraction(
                        e,
                        'bed',
                        bed.id,
                        'move',
                        bed.x,
                        bed.y,
                        totalFootprintW,
                        bed.height
                      )
                    }
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    style={{
                      left: `${Math.max(0, leftPx)}px`,
                      top: `${Math.max(0, topPx)}px`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                      zIndex: isDragging ? 35 : isFocused ? 28 : 20,
                      touchAction: yardMode === 'pan' ? 'pan-x pan-y' : 'none',
                      pointerEvents: yardMode !== 'arrange' ? 'none' : 'auto',
                    }}
                    className={`absolute rounded-xl transition-shadow group ${
                      isDragging
                        ? 'shadow-2xl scale-[1.02] cursor-grabbing ring-4 ring-emerald-500'
                        : isFocused
                        ? 'shadow-2xl ring-4 ring-emerald-500 cursor-grab'
                        : 'shadow-lg hover:shadow-xl cursor-grab'
                    }`}
                  >
                    {/* Compact Overlay Name & Status Badge at Top of Bed */}
                    <div
                      className={`absolute -top-5 left-0 right-0 flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-t-lg text-[10px] font-bold shadow-xs z-20 pointer-events-none ${
                        isArchBox || isTomatoArch
                          ? 'bg-cyan-950/95 text-cyan-50'
                          : 'bg-amber-900/95 text-amber-50'
                      }`}
                    >
                      <span className="truncate">{bed.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {stats.conflictTileCount > 0 && (
                          <span className="bg-red-500 text-white text-[9px] px-1 rounded-full">
                            !{stats.conflictTileCount}
                          </span>
                        )}
                        {stats.synergyTileCount > 0 && (
                          <span className="bg-emerald-500 text-white text-[9px] px-1 rounded-full">
                            ★{stats.synergyTileCount}
                          </span>
                        )}
                        <span className="font-mono text-[9px] opacity-80">
                          {bed.width}×{bed.height}′
                        </span>
                      </div>
                    </div>

                    {/* Desktop Floating Action Bar when Focused */}
                    {isFocused && yardMode === 'arrange' && (
                      <div
                        className={`hidden lg:flex absolute ${
                          bed.y <= 1 ? 'bottom-1 left-1' : '-top-13 left-0'
                        } items-center gap-1 bg-stone-900 text-white px-2.5 py-1.5 rounded-xl shadow-2xl text-xs z-40 whitespace-nowrap`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAndEditBed(bed.id);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Plot Plants</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateBed(bed.id);
                          }}
                          className="p-1 hover:bg-stone-700 rounded-lg"
                          title="Duplicate Bed"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBed(bed.id);
                          }}
                          className="p-1 hover:bg-red-600 rounded-lg text-red-300 hover:text-white"
                          title="Delete Bed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Exact-Footprint Soil Grid Preview: Arch Box vs Standard Single Box */}
                    {isArchBox ? (
                      <div className="w-full h-full flex items-stretch relative rounded-xl overflow-hidden shadow-inner">
                        <div
                          style={{
                            width: `${splitCol * cellPx}px`,
                            gridTemplateColumns: `repeat(${splitCol}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${bed.height}, minmax(0, 1fr))`,
                          }}
                          className="grid soil-pattern border-4 border-amber-800 rounded-l-xl p-1 gap-0.5 shrink-0"
                        >
                          {Array.from({ length: bed.height }).map((_, rowIdx) =>
                            Array.from({ length: splitCol }).map((__, colIdx) =>
                              renderMiniBedCell(bed, colIdx, rowIdx, stats)
                            )
                          )}
                        </div>

                        <div
                          style={{ width: `${walkwayFt * cellPx}px` }}
                          className="relative flex flex-col justify-around py-1 bg-cyan-500/15 border-y-2 border-dashed border-cyan-600/80 shrink-0"
                        >
                          {Array.from({ length: bed.height }).map((_, rIdx) => (
                            <div
                              key={rIdx}
                              className="w-full h-2.5 border-y border-slate-300/90 bg-gradient-to-r from-slate-600/50 via-cyan-200/70 to-slate-600/50 flex items-center justify-center"
                            >
                              <span className="text-[7px] font-mono font-bold text-slate-900 uppercase">
                                Arch
                              </span>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            width: `${(bed.width - splitCol) * cellPx}px`,
                            gridTemplateColumns: `repeat(${
                              bed.width - splitCol
                            }, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${bed.height}, minmax(0, 1fr))`,
                          }}
                          className="grid soil-pattern border-4 border-amber-800 rounded-r-xl p-1 gap-0.5 shrink-0"
                        >
                          {Array.from({ length: bed.height }).map((_, rowIdx) =>
                            Array.from({ length: bed.width - splitCol }).map(
                              (__, idx) =>
                                renderMiniBedCell(
                                  bed,
                                  splitCol + idx,
                                  rowIdx,
                                  stats
                                )
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          gridTemplateColumns: `repeat(${bed.width}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${bed.height}, minmax(0, 1fr))`,
                        }}
                        className="w-full h-full grid soil-pattern border-4 border-amber-800 rounded-xl p-1 gap-0.5 relative overflow-hidden"
                      >
                        {isTomatoArch && (
                          <div className="absolute inset-0 pointer-events-none z-15 flex flex-col justify-around py-1">
                            {Array.from({ length: bed.height }).map((_, rIdx) => (
                              <div
                                key={rIdx}
                                className="w-full h-2 border-y border-cyan-300/80 bg-cyan-400/20"
                              />
                            ))}
                          </div>
                        )}
                        {Array.from({ length: bed.height }).map((_, rowIdx) =>
                          Array.from({ length: bed.width }).map((__, colIdx) =>
                            renderMiniBedCell(bed, colIdx, rowIdx, stats)
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= MOBILE FLOATING BOTTOM ACTION BAR (< lg) ================= */}
        <div className="lg:hidden absolute bottom-3 inset-x-3 z-30 pointer-events-none flex flex-col gap-2">
          {/* 1. If a Garden Bed is tapped on mobile, show sleek Bed Action Card */}
          {focusedBed && !selectedElement && (
            <div className="pointer-events-auto bg-stone-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-xs truncate flex items-center gap-1.5">
                  <span>🌱 {focusedBed.name}</span>
                  <span className="text-[10px] font-mono text-stone-300">
                    ({focusedBed.width}′×{focusedBed.height}′)
                  </span>
                </div>
                <div className="text-[11px] text-stone-300 truncate">
                  Drag bed on map to move, or tap Plot Plants
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectAndEditBed(focusedBed.id)}
                  className="px-3 py-2 rounded-xl bg-emerald-500 active:bg-emerald-600 text-stone-950 font-extrabold text-xs flex items-center gap-1 shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Plot Plants</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateBed(focusedBed.id)}
                  className="p-2 rounded-xl bg-stone-800 text-stone-200 active:scale-95"
                  title="Duplicate Bed"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteBed(focusedBed.id);
                    setFocusedBedId(null);
                  }}
                  className="p-2 rounded-xl bg-red-950/80 text-red-300 active:scale-95"
                  title="Delete Bed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFocusedBedId(null)}
                  className="p-1.5 rounded-xl text-stone-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 2. If a Yard Element (Path, Grass, Shed) is tapped on mobile, show Element Action Card */}
          {selectedElement && (
            <div className="pointer-events-auto bg-stone-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-xs truncate">
                  {selectedElement.name} ({selectedElement.width}′×
                  {selectedElement.height}′)
                </div>
                <div className="text-[11px] text-stone-300 truncate">
                  Drag to move • Drag corner ↘ to resize
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileSheet('customize')}
                  className="px-3 py-2 rounded-xl bg-emerald-500 text-stone-950 font-extrabold text-xs flex items-center gap-1"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Style</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateElement(selectedElement.id, {
                      width: selectedElement.height,
                      height: selectedElement.width,
                    })
                  }
                  className="p-2 rounded-xl bg-stone-800 text-stone-200 active:scale-95"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateElement(selectedElement.id)}
                  className="p-2 rounded-xl bg-stone-800 text-stone-200 active:scale-95"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteElement(selectedElement.id);
                    setSelectedElementId(null);
                  }}
                  className="p-2 rounded-xl bg-red-950/80 text-red-300 active:scale-95"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedElementId(null)}
                  className="p-1.5 rounded-xl text-stone-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 3. Default Mobile Floating Dock when nothing is selected */}
          {!focusedBed && !selectedElement && (
            <div className="pointer-events-auto flex items-center justify-between gap-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-stone-200/90">
              <button
                type="button"
                onClick={() => {
                  setNewBedDefaultType('standard');
                  setIsNewBedOpen(true);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>New Garden Bed</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileSheet('catalog')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-stone-900 active:bg-stone-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Add Yard Feature</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= DESKTOP RIGHT SIDEBAR (lg+) ================= */}
      <aside className="hidden lg:flex bg-white border-l border-stone-200 w-96 flex-col shrink-0 z-30">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-2 bg-stone-50/90">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-stone-900 truncate">
              {selectedElement
                ? `Customizing: ${selectedElement.name}`
                : 'Yard Features, Arch Boxes & Pathways'}
            </h3>
            <p className="text-[11px] text-stone-500 truncate">
              {selectedElement
                ? 'Choose material, color, or size below'
                : 'Click any item to add it to your yard grid'}
            </p>
          </div>
          {selectedElement && (
            <button
              type="button"
              onClick={() => setSelectedElementId(null)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
            >
              Done
            </button>
          )}
        </div>

        {selectedElement ? (
          <div className="flex-1 p-4 bg-stone-50 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-stone-700">
                Quick Actions
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    onUpdateElement(selectedElement.id, {
                      width: selectedElement.height,
                      height: selectedElement.width,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold"
                >
                  Rotate 90°
                </button>
                <button
                  onClick={() => {
                    onDeleteElement(selectedElement.id);
                    setSelectedElementId(null);
                  }}
                  className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {renderCustomizerForm(selectedElement)}
          </div>
        ) : (
          <>
            {renderCatalogContent()}
            <div className="p-3 bg-sky-50/70 border-t border-sky-200 text-xs text-stone-700 space-y-1">
              <div className="flex items-center justify-between font-bold text-sky-950">
                <span>💧 Total Drip Tubing Needed:</span>
                <span className="text-sm font-mono">
                  {dripTotals.totalDripFeet} ft
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-600">
                <span>1/2&Prime; Yard Supply + 1/4&Prime; Bed Lines:</span>
                <span className="font-mono font-semibold">
                  {dripTotals.yardSupplyFeet}′ + {dripTotals.inBedEmitterFeet}′
                </span>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ================= MOBILE SLIDE-UP BOTTOM SHEETS (< lg) ================= */}
      {mobileSheet && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setMobileSheet(null)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[80dvh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Grabber & Header */}
            <div className="pt-2 pb-2.5 px-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  {mobileSheet === 'customize' && selectedElement
                    ? `Customize ${selectedElement.name}`
                    : 'Add to Your Yard'}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {mobileSheet === 'customize'
                    ? 'Change pathway material, color, or dimensions'
                    : 'Tap any bed, pathway, lawn, or structure to place it'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheet(null)}
                className="px-3 py-1.5 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold"
              >
                Done
              </button>
            </div>

            {mobileSheet === 'customize' && selectedElement ? (
              <div className="p-4 overflow-y-auto">
                {renderCustomizerForm(selectedElement)}
              </div>
            ) : (
              renderCatalogContent()
            )}
          </div>
        </div>
      )}

      {/* Drip Tubing & Fittings Breakdown Modal */}
      {showDripReportModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowDripReportModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-stone-900">
                  Drip Irrigation Footage Calculator
                </h3>
              </div>
              <button
                onClick={() => setShowDripReportModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-sky-950">
                    Total Drip Tubing Required
                  </div>
                  <div className="text-[11px] text-sky-700">
                    Combined 1/2&Prime; supply + 1/4&Prime; bed lines
                  </div>
                </div>
                <div className="text-xl font-extrabold font-mono text-sky-700">
                  {dripTotals.totalDripFeet} ft
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5">
                  <div className="text-stone-500">1/2&Prime; Yard Supply Line</div>
                  <div className="font-bold text-base text-stone-900 font-mono mt-0.5">
                    {dripTotals.yardSupplyFeet} ft
                  </div>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5">
                  <div className="text-stone-500">1/4&Prime; In-Bed Emitter Line</div>
                  <div className="font-bold text-base text-stone-900 font-mono mt-0.5">
                    {dripTotals.inBedEmitterFeet} ft
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="font-semibold text-stone-700">
                  Auto-Detected Pipe Fittings:
                </span>
                <span className="font-mono font-bold text-stone-900">
                  {dripTotals.elbowsCount} Elbows (90°) • {dripTotals.teesCount} Tees
                </span>
              </div>

              {dripTotals.perBedBreakdown.length > 0 && (
                <div>
                  <div className="font-bold text-stone-700 uppercase tracking-wider text-[10px] mb-1.5">
                    Per-Bed Tubing Breakdown
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {dripTotals.perBedBreakdown.map((b) => (
                      <div
                        key={b.bedId}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200/80"
                      >
                        <span className="font-medium text-stone-800 truncate">
                          {b.bedName}
                        </span>
                        <span className="font-mono font-bold text-sky-800 shrink-0">
                          {b.feet} ft ({b.dripSquares} sq ft covered)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setShowDripReportModal(false);
                  setYardMode('route_drip');
                }}
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
              >
                Route More Supply Line
              </button>
              <button
                type="button"
                onClick={() => setShowDripReportModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <NewBedModal
        isOpen={isNewBedOpen}
        onClose={() => setIsNewBedOpen(false)}
        initialBedType={newBedDefaultType}
        onSave={onCreateBed}
      />
    </div>
  );
};
