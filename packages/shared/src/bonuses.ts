import { MapTheme } from './constants';

export const BONUS_IDS = [
  'CHAMPIGNON',
  'EPIS_MAIS',
  'PLUME',
  'MIEL',
  'TREFLE',
  'BATTERIE',
  'BIDON_ESSENCE',
  'ROLLERS',
  'GILET',
  'SAC_POUBELLE',
  'BRIQUE',
  'COFFRE',
] as const;

export type BonusId = typeof BONUS_IDS[number];

export interface BonusEffect {
  bombs?: number;
  range?: number;
  speed?: number;
  hp?: number;
}

export interface BonusInfo {
  image: string;
  label: string;
  description: string;
  effect: BonusEffect;
  durationMs?: number;
}

export const BONUSES: Record<BonusId, BonusInfo> = {
  CHAMPIGNON: {
    image: 'champignon.png',
    label: 'Champignon',
    description: '+1 bombe',
    effect: { bombs: 1 },
  },
  EPIS_MAIS: {
    image: 'epis de maïs.png',
    label: 'Épi de maïs',
    description: '+1 portée',
    effect: { range: 1 },
  },
  PLUME: {
    image: 'plume.png',
    label: 'Plume',
    description: '+20 % vitesse',
    effect: { speed: 0.2 },
  },
  MIEL: {
    image: 'miel.png',
    label: 'Pot de miel',
    description: '+1 PV (max 2)',
    effect: { hp: 1 },
  },
  TREFLE: {
    image: 'trefle.png',
    label: 'Trèfle à 4 feuilles',
    description: '+2 bombes et +2 portée',
    effect: { bombs: 2, range: 2 },
  },
  BATTERIE: {
    image: 'Batterie.png',
    label: 'Batterie',
    description: '+1 bombe',
    effect: { bombs: 1 },
  },
  BIDON_ESSENCE: {
    image: 'bidon essence.png',
    label: "Bidon d'essence",
    description: '+1 portée',
    effect: { range: 1 },
  },
  ROLLERS: {
    image: 'roller.png',
    label: 'Rollers',
    description: '+20 % vitesse',
    effect: { speed: 0.2 },
  },
  GILET: {
    image: 'gilet.png',
    label: 'Gilet réfléchissant',
    description: '+1 PV (max 2)',
    effect: { hp: 1 },
  },
  SAC_POUBELLE: {
    image: 'sac poubelle.png',
    label: 'Sac poubelle',
    description: '-20 % vitesse pendant 5 s',
    effect: { speed: -0.2 },
    durationMs: 5000,
  },
  BRIQUE: {
    image: 'brique.png',
    label: 'Brique dans le sac',
    description: '-1 portée',
    effect: { range: -1 },
  },
  COFFRE: {
    image: 'coffre.png',
    label: 'Coffre doré',
    description: '+2 bombes et +2 portée',
    effect: { bombs: 2, range: 2 },
  },
};

export interface WeightedBonus {
  id: BonusId;
  weight: number;
}

export const BONUS_POOL_BY_THEME: Record<MapTheme, WeightedBonus[]> = {
  CAMPAGNE: [
    { id: 'CHAMPIGNON', weight: 4 },
    { id: 'EPIS_MAIS', weight: 4 },
    { id: 'PLUME', weight: 4 },
    { id: 'MIEL', weight: 4 },
    { id: 'TREFLE', weight: 0 },
  ],
  URBAN: [
    { id: 'BATTERIE', weight: 4 },
    { id: 'BIDON_ESSENCE', weight: 4 },
    { id: 'ROLLERS', weight: 4 },
    { id: 'GILET', weight: 4 },
    { id: 'SAC_POUBELLE', weight: 1 },
    { id: 'BRIQUE', weight: 1 },
    { id: 'COFFRE', weight: 0 },
  ],
};

export const SPECIAL_BONUS_BY_THEME: Record<MapTheme, BonusId> = {
  CAMPAGNE: 'TREFLE',
  URBAN: 'COFFRE',
};

export function themeBonusIds(theme: MapTheme): BonusId[] {
  return BONUS_POOL_BY_THEME[theme].map((entry) => entry.id);
}

export function drawBonus(theme: MapTheme, random: () => number = Math.random): BonusId {
  const pool = BONUS_POOL_BY_THEME[theme].filter((entry) => entry.weight > 0);
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let draw = random() * total;

  for (const entry of pool) {
    draw -= entry.weight;
    if (draw < 0) return entry.id;
  }

  return pool[pool.length - 1].id;
}

export function bonusImageUrl(id: BonusId): string {
  return `../../../assets/Bonus/${encodeURIComponent(BONUSES[id].image)}`;
}
