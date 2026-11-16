import React from 'react';
import { Award, Ticket, Trophy } from 'lucide-react';
import { type PlayerSlot, getRankedLeaderboard } from '../engine/arenaLogic';

interface LeaderboardSectionProps {
  slots: PlayerSlot[];
  roomPin: string;
  roundNumber: number;
  sfxEnabled: boolean;
  onSimulateGuestJoin: () => void;
}

export const LeaderboardSection: React.FC<LeaderboardSectionProps> = ({
  slots,
  roomPin,
  roundNumber,
  onSimulateGuestJoin,
}) => {
  const ranked = getRankedLeaderboard(slots);
  const hasMatchesOrGuests =
    ranked.length > 1 || ranked.some((p) => p.score > 0 || p.driftPoints > 0);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 sm:p-6 flex flex-col flex-1">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-white tracking-wide uppercase text-sm">
            Tournament Leaderboard
          </h3>
        </div>
        <span className="text-xs font-mono-code text-slate-400">
          Round {roundNumber}
        </span>
      </div>

      {!hasMatchesOrGuests ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-800 rounded-2xl my-1">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-cyan-400 mb-3">
            <Ticket className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">
            Waiting for Squad Action
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-xs">
            Pair phone gamepads via QR or launch a match to track live drift scores, accuracy, and orbital pickups.
          </p>
          <div className="text-xs text-cyan-300 font-mono-code">
            Room #{roomPin} · {ranked.length} Connected
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-x-auto">
          {ranked.map((player, index) => (
            <div
              key={player.id}
              className={`rounded-2xl p-3 border flex items-center justify-between gap-3 ${
                index === 0
                  ? 'bg-amber-500/10 border-amber-400/35'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-xs font-mono-code font-bold text-slate-200 flex items-center justify-center shrink-0">
                  {index === 0 ? <Award className="w-4 h-4 text-amber-400" /> : `#${index + 1}`}
                </div>
                <div
                  style={{ backgroundColor: player.liveryColor }}
                  className="w-2.5 h-7 rounded-full shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {player.name}
                  </div>
                  <div className="text-[11px] text-slate-400 tabular-nums">
                    Drift {Math.round(player.driftPoints)} · Acc {player.accuracy}%
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-sm font-extrabold font-mono-code text-cyan-300 tabular-nums">
                  {Math.round(player.score)}
                </div>
                <div className="text-[10px] text-slate-400 uppercase">pts</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Real-Time WebSocket Sync</span>
        <button
          type="button"
          onClick={onSimulateGuestJoin}
          disabled={slots.every((s) => s.status !== 'empty')}
          className="text-cyan-400 hover:text-cyan-300 disabled:opacity-40 font-semibold cursor-pointer"
        >
          Add AI Rival +
        </button>
      </div>
    </section>
  );
};
