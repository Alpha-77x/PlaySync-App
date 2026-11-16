import React, { useState } from 'react';
import { ArrowRight, Flame, Orbit, Radio, Shield, Snowflake, Users, Wifi } from 'lucide-react';
import { type ArenaModeId, ARENA_MODES, ARENA_MODE_ORDER } from '../engine/arenaLogic';
import type { RoomSummary } from '../shared/multiplayerProtocol';
import { triggerHaptic } from '../utils/haptics';
import { soundEngine } from '../utils/soundEngine';

interface GameHubScreenProps {
  wsConnected: boolean;
  pingMs: number;
  roomSummaries: RoomSummary[];
  playerCallsign: string;
  onChangeCallsign: (name: string) => void;
  onEnterLobby: (modeId: ArenaModeId) => void;
  onJoinByPin: (pin: string) => void;
  sfxEnabled: boolean;
  hapticsEnabled: boolean;
  joinError: string | null;
}

const HUB_ICONS: Record<ArenaModeId, React.ComponentType<{ className?: string }>> = {
  f1: Flame,
  tank: Shield,
  ice: Snowflake,
  zerog: Orbit,
};

export const GameHubScreen: React.FC<GameHubScreenProps> = ({
  wsConnected,
  pingMs,
  roomSummaries,
  playerCallsign,
  onChangeCallsign,
  onEnterLobby,
  onJoinByPin,
  sfxEnabled,
  hapticsEnabled,
  joinError,
}) => {
  const [pinInput, setPinInput] = useState('');

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim();
    if (!/^\d{4}$/.test(cleaned)) return;
    triggerHaptic('switch', hapticsEnabled);
    soundEngine.playJoinChime(sfxEnabled);
    onJoinByPin(cleaned);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 lg:px-8 pt-6 pb-24 lg:pb-12 space-y-8">
      {/* SPACIOUS MULTIPLAYER HUB HEADER */}
      <section className="rounded-3xl border border-white/10 bg-[#0b1222]/95 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <Radio className="w-4 h-4" />
            <span>Isolated Multiplayer Game Arenas</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-300 font-mono-code">
              <Wifi className="w-3.5 h-3.5" />
              {wsConnected ? `Live WS · ${pingMs}ms` : 'Connecting...'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Select Your Dedicated Arena
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Each game launches inside its own isolated multiplayer lobby and full-size 3D arena—F1 cars race F1 cars, and Cyber Tanks duel Cyber Tanks with zero crossover.
          </p>
        </div>

        {/* Callsign + Join Room by 4-Digit PIN */}
        <form
          onSubmit={handlePinSubmit}
          className="w-full lg:w-auto lg:min-w-[380px] rounded-2xl border border-slate-800 bg-slate-950/75 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="hub-callsign" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Your Callsign
              </label>
              <input
                id="hub-callsign"
                type="text"
                maxLength={18}
                value={playerCallsign}
                onChange={(e) => onChangeCallsign(e.target.value)}
                placeholder="Host Console"
                className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="hub-join-pin" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Join Room PIN
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
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm font-mono-code text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={pinInput.length !== 4}
                  className="min-h-[42px] px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-extrabold text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
          {joinError && (
            <p className="text-xs text-rose-400 font-medium">{joinError}</p>
          )}
        </form>
      </section>

      {/* DISTANCED 4-GAME SHOWCASE GRID */}
      <section aria-label="Game Arena Directory" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ARENA_MODE_ORDER.map((id) => {
          const mode = ARENA_MODES[id];
          const Icon = HUB_ICONS[id];
          const summary = roomSummaries.find((r) => r.modeId === id);
          const roomPin = summary?.roomPin ?? (id === 'f1' ? '8492' : id === 'tank' ? '4170' : id === 'ice' ? '6325' : '9048');
          const activePlayers = summary?.playerCount ?? 0;

          return (
            <div
              key={id}
              className="rounded-3xl border border-white/10 bg-[#0b1222]/90 hover:border-cyan-400/50 transition-all p-6 sm:p-7 flex flex-col justify-between gap-6 shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        borderColor: `${mode.accentColor}55`,
                        backgroundColor: `${mode.accentColor}1f`,
                        color: mode.accentColor,
                      }}
                      className="w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0"
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div
                        style={{ color: mode.accentColor }}
                        className="text-xs font-bold uppercase tracking-wider"
                      >
                        {mode.category}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white">
                        {mode.title}
                      </h2>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono-code font-bold text-cyan-300">
                      Room #{roomPin}
                    </div>
                    <div className="text-[11px] text-slate-400 inline-flex items-center gap-1 justify-end">
                      <Users className="w-3 h-3" />
                      <span>{activePlayers}/8 Live</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {mode.description}
                </p>

                {/* Key Mechanical Highlights */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                  <div className="rounded-2xl bg-slate-900/75 border border-slate-800 px-2.5 sm:px-3 py-2 sm:py-2.5 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Top Speed</div>
                    <div className="text-xs sm:text-sm font-black font-mono-code text-white tabular-nums">
                      {Math.round(mode.physics.topSpeed * 14)} km/h
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-900/75 border border-slate-800 px-2.5 sm:px-3 py-2 sm:py-2.5 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Armor</div>
                    <div className="text-xs sm:text-sm font-black font-mono-code text-emerald-400 tabular-nums">
                      {mode.physics.armorRating}%
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-900/75 border border-slate-800 px-2.5 sm:px-3 py-2 sm:py-2.5 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Primary</div>
                    <div className="text-xs sm:text-sm font-bold text-cyan-300 truncate">
                      {mode.actionLabel}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{mode.features[0]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{mode.features[1]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{mode.features[2]}</span>
                </div>

                <button
                  type="button"
                  data-testid={`enter-lobby-${id}`}
                  onClick={() => {
                    triggerHaptic('switch', hapticsEnabled);
                    soundEngine.playModeSwitch(sfxEnabled);
                    onEnterLobby(id);
                  }}
                  className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  <span>Enter Lobby</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
