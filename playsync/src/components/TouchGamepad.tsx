import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Gauge,
  OctagonAlert,
  Shield,
  Snowflake,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { ArenaModeSpec, ControlInput } from '../engine/arenaLogic';
import { triggerHaptic } from '../utils/haptics';
import { soundEngine } from '../utils/soundEngine';

interface TouchGamepadProps {
  modeSpec: ArenaModeSpec;
  variant: 'full' | 'overlay';
  rotatedLandscape?: boolean;
  sfxEnabled: boolean;
  hapticsEnabled: boolean;
  onInputChange: (next: Partial<ControlInput>) => void;
  onTriggerAction: () => void;
  liveTelemetry?: {
    speed: number;
    boostEnergy: number;
    score: number;
  };
}

export const TouchGamepad: React.FC<TouchGamepadProps> = ({
  modeSpec,
  variant,
  rotatedLandscape = false,
  sfxEnabled,
  hapticsEnabled,
  onInputChange,
  onTriggerAction,
  liveTelemetry,
}) => {
  const isF1 = modeSpec.id === 'f1';
  const padRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [stickActive, setStickActive] = useState(false);
  const [boostHeld, setBoostHeld] = useState(false);
  const [shieldHeld, setShieldHeld] = useState(false);

  // Dedicated F1 pedal & steer button states
  const [leftHeld, setLeftHeld] = useState(false);
  const [rightHeld, setRightHeld] = useState(false);
  const [accelHeld, setAccelHeld] = useState(false);
  const [brakeHeld, setBrakeHeld] = useState(false);

  const leftHeldRef = useRef(false);
  const rightHeldRef = useRef(false);
  const accelHeldRef = useRef(false);
  const brakeHeldRef = useRef(false);

  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroNotice, setGyroNotice] = useState<string | null>(null);
  const activePointerId = useRef<number | null>(null);
  const maxRadius = variant === 'overlay' ? 40 : 54;

  const syncF1Axes = useCallback(() => {
    const moveX = (rightHeldRef.current ? 1 : 0) - (leftHeldRef.current ? 1 : 0);
    const moveY = (accelHeldRef.current ? 1 : 0) - (brakeHeldRef.current ? 1 : 0);
    onInputChange({ moveX, moveY });
  }, [onInputChange]);

  // Reset held inputs when switching mode or unmounting
  useEffect(() => {
    return () => {
      leftHeldRef.current = false;
      rightHeldRef.current = false;
      accelHeldRef.current = false;
      brakeHeldRef.current = false;
      onInputChange({ moveX: 0, moveY: 0, boost: false, shield: false });
    };
  }, [modeSpec.id, onInputChange]);

  // Gyroscope orientation listener when toggled on Android / iOS
  useEffect(() => {
    if (!gyroEnabled) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0; // left-right tilt (-90..90)
      const beta = event.beta ?? 0; // front-back tilt (-180..180)
      const steer = Math.max(-1, Math.min(1, gamma / 32));
      const throttle = Math.max(-1, Math.min(1, (45 - beta) / 30));
      setKnobOffset({ x: steer * maxRadius, y: -throttle * maxRadius });
      onInputChange({ moveX: steer, moveY: throttle });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [gyroEnabled, maxRadius, onInputChange]);

  const toggleGyro = async () => {
    triggerHaptic('switch', hapticsEnabled);
    soundEngine.playClick(sfxEnabled);

    if (gyroEnabled) {
      setGyroEnabled(false);
      setKnobOffset({ x: 0, y: 0 });
      onInputChange({ moveX: 0, moveY: 0 });
      setGyroNotice(null);
      return;
    }

    const DevOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
      try {
        const res = await DevOrient.requestPermission();
        if (res !== 'granted') {
          setGyroNotice('Motion permission denied — use touch controls.');
          return;
        }
      } catch {
        setGyroNotice('Gyro sensor unavailable on this device.');
        return;
      }
    }

    setGyroEnabled(true);
    setGyroNotice('Gyro steering active — tilt device to steer.');
  };

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawX = clientX - cx;
    const rawY = clientY - cy;
    // When stage is CSS-rotated +90deg clockwise on a portrait phone, map physical screen touch axes to landscape axes
    let dx = rotatedLandscape ? rawY : rawX;
    let dy = rotatedLandscape ? -rawX : rawY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    onInputChange({
      moveX: Number((dx / maxRadius).toFixed(2)),
      moveY: Number((-dy / maxRadius).toFixed(2)),
    });
  };

  const resetStick = () => {
    activePointerId.current = null;
    setStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onInputChange({ moveX: 0, moveY: 0 });
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (gyroEnabled) setGyroEnabled(false);
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer capture error
    }
    setStickActive(true);
    triggerHaptic('tap', hapticsEnabled);
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    resetStick();
  };

  const setSteerButton = (side: 'left' | 'right', pressed: boolean, e?: React.PointerEvent<HTMLButtonElement>) => {
    if (pressed && e) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure on synthetic events
      }
      if (gyroEnabled) setGyroEnabled(false);
      triggerHaptic('tap', hapticsEnabled);
    }
    if (side === 'left') {
      leftHeldRef.current = pressed;
      setLeftHeld(pressed);
    } else {
      rightHeldRef.current = pressed;
      setRightHeld(pressed);
    }
    syncF1Axes();
  };

  const setPedalButton = (pedal: 'accel' | 'brake', pressed: boolean, e?: React.PointerEvent<HTMLButtonElement>) => {
    if (pressed && e) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure on synthetic events
      }
      if (gyroEnabled) setGyroEnabled(false);
      triggerHaptic(pedal === 'accel' ? 'switch' : 'tap', hapticsEnabled);
    }
    if (pedal === 'accel') {
      accelHeldRef.current = pressed;
      setAccelHeld(pressed);
    } else {
      brakeHeldRef.current = pressed;
      setBrakeHeld(pressed);
    }
    syncF1Axes();
  };

  const stickSizeClass = variant === 'overlay' ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-44 h-44';
  const knobSizeClass = variant === 'overlay' ? 'w-11 h-11 sm:w-12 sm:h-12' : 'w-16 h-16';

  if (variant === 'overlay') {
    if (isF1) {
      return (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex items-end justify-between px-3 sm:px-6 pb-safe">
          {/* Left Side: Click/Hold Left & Right Steering Buttons */}
          <div className="pointer-events-auto flex items-end gap-2.5">
            <button
              type="button"
              data-testid="f1-steer-left"
              aria-label="Steer Left"
              onPointerDown={(e) => setSteerButton('left', true, e)}
              onPointerUp={() => setSteerButton('left', false)}
              onPointerCancel={() => setSteerButton('left', false)}
              className={`min-h-[64px] min-w-[68px] sm:min-w-[76px] px-3 rounded-2xl border-2 font-extrabold text-xs flex flex-col items-center justify-center gap-1 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                leftHeld
                  ? 'border-cyan-300 bg-cyan-400 text-slate-950 shadow-lg'
                  : 'border-cyan-400/45 bg-[#070d1d]/92 text-slate-100'
              }`}
            >
              <ArrowLeft className="w-6 h-6" />
              <span>LEFT</span>
            </button>

            <button
              type="button"
              data-testid="f1-steer-right"
              aria-label="Steer Right"
              onPointerDown={(e) => setSteerButton('right', true, e)}
              onPointerUp={() => setSteerButton('right', false)}
              onPointerCancel={() => setSteerButton('right', false)}
              className={`min-h-[64px] min-w-[68px] sm:min-w-[76px] px-3 rounded-2xl border-2 font-extrabold text-xs flex flex-col items-center justify-center gap-1 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                rightHeld
                  ? 'border-cyan-300 bg-cyan-400 text-slate-950 shadow-lg'
                  : 'border-cyan-400/45 bg-[#070d1d]/92 text-slate-100'
              }`}
            >
              <ArrowRight className="w-6 h-6" />
              <span>RIGHT</span>
            </button>
          </div>

          {/* Right Side: DRS Boost / Apex Surge + Brake & Accelerate Pedals */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="f1-boost-btn"
                aria-label="DRS Boost"
                onPointerDown={() => {
                  setBoostHeld(true);
                  triggerHaptic('boost', hapticsEnabled);
                  soundEngine.playBoostWhoosh(sfxEnabled);
                  onInputChange({ boost: true });
                }}
                onPointerUp={() => {
                  setBoostHeld(false);
                  onInputChange({ boost: false });
                }}
                onPointerCancel={() => {
                  setBoostHeld(false);
                  onInputChange({ boost: false });
                }}
                className={`min-h-[42px] px-3 rounded-xl border font-bold text-[11px] inline-flex items-center gap-1.5 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                  boostHeld
                    ? 'border-cyan-200 bg-cyan-400 text-slate-950'
                    : 'border-cyan-400/55 bg-[#082438]/95 text-cyan-100'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>DRS</span>
              </button>

              <button
                type="button"
                data-testid="f1-apex-btn"
                aria-label="Apex Surge"
                onPointerDown={() => {
                  triggerHaptic('fire', hapticsEnabled);
                  soundEngine.playFirePulse(sfxEnabled);
                  onTriggerAction();
                }}
                className="min-h-[42px] px-3 rounded-xl border border-pink-400/65 bg-[#3a0b28]/95 text-white font-bold text-[11px] inline-flex items-center gap-1.5 select-none touch-none cursor-pointer transition-transform active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                <span>APEX</span>
              </button>
            </div>

            <div className="flex items-end gap-2.5">
              <button
                type="button"
                data-testid="f1-brake-btn"
                aria-label="Brake"
                onPointerDown={(e) => setPedalButton('brake', true, e)}
                onPointerUp={() => setPedalButton('brake', false)}
                onPointerCancel={() => setPedalButton('brake', false)}
                className={`min-h-[60px] min-w-[66px] sm:min-w-[74px] px-3 rounded-2xl border-2 font-extrabold text-xs flex flex-col items-center justify-center gap-1 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                  brakeHeld
                    ? 'border-rose-300 bg-rose-500 text-white shadow-lg'
                    : 'border-rose-400/55 bg-[#2a0914]/92 text-rose-200'
                }`}
              >
                <OctagonAlert className="w-5 h-5" />
                <span>BRAKE</span>
              </button>

              <button
                type="button"
                data-testid="f1-accel-btn"
                aria-label="Accelerate"
                onPointerDown={(e) => setPedalButton('accel', true, e)}
                onPointerUp={() => setPedalButton('accel', false)}
                onPointerCancel={() => setPedalButton('accel', false)}
                className={`min-h-[68px] min-w-[80px] sm:min-w-[92px] px-3.5 rounded-2xl border-2 font-black text-xs flex flex-col items-center justify-center gap-1 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                  accelHeld
                    ? 'border-emerald-200 bg-emerald-400 text-slate-950 shadow-lg'
                    : 'border-emerald-400/70 bg-[#072b22]/95 text-emerald-200'
                }`}
              >
                <Gauge className="w-5 h-5" />
                <span>GAS</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex items-end justify-between px-4 sm:px-6 pb-safe">
        {/* Left Thumb Analog Stick (Tank / Ice / Zero-G) */}
        <div
          ref={padRef}
          role="application"
          aria-label="Virtual Analog Steering Stick"
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickPointerMove}
          onPointerUp={handleStickPointerUp}
          onPointerCancel={handleStickPointerUp}
          className={`pointer-events-auto relative ${stickSizeClass} rounded-full border border-cyan-400/35 bg-black/85 flex items-center justify-center touch-none select-none`}
        >
          <div className="absolute inset-3 rounded-full border border-dashed border-white/15 pointer-events-none" />
          <div
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
            }}
            className={`${knobSizeClass} rounded-full border-2 border-cyan-300 bg-cyan-400/30 shadow-lg transition-transform duration-75 ${
              stickActive ? 'scale-105 bg-cyan-400/50' : ''
            }`}
          />
        </div>

        {/* Right Thumb Action Cluster */}
        <div className="pointer-events-auto flex items-end gap-3">
          <button
            type="button"
            data-testid="gamepad-secondary-btn"
            aria-label={modeSpec.secondaryActionLabel}
            onPointerDown={() => {
              setShieldHeld(true);
              triggerHaptic('tap', hapticsEnabled);
              onInputChange({ shield: true });
            }}
            onPointerUp={() => {
              setShieldHeld(false);
              onInputChange({ shield: false });
            }}
            onPointerCancel={() => {
              setShieldHeld(false);
              onInputChange({ shield: false });
            }}
            className={`min-h-[54px] min-w-[54px] px-2.5 rounded-2xl border font-bold text-[11px] flex flex-col items-center justify-center gap-1 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
              shieldHeld
                ? modeSpec.id === 'ice'
                  ? 'border-cyan-300 bg-cyan-400 text-black'
                  : 'border-amber-300 bg-amber-600 text-white'
                : 'border-white/20 bg-black/90 text-slate-100'
            }`}
          >
            {modeSpec.id === 'ice' ? (
              <Snowflake className={`w-4 h-4 ${shieldHeld ? 'text-black' : 'text-cyan-300'}`} />
            ) : (
              <Shield className="w-4 h-4 text-amber-300" />
            )}
            <span>{modeSpec.id === 'ice' ? 'DRIFT' : modeSpec.secondaryActionLabel.split(' ')[0]}</span>
          </button>

          <button
            type="button"
            aria-label="Boost Thruster"
            onPointerDown={() => {
              setBoostHeld(true);
              triggerHaptic('boost', hapticsEnabled);
              soundEngine.playBoostWhoosh(sfxEnabled);
              onInputChange({ boost: true });
            }}
            onPointerUp={() => {
              setBoostHeld(false);
              onInputChange({ boost: false });
            }}
            onPointerCancel={() => {
              setBoostHeld(false);
              onInputChange({ boost: false });
            }}
            className={`min-h-[60px] min-w-[60px] px-2.5 rounded-2xl border font-bold text-[11px] flex flex-col items-center justify-center gap-1 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
              boostHeld
                ? 'border-cyan-200 bg-cyan-400 text-slate-950'
                : 'border-cyan-400/60 bg-[#082438]/95 text-cyan-100'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span>BOOST</span>
          </button>

          <button
            type="button"
            aria-label={modeSpec.actionLabel}
            onPointerDown={() => {
              triggerHaptic('fire', hapticsEnabled);
              soundEngine.playFirePulse(sfxEnabled);
              onTriggerAction();
            }}
            className="min-h-[68px] min-w-[68px] px-2.5 rounded-2xl border border-pink-400/70 bg-[#3a0b28]/95 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 select-none touch-none cursor-pointer transition-transform active:scale-95"
          >
            <Sparkles className="w-5 h-5 text-pink-300" />
            <span>{modeSpec.actionLabel.split(' ')[0]}</span>
          </button>
        </div>
      </div>
    );
  }

  // Dedicated Android Controller Deck ('full' variant)
  return (
    <section className="rounded-3xl border border-white/10 bg-[#050609] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Android Motion Controller
          </div>
          <h3 className="text-lg font-extrabold text-white">
            {modeSpec.title} Pad
          </h3>
        </div>
        <button
          type="button"
          onClick={toggleGyro}
          aria-pressed={gyroEnabled}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
            gyroEnabled
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
              : 'border-white/15 bg-black text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Compass className="w-4 h-4 text-cyan-400" />
          <span>{gyroEnabled ? 'Gyro Tilt: ON' : 'Enable Gyro Tilt'}</span>
        </button>
      </div>

      {gyroNotice && (
        <p className="text-xs text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 rounded-xl px-3.5 py-2">
          {gyroNotice}
        </p>
      )}

      {liveTelemetry && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-black border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Speed</div>
            <div className="text-xl font-extrabold font-mono-code text-white tabular-nums">
              {Math.round(liveTelemetry.speed * 14)}
              <span className="text-xs font-normal text-slate-400 ml-1">km/h</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">DRS Energy</div>
            <div className="text-xl font-extrabold font-mono-code text-cyan-400 tabular-nums">
              {Math.round(liveTelemetry.boostEnergy)}%
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Live Score</div>
            <div className="text-xl font-extrabold font-mono-code text-emerald-400 tabular-nums">
              {Math.round(liveTelemetry.score)}
            </div>
          </div>
        </div>
      )}

      {isF1 ? (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onPointerDown={(e) => setSteerButton('left', true, e)}
              onPointerUp={() => setSteerButton('left', false)}
              onPointerCancel={() => setSteerButton('left', false)}
              className={`min-h-[76px] rounded-2xl border-2 font-extrabold text-sm flex items-center justify-center gap-2 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                leftHeld
                  ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                  : 'border-cyan-400/40 bg-slate-900 text-white'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>LEFT</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => setSteerButton('right', true, e)}
              onPointerUp={() => setSteerButton('right', false)}
              onPointerCancel={() => setSteerButton('right', false)}
              className={`min-h-[76px] rounded-2xl border-2 font-extrabold text-sm flex items-center justify-center gap-2 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                rightHeld
                  ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                  : 'border-cyan-400/40 bg-slate-900 text-white'
              }`}
            >
              <span>RIGHT</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onPointerDown={(e) => setPedalButton('brake', true, e)}
              onPointerUp={() => setPedalButton('brake', false)}
              onPointerCancel={() => setPedalButton('brake', false)}
              className={`min-h-[72px] rounded-2xl border-2 font-extrabold text-sm flex items-center justify-center gap-2 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                brakeHeld
                  ? 'border-rose-300 bg-rose-500 text-white'
                  : 'border-rose-400/50 bg-rose-950/60 text-rose-200'
              }`}
            >
              <OctagonAlert className="w-5 h-5" />
              <span>BRAKE</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => setPedalButton('accel', true, e)}
              onPointerUp={() => setPedalButton('accel', false)}
              onPointerCancel={() => setPedalButton('accel', false)}
              className={`min-h-[72px] rounded-2xl border-2 font-black text-sm flex items-center justify-center gap-2 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                accelHeld
                  ? 'border-emerald-200 bg-emerald-400 text-slate-950'
                  : 'border-emerald-400/60 bg-emerald-950/70 text-emerald-200'
              }`}
            >
              <Gauge className="w-5 h-5" />
              <span>ACCELERATE</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onPointerDown={() => {
                setBoostHeld(true);
                triggerHaptic('boost', hapticsEnabled);
                soundEngine.playBoostWhoosh(sfxEnabled);
                onInputChange({ boost: true });
              }}
              onPointerUp={() => {
                setBoostHeld(false);
                onInputChange({ boost: false });
              }}
              onPointerCancel={() => {
                setBoostHeld(false);
                onInputChange({ boost: false });
              }}
              className={`min-h-[54px] rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                boostHeld
                  ? 'border-cyan-200 bg-cyan-400 text-slate-950'
                  : 'border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>DRS Boost</span>
            </button>

            <button
              type="button"
              onPointerDown={() => {
                triggerHaptic('fire', hapticsEnabled);
                soundEngine.playFirePulse(sfxEnabled);
                onTriggerAction();
              }}
              className="min-h-[54px] rounded-2xl border border-pink-400/50 bg-pink-500/20 hover:bg-pink-500/30 text-pink-100 font-bold text-xs flex items-center justify-center gap-2 select-none touch-none cursor-pointer transition-transform active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-pink-300" />
              <span>{modeSpec.actionLabel}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
          {/* Left Analog Stick */}
          <div className="flex flex-col items-center gap-2">
            <div
              ref={padRef}
              role="application"
              aria-label="Touch Analog Thumbstick"
              onPointerDown={handleStickPointerDown}
              onPointerMove={handleStickPointerMove}
              onPointerUp={handleStickPointerUp}
              onPointerCancel={handleStickPointerUp}
              className={`relative ${stickSizeClass} rounded-full border-2 border-cyan-500/35 bg-slate-950/90 flex items-center justify-center touch-none select-none shadow-inner`}
            >
              <div className="absolute inset-4 rounded-full border border-dashed border-slate-700 pointer-events-none" />
              <div
                style={{
                  transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                }}
                className={`${knobSizeClass} rounded-full border-2 border-cyan-300 bg-cyan-400/30 shadow-lg transition-transform duration-75 ${
                  stickActive ? 'scale-105 bg-cyan-400/50' : ''
                }`}
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Drag to Steer &amp; Throttle
            </span>
          </div>

          {/* Right Action Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:min-w-[230px]">
            <button
              type="button"
              onPointerDown={() => {
                setBoostHeld(true);
                triggerHaptic('boost', hapticsEnabled);
                soundEngine.playBoostWhoosh(sfxEnabled);
                onInputChange({ boost: true });
              }}
              onPointerUp={() => {
                setBoostHeld(false);
                onInputChange({ boost: false });
              }}
              onPointerCancel={() => {
                setBoostHeld(false);
                onInputChange({ boost: false });
              }}
              className={`min-h-[68px] rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                boostHeld
                  ? 'border-cyan-200 bg-cyan-400 text-slate-950'
                  : 'border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
              }`}
            >
              <Zap className="w-5 h-5" />
              <span>Nitro Boost</span>
            </button>

            <button
              type="button"
              onPointerDown={() => {
                triggerHaptic('fire', hapticsEnabled);
                soundEngine.playFirePulse(sfxEnabled);
                onTriggerAction();
              }}
              className="min-h-[68px] rounded-2xl border border-pink-400/50 bg-pink-500/20 hover:bg-pink-500/30 text-pink-100 font-bold text-xs flex flex-col items-center justify-center gap-1.5 select-none touch-none cursor-pointer transition-transform active:scale-95"
            >
              <Sparkles className="w-5 h-5 text-pink-300" />
              <span>{modeSpec.actionLabel}</span>
            </button>

            <button
              type="button"
              onPointerDown={() => {
                setShieldHeld(true);
                triggerHaptic('tap', hapticsEnabled);
                onInputChange({ shield: true });
              }}
              onPointerUp={() => {
                setShieldHeld(false);
                onInputChange({ shield: false });
              }}
              onPointerCancel={() => {
                setShieldHeld(false);
                onInputChange({ shield: false });
              }}
              className={`col-span-2 min-h-[52px] rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 select-none touch-none cursor-pointer transition-transform active:scale-95 ${
                shieldHeld
                  ? modeSpec.id === 'ice'
                    ? 'border-cyan-300 bg-cyan-400 text-black'
                    : 'border-amber-300 bg-amber-500/35 text-white'
                  : 'border-white/15 bg-black text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {modeSpec.id === 'ice' ? (
                <Snowflake className={`w-4 h-4 ${shieldHeld ? 'text-black' : 'text-cyan-300'}`} />
              ) : (
                <Shield className="w-4 h-4 text-amber-300" />
              )}
              <span>{modeSpec.secondaryActionLabel}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
