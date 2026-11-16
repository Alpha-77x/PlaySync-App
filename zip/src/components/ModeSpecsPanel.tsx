import React from 'react';
import { Gauge, Palette, Shield, Timer, Zap } from 'lucide-react';
import { type ArenaModeSpec, LIVERY_PALETTE } from '../engine/arenaLogic';
import { triggerHaptic } from '../utils/haptics';
import { soundEngine } from '../utils/soundEngine';

interface ModeSpecsPanelProps {
  modeSpec: ArenaModeSpec;
  liveryColor: string;
  roundSeconds: number;
  sfxEnabled: boolean;
  onSelectLivery: (hex: string) => void;
  onSelectRoundSeconds: (seconds: number) => void;
}

export const ModeSpecsPanel: React.FC<ModeSpecsPanelProps> = ({
  modeSpec,
  liveryColor,
  roundSeconds,
  sfxEnabled,
  onSelectLivery,
  onSelectRoundSeconds,
}) => {
  const { physics } = modeSpec;
  const stats = [
    {
      label: 'Top Speed',
      value: Math.round((physics.topSpeed / 24) * 100),
      display: `${Math.round(physics.topSpeed * 14)} km/h`,
      icon: Gauge,
      barColor: 'bg-cyan-400',
    },
    {
      label: 'Boost Power',
      value: Math.round((physics.boostMultiplier / 1.7) * 100),
      display: `${physics.boostMultiplier.toFixed(2)}x`,
      icon: Zap,
      barColor: 'bg-pink-500',
    },
    {
      label: 'Chassis Armor',
      value: physics.armorRating,
      display: `${physics.armorRating}%`,
      icon: Shield,
      barColor: 'bg-emerald-400',
    },
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Arena Telemetry &amp; Tuning
          </div>
          <h3 className="text-base font-extrabold text-white">{modeSpec.title}</h3>
        </div>
        <span className="text-xs font-mono-code text-slate-400">{modeSpec.playerRange}</span>
      </div>

      <div className="space-y-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium inline-flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  {stat.label}
                </span>
                <span className="font-mono-code font-bold text-white tabular-nums">
                  {stat.display}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800/90 overflow-hidden">
                <div
                  className={`h-full rounded-full ${stat.barColor} transition-all duration-300`}
                  style={{ width: `${Math.min(100, Math.max(10, stat.value))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Host Livery Picker */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium inline-flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            Host Vehicle Livery
          </span>
          <span className="font-mono-code text-slate-400">
            {LIVERY_PALETTE.find((c) => c.hex === liveryColor)?.name ?? 'Custom'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {LIVERY_PALETTE.map((swatch) => {
            const selected = swatch.hex === liveryColor;
            return (
              <button
                key={swatch.hex}
                type="button"
                aria-label={`Select ${swatch.name} livery`}
                aria-pressed={selected}
                onClick={() => {
                  triggerHaptic('tap');
                  soundEngine.playClick(sfxEnabled);
                  onSelectLivery(swatch.hex);
                }}
                style={{ backgroundColor: swatch.hex }}
                className={`w-9 h-9 rounded-xl transition-transform cursor-pointer ${
                  selected
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0b1222] scale-105'
                    : 'opacity-80 hover:opacity-100 hover:scale-105'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Match Duration Selector */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-300 font-medium inline-flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-amber-400" />
          Round Duration
        </span>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {[45, 60, 90].map((secs) => (
            <button
              key={secs}
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                soundEngine.playClick(sfxEnabled);
                onSelectRoundSeconds(secs);
              }}
              className={`min-h-[34px] px-2.5 rounded-lg text-xs font-mono-code font-bold transition-colors cursor-pointer ${
                roundSeconds === secs
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {secs}s
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
