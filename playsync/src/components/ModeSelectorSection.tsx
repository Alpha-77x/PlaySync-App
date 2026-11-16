import React from 'react';
import { Flame, Orbit, Shield, Snowflake } from 'lucide-react';
import {
  type ArenaModeId,
  type GameLobbyState,
  ARENA_MODES,
  ARENA_MODE_ORDER,
  getConnectedCount,
} from '../engine/arenaLogic';
import { triggerHaptic } from '../utils/haptics';
import { soundEngine } from '../utils/soundEngine';

interface ModeSelectorSectionProps {
  activeMode: ArenaModeId;
  lobbies: Record<ArenaModeId, GameLobbyState>;
  sfxEnabled: boolean;
  onSelectMode: (mode: ArenaModeId) => void;
}

const MODE_ICONS: Record<ArenaModeId, React.ComponentType<{ className?: string }>> = {
  f1: Flame,
  tank: Shield,
  ice: Snowflake,
  zerog: Orbit,
};

export const ModeSelectorSection: React.FC<ModeSelectorSectionProps> = ({
  activeMode,
  lobbies,
  sfxEnabled,
  onSelectMode,
}) => {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-white tracking-wide uppercase text-sm">
            Dedicated Game Lobbies (4 Isolated Arenas)
          </h3>
          <p className="text-xs text-slate-400">
            Each game runs its own isolated lobby, PIN, roster, and 3D arena
          </p>
        </div>
        <span className="text-xs text-cyan-400 font-medium whitespace-nowrap">
          60 FPS Engine
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ARENA_MODE_ORDER.map((id) => {
          const mode = ARENA_MODES[id];
          const lobby = lobbies[id];
          const Icon = MODE_ICONS[id];
          const isSelected = activeMode === id;
          const connected = getConnectedCount(lobby.slots);

          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                triggerHaptic('switch');
                soundEngine.playModeSwitch(sfxEnabled);
                onSelectMode(id);
              }}
              aria-pressed={isSelected}
              className={`group rounded-2xl p-4 sm:p-5 text-left border transition-all duration-150 cursor-pointer active:scale-[0.99] ${
                isSelected
                  ? 'bg-[#101d38] border-cyan-400/60 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-900/55 border-white/8 hover:border-slate-600/80 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div
                  style={{
                    borderColor: `${mode.accentColor}55`,
                    backgroundColor: `${mode.accentColor}1f`,
                    color: mode.accentColor,
                  }}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono-code text-slate-300">
                  Lobby #{lobby.roomPin} · {connected}/8
                </span>
              </div>

              <div
                style={{ color: mode.accentColor }}
                className="text-[11px] font-bold tracking-wider uppercase mb-1"
              >
                {mode.category}
              </div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h4 className="text-base font-extrabold text-white">
                  {mode.title}
                </h4>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {isSelected ? 'Active Lobby' : 'Enter Lobby'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {mode.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                <span>{mode.features[0]}</span>
                <span aria-hidden="true">·</span>
                <span>{mode.features[1]}</span>
                <span aria-hidden="true">·</span>
                <span>{mode.features[2]}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
