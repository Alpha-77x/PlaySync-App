import React, { useEffect, useState } from 'react';
import { Award, Check, Flame, Orbit, RotateCcw, Shield, Snowflake, Trophy, User, X } from 'lucide-react';
import { ARENA_MODES, ARENA_MODE_ORDER, type ArenaModeId } from '../engine/arenaLogic';
import { triggerHaptic } from '../utils/haptics';
import {
  AVATAR_COLORS,
  AVATAR_OPTIONS,
  type AvatarId,
  type PlayerProfile,
  computeWinRate,
  sanitizeNickname,
} from '../utils/playerProfile';
import { soundEngine } from '../utils/soundEngine';
import { PilotAvatar } from './PilotAvatar';

interface ProfileModalProps {
  isOpen: boolean;
  profile: PlayerProfile;
  sfxEnabled: boolean;
  hapticsEnabled: boolean;
  onClose: () => void;
  onSaveProfile: (next: { nickname: string; avatarId: AvatarId; avatarColor: string }) => void;
  onResetStats: () => void;
}

const MODE_MINI_ICONS: Record<ArenaModeId, React.ComponentType<{ className?: string }>> = {
  f1: Flame,
  tank: Shield,
  ice: Snowflake,
  zerog: Orbit,
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  profile,
  sfxEnabled,
  hapticsEnabled,
  onClose,
  onSaveProfile,
  onResetStats,
}) => {
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarId, setAvatarId] = useState<AvatarId>(profile.avatarId);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);
  const [activeTab, setActiveTab] = useState<'customize' | 'career'>('customize');
  const [confirmReset, setConfirmReset] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNickname(profile.nickname);
      setAvatarId(profile.avatarId);
      setAvatarColor(profile.avatarColor);
      setConfirmReset(false);
      setSavedNotice(false);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const winRate = computeWinRate(profile.stats);
  const selectedAvatarMeta = AVATAR_OPTIONS.find((a) => a.id === avatarId) ?? AVATAR_OPTIONS[0];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('switch', hapticsEnabled);
    soundEngine.playJoinChime(sfxEnabled);
    onSaveProfile({
      nickname: sanitizeNickname(nickname),
      avatarId,
      avatarColor,
    });
    setSavedNotice(true);
    window.setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 550);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-[#050609] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PilotAvatar avatarId={avatarId} color={avatarColor} size="md" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Pilot Identity & Career
              </div>
              <h2 id="profile-modal-title" className="text-lg sm:text-xl font-black text-white truncate">
                {sanitizeNickname(nickname)}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('tap', hapticsEnabled);
              soundEngine.playClick(sfxEnabled);
              onClose();
            }}
            aria-label="Close pilot profile modal"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Tab Switcher */}
        <div className="px-6 pt-4 flex gap-2 bg-black">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('tap', hapticsEnabled);
              soundEngine.playClick(sfxEnabled);
              setActiveTab('customize');
            }}
            className={`flex-1 min-h-[42px] rounded-xl text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'customize'
                ? 'bg-cyan-400 text-black'
                : 'bg-zinc-950 border border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Customize Pilot</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('tap', hapticsEnabled);
              soundEngine.playClick(sfxEnabled);
              setActiveTab('career');
            }}
            className={`flex-1 min-h-[42px] rounded-xl text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'career'
                ? 'bg-cyan-400 text-black'
                : 'bg-zinc-950 border border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Career Stats ({profile.stats.gamesPlayed})</span>
          </button>
        </div>

        {activeTab === 'customize' ? (
          <form onSubmit={handleSave} className="p-6 space-y-5 bg-black">
            {/* Permanent Nickname Input */}
            <div>
              <label
                htmlFor="profile-nickname-input"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Permanent Nickname
              </label>
              <input
                id="profile-nickname-input"
                type="text"
                maxLength={18}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your permanent callsign"
                className="w-full min-h-[46px] rounded-2xl bg-[#090b10] border border-white/15 px-4 text-sm font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Avatar Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Select Pilot Emblem
                </span>
                <span className="text-xs font-semibold text-cyan-300">
                  {selectedAvatarMeta.label} · {selectedAvatarMeta.role}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {AVATAR_OPTIONS.map((opt) => {
                  const selected = avatarId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap', hapticsEnabled);
                        soundEngine.playClick(sfxEnabled);
                        setAvatarId(opt.id);
                      }}
                      aria-pressed={selected}
                      aria-label={`Select ${opt.label} avatar`}
                      className={`rounded-2xl p-2.5 border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        selected
                          ? 'bg-zinc-900 border-cyan-400 shadow-lg shadow-cyan-500/10'
                          : 'bg-[#07080c] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <PilotAvatar avatarId={opt.id} color={avatarColor} size="md" />
                      <span className="text-[11px] font-bold text-zinc-200 truncate w-full text-center">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Avatar Accent Ring */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Emblem Aura Color
              </span>
              <div className="flex flex-wrap gap-2.5">
                {AVATAR_COLORS.map((c) => {
                  const active = avatarColor === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap', hapticsEnabled);
                        soundEngine.playClick(sfxEnabled);
                        setAvatarColor(c.hex);
                      }}
                      aria-pressed={active}
                      aria-label={`Select ${c.name} emblem color`}
                      style={{ backgroundColor: c.hex }}
                      className={`w-9 h-9 rounded-xl border-2 transition-transform cursor-pointer flex items-center justify-center ${
                        active ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      {active && <Check className="w-4 h-4 text-black stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-profile-btn"
                className="min-h-[44px] px-6 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
              >
                {savedNotice ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5 bg-black">
            {/* Primary Career Readouts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-[#07080c] border border-white/10 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Games Played
                </div>
                <div
                  data-testid="career-games-played"
                  className="text-2xl font-black font-mono-code text-white tabular-nums mt-1"
                >
                  {profile.stats.gamesPlayed}
                </div>
              </div>
              <div className="rounded-2xl bg-[#07080c] border border-white/10 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Win Rate
                </div>
                <div
                  data-testid="career-win-rate"
                  className="text-2xl font-black font-mono-code text-emerald-400 tabular-nums mt-1"
                >
                  {winRate}%
                </div>
              </div>
              <div className="rounded-2xl bg-[#07080c] border border-white/10 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Best Score
                </div>
                <div className="text-2xl font-black font-mono-code text-cyan-400 tabular-nums mt-1">
                  {profile.stats.bestScore}
                </div>
              </div>
              <div className="rounded-2xl bg-[#07080c] border border-white/10 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Drift Pts
                </div>
                <div className="text-2xl font-black font-mono-code text-amber-400 tabular-nums mt-1">
                  {profile.stats.totalDriftPoints}
                </div>
              </div>
            </div>

            {/* Win Rate Progress Meter */}
            <div className="rounded-2xl bg-[#07080c] border border-white/10 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300 inline-flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  Arena Victories ({profile.stats.wins} Wins / {profile.stats.gamesPlayed} Matches)
                </span>
                <span className="font-mono-code font-bold text-emerald-400">{winRate}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                <div
                  style={{ width: `${Math.max(profile.stats.gamesPlayed > 0 ? 4 : 0, winRate)}%` }}
                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                />
              </div>
            </div>

            {/* Per-Arena Breakdown */}
            <div className="grid grid-cols-2 gap-2.5">
              {ARENA_MODE_ORDER.map((id) => {
                const m = ARENA_MODES[id];
                const Icon = MODE_MINI_ICONS[id];
                const count = profile.stats.modeGames[id] ?? 0;
                return (
                  <div
                    key={id}
                    className="rounded-2xl bg-[#07080c] border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span style={{ color: m.accentColor }} className="shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-zinc-200 truncate">{m.title}</span>
                    </div>
                    <span className="font-mono-code text-xs font-extrabold text-zinc-400 shrink-0">
                      {count}x
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Inline Reset Stats Confirmation */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[40px] px-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-400 hover:text-rose-400 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Career Stats</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 font-semibold">Reset all stats?</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('switch', hapticsEnabled);
                      soundEngine.playClick(sfxEnabled);
                      onResetStats();
                      setConfirmReset(false);
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[36px] px-3 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
