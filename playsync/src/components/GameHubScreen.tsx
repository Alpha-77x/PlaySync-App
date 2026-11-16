import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight,
  Check,
  Compass,
  Copy,
  Flame,
  Gamepad2,
  Orbit,
  Play,
  QrCode,
  Radio,
  Shield,
  Sliders,
  Snowflake,
  Sparkles,
  Trophy,
  Users,
  Vibrate,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  type ArenaModeId,
  ARENA_MODES,
  ARENA_MODE_ORDER,
} from '../engine/arenaLogic';
import type { RoomSummary } from '../shared/multiplayerProtocol';
import { triggerHaptic } from '../utils/haptics';
import {
  type PlayerProfile,
  computeWinRate,
} from '../utils/playerProfile';
import { soundEngine } from '../utils/soundEngine';
import { PilotAvatar } from './PilotAvatar';

interface GameHubScreenProps {
  wsConnected: boolean;
  pingMs: number;
  roomSummaries: RoomSummary[];
  profile: PlayerProfile;
  sfxEnabled: boolean;
  hapticsEnabled: boolean;
  joinError: string | null;
  onToggleSfx: () => void;
  onToggleHaptics: () => void;
  onOpenProfile: () => void;
  onEnterLobby: (modeId: ArenaModeId) => void;
  onQuickLaunch: (modeId: ArenaModeId) => void;
  onJoinByPin: (pin: string) => void;
}

type HubSectionFocus = 'arena' | 'squad' | 'pairing' | 'gamepad';

const HUB_ICONS: Record<ArenaModeId, React.ComponentType<{ className?: string }>> = {
  f1: Flame,
  tank: Shield,
  ice: Snowflake,
  zerog: Orbit,
};

const DEFAULT_PINS: Record<ArenaModeId, string> = {
  f1: '8492',
  tank: '4170',
  ice: '6325',
  zerog: '9048',
};

const ArenaSchematicSVG: React.FC<{ modeId: ArenaModeId; accentColor: string }> = ({
  modeId,
  accentColor,
}) => {
  return (
    <svg
      viewBox="0 0 360 150"
      className="w-full h-36 sm:h-40 rounded-2xl bg-black border border-white/10"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`grid-${modeId}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="360" height="150" fill={`url(#grid-${modeId})`} />

      {modeId === 'f1' && (
        <g>
          <path
            d="M 65 42 H 255 C 295 42 308 65 300 92 C 292 118 265 120 225 112 C 195 106 165 118 125 118 H 65 C 40 118 32 95 36 74 C 40 53 48 42 65 42 Z"
            fill="none"
            stroke="#1f2937"
            strokeWidth="18"
            strokeLinejoin="round"
          />
          <path
            d="M 65 42 H 255 C 295 42 308 65 300 92 C 292 118 265 120 225 112 C 195 106 165 118 125 118 H 65 C 40 118 32 95 36 74 C 40 53 48 42 65 42 Z"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeDasharray="10 6"
          />
          <line x1="150" y1="31" x2="150" y2="53" stroke="#ffffff" strokeWidth="3" />
          <circle cx="176" cy="42" r="5" fill={accentColor} />
          <circle cx="292" cy="86" r="4" fill="#00f5ff" />
          <circle cx="88" cy="118" r="4" fill="#ffb703" />
        </g>
      )}

      {modeId === 'tank' && (
        <g>
          <rect x="40" y="22" width="280" height="106" rx="14" fill="none" stroke={accentColor} strokeWidth="2" opacity="0.65" />
          <rect x="92" y="42" width="24" height="24" rx="4" fill="#18181b" stroke="#fbbf24" strokeWidth="1.5" />
          <rect x="244" y="42" width="24" height="24" rx="4" fill="#18181b" stroke="#fbbf24" strokeWidth="1.5" />
          <rect x="166" y="62" width="28" height="26" rx="5" fill="#18181b" stroke={accentColor} strokeWidth="2" />
          <line x1="72" y1="75" x2="146" y2="75" stroke="#00f5ff" strokeWidth="2" strokeDasharray="5 5" />
          <circle cx="64" cy="75" r="6" fill="#00f5ff" />
          <circle cx="294" cy="75" r="6" fill={accentColor} />
        </g>
      )}

      {modeId === 'ice' && (
        <g>
          <ellipse cx="180" cy="75" rx="124" ry="52" fill="none" stroke="#164e63" strokeWidth="2" />
          <ellipse cx="180" cy="75" rx="84" ry="34" fill="none" stroke={accentColor} strokeWidth="2" strokeDasharray="6 4" />
          <path
            d="M 105 94 Q 158 118 228 96"
            fill="none"
            stroke="#00f5ff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 112 88 Q 162 110 222 90"
            fill="none"
            stroke="#ffb703"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <circle cx="228" cy="95" r="6" fill="#00f5ff" />
          <circle cx="132" cy="52" r="5" fill="#f43f5e" />
          <circle cx="242" cy="55" r="5" fill="#00f5a0" />
        </g>
      )}

      {modeId === 'zerog' && (
        <g>
          <circle cx="180" cy="75" r="54" fill="none" stroke={accentColor} strokeWidth="2" opacity="0.7" />
          <circle cx="180" cy="75" r="30" fill="none" stroke="#00f5ff" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="180" cy="75" r="9" fill={accentColor} opacity="0.9" />
          <circle cx="128" cy="60" r="5" fill="#00f5ff" />
          <circle cx="236" cy="88" r="5" fill="#ffb703" />
          <circle cx="195" cy="24" r="4" fill="#00f5a0" />
        </g>
      )}
    </svg>
  );
};

export const GameHubScreen: React.FC<GameHubScreenProps> = ({
  wsConnected,
  pingMs,
  roomSummaries,
  profile,
  sfxEnabled,
  hapticsEnabled,
  joinError,
  onToggleSfx,
  onToggleHaptics,
  onOpenProfile,
  onEnterLobby,
  onQuickLaunch,
  onJoinByPin,
}) => {
  const [selectedMode, setSelectedMode] = useState<ArenaModeId>('ice');
  const [pinInput, setPinInput] = useState('');
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [hubFocus, setHubFocus] = useState<HubSectionFocus>('arena');

  // Interactive Gamepad Pre-Flight Test State (60 FPS lightweight)
  const [testStick, setTestStick] = useState({ x: 0, y: 0 });
  const [testLabel, setTestLabel] = useState('Ready — test stick, drift, or boost');
  const [activeBtn, setActiveBtn] = useState<string | null>(null);
  const testPadRef = useRef<HTMLDivElement>(null);
  const testPointerRef = useRef<number | null>(null);

  const mode = ARENA_MODES[selectedMode];
  const summary = roomSummaries.find((r) => r.modeId === selectedMode);
  const roomPin = summary?.roomPin ?? DEFAULT_PINS[selectedMode];
  const activePlayers = summary?.playerCount ?? 1;
  const winRate = computeWinRate(profile.stats);

  const joinUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://playsync.gg';
    return `${origin}/?join=${roomPin}`;
  }, [roomPin]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(joinUrl, {
      width: 180,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrPreviewUrl(url);
      })
      .catch(() => {
        if (active) setQrPreviewUrl('');
      });
    return () => {
      active = false;
    };
  }, [joinUrl]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim();
    if (!/^\d{4}$/.test(cleaned)) return;
    triggerHaptic('switch', hapticsEnabled);
    soundEngine.playJoinChime(sfxEnabled);
    onJoinByPin(cleaned);
  };

  const handleCopyPin = async () => {
    triggerHaptic('tap', hapticsEnabled);
    soundEngine.playClick(sfxEnabled);
    try {
      await navigator.clipboard.writeText(roomPin);
    } catch {
      // Ignore clipboard failure
    }
    setCopiedPin(true);
    window.setTimeout(() => setCopiedPin(false), 1400);
  };

  const updateTestStick = (clientX: number, clientY: number) => {
    const el = testPadRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = 30;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setTestStick({ x: dx, y: dy });
    const steerPct = Math.round((dx / maxR) * 100);
    const gasPct = Math.round((-dy / maxR) * 100);
    setTestLabel(`Axis X ${steerPct}% · Y ${gasPct}%`);
  };

  const firePadCheck = (name: string, kind: 'tap' | 'boost' | 'fire' | 'switch') => {
    setActiveBtn(name);
    setTestLabel(`${name} signal verified · <4ms`);
    triggerHaptic(kind, hapticsEnabled);
    if (kind === 'boost') soundEngine.playBoostWhoosh(sfxEnabled);
    else if (kind === 'fire') soundEngine.playFirePulse(sfxEnabled);
    else soundEngine.playClick(sfxEnabled);
    window.setTimeout(() => setActiveBtn((prev) => (prev === name ? null : prev)), 260);
  };

  return (
    <div className="w-full max-w-[1480px] mx-auto px-4 lg:px-8 pt-5 pb-24 lg:pb-12 space-y-6">
      {/* AMOLED COMMAND DECK TOP BANNER */}
      <section className="rounded-3xl border border-white/10 bg-[#050609] p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <Radio className="w-4 h-4" />
            <span>Pre-Lobby Command Deck</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-mono-code">
              <Wifi className="w-3.5 h-3.5" />
              {wsConnected ? `Live WS · ${pingMs}ms` : 'Offline Ready · 60 FPS'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Stage Your Arena Before Joining
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Pick an isolated mode below, customize your pilot &amp; career stats, pair controllers via QR, and verify your gamepad before entering the live 3D lobby.
          </p>
        </div>

        {/* Interactive Pilot Card + Quick PIN Join */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto">
          <button
            type="button"
            data-testid="hub-profile-card"
            onClick={() => {
              triggerHaptic('tap', hapticsEnabled);
              soundEngine.playClick(sfxEnabled);
              onOpenProfile();
            }}
            className="rounded-2xl border border-white/15 hover:border-cyan-400/60 bg-black p-3.5 flex items-center gap-3 text-left transition-colors cursor-pointer min-w-[220px]"
          >
            <PilotAvatar avatarId={profile.avatarId} color={profile.avatarColor} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Pilot Profile
              </div>
              <div className="text-sm font-extrabold text-white truncate">
                {profile.nickname}
              </div>
              <div className="text-[11px] font-mono-code text-zinc-400">
                {profile.stats.gamesPlayed} Games · {winRate}% Win
              </div>
            </div>
            <Sliders className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>

          <form
            onSubmit={handlePinSubmit}
            className="rounded-2xl border border-white/10 bg-black p-3 flex flex-col justify-center gap-1.5"
          >
            <label htmlFor="hub-join-pin" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Join Friend by PIN
            </label>
            <div className="flex gap-2">
              <input
                id="hub-join-pin"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4170"
                className="w-24 min-h-[40px] rounded-xl bg-[#090b10] border border-white/15 px-3 text-sm font-mono-code text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={pinInput.length !== 4}
                className="min-h-[40px] px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
              >
                Join
              </button>
            </div>
            {joinError && <p className="text-[11px] text-rose-400">{joinError}</p>}
          </form>
        </div>
      </section>

      {/* INTERACTIVE 4-ARENA SELECTOR STRIP */}
      <section aria-label="Arena Mode Selector" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ARENA_MODE_ORDER.map((id) => {
          const item = ARENA_MODES[id];
          const Icon = HUB_ICONS[id];
          const itemSummary = roomSummaries.find((r) => r.modeId === id);
          const itemPin = itemSummary?.roomPin ?? DEFAULT_PINS[id];
          const isSelected = selectedMode === id;

          return (
            <button
              key={id}
              type="button"
              data-testid={`select-mode-${id}`}
              onClick={() => {
                triggerHaptic('switch', hapticsEnabled);
                soundEngine.playModeSwitch(sfxEnabled);
                setSelectedMode(id);
              }}
              style={
                isSelected
                  ? { borderColor: item.accentColor }
                  : undefined
              }
              className={`rounded-2xl border p-4 text-left transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'bg-[#090b10] shadow-lg'
                  : 'bg-[#050609] border-white/10 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  style={{
                    borderColor: `${item.accentColor}66`,
                    backgroundColor: `${item.accentColor}1a`,
                    color: item.accentColor,
                  }}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-mono-code text-[11px] font-bold text-zinc-400">
                  #{itemPin}
                </span>
              </div>

              <div>
                <div
                  style={{ color: item.accentColor }}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  {item.category}
                </div>
                <div className="text-sm sm:text-base font-black text-white truncate">
                  {item.title}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* ALIGNED 4-PILLAR COMMAND DECK: ARENA · SQUAD · PAIR QR · GAMEPAD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PILLAR 1: ARENA OVERVIEW & TACTICAL SCHEMATIC */}
        <section
          id="hub-pillar-arena"
          className={`lg:col-span-7 rounded-3xl border border-white/10 bg-[#050609] p-5 sm:p-6 flex flex-col justify-between gap-5 ${
            hubFocus === 'arena' ? 'block' : 'hidden lg:flex'
          }`}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div
                  style={{ color: mode.accentColor }}
                  className="text-xs font-extrabold uppercase tracking-wider"
                >
                  Arena · {mode.category}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {mode.title}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-black border border-white/10 font-mono-code text-xs font-bold text-cyan-400">
                  Room #{roomPin}
                </span>
                <span className="px-3 py-1 rounded-xl bg-black border border-white/10 font-mono-code text-xs font-bold text-emerald-400">
                  60 FPS
                </span>
              </div>
            </div>

            <ArenaSchematicSVG modeId={selectedMode} accentColor={mode.accentColor} />

            <p className="text-sm text-zinc-300 leading-relaxed">
              {mode.description}
            </p>

            {/* Telemetry & Action Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl bg-black border border-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Top Speed</div>
                <div className="text-sm font-black font-mono-code text-white tabular-nums mt-0.5">
                  {Math.round(mode.physics.topSpeed * 14)} km/h
                </div>
              </div>
              <div className="rounded-2xl bg-black border border-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Armor</div>
                <div className="text-sm font-black font-mono-code text-emerald-400 tabular-nums mt-0.5">
                  {mode.physics.armorRating}%
                </div>
              </div>
              <div className="rounded-2xl bg-black border border-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Primary</div>
                <div className="text-sm font-extrabold text-cyan-300 truncate mt-0.5">
                  {mode.actionLabel}
                </div>
              </div>
              <div className="rounded-2xl bg-black border border-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Secondary</div>
                <div className="text-sm font-extrabold text-amber-300 truncate mt-0.5">
                  {mode.secondaryActionLabel}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {mode.features.map((feat) => (
                <span
                  key={feat}
                  className="px-3 py-1 rounded-xl bg-black border border-white/10 text-zinc-300 font-medium"
                >
                  {feat}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              data-testid={`enter-lobby-${selectedMode}`}
              onClick={() => {
                triggerHaptic('switch', hapticsEnabled);
                soundEngine.playModeSwitch(sfxEnabled);
                onEnterLobby(selectedMode);
              }}
              className="flex-1 min-h-[50px] px-6 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Enter {mode.lobbyTitle}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid={`quick-launch-${selectedMode}`}
              onClick={() => {
                triggerHaptic('boost', hapticsEnabled);
                soundEngine.playMatchStart(sfxEnabled);
                onQuickLaunch(selectedMode);
              }}
              className="min-h-[50px] px-5 rounded-2xl bg-black hover:bg-zinc-900 border border-white/15 text-white font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current text-emerald-400" />
              <span>Quick Play</span>
            </button>
          </div>
        </section>

        {/* PILLARS 2, 3, 4: SQUAD · PAIR QR · GAMEPAD */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* PILLAR 2: SQUAD & PILOT CAREER */}
          <section
            id="hub-pillar-squad"
            className={`rounded-3xl border border-white/10 bg-[#050609] p-5 space-y-4 ${
              hubFocus === 'squad' ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                <Users className="w-4 h-4" />
                <span>Squad &amp; Pilot Career</span>
              </div>
              <span className="font-mono-code text-xs text-zinc-400">
                {activePlayers}/8 Live in #{roomPin}
              </span>
            </div>

            <div className="rounded-2xl bg-black border border-white/10 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PilotAvatar avatarId={profile.avatarId} color={profile.avatarColor} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-black text-white truncate">
                    {profile.nickname}
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-amber-400 font-mono-code">
                      <Trophy className="w-3 h-3" />
                      {winRate}% Win
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-code">{profile.stats.gamesPlayed} Matches</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="hub-edit-profile-btn"
                onClick={() => {
                  triggerHaptic('tap', hapticsEnabled);
                  soundEngine.playClick(sfxEnabled);
                  onOpenProfile();
                }}
                className="min-h-[38px] px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-bold text-white cursor-pointer shrink-0"
              >
                Customize
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black border border-white/10 py-2 px-2">
                <div className="text-[10px] uppercase text-zinc-500">Best Score</div>
                <div className="text-sm font-black font-mono-code text-cyan-400 tabular-nums">
                  {profile.stats.bestScore}
                </div>
              </div>
              <div className="rounded-xl bg-black border border-white/10 py-2 px-2">
                <div className="text-[10px] uppercase text-zinc-500">Drift Pts</div>
                <div className="text-sm font-black font-mono-code text-amber-400 tabular-nums">
                  {profile.stats.totalDriftPoints}
                </div>
              </div>
              <div className="rounded-xl bg-black border border-white/10 py-2 px-2">
                <div className="text-[10px] uppercase text-zinc-500">Wins</div>
                <div className="text-sm font-black font-mono-code text-emerald-400 tabular-nums">
                  {profile.stats.wins}
                </div>
              </div>
            </div>
          </section>

          {/* PILLAR 3: PAIR QR PREVIEW */}
          <section
            id="hub-pillar-pairing"
            className={`rounded-3xl border border-white/10 bg-[#050609] p-5 space-y-3 ${
              hubFocus === 'pairing' ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                <QrCode className="w-4 h-4" />
                <span>Pair QR · Mobile Sync</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPin}
                className="min-h-[32px] px-2.5 rounded-lg bg-black border border-white/15 text-[11px] font-mono-code font-bold text-cyan-300 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>#{roomPin}</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-white p-1.5 shrink-0 flex items-center justify-center">
                {qrPreviewUrl ? (
                  <img
                    src={qrPreviewUrl}
                    alt={`Preview QR code for room ${roomPin}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs font-mono-code font-bold text-black">{roomPin}</span>
                )}
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="text-sm font-extrabold text-white">
                  Instant Android Gamepad Link
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Friends scan this code or enter <span className="font-mono-code text-cyan-300">#{roomPin}</span> to join <strong className="text-white">{mode.title}</strong> as a live touch/gyro controller.
                </p>
              </div>
            </div>
          </section>

          {/* PILLAR 4: INTERACTIVE GAMEPAD PRE-FLIGHT CONSOLE */}
          <section
            id="hub-pillar-gamepad"
            className={`rounded-3xl border border-white/10 bg-[#050609] p-5 space-y-4 ${
              hubFocus === 'gamepad' ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                <Gamepad2 className="w-4 h-4" />
                <span>Gamepad · Touch &amp; Haptics Check</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleHaptics}
                  aria-pressed={hapticsEnabled}
                  className={`min-h-[30px] px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                    hapticsEnabled
                      ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/10 bg-black text-zinc-500'
                  }`}
                >
                  <Vibrate className="w-3 h-3" />
                  <span>{hapticsEnabled ? 'Haptic' : 'Muted'}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleSfx}
                  aria-pressed={sfxEnabled}
                  className={`min-h-[30px] px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                    sfxEnabled
                      ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/10 bg-black text-zinc-500'
                  }`}
                >
                  {sfxEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  <span>{sfxEnabled ? 'SFX' : 'Off'}</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-black border border-white/10 p-3.5 flex items-center justify-between gap-4">
              {/* Mini interactive analog stick */}
              <div
                ref={testPadRef}
                role="application"
                aria-label="Pre-lobby analog stick test pad"
                onPointerDown={(e) => {
                  testPointerRef.current = e.pointerId;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                  triggerHaptic('tap', hapticsEnabled);
                  updateTestStick(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (testPointerRef.current !== e.pointerId) return;
                  updateTestStick(e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  if (testPointerRef.current !== e.pointerId) return;
                  testPointerRef.current = null;
                  setTestStick({ x: 0, y: 0 });
                  setTestLabel('Stick centered · ready');
                }}
                onPointerCancel={() => {
                  testPointerRef.current = null;
                  setTestStick({ x: 0, y: 0 });
                }}
                className="relative w-24 h-24 rounded-full border border-cyan-400/40 bg-[#07090f] flex items-center justify-center touch-none select-none shrink-0 cursor-grab"
              >
                <div className="absolute inset-2.5 rounded-full border border-dashed border-white/15 pointer-events-none" />
                <div
                  style={{
                    transform: `translate3d(${testStick.x}px, ${testStick.y}px, 0)`,
                  }}
                  className="w-9 h-9 rounded-full border-2 border-cyan-300 bg-cyan-400/35 pointer-events-none"
                />
              </div>

              {/* Action buttons aligned with active mode */}
              <div className="flex-1 space-y-2 min-w-0">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => firePadCheck('Boost', 'boost')}
                    className={`min-h-[42px] rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                      activeBtn === 'Boost'
                        ? 'border-cyan-300 bg-cyan-400 text-black'
                        : 'border-cyan-400/40 bg-[#06121b] text-cyan-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Boost</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => firePadCheck(mode.actionLabel.split(' ')[0], 'fire')}
                    className={`min-h-[42px] rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                      activeBtn === mode.actionLabel.split(' ')[0]
                        ? 'border-pink-300 bg-pink-500 text-white'
                        : 'border-pink-400/45 bg-[#190612] text-pink-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="truncate max-w-full px-1">{mode.actionLabel.split(' ')[0]}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => firePadCheck(mode.secondaryActionLabel, 'tap')}
                    className={`min-h-[42px] rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                      activeBtn === mode.secondaryActionLabel
                        ? 'border-amber-300 bg-amber-500 text-black'
                        : 'border-amber-400/40 bg-[#181104] text-amber-200'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span className="truncate max-w-full px-1">
                      {selectedMode === 'ice' ? 'Drift' : mode.secondaryActionLabel.split(' ')[0]}
                    </span>
                  </button>
                </div>
                <div className="text-[11px] font-mono-code text-zinc-400 truncate">
                  {testLabel}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* MOBILE PRE-LOBBY 4-PILLAR BOTTOM BAR (Aligns 1:1 with Arena · Squad · Pair QR · Gamepad) */}
      <nav
        aria-label="Pre-lobby navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black pb-safe"
      >
        <div className="grid grid-cols-4 h-16">
          {(
            [
              { id: 'arena', label: 'Arena', icon: Play },
              { id: 'squad', label: 'Squad', icon: Users },
              { id: 'pairing', label: 'Pair QR', icon: QrCode },
              { id: 'gamepad', label: 'Gamepad', icon: Gamepad2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = hubFocus === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic('tap', hapticsEnabled);
                  soundEngine.playClick(sfxEnabled);
                  setHubFocus(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors cursor-pointer ${
                  active ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
