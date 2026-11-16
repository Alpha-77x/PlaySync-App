import type { ArenaModeId } from '../engine/arenaLogic';

export type AvatarId =
  | 'apex-visor'
  | 'cyber-helm'
  | 'cryo-fox'
  | 'rail-knight'
  | 'nova-spark'
  | 'orbit-crest'
  | 'drift-crown'
  | 'void-hawk';

export interface AvatarOption {
  id: AvatarId;
  label: string;
  role: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'apex-visor', label: 'Apex Visor', role: 'Circuit Ace' },
  { id: 'cyber-helm', label: 'Cyber Helm', role: 'Neon Pilot' },
  { id: 'cryo-fox', label: 'Cryo Fox', role: 'Drift Specialist' },
  { id: 'rail-knight', label: 'Rail Knight', role: 'Tank Commander' },
  { id: 'nova-spark', label: 'Nova Spark', role: 'Zero-G Striker' },
  { id: 'orbit-crest', label: 'Orbit Crest', role: 'Squad Captain' },
  { id: 'drift-crown', label: 'Drift Crown', role: 'Arena Champion' },
  { id: 'void-hawk', label: 'Void Hawk', role: 'Interceptor' },
];

export const AVATAR_COLORS = [
  { name: 'Cyber Cyan', hex: '#00f5ff' },
  { name: 'Crimson Rosso', hex: '#ef1a4b' },
  { name: 'Solar Amber', hex: '#ffb703' },
  { name: 'Emerald Pulse', hex: '#00f5a0' },
  { name: 'Ultraviolet', hex: '#8b5cf6' },
  { name: 'Electric Coral', hex: '#fb7185' },
] as const;

export interface CareerStats {
  gamesPlayed: number;
  wins: number;
  bestScore: number;
  totalScore: number;
  totalDriftPoints: number;
  modeGames: Record<ArenaModeId, number>;
}

export interface PlayerProfile {
  nickname: string;
  avatarId: AvatarId;
  avatarColor: string;
  stats: CareerStats;
}

export const PROFILE_STORAGE_KEY = 'playsync.profile.v1';

export function createDefaultProfile(): PlayerProfile {
  return {
    nickname: 'Host Console',
    avatarId: 'apex-visor',
    avatarColor: '#00f5ff',
    stats: {
      gamesPlayed: 0,
      wins: 0,
      bestScore: 0,
      totalScore: 0,
      totalDriftPoints: 0,
      modeGames: {
        f1: 0,
        tank: 0,
        ice: 0,
        zerog: 0,
      },
    },
  };
}

export function sanitizeNickname(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, 18);
  return cleaned || 'Host Console';
}

export function computeWinRate(stats: Pick<CareerStats, 'gamesPlayed' | 'wins'>): number {
  if (stats.gamesPlayed <= 0) return 0;
  return Math.round((Math.max(0, stats.wins) / stats.gamesPlayed) * 100);
}

export function recordMatchOutcome(
  profile: PlayerProfile,
  outcome: {
    modeId: ArenaModeId;
    score: number;
    driftPoints: number;
    won: boolean;
  }
): PlayerProfile {
  const safeScore = Math.max(0, Math.round(outcome.score));
  const safeDrift = Math.max(0, Math.round(outcome.driftPoints));
  return {
    ...profile,
    stats: {
      gamesPlayed: profile.stats.gamesPlayed + 1,
      wins: profile.stats.wins + (outcome.won ? 1 : 0),
      bestScore: Math.max(profile.stats.bestScore, safeScore),
      totalScore: profile.stats.totalScore + safeScore,
      totalDriftPoints: profile.stats.totalDriftPoints + safeDrift,
      modeGames: {
        ...profile.stats.modeGames,
        [outcome.modeId]: (profile.stats.modeGames[outcome.modeId] ?? 0) + 1,
      },
    },
  };
}

export function resetCareerStats(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    stats: createDefaultProfile().stats,
  };
}

export function parseStoredProfile(raw: string | null): PlayerProfile {
  const fallback = createDefaultProfile();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const validAvatar = AVATAR_OPTIONS.some((a) => a.id === parsed.avatarId)
      ? (parsed.avatarId as AvatarId)
      : fallback.avatarId;
    const validColor =
      typeof parsed.avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.avatarColor)
        ? parsed.avatarColor
        : fallback.avatarColor;
    const rawStats = parsed.stats;
    return {
      nickname: sanitizeNickname(typeof parsed.nickname === 'string' ? parsed.nickname : fallback.nickname),
      avatarId: validAvatar,
      avatarColor: validColor,
      stats: {
        gamesPlayed: Math.max(0, Number(rawStats?.gamesPlayed) || 0),
        wins: Math.max(0, Number(rawStats?.wins) || 0),
        bestScore: Math.max(0, Number(rawStats?.bestScore) || 0),
        totalScore: Math.max(0, Number(rawStats?.totalScore) || 0),
        totalDriftPoints: Math.max(0, Number(rawStats?.totalDriftPoints) || 0),
        modeGames: {
          f1: Math.max(0, Number(rawStats?.modeGames?.f1) || 0),
          tank: Math.max(0, Number(rawStats?.modeGames?.tank) || 0),
          ice: Math.max(0, Number(rawStats?.modeGames?.ice) || 0),
          zerog: Math.max(0, Number(rawStats?.modeGames?.zerog) || 0),
        },
      },
    };
  } catch {
    return fallback;
  }
}

export function loadPlayerProfile(storage?: Pick<Storage, 'getItem'>): PlayerProfile {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return createDefaultProfile();
    return parseStoredProfile(store.getItem(PROFILE_STORAGE_KEY));
  } catch {
    return createDefaultProfile();
  }
}

export function savePlayerProfile(
  profile: PlayerProfile,
  storage?: Pick<Storage, 'setItem'>
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    store.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota / private mode failures
  }
}
