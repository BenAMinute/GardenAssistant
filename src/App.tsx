import React, { useEffect, useState } from 'react';
import { Header, ActiveTab } from './components/Header';
import { YardOverview } from './components/YardOverview';
import { BedEditor } from './components/BedEditor';
import { PlantGuidePage } from './components/PlantGuidePage';
import {
  BedConfig,
  BedIrrigationType,
  GardenBed,
  GardenLayout,
  SurfaceStyleId,
  UserProfile,
  YardElement,
  YardElementType,
} from './types/garden';
import {
  deleteUserLayout,
  fetchUserLayouts,
  loadLocalLayouts,
  saveLocalLayouts,
  saveUserLayout,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
} from './services/firebase';
import {
  doesCellHaveCage,
  doesCellHaveDrip,
  getSquareDivision,
  getSquareRepresentativePlant,
  isCellUnderArch,
  makeSlotKey,
  parsePlantingKey,
} from './utils/companionChecker';

/**
 * Changes the N×N planting grid of one square, carrying existing plants across:
 * - whole → split: every new slot gets the whole-square plant
 * - split → split: slots are remapped proportionally
 * - split → whole: the most common plant in the square is kept
 */
function applySquareDivision(bed: GardenBed, coords: string[], n: number): GardenBed {
  const cells = { ...bed.cells };
  const subdivisions = { ...(bed.subdivisions || {}) };
  const subCells = { ...(bed.subCells || {}) };
  const working: GardenBed = { ...bed, cells, subdivisions, subCells };

  for (const coord of coords) {
    const cur = getSquareDivision(working, coord);
    if (cur === n) continue;
    const [c, r] = coord.split(',').map(Number);

    // Snapshot current slot contents and remove them
    const oldSlots: Record<string, string> = {};
    if (cur > 1) {
      for (let sy = 0; sy < cur; sy++) {
        for (let sx = 0; sx < cur; sx++) {
          const k = makeSlotKey(c, r, sx, sy);
          if (subCells[k]) oldSlots[`${sx},${sy}`] = subCells[k];
          delete subCells[k];
        }
      }
    }
    const wholePlant = cur === 1 ? cells[coord] : undefined;

    if (n <= 1) {
      delete subdivisions[coord];
      const counts: Record<string, number> = {};
      for (const pid of Object.values(oldSlots)) counts[pid] = (counts[pid] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) cells[coord] = top[0];
    } else {
      subdivisions[coord] = n;
      delete cells[coord];
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const pid =
            cur === 1
              ? wholePlant
              : oldSlots[`${Math.floor((sx * cur) / n)},${Math.floor((sy * cur) / n)}`];
          if (pid) subCells[makeSlotKey(c, r, sx, sy)] = pid;
        }
      }
    }
  }

  return working;
}

export default function App() {
  // ... (existing state declarations from lines 90-102)
  const [layouts, setLayouts] = useState<GardenLayout[]>(() => loadLocalLayouts());
  const [currentLayoutId, setCurrentLayoutId] = useState<string>(() => {
    const initial = loadLocalLayouts();
    return initial[0]?.id || 'layout-spring-main';
  });
  const [selectedBedId, setSelectedBedId] = useState<string | null>(() => {
    const initial = loadLocalLayouts();
    return initial[0]?.beds[0]?.id || null;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [focusedGuidePlantId, setFocusedGuidePlantId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Subscribe to Firebase / Demo Auth
  useEffect(() => {
    const unsub = subscribeToAuth(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        const remoteLayouts = await fetchUserLayouts(authUser.uid);
        if (remoteLayouts.length > 0) {
          setLayouts(remoteLayouts);
          setCurrentLayoutId(remoteLayouts[0].id);
          setSelectedBedId(remoteLayouts[0].beds[0]?.id || null);
        }
      }
    });
    return () => unsub();
  }, []);

  const currentLayout =
    layouts.find((l) => l.id === currentLayoutId) || layouts[0];

  const activeBed: GardenBed | undefined =
    currentLayout.beds.find((b) => b.id === selectedBedId) ||
    currentLayout.beds[0];

  const persistUpdatedLayout = (updated: GardenLayout) => {
    setLayouts((prev) => {
      const next = prev.map((l) => (l.id === updated.id ? updated : l));
      saveLocalLayouts(next);
      return next;
    });
    if (user) {
      saveUserLayout(user.uid, updated);
    }
  };

  // Layout Management Handlers
  const handleSelectLayout = (layoutId: string) => {
    setCurrentLayoutId(layoutId);
    const found = layouts.find((l) => l.id === layoutId);
    if (found) {
      setSelectedBedId(found.beds[0]?.id || null);
    }
  };

  const handleCreateLayout = (name: string) => {
    const newBed: GardenBed = {
      id: `bed-${Date.now()}`,
      name: 'Raised Bed #1',
      bedType: 'standard',
      width: 4,
      height: 4,
      x: 3,
      y: 3,
      cells: {},
    };
    const newLayout: GardenLayout = {
      id: `layout-${Date.now()}`,
      name,
      updatedAt: Date.now(),
      beds: [newBed],
      elements: [
        {
          id: `elem-grass-${Date.now()}`,
          type: 'grass_panel',
          name: 'Lawn / Grass Area',
          x: 1,
          y: 1,
          width: 12,
          height: 10,
          surfaceStyle: 'grass_lush',
        },
      ],
    };
    const next = [newLayout, ...layouts];
    setLayouts(next);
    saveLocalLayouts(next);
    if (user) saveUserLayout(user.uid, newLayout);
    setCurrentLayoutId(newLayout.id);
    setSelectedBedId(newBed.id);
  };

  const handleDuplicateLayout = () => {
    const copy: GardenLayout = {
      ...currentLayout,
      id: `layout-${Date.now()}`,
      name: `${currentLayout.name} (Copy)`,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => ({
        ...b,
        id: `bed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        cells: { ...b.cells },
        subdivisions: b.subdivisions ? { ...b.subdivisions } : undefined,
        subCells: b.subCells ? { ...b.subCells } : undefined,
        cagedCells: b.cagedCells ? { ...b.cagedCells } : undefined,
        archCells: b.archCells ? { ...b.archCells } : undefined,
      })),
      elements: (currentLayout.elements || []).map((el) => ({
        ...el,
        id: `elem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    };
    const next = [copy, ...layouts];
    setLayouts(next);
    saveLocalLayouts(next);
    if (user) saveUserLayout(user.uid, copy);
    setCurrentLayoutId(copy.id);
    setSelectedBedId(copy.beds[0]?.id || null);
  };

  const handleRenameLayout = (newName: string) => {
    const updated: GardenLayout = {
      ...currentLayout,
      name: newName,
      updatedAt: Date.now(),
    };
    persistUpdatedLayout(updated);
  };

  const handleDeleteLayout = (layoutId: string) => {
    if (layouts.length <= 1) return;
    const remaining = layouts.filter((l) => l.id !== layoutId);
    setLayouts(remaining);
    saveLocalLayouts(remaining);
    if (user) deleteUserLayout(user.uid, layoutId);
    if (currentLayoutId === layoutId) {
      setCurrentLayoutId(remaining[0].id);
      setSelectedBedId(remaining[0].beds[0]?.id || null);
    }
  };

  // Garden Bed Handlers
  const handleUpdateBedPosition = (bedId: string, x: number, y: number) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => (b.id === bedId ? { ...b, x, y } : b)),
    };
    persistUpdatedLayout(updated);
  };

  const handleCreateBed = (config: BedConfig) => {
    const offsetIndex = currentLayout.beds.length;
    const newBed: GardenBed = {
      id: `bed-${Date.now()}`,
      name: config.name,
      bedType: config.bedType,
      walkwayWidth: config.walkwayWidth,
      width: config.width,
      height: config.height,
      ...(config.bedType === 'arch_box'
        ? { archStart: config.archStart ?? 0, archLength: config.archLength ?? config.height }
        : {}),
      x: 2 + (offsetIndex * 3) % 10,
      y: 2 + Math.floor(offsetIndex / 2) * 5,
      cells: {},
    };
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: [...currentLayout.beds, newBed],
    };
    persistUpdatedLayout(updated);
    setSelectedBedId(newBed.id);
  };

  const handleDeleteBed = (bedId: string) => {
    const updatedBeds = currentLayout.beds.filter((b) => b.id !== bedId);
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: updatedBeds,
    };
    persistUpdatedLayout(updated);
    if (selectedBedId === bedId) {
      setSelectedBedId(updatedBeds[0]?.id || null);
    }
  };

  const handleDuplicateBed = (bedId: string) => {
    const orig = currentLayout.beds.find((b) => b.id === bedId);
    if (!orig) return;
    const copy: GardenBed = {
      ...orig,
      id: `bed-${Date.now()}`,
      name: `${orig.name} (Copy)`,
      x: orig.x + 2,
      y: orig.y + 2,
      cells: { ...orig.cells },
      subdivisions: orig.subdivisions ? { ...orig.subdivisions } : undefined,
      subCells: orig.subCells ? { ...orig.subCells } : undefined,
      cagedCells: orig.cagedCells ? { ...orig.cagedCells } : undefined,
      archCells: orig.archCells ? { ...orig.archCells } : undefined,
    };
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: [...currentLayout.beds, copy],
    };
    persistUpdatedLayout(updated);
    setSelectedBedId(copy.id);
  };

  // Yard Element Handlers
  const handleCreateElement = (
    type: YardElementType,
    name: string,
    width: number,
    height: number,
    surfaceStyle?: SurfaceStyleId
  ) => {
    const existing = currentLayout.elements || [];
    const offset = existing.length;
    const newEl: YardElement = {
      id: `elem-${Date.now()}`,
      type,
      name,
      x: 2 + (offset * 2) % 10,
      y: 2 + (offset * 2) % 8,
      width,
      height,
      surfaceStyle,
    };
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      elements: [...existing, newEl],
    };
    persistUpdatedLayout(updated);
  };

  const handleUpdateElement = (elementId: string, updates: Partial<YardElement>) => {
    const existing = currentLayout.elements || [];
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      elements: existing.map((el) =>
        el.id === elementId ? { ...el, ...updates } : el
      ),
    };
    persistUpdatedLayout(updated);
  };

  const handleDeleteElement = (elementId: string) => {
    const existing = currentLayout.elements || [];
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      elements: existing.filter((el) => el.id !== elementId),
    };
    persistUpdatedLayout(updated);
  };

  const handleDuplicateElement = (elementId: string) => {
    const existing = currentLayout.elements || [];
    const orig = existing.find((el) => el.id === elementId);
    if (!orig) return;
    const copy: YardElement = {
      ...orig,
      id: `elem-${Date.now()}`,
      name: `${orig.name} (Copy)`,
      x: orig.x + 1,
      y: orig.y + 1,
    };
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      elements: [...existing, copy],
    };
    persistUpdatedLayout(updated);
  };

  const handleSetYardDripCell = (coord: string, active: boolean) => {
    setLayouts((prev) => {
      const next = prev.map((l) => {
        if (l.id !== currentLayout.id) return l;
        const nextYardDrip = { ...(l.yardDripCells || {}) };
        if (active) {
          nextYardDrip[coord] = true;
        } else {
          delete nextYardDrip[coord];
        }
        const updated: GardenLayout = {
          ...l,
          updatedAt: Date.now(),
          yardDripCells: nextYardDrip,
        };
        if (user) saveUserLayout(user.uid, updated);
        return updated;
      });
      saveLocalLayouts(next);
      return next;
    });
  };

  const handleClearYardDrip = () => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      yardDripCells: {},
    };
    persistUpdatedLayout(updated);
  };

  const handlePlacePlant = (bedId: string, coord: string, plantId: string | null) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => {
        if (b.id !== bedId) return b;
        if (parsePlantingKey(coord).isSlot) {
          // Sub-slot inside a split square
          const nextSub = { ...(b.subCells || {}) };
          if (plantId === null) {
            delete nextSub[coord];
          } else {
            nextSub[coord] = plantId;
          }
          return { ...b, subCells: nextSub };
        }
        const nextCells = { ...b.cells };
        const nextCaged = { ...(b.cagedCells || {}) };
        if (plantId === null) {
          delete nextCells[coord];
          delete nextCaged[coord];
        } else {
          nextCells[coord] = plantId;
          // Reset manual cage override when placing a new plant so default `needsCage` applies
          delete nextCaged[coord];
        }
        return { ...b, cells: nextCells, cagedCells: nextCaged };
      }),
    };
    persistUpdatedLayout(updated);
  };

  /** Sets the N×N planting grid for one square, or for every square when coord === 'all' */
  const handleSetSquareDivision = (bedId: string, coord: string | 'all', n: number) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => {
        if (b.id !== bedId) return b;
        if (coord !== 'all') return applySquareDivision(b, [coord], n);
        const all: string[] = [];
        for (let r = 0; r < b.height; r++) {
          for (let c = 0; c < b.width; c++) all.push(`${c},${r}`);
        }
        return applySquareDivision(b, all, n);
      }),
    };
    persistUpdatedLayout(updated);
  };

  const handleToggleCage = (bedId: string, coord: string) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => {
        if (b.id !== bedId) return b;
        const plant = getSquareRepresentativePlant(b, coord);
        const currentlyHasCage = doesCellHaveCage(b, coord, plant);
        return {
          ...b,
          cagedCells: {
            ...(b.cagedCells || {}),
            [coord]: !currentlyHasCage,
          },
        };
      }),
    };
    persistUpdatedLayout(updated);
  };

  const handleToggleArchCell = (bedId: string, coord: string) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => {
        if (b.id !== bedId) return b;
        const [c, r] = coord.split(',').map(Number);
        const currentlyUnderArch = isCellUnderArch(b, c, r);
        return {
          ...b,
          archCells: {
            ...(b.archCells || {}),
            [coord]: !currentlyUnderArch,
          },
        };
      }),
    };
    persistUpdatedLayout(updated);
  };

  const handleToggleDripCell = (bedId: string, coord: string) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => {
        if (b.id !== bedId) return b;
        const currentlyHasDrip = doesCellHaveDrip(b, coord);
        return {
          ...b,
          dripCells: {
            ...(b.dripCells || {}),
            [coord]: !currentlyHasDrip,
          },
        };
      }),
    };
    persistUpdatedLayout(updated);
  };

  const handleChangeBedIrrigation = (
    bedId: string,
    irrigationType: BedIrrigationType
  ) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) =>
        b.id === bedId ? { ...b, irrigationType, dripCells: {} } : b
      ),
    };
    persistUpdatedLayout(updated);
  };

  const handleClearBed = (bedId: string) => {
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) =>
        b.id === bedId
          ? { ...b, cells: {}, subCells: {}, subdivisions: {}, cagedCells: {}, archCells: {} }
          : b
      ),
    };
    persistUpdatedLayout(updated);
  };

  const handleResizeOrRenameBed = (bedId: string, config: BedConfig) => {
    const { name, width, height, bedType, walkwayWidth, archStart, archLength } = config;
    const inBounds = (coord: string) => {
      const { col, row } = parsePlantingKey(coord);
      return col < width && row < height;
    };
    const updated: GardenLayout = {
      ...currentLayout,
      updatedAt: Date.now(),
      beds: currentLayout.beds.map((b) => {
        if (b.id !== bedId) return b;
        const trimmedCells: Record<string, string> = {};
        for (const [coord, pid] of Object.entries(b.cells)) {
          if (inBounds(coord)) trimmedCells[coord] = pid;
        }
        const trimmedSubdivisions: Record<string, number> = {};
        for (const [coord, n] of Object.entries(b.subdivisions || {})) {
          if (inBounds(coord)) trimmedSubdivisions[coord] = n;
        }
        const trimmedSubCells: Record<string, string> = {};
        for (const [key, pid] of Object.entries(b.subCells || {})) {
          if (inBounds(key)) trimmedSubCells[key] = pid;
        }
        return {
          ...b,
          name,
          width,
          height,
          bedType,
          walkwayWidth,
          archStart: bedType === 'arch_box' ? archStart ?? 0 : b.archStart,
          archLength: bedType === 'arch_box' ? archLength ?? height : b.archLength,
          cells: trimmedCells,
          subdivisions: trimmedSubdivisions,
          subCells: trimmedSubCells,
        };
      }),
    };
    persistUpdatedLayout(updated);
  };

  const handleSignIn = async () => {
    const profile = await signInWithGoogle();
    setUser(profile);
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      {/* Mobile-first container with max-width for larger screens */}
      <div className="w-full md:max-w-[1280px] mx-auto">
        <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        layouts={layouts}
        currentLayout={currentLayout}
        onSelectLayout={handleSelectLayout}
        onCreateLayout={handleCreateLayout}
        onDuplicateLayout={handleDuplicateLayout}
        onRenameLayout={handleRenameLayout}
        onDeleteLayout={handleDeleteLayout}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        activeBedName={activeBed?.name}
      />

      <main className="flex-1">
        {activeTab === 'overview' && (
          <YardOverview
            layout={currentLayout}
            beds={currentLayout.beds}
            elements={currentLayout.elements || []}
            yardDripCells={currentLayout.yardDripCells || {}}
            selectedBedId={activeBed?.id || null}
            onSelectAndEditBed={(bedId) => {
              setSelectedBedId(bedId);
              setActiveTab('editor');
            }}
            onUpdateBedPosition={handleUpdateBedPosition}
            onCreateBed={handleCreateBed}
            onDeleteBed={handleDeleteBed}
            onDuplicateBed={handleDuplicateBed}
            onCreateElement={handleCreateElement}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onSetYardDripCell={handleSetYardDripCell}
            onClearYardDrip={handleClearYardDrip}
          />
        )}

        {activeTab === 'editor' && (
          activeBed ? (
            <BedEditor
              beds={currentLayout.beds}
              activeBed={activeBed}
              onSelectBed={(bedId) => setSelectedBedId(bedId)}
              onBackToOverview={() => setActiveTab('overview')}
              onOpenPlantGuide={(plantId) => {
                if (plantId) setFocusedGuidePlantId(plantId);
                setActiveTab('guide');
              }}
              onPlacePlant={handlePlacePlant}
              onToggleCage={handleToggleCage}
              onToggleArchCell={handleToggleArchCell}
              onToggleDripCell={handleToggleDripCell}
              onChangeBedIrrigation={handleChangeBedIrrigation}
              onClearBed={handleClearBed}
              onResizeOrRenameBed={handleResizeOrRenameBed}
              onSetSquareDivision={handleSetSquareDivision}
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-stone-600 mb-4">
                No garden beds exist in this layout yet.
              </p>
              <button
                onClick={() => {
                  handleCreateBed({
                    name: 'Raised Bed #1',
                    width: 4,
                    height: 4,
                    bedType: 'standard',
                    walkwayWidth: 2,
                  });
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-sm"
              >
                + Create a 4×4 ft Garden Bed
              </button>
            </div>
          )
        )}

        {activeTab === 'guide' && (
          <PlantGuidePage
            initialFocusedPlantId={focusedGuidePlantId}
            onClearFocusedPlant={() => setFocusedGuidePlantId(null)}
          />
        )}
      </main>
    </div>
  </div>
);
};

