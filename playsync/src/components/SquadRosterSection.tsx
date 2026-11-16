import React, { useState } from 'react';
import {
  Bot,
  Gamepad2,
  Play,
  Plus,
  Smartphone,
  UserMinus,
  Zap,
} from 'lucide-react';
import {
  type InputType,
  type PlayerSlot,
  getConnectedCount,
  getReadyCount,
} from '../engine/arenaLogic';
import { triggerHaptic } from '../utils/haptics';
import { soundEngine } from '../utils/soundEngine';

import type { AvatarId } from '../utils/playerProfile';
import { PilotAvatar } from './PilotAvatar';

interface SquadRosterSectionProps {
  slots: PlayerSlot[];
  lobbyTitle?: string;
  sfxEnabled: boolean;
  hostAvatarId?: AvatarId;
  hostAvatarColor?: string;
  onAddGuest: (customName?: string, inputType?: InputType) => void;
  onRemoveGuest: (slotNumber: number) => void;
  onToggleReady: (slotNumber: number) => void;
  onLaunchMatch: () => void;
  onLaunchSandbox: () => void;
}

export const SquadRosterSection: React.FC<SquadRosterSectionProps> = ({
  slots,
  lobbyTitle,
  sfxEnabled,
  hostAvatarId,
  hostAvatarColor,
  onAddGuest,
  onRemoveGuest,
  onToggleReady,
  onLaunchMatch,
  onLaunchSandbox,
}) => {
  const [guestName, setGuestName] = useState('');
  const [guestInputType, setGuestInputType] = useState<InputType>('Touch & Gyro');
  const connectedCount = getConnectedCount(slots);
  const readyCount = getReadyCount(slots);

  const handleQuickAdd = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (connectedCount >= 8) return;
    triggerHaptic('switch');
    soundEngine.playJoinChime(sfxEnabled);
    onAddGuest(guestName || undefined, guestInputType);
    setGuestName('');
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-[#050609] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
            {lobbyTitle ? `${lobbyTitle} Squad` : 'Multiplayer Squad Slots'} ({readyCount} / 8 Ready)
          </h3>
          <p className="text-xs text-zinc-400">
            Real-time WebSocket slots · Friends join by PIN/QR, or spawn AI rivals
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleQuickAdd()}
          disabled={connectedCount >= 8}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-40 border border-cyan-400/35 text-xs font-bold text-cyan-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>Add AI Rival</span>
        </button>
      </div>

      {/* Custom AI Rival Bar */}
      {connectedCount < 8 && (
        <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row gap-2.5">
          <label htmlFor="guest-callsign-input" className="sr-only">
            AI rival callsign
          </label>
          <input
            id="guest-callsign-input"
            type="text"
            maxLength={18}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Optional AI rival name (e.g. ApexViper)"
            className="flex-1 min-h-[44px] rounded-xl bg-black border border-white/15 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
          />
          <label htmlFor="guest-input-select" className="sr-only">
            Slot type
          </label>
          <select
            id="guest-input-select"
            value={guestInputType}
            onChange={(e) => setGuestInputType(e.target.value as InputType)}
            className="min-h-[44px] rounded-xl bg-black border border-white/15 px-3 text-xs font-medium text-zinc-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="AI Bot">AI Rival Bot</option>
          </select>
          <button
            type="submit"
            className="min-h-[44px] px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-bold text-white whitespace-nowrap cursor-pointer"
          >
            Spawn Slot P{connectedCount + 1}
          </button>
        </form>
      )}

      {/* 8-Player Slot Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3">
        {slots.map((slot) => {
          const isOccupied = slot.status !== 'empty';
          const isHost = slot.status === 'host';

          if (!isOccupied) {
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleQuickAdd()}
                className="min-h-[68px] rounded-2xl p-3 bg-black hover:bg-zinc-950 border border-dashed border-white/15 hover:border-cyan-500/40 flex items-center gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-900 text-zinc-400 font-mono-code font-bold text-xs flex items-center justify-center shrink-0">
                  P{slot.slotNumber}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-300 truncate">
                    Open Slot
                  </div>
                  <div className="text-[11px] text-cyan-400/90 truncate">
                    PIN join or tap for AI
                  </div>
                </div>
              </button>
            );
          }

          return (
            <div
              key={slot.id}
              className={`min-h-[68px] rounded-2xl p-3 border flex items-center justify-between gap-2 transition-colors ${
                slot.ready
                  ? 'bg-[#04131a] border-cyan-500/40'
                  : 'bg-black border-white/10'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  soundEngine.playClick(sfxEnabled);
                  onToggleReady(slot.slotNumber);
                }}
                aria-label={`Toggle ready state for ${slot.name}`}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
              >
                {isHost && hostAvatarId ? (
                  <PilotAvatar
                    avatarId={hostAvatarId}
                    color={hostAvatarColor ?? slot.liveryColor}
                    size="sm"
                  />
                ) : (
                  <div
                    style={{ backgroundColor: slot.liveryColor }}
                    className="w-9 h-9 rounded-xl text-black font-mono-code font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm"
                  >
                    P{slot.slotNumber}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {slot.name}
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center gap-1 truncate">
                    {slot.inputType === 'AI Bot' ? (
                      <Bot className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : slot.inputType === 'Gamepad' ? (
                      <Gamepad2 className="w-3 h-3 text-cyan-400 shrink-0" />
                    ) : (
                      <Smartphone className="w-3 h-3 text-cyan-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {isHost ? 'Host' : slot.ready ? 'Ready' : 'Standby'} · {slot.pingMs}ms
                    </span>
                  </div>
                </div>
              </button>

              {!isHost && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    soundEngine.playClick(sfxEnabled);
                    onRemoveGuest(slot.slotNumber);
                  }}
                  aria-label={`Remove ${slot.name}`}
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Primary Launch Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
        <button
          type="button"
          data-start="true"
          onClick={() => {
            triggerHaptic('boost');
            soundEngine.playMatchStart(sfxEnabled);
            onLaunchMatch();
          }}
          className="sm:flex-1 min-h-[52px] px-6 py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm tracking-wide uppercase transition-colors flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-cyan-500/20"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>
            {connectedCount > 1
              ? `Launch Arena Match (${readyCount} Ready)`
              : 'Launch Solo Arena Match'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('switch');
            soundEngine.playModeSwitch(sfxEnabled);
            onLaunchSandbox();
          }}
          className="min-h-[52px] px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Practice Sandbox</span>
        </button>
      </div>
    </section>
  );
};
