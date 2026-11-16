import React, { useEffect, useState } from 'react';
import { X, Plus, Ruler, Columns } from 'lucide-react';
import { BedConfig, GardenBedType } from '../types/garden';
import { MAX_ARCH_BOX_EACH_W, MAX_BED_FT } from '../utils/companionChecker';

interface NewBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: BedConfig) => void;
  initialName?: string;
  initialWidth?: number;
  initialHeight?: number;
  initialBedType?: GardenBedType;
  initialWalkwayWidth?: number;
  initialArchStart?: number;
  initialArchLength?: number;
  title?: string;
}

type ArchPosition = 'start' | 'center' | 'end' | 'custom';

const STANDARD_PRESETS = [
  { label: '4 × 4 ft Classic Square', width: 4, height: 4 },
  { label: '4 × 8 ft Raised Bed', width: 4, height: 8 },
  { label: '4 × 12 ft Long Bed', width: 4, height: 12 },
  { label: '4 × 20 ft Row Bed', width: 4, height: 20 },
  { label: '3 × 24 ft Fence Bed', width: 3, height: 24 },
  { label: '3 × 6 ft Patio Bed', width: 3, height: 6 },
];

const ARCH_BOX_PRESETS = [
  { label: 'Two 2×6 ft Boxes + 2ft Arch', width: 4, height: 6, walkway: 2 },
  { label: 'Two 2×8 ft Boxes + 3ft Arch', width: 4, height: 8, walkway: 3 },
  { label: 'Two 3×12 ft Boxes + 3ft Arch', width: 6, height: 12, walkway: 3 },
  { label: 'Two 4×8 ft Boxes + 3ft Arch', width: 8, height: 8, walkway: 3 },
  { label: 'Two 3×20 ft Boxes + 4ft Arch', width: 6, height: 20, walkway: 4 },
];

const ARCH_POSITIONS: Array<{ id: ArchPosition; label: string }> = [
  { id: 'start', label: 'Start' },
  { id: 'center', label: 'Center' },
  { id: 'end', label: 'End' },
  { id: 'custom', label: 'Custom' },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
/** Round to the nearest half foot */
const roundHalf = (n: number) => Math.round(n * 2) / 2;
const fmtFt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** Figure out which position preset matches a saved arch start/length */
function detectArchPosition(start: number, length: number, height: number): ArchPosition {
  const eps = 0.01;
  if (Math.abs(start) < eps) return 'start';
  if (Math.abs(start - (height - length) / 2) < eps) return 'center';
  if (Math.abs(start - (height - length)) < eps) return 'end';
  return 'custom';
}

export const NewBedModal: React.FC<NewBedModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  initialWidth = 4,
  initialHeight = 4,
  initialBedType = 'standard',
  initialWalkwayWidth = 2,
  initialArchStart,
  initialArchLength,
  title = 'Create New Garden Bed',
}) => {
  const [bedType, setBedType] = useState<GardenBedType>(initialBedType);
  const [name, setName] = useState(initialName || 'Raised Bed');
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [walkwayWidth, setWalkwayWidth] = useState(initialWalkwayWidth);
  const [archLength, setArchLength] = useState(initialArchLength ?? initialHeight);
  const [archPosition, setArchPosition] = useState<ArchPosition>('start');
  const [archOffset, setArchOffset] = useState(initialArchStart ?? 0);

  useEffect(() => {
    if (isOpen) {
      setBedType(initialBedType);
      setName(
        initialName ||
          (initialBedType === 'arch_box' ? 'Twin Arch Box (2 Linked Beds)' : 'Raised Bed')
      );
      setWidth(initialWidth);
      setHeight(initialHeight);
      setWalkwayWidth(initialWalkwayWidth);
      const len = clamp(initialArchLength ?? initialHeight, 0.5, initialHeight);
      const start = clamp(initialArchStart ?? 0, 0, initialHeight - len);
      setArchLength(len);
      setArchOffset(start);
      setArchPosition(detectArchPosition(start, len, initialHeight));
    }
  }, [
    isOpen,
    initialName,
    initialWidth,
    initialHeight,
    initialBedType,
    initialWalkwayWidth,
    initialArchStart,
    initialArchLength,
  ]);

  if (!isOpen) return null;

  // ---- Derived arch span (in ft along bed length) ----
  const safeHeight = clamp(Number(height) || 1, 1, MAX_BED_FT);
  const effArchLength = clamp(roundHalf(Number(archLength) || safeHeight), 0.5, safeHeight);
  const maxOffset = safeHeight - effArchLength;
  const effArchStart =
    archPosition === 'start'
      ? 0
      : archPosition === 'center'
      ? maxOffset / 2
      : archPosition === 'end'
      ? maxOffset
      : clamp(roundHalf(Number(archOffset) || 0), 0, maxOffset);
  const effArchEnd = effArchStart + effArchLength;

  const updateHeight = (h: number) => {
    // If the arch was spanning the full bed, keep it full-length as the bed grows/shrinks
    if (archLength === height) setArchLength(h);
    setHeight(h);
  };

  const handleSelectBedType = (nextType: GardenBedType) => {
    setBedType(nextType);
    if (nextType === 'arch_box') {
      // Ensure even width so each of the two boxes has equal columns
      if (width % 2 !== 0) setWidth(Math.max(4, width + 1));
      if (!initialName && name === 'Raised Bed') {
        setName('Twin Arch Box (2 Linked Beds)');
      }
    } else if (!initialName && name.startsWith('Twin Arch')) {
      setName('Raised Bed');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const maxW = bedType === 'arch_box' ? MAX_ARCH_BOX_EACH_W * 2 : MAX_BED_FT;
    let clampedW = clamp(Number(width) || 4, bedType === 'arch_box' ? 2 : 1, maxW);
    if (bedType === 'arch_box' && clampedW % 2 !== 0) {
      clampedW += 1; // Keep even number of total columns across the 2 boxes
    }
    const clampedH = safeHeight;
    const clampedWalkway = clamp(Number(walkwayWidth) || 2, 1, 8);
    onSave({
      name: name.trim() || `Garden Bed (${clampedW}×${clampedH} ft)`,
      width: clampedW,
      height: clampedH,
      bedType,
      walkwayWidth: clampedWalkway,
      ...(bedType === 'arch_box'
        ? { archStart: effArchStart, archLength: effArchLength }
        : {}),
    });
    onClose();
  };

  const perBoxWidth = Math.max(1, Math.floor(width / 2));
  const inputClass =
    'w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Ruler className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-lg text-stone-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Bed Style Selector: Standard vs Double Arch Box */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Garden Bed Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="bed-style-standard"
                onClick={() => handleSelectBedType('standard')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  bedType === 'standard'
                    ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/30'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                }`}
              >
                <div className="font-bold text-xs text-stone-900">🌱 Standard Bed</div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  Single raised garden box
                </div>
              </button>

              <button
                type="button"
                id="bed-style-arch-box"
                onClick={() => handleSelectBedType('arch_box')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  bedType === 'arch_box'
                    ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/30'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                }`}
              >
                <div className="font-bold text-xs text-stone-900 flex items-center gap-1">
                  <Columns className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Arch Box (2 Boxes)</span>
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  Two boxes joined by an arch, edited as one!
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Bed Name
            </label>
            <input
              type="text"
              id="bed-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Twin Cucumber Arch Box"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Presets */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Quick Size Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {bedType === 'arch_box'
                ? ARCH_BOX_PRESETS.map((preset) => {
                    const active =
                      width === preset.width &&
                      height === preset.height &&
                      walkwayWidth === preset.walkway;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setWidth(preset.width);
                          updateHeight(preset.height);
                          setWalkwayWidth(preset.walkway);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })
                : STANDARD_PRESETS.map((preset) => {
                    const active = width === preset.width && height === preset.height;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setWidth(preset.width);
                          updateHeight(preset.height);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
            </div>
          </div>

          {bedType === 'arch_box' ? (
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Each Box Width (ft)
                </label>
                <input
                  type="number"
                  id="bed-box-width-input"
                  min={1}
                  max={MAX_ARCH_BOX_EACH_W}
                  value={perBoxWidth}
                  onChange={(e) => {
                    const eachW = clamp(Number(e.target.value) || 1, 1, MAX_ARCH_BOX_EACH_W);
                    setWidth(eachW * 2);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Bed Length (ft)
                </label>
                <input
                  type="number"
                  id="bed-length-input"
                  min={1}
                  max={MAX_BED_FT}
                  value={height}
                  onChange={(e) => updateHeight(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Walkway Width (ft)
                </label>
                <input
                  type="number"
                  id="bed-walkway-input"
                  min={1}
                  max={8}
                  value={walkwayWidth}
                  onChange={(e) => setWalkwayWidth(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Width (Feet / Columns)
                </label>
                <input
                  type="number"
                  id="bed-width-input"
                  min={1}
                  max={MAX_BED_FT}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Length (Feet / Rows)
                </label>
                <input
                  type="number"
                  id="bed-length-input"
                  min={1}
                  max={MAX_BED_FT}
                  value={height}
                  onChange={(e) => updateHeight(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* ===== Arch Span (Arch Box only) ===== */}
          {bedType === 'arch_box' && (
            <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-900 flex items-center gap-1.5">
                  🍅 Arch Span
                </span>
                <span className="text-[11px] font-semibold text-cyan-800">
                  {effArchLength >= safeHeight
                    ? 'Covers the full bed length'
                    : `Covers ${fmtFt(effArchLength)}′ of ${fmtFt(safeHeight)}′`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Arch Length (ft)
                  </label>
                  <input
                    type="number"
                    id="arch-length-input"
                    min={0.5}
                    max={safeHeight}
                    step={0.5}
                    value={archLength}
                    onChange={(e) => setArchLength(Number(e.target.value))}
                    className={inputClass}
                  />
                  <div className="flex gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setArchLength(safeHeight)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-cyan-200 text-cyan-800 hover:bg-cyan-100"
                    >
                      Full
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchLength(Math.max(0.5, roundHalf(safeHeight / 2)))}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-cyan-200 text-cyan-800 hover:bg-cyan-100"
                    >
                      Half
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Arch Position
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {ARCH_POSITIONS.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        id={`arch-position-${pos.id}`}
                        onClick={() => {
                          if (pos.id === 'custom') setArchOffset(effArchStart);
                          setArchPosition(pos.id);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                          archPosition === pos.id
                            ? 'bg-cyan-700 text-white border-cyan-700 shadow-xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-cyan-50'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {archPosition === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Arch starts this far from the bed start (ft)
                  </label>
                  <input
                    type="number"
                    id="arch-offset-input"
                    min={0}
                    max={maxOffset}
                    step={0.5}
                    value={archOffset}
                    onChange={(e) => setArchOffset(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              )}

              {/* Live to-scale diagram of the bed length with the arch span highlighted */}
              <div>
                <div className="relative h-9 rounded-lg bg-amber-900/90 border-2 border-amber-800 overflow-hidden">
                  {/* 1 ft tick marks */}
                  {safeHeight <= MAX_BED_FT &&
                    Array.from({ length: Math.max(0, Math.floor(safeHeight) - 1) }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-amber-200/20"
                        style={{ left: `${((i + 1) / safeHeight) * 100}%` }}
                      />
                    ))}
                  <div
                    className="absolute top-1 bottom-1 rounded-md bg-gradient-to-r from-cyan-500 via-cyan-300 to-cyan-500 border border-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.6)] flex items-center justify-center transition-all duration-300"
                    style={{
                      left: `${(effArchStart / safeHeight) * 100}%`,
                      width: `${(effArchLength / safeHeight) * 100}%`,
                    }}
                  >
                    <span className="text-[10px] font-extrabold text-cyan-950 whitespace-nowrap px-1 truncate">
                      {fmtFt(effArchLength)}′ arch
                    </span>
                  </div>
                </div>
                <div className="relative h-4 mt-0.5 text-[10px] font-mono text-stone-500">
                  <span className="absolute left-0">0′</span>
                  {effArchStart > 0 && (
                    <span
                      className="absolute -translate-x-1/2 text-cyan-800 font-bold"
                      style={{ left: `${(effArchStart / safeHeight) * 100}%` }}
                    >
                      {fmtFt(effArchStart)}′
                    </span>
                  )}
                  {effArchEnd < safeHeight && (
                    <span
                      className="absolute -translate-x-1/2 text-cyan-800 font-bold"
                      style={{ left: `${(effArchEnd / safeHeight) * 100}%` }}
                    >
                      {fmtFt(effArchEnd)}′
                    </span>
                  )}
                  <span className="absolute right-0">{fmtFt(safeHeight)}′</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 flex items-center justify-between gap-2 text-xs text-stone-600">
            <span>
              {bedType === 'arch_box'
                ? `Two ${perBoxWidth}′×${fmtFt(safeHeight)}′ boxes + ${walkwayWidth}′ walkway:`
                : 'Total Planting Area:'}
            </span>
            <span className="font-bold text-emerald-700 text-sm whitespace-nowrap">
              {Math.max(1, width) * Math.max(1, safeHeight)} sq ft planting area
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-bed-button"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Save Garden Bed</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
