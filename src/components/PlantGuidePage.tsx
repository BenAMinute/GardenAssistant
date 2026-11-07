import React, { useEffect, useState } from 'react';
import {
  Search,
  Sun,
  CheckCircle2,
  XCircle,
  Sprout,
  RotateCcw,
  X,
  Grid,
} from 'lucide-react';
import { FAMILY_MAP, PLANT_FAMILIES, PLANT_MAP, PLANTS, WATER_NEED_META } from '../data/plants';
import { PlantFamilyId, PlantInfo } from '../types/garden';
import { getRelationshipReason } from '../utils/companionChecker';

interface PlantGuidePageProps {
  initialFocusedPlantId?: string | null;
  onClearFocusedPlant?: () => void;
}

export const PlantGuidePage: React.FC<PlantGuidePageProps> = ({
  initialFocusedPlantId,
  onClearFocusedPlant,
}) => {
  const [search, setSearch] = useState('');
  const [activeFamily, setActiveFamily] = useState<PlantFamilyId | 'all'>('all');
  const [modalPlant, setModalPlant] = useState<PlantInfo | null>(null);

  useEffect(() => {
    if (initialFocusedPlantId && PLANT_MAP[initialFocusedPlantId]) {
      setModalPlant(PLANT_MAP[initialFocusedPlantId]);
      if (onClearFocusedPlant) onClearFocusedPlant();
    }
  }, [initialFocusedPlantId, onClearFocusedPlant]);

  const visibleFamilies = PLANT_FAMILIES.filter(
    (fam) => activeFamily === 'all' || fam.id === activeFamily
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 md:pb-12 bg-stone-50">
      {/* Hero Banner & Search */}
      <div className="bg-emerald-900 text-white border-b border-emerald-800 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-800 text-emerald-200 text-xs font-semibold mb-2">
                <Sprout className="w-3.5 h-3.5" />
                Botanical Families &amp; Companion Reference
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Garden Plant Families &amp; Cross-Planting Guide
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-2xl">
                Browse common garden plants grouped by their botanical families, square-foot spacing, beneficial companions, and incompatible neighbors to avoid.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-emerald-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plant (e.g. Tomato, Basil, Onion)..."
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-white placeholder:text-emerald-300/60 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Family Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mt-5 pb-1">
            <button
              onClick={() => setActiveFamily('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${
                activeFamily === 'all'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-800'
              }`}
            >
              All Plant Families ({PLANT_FAMILIES.length})
            </button>
            {PLANT_FAMILIES.map((fam) => {
              const count = PLANTS.filter((p) => p.family === fam.id).length;
              return (
                <button
                  key={fam.id}
                  onClick={() => setActiveFamily(fam.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${
                    activeFamily === fam.id
                      ? 'bg-white text-emerald-950 shadow-xs'
                      : 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-800'
                  }`}
                >
                  {fam.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Family Grids Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-8">
        {visibleFamilies.map((family) => {
          const familyPlants = PLANTS.filter((p) => {
            if (p.family !== family.id) return false;
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            const matchesName = p.name.toLowerCase().includes(q);
            const matchesFamily =
              family.name.toLowerCase().includes(q) ||
              family.scientificName.toLowerCase().includes(q);
            const matchesCompanion = p.companions.some((cid) =>
              PLANT_MAP[cid]?.name.toLowerCase().includes(q)
            );
            return matchesName || matchesFamily || matchesCompanion;
          });

          if (familyPlants.length === 0) return null;

          return (
            <section
              key={family.id}
              className={`rounded-3xl border-2 p-4 sm:p-6 shadow-xs ${family.themeColor}`}
            >
              {/* Family Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 mb-5 border-b border-stone-200/80">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                      {family.name}
                    </h3>
                    <span
                      className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full ${family.badgeBg} ${family.badgeText}`}
                    >
                      {family.scientificName}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1">
                    {family.description}
                  </p>
                </div>

                {/* Family Rotation / Companion Tip Box */}
                <div className="bg-white/90 rounded-2xl p-3 border border-stone-200/90 lg:max-w-md flex items-start gap-2.5 text-xs text-stone-700 shrink-0">
                  <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-900 block">
                      Family &amp; Rotation Rule:
                    </span>
                    {family.rotationTips}
                  </div>
                </div>
              </div>

              {/* Grid of Plants in this Family */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {familyPlants.map((plant) => (
                  <div
                    key={plant.id}
                    className="bg-white rounded-2xl border border-stone-200/90 shadow-xs hover:shadow-md transition flex flex-col justify-between p-4"
                  >
                    <div>
                      {/* Card Top: Emoji, Name, Spacing, Sun */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-3xl shrink-0">
                            {plant.emoji}
                          </div>
                          <div>
                            <h4 className="font-bold text-base text-stone-900 leading-snug">
                              {plant.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                                <Grid className="w-3 h-3" />
                                {plant.perSquareFoot} / sq ft
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                  WATER_NEED_META[plant.waterNeed].badgeBg
                                } ${WATER_NEED_META[plant.waterNeed].badgeText}`}
                                title={WATER_NEED_META[plant.waterNeed].description}
                              >
                                {WATER_NEED_META[plant.waterNeed].drops}{' '}
                                {WATER_NEED_META[plant.waterNeed].shortLabel} Water
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                                <Sun className="w-3 h-3 text-amber-500" />
                                {plant.sun}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setModalPlant(plant)}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition shrink-0"
                        >
                          Details
                        </button>
                      </div>

                      {/* Plant Summary */}
                      <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                        {plant.summary}
                      </p>

                      {/* Grows Well With (Companions) */}
                      <div className="mt-3.5 pt-3 border-t border-stone-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Grows Well With ({plant.companions.length})</span>
                        </div>
                        {plant.companions.length === 0 ? (
                          <span className="text-xs text-stone-400 italic">None listed</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {plant.companions.map((compId) => {
                              const comp = PLANT_MAP[compId];
                              if (!comp) return null;
                              return (
                                <button
                                  key={compId}
                                  type="button"
                                  onClick={() => setModalPlant(comp)}
                                  title={getRelationshipReason(plant, comp, 'companion')}
                                  className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[11px] font-medium flex items-center gap-1 transition"
                                >
                                  <span>{comp.emoji}</span>
                                  <span>{comp.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Keep Away From (Antagonists) */}
                      <div className="mt-3 pt-2.5 border-t border-stone-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 mb-1.5">
                          <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>Do Not Plant With ({plant.antagonists.length})</span>
                        </div>
                        {plant.antagonists.length === 0 ? (
                          <span className="text-xs text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded-md inline-block">
                            Friendly with almost all garden neighbors!
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {plant.antagonists.map((antId) => {
                              const ant = PLANT_MAP[antId];
                              if (!ant) return null;
                              return (
                                <button
                                  key={antId}
                                  type="button"
                                  onClick={() => setModalPlant(ant)}
                                  title={getRelationshipReason(plant, ant, 'antagonist')}
                                  className="px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 text-[11px] font-medium flex items-center gap-1 transition"
                                >
                                  <span>{ant.emoji}</span>
                                  <span>{ant.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Detailed Plant Compatibility Modal */}
      {modalPlant && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalPlant(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-4xl">
                  {modalPlant.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-stone-900">
                      {modalPlant.name}
                    </h3>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        FAMILY_MAP[modalPlant.family].badgeBg
                      } ${FAMILY_MAP[modalPlant.family].badgeText}`}
                    >
                      {FAMILY_MAP[modalPlant.family].name} (
                      {FAMILY_MAP[modalPlant.family].scientificName})
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Recommended Spacing: <strong>{modalPlant.perSquareFoot} per sq ft</strong> •{' '}
                    {modalPlant.sun}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalPlant(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-stone-700 mt-4 leading-relaxed bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80">
              {modalPlant.summary}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Detailed Companions */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5">
                <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5 mb-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Best Companion Plants ({modalPlant.companions.length})</span>
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {modalPlant.companions.map((cid) => {
                    const cp = PLANT_MAP[cid];
                    if (!cp) return null;
                    return (
                      <div
                        key={cid}
                        onClick={() => setModalPlant(cp)}
                        className="bg-white p-2.5 rounded-xl border border-emerald-200/80 hover:border-emerald-400 cursor-pointer transition"
                      >
                        <div className="font-bold text-xs text-stone-900 flex items-center justify-between">
                          <span>
                            {cp.emoji} {cp.name}
                          </span>
                          <span className="text-[10px] text-stone-400 font-normal">
                            {FAMILY_MAP[cp.family].name.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          {getRelationshipReason(modalPlant, cp, 'companion')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Antagonists */}
              <div className="bg-red-50/60 border border-red-200 rounded-2xl p-3.5">
                <h4 className="font-bold text-sm text-red-900 flex items-center gap-1.5 mb-2.5">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>Incompatible Plants ({modalPlant.antagonists.length})</span>
                </h4>
                {modalPlant.antagonists.length === 0 ? (
                  <p className="text-xs text-stone-600">
                    {modalPlant.name} has no major incompatible garden neighbors!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {modalPlant.antagonists.map((aid) => {
                      const ap = PLANT_MAP[aid];
                      if (!ap) return null;
                      return (
                        <div
                          key={aid}
                          onClick={() => setModalPlant(ap)}
                          className="bg-white p-2.5 rounded-xl border border-red-200/80 hover:border-red-400 cursor-pointer transition"
                        >
                          <div className="font-bold text-xs text-red-900 flex items-center justify-between">
                            <span>
                              {ap.emoji} {ap.name}
                            </span>
                            <span className="text-[10px] text-stone-400 font-normal">
                              {FAMILY_MAP[ap.family].name.split(' ')[0]}
                            </span>
                          </div>
                          <p className="text-[11px] text-red-800/90 mt-0.5">
                            {getRelationshipReason(modalPlant, ap, 'antagonist')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
