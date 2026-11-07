import React, { useEffect, useState } from 'react';
import { X, Plus, Ruler, Columns } from 'lucide-react';
import { GardenBedType } from '../types/garden';

interface NewBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    width: number,
    height: number,
    bedType: GardenBedType,
    walkwayWidth: number
  ) => void;
  initialName?: string;
  initialWidth?: number;
  initialHeight?: number;
  initialBedType?: GardenBedType;
  initialWalkwayWidth?: number;
  title?: string;
}

const STANDARD_PRESETS = [
  { label: '4 × 4 ft Classic Square', width: 4, height: 4 },
  { label: '4 × 8 ft Raised Bed', width: 4, height: 8 },
  { label: '8 × 4 ft Horizontal Bed', width: 8, height: 4 },
  { label: '3 × 6 ft Patio Bed', width: 3, height: 6 },
];

const ARCH_BOX_PRESETS = [
  { label: 'Two 2×6 ft Boxes + 2ft Arch (4×6 total)', width: 4, height: 6, walkway: 2 },
  { label: 'Two 2×8 ft Boxes + 3ft Arch (4×8 total)', width: 4, height: 8, walkway: 3 },
  { label: 'Two 3×6 ft Boxes + 2ft Arch (6×6 total)', width: 6, height: 6, walkway: 2 },
  { label: 'Two 4×8 ft Boxes + 3ft Arch (8×8 total)', width: 8, height: 8, walkway: 3 },
];

export const NewBedModal: React.FC<NewBedModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  initialWidth = 4,
  initialHeight = 4,
  initialBedType = 'standard',
  initialWalkwayWidth = 2,
  title = 'Create New Garden Bed',
}) => {
  const [bedType, setBedType] = useState<GardenBedType>(initialBedType);
  const [name, setName] = useState(initialName || 'Raised Bed');
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [walkwayWidth, setWalkwayWidth] = useState(initialWalkwayWidth);

  useEffect(() => {
    if (isOpen) {
      setBedType(initialBedType);
      setName(
        initialName ||
          (initialBedType === 'arch_box'
            ? 'Twin Arch Box (Tomato & Vine Arch)'
            : initialBedType === 'tomato_arch'
            ? 'Tomato Arch Bed'
            : 'Raised Bed')
      );
      setWidth(initialWidth);
      setHeight(initialHeight);
      setWalkwayWidth(initialWalkwayWidth);
    }
  }, [isOpen, initialName, initialWidth, initialHeight, initialBedType, initialWalkwayWidth]);

  if (!isOpen) return null;

  const handleSelectBedType = (nextType: GardenBedType) => {
    setBedType(nextType);
    if (nextType === 'arch_box') {
      // Ensure even width so each of the two boxes has equal columns
      if (width % 2 !== 0) setWidth(Math.max(4, width + 1));
      if (!initialName && (name === 'Raised Bed' || name === 'Tomato Arch Bed')) {
        setName('Twin Arch Box (2 Linked Beds)');
      }
    } else if (nextType === 'tomato_arch') {
      if (!initialName && (name === 'Raised Bed' || name.startsWith('Twin Arch'))) {
        setName('Tomato Arch Bed');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let clampedW = Math.max(2, Math.min(16, Number(width) || 4));
    if (bedType === 'arch_box' && clampedW % 2 !== 0) {
      clampedW += 1; // Keep even number of total columns across the 2 boxes
    }
    const clampedH = Math.max(1, Math.min(16, Number(height) || 4));
    const clampedWalkway = Math.max(1, Math.min(6, Number(walkwayWidth) || 2));
    onSave(
      name.trim() || `Garden Bed (${clampedW}×${clampedH} ft)`,
      clampedW,
      clampedH,
      bedType,
      clampedWalkway
    );
    onClose();
  };

  const perBoxWidth = Math.max(1, Math.floor(width / 2));

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
          {/* Bed Style Selector: Standard vs Double Arch Box vs Tomato Arch */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Garden Bed Style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
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
                  Two boxes joined by a center arch, edited as one!
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectBedType('tomato_arch')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  bedType === 'tomato_arch'
                    ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/30'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                }`}
              >
                <div className="font-bold text-xs text-stone-900">🍅 Tomato Arch Bed</div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  Bed with overhead tomato arch trellis
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Twin Tomato Arch Box"
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
                          setHeight(preset.height);
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
                          setHeight(preset.height);
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
                  min={1}
                  max={8}
                  value={perBoxWidth}
                  onChange={(e) => {
                    const eachW = Math.max(1, Math.min(8, Number(e.target.value) || 2));
                    setWidth(eachW * 2);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Length (ft)
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Arch Gap (ft)
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={walkwayWidth}
                  onChange={(e) => setWalkwayWidth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  min={1}
                  max={16}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Length (Feet / Rows)
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 flex items-center justify-between text-xs text-stone-600">
            <span>
              {bedType === 'arch_box'
                ? `Two ${perBoxWidth}′×${height}′ boxes + ${walkwayWidth}′ center arch:`
                : 'Total Planting Area:'}
            </span>
            <span className="font-bold text-emerald-700 text-sm">
              {Math.max(1, width) * Math.max(1, height)} sq ft planting area
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
