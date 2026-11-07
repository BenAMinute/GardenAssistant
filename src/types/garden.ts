export type PlantFamilyId =
  | 'nightshade'
  | 'brassica'
  | 'allium'
  | 'legume'
  | 'cucurbit'
  | 'umbellifer'
  | 'leafy'
  | 'herb_flower';

export interface PlantFamilyInfo {
  id: PlantFamilyId;
  name: string;
  scientificName: string;
  description: string;
  rotationTips: string;
  themeColor: string;
  badgeBg: string;
  badgeText: string;
}

export type WaterNeedLevel = 'low' | 'medium' | 'high';

export interface PlantInfo {
  id: string;
  name: string;
  family: PlantFamilyId;
  category: 'vegetable' | 'herb' | 'fruit' | 'flower';
  emoji: string;
  color: string;
  perSquareFoot: 1 | 2 | 4 | 9 | 16;
  waterNeed: WaterNeedLevel;
  needsCage?: boolean;
  climbsArch?: boolean;
  supportNote?: string;
  companions: string[];
  antagonists: string[];
  companionReasons?: Record<string, string>;
  antagonistReasons?: Record<string, string>;
  summary: string;
  sun: 'Full Sun' | 'Part Shade' | 'Full Sun / Part Shade';
}

export type GardenBedType = 'standard' | 'arch_box' | 'tomato_arch';
export type BedIrrigationType = 'none' | 'drip_lines' | 'soaker_hose' | 'micro_sprayers';

export interface GardenBed {
  id: string;
  name: string;
  bedType?: GardenBedType;
  walkwayWidth?: number;
  irrigationType?: BedIrrigationType; // Bed-wide irrigation mode
  width: number;
  height: number;
  x: number;
  y: number;
  cells: Record<string, string>;        // "col,row" -> plantId
  cagedCells?: Record<string, boolean>; // "col,row" -> true if caged
  archCells?: Record<string, boolean>;  // "col,row" -> true if under a tomato arch trellis
  dripCells?: Record<string, boolean>;  // "col,row" -> true if custom drip emitter / line on cell
}

export type YardElementCategory =
  | 'pathway'
  | 'ground'
  | 'structure'
  | 'utility';

export type YardElementType =
  // Pathways
  | 'gravel_path'
  | 'mulch_path'
  | 'brick_path'
  | 'flagstone_path'
  | 'wood_deck_path'
  // Ground & Lawn Panels
  | 'grass_panel'
  | 'clover_lawn'
  | 'soil_area'
  // Structures & Buildings
  | 'shed'
  | 'building'
  | 'greenhouse'
  | 'tomato_arch_structure'
  | 'patio'
  | 'pergola'
  | 'chicken_coop'
  | 'fence'
  // Yard Utilities & Trees & Irrigation
  | 'tree_canopy'
  | 'compost'
  | 'rain_barrel'
  | 'water_spigot'
  | 'irrigation_line'
  | 'irrigation_timer'
  | 'fire_pit'
  | 'bench';

export type SurfaceStyleId =
  | 'gravel_grey'
  | 'gravel_tan'
  | 'gravel_white'
  | 'mulch_dark'
  | 'mulch_cedar'
  | 'mulch_red'
  | 'paver_brick'
  | 'paver_slate'
  | 'wood_cedar'
  | 'grass_lush'
  | 'grass_clover'
  | 'custom_color';

export interface YardElement {
  id: string;
  type: YardElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  surfaceStyle?: SurfaceStyleId;
  customColor?: string;
}

export interface GardenLayout {
  id: string;
  name: string;
  updatedAt: number;
  beds: GardenBed[];
  elements?: YardElement[];
  yardDripCells?: Record<string, boolean>; // "x,y" yard grid coordinates (1 unit = 1 linear ft of routed drip line)
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isDemo?: boolean;
}

export interface NeighborRelation {
  neighborCoord: string;
  neighborPlant: PlantInfo;
  type: 'companion' | 'antagonist' | 'water_mismatch';
  reason: string;
}

export interface CellEvaluation {
  coord: string;
  plant: PlantInfo;
  conflicts: NeighborRelation[];
  waterMismatches: NeighborRelation[];
  synergies: NeighborRelation[];
}
