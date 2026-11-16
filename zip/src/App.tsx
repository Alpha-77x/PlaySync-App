import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Camera,
  Gamepad2,
  Pause,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Users,
  Vibrate,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  type ArenaModeId,
  type CameraPreset,
  type ControlInput,
  type MatchPhase,
  ARENA_MODES,
  createInitialLobbies,
  findModeByPin,
  getConnectedCount,
  getRankedLeaderboard,
  getReadyCount,
} from './engine/arenaLogic';
import { ArenaViewport3D, type LiveTelemetry } from './components/ArenaViewport3D';
import { GameHubScreen } from './components/GameHubScreen';
import { LeaderboardSection } from './components/LeaderboardSection';
import { ModeSpecsPanel } from './components/ModeSpecsPanel';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QRCodeCard } from './components/QRCodeCard';
import { SquadRosterSection } from './components/SquadRosterSection';
import { TouchGamepad } from './components/TouchGamepad';
import { useMultiplayerRoom } from './hooks/useMultiplayerRoom';
import type { RoomSummary } from './shared/multiplayerProtocol';
import { triggerHaptic } from './utils/haptics';
import { soundEngine } from './utils/soundEngine';

type ViewScreen = 'hub' | 'lobby';
type MobileLobbyTab = 'arena' | 'squad' | 'pairing' | 'gamepad';

const LOBBY_SHORT_NAMES: Record<ArenaModeId, string> = {
  f1: 'F1 Grand Prix',
  tank: 'Tank Duel',
  ice: 'Slip N Bump',
  zerog: 'Zero-G',
};

export default function App() {
  const [viewScreen, setViewScreen] = useState<ViewScreen>('hub');
  const [activeMode, setActiveMode] = useState<ArenaModeId>('f1');
  const [playerCallsign, setPlayerCallsign] = useState<string>('Host Console');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbit');
  const [localLobbies] = useState(() => createInitialLobbies());
  const [roomSummaries, setRoomSummaries] = useState<RoomSummary[]>([]);

  const [sfxEnabled, setSfxEnabled] = useState<boolean>(true);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [mobileTab, setMobileTab] = useState<MobileLobbyTab>('arena');
  const [showOverlayPad, setShowOverlayPad] = useState<boolean>(true);
  const [landscapePlayPref, setLandscapePlayPref] = useState<boolean>(true);
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() =>
    typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1280, height: 800 }
  );
  const [actionPulseCounter, setActionPulseCounter] = useState<number>(0);
  const [joinedNotice, setJoinedNotice] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const [telemetry, setTelemetry] = useState<LiveTelemetry>({
    speed: 0,
    boostEnergy: 100,
    score: 0,
    driftPoints: 0,
    hitsLanded: 0,
    laps: 1,
    isBoosting: false,
  });

  const controlInputRef = useRef<ControlInput>({
    moveX: 0,
    moveY: 0,
    boost: false,
    action: false,
    shield: false,
  });

  const {
    wsConnected,
    clientId,
    pingMs,
    roomSnapshot,
    roomError,
    roomEvents,
    remoteVehiclesRef,
    remoteActionsRef,
    joinRoom,
    leaveRoom,
    setReady,
    setLivery,
    setRoundSeconds,
    addBot,
    removeSlot,
    regeneratePin,
    startMatch,
    pauseMatch,
    endMatch,
    sendVehicleState,
    sendActionEvent,
    sendHitEvent,
  } = useMultiplayerRoom();

  const effectiveMode: ArenaModeId = roomSnapshot?.modeId ?? activeMode;
  const modeSpec = ARENA_MODES[effectiveMode];
  const fallbackLobby = localLobbies[effectiveMode];

  const roomPin = roomSnapshot?.roomPin ?? fallbackLobby.roomPin;
  const slots = roomSnapshot?.slots ?? fallbackLobby.slots;
  const matchPhase: MatchPhase = roomSnapshot?.matchPhase ?? 'lobby';
  const isSandbox = roomSnapshot?.isSandbox ?? false;
  const roundNumber = roomSnapshot?.roundNumber ?? 1;
  const roundSeconds = roomSnapshot?.roundSeconds ?? 60;
  const timeLeft = roomSnapshot?.timeLeft ?? roundSeconds;

  const selfSlot = useMemo(() => {
    if (!roomSnapshot || !clientId) return slots[0];
    const myPlayer = roomSnapshot.players.find((p) => p.clientId === clientId);
    if (!myPlayer) return slots[0];
    return slots[myPlayer.slotNumber - 1] ?? slots[0];
  }, [roomSnapshot, clientId, slots]);

  const hostLivery = selfSlot?.liveryColor ?? modeSpec.accentColor;
  const connectedCount = getConnectedCount(slots);
  const readyCount = getReadyCount(slots);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setActionToast(null);
    }, 1800);
  }, []);

  // Poll /api/rooms while browsing the Game Hub so live player counts & PINs stay fresh
  useEffect(() => {
    if (viewScreen !== 'hub') return;
    let active = true;
    const loadRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || !contentType.includes('application/json')) return;
        const data = (await res.json()) as { rooms?: RoomSummary[] };
        if (active && Array.isArray(data.rooms)) {
          setRoomSummaries(data.rooms);
        }
      } catch {
        // Ignore transient offline errors
      }
    };
    loadRooms();
    const timer = window.setInterval(loadRooms, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [viewScreen]);

  // URL parameter routing (?join=XXXX, ?mode=tank, ?autostart=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') as ArenaModeId | null;
    const joinParam = params.get('join');
    const autostart = params.get('autostart') === '1';

    if (joinParam && /^\d{4}$/.test(joinParam)) {
      const matched = findModeByPin(localLobbies, joinParam) ?? 'f1';
      setActiveMode(matched);
      setPlayerCallsign('Android Player');
      setViewScreen('lobby');
      setMobileTab('gamepad');
      joinRoom({
        roomPin: joinParam,
        modeId: matched,
        playerName: 'Android Player',
        inputType: 'Touch & Gyro',
        liveryColor: '#ffb703',
      });
      setJoinedNotice(`Joined live multiplayer Room #${joinParam}`);
    } else if (modeParam && modeParam in ARENA_MODES) {
      setActiveMode(modeParam);
      setViewScreen('lobby');
      joinRoom({
        modeId: modeParam,
        playerName: 'Host Console',
        inputType: 'Touch & Gyro',
        liveryColor: ARENA_MODES[modeParam].accentColor,
      });
      if (autostart) {
        window.setTimeout(() => startMatch(false), 350);
      }
    } else if (autostart) {
      setActiveMode('f1');
      setViewScreen('lobby');
      joinRoom({
        modeId: 'f1',
        playerName: 'Host Console',
        inputType: 'Touch & Gyro',
        liveryColor: ARENA_MODES.f1.accentColor,
      });
      window.setTimeout(() => startMatch(false), 350);
    }
  }, [joinRoom, localLobbies, startMatch]);

  // Sync camera preset when entering match or switching mode
  useEffect(() => {
    if (roomSnapshot?.modeId && roomSnapshot.modeId !== activeMode) {
      setActiveMode(roomSnapshot.modeId);
    }
  }, [roomSnapshot?.modeId, activeMode]);

  // Mirror state to document.body.dataset.state
  useEffect(() => {
    const mapped =
      viewScreen === 'hub'
        ? 'hub'
        : matchPhase === 'lobby'
        ? 'title'
        : matchPhase === 'results'
        ? 'gameover'
        : matchPhase;
    document.body.dataset.state = mapped;
  }, [viewScreen, matchPhase]);

  // Track viewport size & orientation changes for portrait Hub/Lobby -> landscape play
  useEffect(() => {
    const syncViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  const orientationLockedRef = useRef(false);

  // Attempt native Screen Orientation Lock when entering/exiting active play on mobile
  useEffect(() => {
    const isPlaying = viewScreen === 'lobby' && matchPhase !== 'lobby';
    const isMobile = viewport.width < 1024;
    try {
      const orient = (typeof screen !== 'undefined' ? screen.orientation : undefined) as
        | (ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void })
        | undefined;

      if (isPlaying && isMobile && landscapePlayPref) {
        orientationLockedRef.current = true;
        orient?.lock?.('landscape').catch(() => {});
      } else if (!isPlaying && orientationLockedRef.current) {
        orientationLockedRef.current = false;
        orient?.unlock?.();
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch {
      orientationLockedRef.current = false;
    }
  }, [viewScreen, matchPhase, viewport.width, landscapePlayPref]);

  // Global keyboard shortcuts (1/2/3 camera, P/Esc pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (viewScreen !== 'lobby') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;

      if (e.key === '1') setCameraPreset('orbit');
      if (e.key === '2') setCameraPreset('chase');
      if (e.key === '3') setCameraPreset('tactical');

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (matchPhase === 'playing') pauseMatch(true);
        else if (matchPhase === 'paused') pauseMatch(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewScreen, matchPhase, pauseMatch]);

  const handleControlInputChange = useCallback((next: Partial<ControlInput>) => {
    controlInputRef.current = { ...controlInputRef.current, ...next };
  }, []);

  const handleTriggerAction = useCallback(() => {
    setActionPulseCounter((c) => c + 1);
  }, []);

  const handleEnterLobby = (modeId: ArenaModeId) => {
    setActiveMode(modeId);
    setCameraPreset('orbit');
    setMobileTab('arena');
    setViewScreen('lobby');
    setTelemetry({
      speed: 0,
      boostEnergy: 100,
      score: 0,
      driftPoints: 0,
      hitsLanded: 0,
      laps: 1,
      isBoosting: false,
    });
    joinRoom({
      modeId,
      playerName: playerCallsign || 'Host Console',
      inputType: 'Touch & Gyro',
      liveryColor: ARENA_MODES[modeId].accentColor,
    });
  };

  const handleJoinByPin = (pin: string) => {
    const matched = roomSummaries.find((r) => r.roomPin === pin)?.modeId ?? 'f1';
    setActiveMode(matched);
    setCameraPreset('orbit');
    setMobileTab('arena');
    setViewScreen('lobby');
    joinRoom({
      roomPin: pin,
      modeId: matched,
      playerName: playerCallsign || 'Guest Player',
      inputType: 'Touch & Gyro',
      liveryColor: ARENA_MODES[matched].accentColor,
    });
  };

  const handleBackToHub = () => {
    triggerHaptic('tap', hapticsEnabled);
    soundEngine.playClick(sfxEnabled);
    leaveRoom();
    setViewScreen('hub');
    setCameraPreset('orbit');
    setJoinedNotice(null);
  };

  const handleLaunchMatch = (sandbox = false) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTelemetry({
      speed: 0,
      boostEnergy: 100,
      score: 0,
      driftPoints: 0,
      hitsLanded: 0,
      laps: 1,
      isBoosting: false,
    });
    setCameraPreset('chase');
    setMobileTab('arena');
    startMatch(sandbox);
  };

  const handleOrbCollect = useCallback(
    (points: number) => {
      triggerHaptic('tap', hapticsEnabled);
      soundEngine.playPickup(sfxEnabled);
      showToast(`+${points} Energy Core`);
    },
    [hapticsEnabled, sfxEnabled, showToast]
  );

  const handleBoostPad = useCallback(
    (points: number) => {
      triggerHaptic('boost', hapticsEnabled);
      soundEngine.playBoostPad(sfxEnabled);
      showToast(`+${points} Speed Gate Surge!`);
    },
    [hapticsEnabled, sfxEnabled, showToast]
  );

  const handleLapComplete = useCallback(
    (lap: number, points: number) => {
      triggerHaptic('boost', hapticsEnabled);
      soundEngine.playMatchStart(sfxEnabled);
      showToast(`Lap ${lap} · +${points} Bonus!`);
    },
    [hapticsEnabled, sfxEnabled, showToast]
  );

  const handleHitConfirmed = useCallback(
    (points: number, reason: string, targetClientId?: string) => {
      triggerHaptic('fire', hapticsEnabled);
      soundEngine.playHitConfirm(sfxEnabled);
      showToast(`+${points} ${reason}!`);
      sendHitEvent(points, reason, targetClientId);
    },
    [hapticsEnabled, sfxEnabled, showToast, sendHitEvent]
  );

  const rankedResults = getRankedLeaderboard(slots);
  const isPlayingOverlay = viewScreen === 'lobby' && matchPhase !== 'lobby';
  const isPortraitViewport = viewport.width < viewport.height && viewport.width < 768;
  const isRotatedLandscape = isPlayingOverlay && landscapePlayPref && isPortraitViewport;
  const isHorizontalLayout = isPlayingOverlay && (viewport.width >= viewport.height || isRotatedLandscape);
  const isCompactLandscape = isHorizontalLayout && (isRotatedLandscape || viewport.height < 540);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col pb-20 lg:pb-8">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#030712] pt-safe">
        <div className="max-w-[1560px] mx-auto px-4 lg:px-8 h-14 lg:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {viewScreen === 'lobby' && !isPlayingOverlay && (
              <button
                type="button"
                data-testid="back-to-hub-btn"
                onClick={handleBackToHub}
                className="min-h-[38px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Game Hub</span>
              </button>
            )}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-400 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20">
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <span
                className={`text-base lg:text-lg font-extrabold tracking-wider text-white whitespace-nowrap ${
                  viewScreen === 'lobby' ? 'hidden sm:inline' : ''
                }`}
              >
                PLAYSYNC
              </span>
            </div>
          </div>

          {/* Center Status Pill in Lobby */}
          {viewScreen === 'lobby' && (
            <div className="hidden md:flex items-center gap-2.5 text-xs font-semibold text-slate-300">
              <span
                style={{ color: modeSpec.accentColor }}
                className="font-extrabold uppercase tracking-wider"
              >
                {modeSpec.lobbyTitle}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-code text-cyan-300">Room #{roomPin}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-mono-code">
                <Wifi className="w-3.5 h-3.5" />
                {wsConnected ? `${pingMs}ms` : 'Local Ready'}
              </span>
            </div>
          )}

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {viewScreen === 'lobby' && (
              <span
                data-testid="mobile-header-pin"
                className="lg:hidden font-mono-code text-xs font-bold text-cyan-300 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800"
              >
                #{roomPin}
              </span>
            )}

            <PWAInstallButton compact />

            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap', hapticsEnabled);
                setSfxEnabled((v) => !v);
              }}
              aria-label={sfxEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              {sfxEnabled ? (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {viewScreen === 'lobby' && (
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  triggerHaptic('boost', hapticsEnabled);
                  soundEngine.playMatchStart(sfxEnabled);
                  handleLaunchMatch(false);
                }}
                className="hidden lg:inline-flex min-h-[42px] px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs tracking-wide uppercase transition-colors whitespace-nowrap shrink-0 cursor-pointer items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch {LOBBY_SHORT_NAMES[effectiveMode]}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* STAGE 1: DISTANCED GAME HUB SCREEN */}
      {viewScreen === 'hub' && (
        <GameHubScreen
          wsConnected={wsConnected}
          pingMs={pingMs}
          roomSummaries={roomSummaries}
          playerCallsign={playerCallsign}
          onChangeCallsign={setPlayerCallsign}
          onEnterLobby={handleEnterLobby}
          onJoinByPin={handleJoinByPin}
          sfxEnabled={sfxEnabled}
          hapticsEnabled={hapticsEnabled}
          joinError={roomError}
        />
      )}

      {/* STAGE 2 & 3: DEDICATED SINGLE-GAME LOBBY + FULLSCREEN LIVE ARENA */}
      {viewScreen === 'lobby' && (
        <>
          {joinedNotice && (
            <div className="max-w-[1560px] w-full mx-auto px-4 lg:px-8 pt-4">
              <div className="rounded-2xl border border-emerald-400/35 bg-emerald-950/50 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-200">
                <span>{joinedNotice}</span>
                <button
                  type="button"
                  onClick={() => setJoinedNotice(null)}
                  className="font-bold text-emerald-300 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <main className="w-full max-w-[1560px] mx-auto px-4 lg:px-8 pt-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* LEFT COLUMN: 3D SHOWCASE + SQUAD ROSTER */}
            <div className="lg:col-span-8 flex flex-col gap-6 lg:gap-8">
              <section
                id="section-arena"
                data-orientation={
                  isRotatedLandscape
                    ? 'landscape-rotated'
                    : isHorizontalLayout
                    ? 'landscape'
                    : 'portrait'
                }
                style={
                  isRotatedLandscape
                    ? {
                        width: `${viewport.height}px`,
                        height: `${viewport.width}px`,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(90deg)',
                      }
                    : undefined
                }
                className={`${
                  isPlayingOverlay
                    ? isRotatedLandscape
                      ? 'fixed z-40 bg-[#030712] flex flex-col p-2.5 overflow-hidden'
                      : 'fixed inset-0 z-40 bg-[#030712] flex flex-col p-2.5 sm:p-5 overflow-hidden'
                    : mobileTab === 'arena'
                    ? 'rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 sm:p-6 flex flex-col'
                    : 'hidden lg:flex rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 sm:p-6 flex-col'
                }`}
              >
                {/* Arena Top Toolbar */}
                <div
                  className={`flex ${
                    isHorizontalLayout
                      ? 'flex-row items-center justify-between gap-2 mb-2'
                      : 'flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-4'
                  }`}
                >
                  <div className="min-w-0">
                    {!isCompactLandscape && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-slate-400 mb-0.5">
                        <span style={{ color: modeSpec.accentColor }} className="font-bold uppercase tracking-wider">
                          {modeSpec.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-code whitespace-nowrap">Lobby #{roomPin}</span>
                      </div>
                    )}
                    <h1
                      className={`font-black tracking-tight text-white truncate ${
                        isCompactLandscape ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl'
                      }`}
                    >
                      {isPlayingOverlay ? modeSpec.title : modeSpec.lobbyTitle}
                    </h1>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-nowrap">
                    <div
                      role="group"
                      aria-label="3D Camera Presets"
                      className="flex items-center gap-0.5 sm:gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700/70 text-[11px] sm:text-xs"
                    >
                      {modeSpec.cameraOptions.map((cam) => (
                        <button
                          key={cam.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap', hapticsEnabled);
                            soundEngine.playClick(sfxEnabled);
                            setCameraPreset(cam.id);
                          }}
                          className={`min-h-[32px] px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                            cameraPreset === cam.id
                              ? 'bg-cyan-400 text-slate-950'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span className={isCompactLandscape ? 'inline' : 'sm:hidden'}>
                            {cam.shortLabel}
                          </span>
                          {!isCompactLandscape && (
                            <span className="hidden sm:inline">{cam.label}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {isPlayingOverlay && (
                      <>
                        {viewport.width < 1024 && (
                          <button
                            type="button"
                            data-testid="toggle-landscape-btn"
                            onClick={() => setLandscapePlayPref((v) => !v)}
                            aria-label={landscapePlayPref ? 'Switch to portrait view' : 'Switch to horizontal landscape view'}
                            className="min-h-[38px] px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[11px] font-semibold text-slate-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{landscapePlayPref ? 'Horiz' : 'Vert'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowOverlayPad((v) => !v)}
                          aria-label={showOverlayPad ? 'Hide on-screen touch pad' : 'Show on-screen touch pad'}
                          className="min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Gamepad2 className="w-4 h-4 text-cyan-400" />
                          <span className="hidden sm:inline">
                            {showOverlayPad ? 'Hide Pad' : 'Touch Pad'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => pauseMatch(matchPhase === 'playing')}
                          aria-label="Pause match"
                          className="min-h-[38px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Pause className="w-4 h-4" />
                          <span>Pause</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded 3D Canvas Container */}
                <div
                  className={`relative w-full rounded-2xl overflow-hidden bg-[#040712] border border-cyan-500/20 ${
                    isPlayingOverlay ? 'flex-1 min-h-0' : 'h-[360px] sm:h-[460px] lg:h-[520px]'
                  }`}
                >
                  <ArenaViewport3D
                    activeMode={effectiveMode}
                    cameraPreset={cameraPreset}
                    matchPhase={matchPhase}
                    liveryColor={hostLivery}
                    controlInputRef={controlInputRef}
                    actionPulseCounter={actionPulseCounter}
                    remoteVehiclesRef={remoteVehiclesRef}
                    remoteActionsRef={remoteActionsRef}
                    onTelemetryUpdate={setTelemetry}
                    onOrbCollect={handleOrbCollect}
                    onBoostPad={handleBoostPad}
                    onLapComplete={handleLapComplete}
                    onHitConfirmed={handleHitConfirmed}
                    onLocalStateEmit={sendVehicleState}
                    onActionEmit={sendActionEvent}
                  />

                  {isPlayingOverlay ? (
                    <>
                      {/* Top-Left Speed + Boost + Laps/Hits/Drift */}
                      <div
                        className={`pointer-events-none absolute top-2.5 left-2.5 z-10 flex items-center rounded-2xl border border-white/15 bg-[#050a18]/90 ${
                          isCompactLandscape ? 'gap-2.5 px-2.5 py-1.5' : 'gap-3 px-3.5 py-2'
                        }`}
                      >
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Speed
                          </div>
                          <div
                            className={`font-black font-mono-code text-white tabular-nums leading-tight ${
                              isCompactLandscape ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
                            }`}
                          >
                            {Math.round(telemetry.speed * 14)}
                            <span className="text-[10px] font-normal text-slate-400 ml-0.5">km/h</span>
                          </div>
                        </div>
                        <div className="h-6 w-px bg-slate-700" />
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Boost
                          </div>
                          <div
                            className={`font-black font-mono-code text-cyan-400 tabular-nums leading-tight ${
                              isCompactLandscape ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
                            }`}
                          >
                            {Math.round(telemetry.boostEnergy)}%
                          </div>
                        </div>
                        <div className="h-6 w-px bg-slate-700" />
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {effectiveMode === 'f1'
                              ? 'Lap'
                              : effectiveMode === 'tank' || effectiveMode === 'zerog'
                              ? 'Hits'
                              : 'Drift'}
                          </div>
                          <div
                            className={`font-black font-mono-code text-pink-400 tabular-nums leading-tight ${
                              isCompactLandscape ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
                            }`}
                          >
                            {effectiveMode === 'f1'
                              ? telemetry.laps
                              : effectiveMode === 'tank' || effectiveMode === 'zerog'
                              ? telemetry.hitsLanded
                              : Math.round(telemetry.driftPoints)}
                          </div>
                        </div>
                      </div>

                      {/* Top-Right Score + Timer */}
                      <div
                        className={`pointer-events-none absolute top-2.5 right-2.5 z-10 flex items-center rounded-2xl border border-white/15 bg-[#050a18]/90 ${
                          isCompactLandscape ? 'gap-2.5 px-2.5 py-1.5' : 'gap-3 px-3.5 py-2'
                        }`}
                      >
                        <div className="text-right">
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Score
                          </div>
                          <div
                            data-testid="live-score-value"
                            className={`font-black font-mono-code text-emerald-400 tabular-nums leading-tight ${
                              isCompactLandscape ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
                            }`}
                          >
                            {Math.round(telemetry.score)}
                          </div>
                        </div>
                        <div className="h-6 w-px bg-slate-700" />
                        <div className="text-right">
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {isSandbox ? 'Mode' : 'Time'}
                          </div>
                          <div
                            className={`font-black font-mono-code text-amber-300 tabular-nums leading-tight ${
                              isCompactLandscape ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
                            }`}
                          >
                            {isSandbox ? 'FREE' : `${timeLeft}s`}
                          </div>
                        </div>
                      </div>

                      {/* Combat / Boost Toast */}
                      {actionToast && (
                        <div className="pointer-events-none absolute top-14 sm:top-20 left-1/2 -translate-x-1/2 z-10 rounded-xl border border-cyan-400/50 bg-[#050a18]/95 px-4 py-1.5 text-xs font-extrabold tracking-wide text-cyan-300 shadow-lg whitespace-nowrap">
                          {actionToast}
                        </div>
                      )}

                      <div className="pointer-events-none hidden lg:flex absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-xs text-slate-300 bg-[#050a18]/85 border border-white/10 rounded-xl px-3.5 py-1.5 whitespace-nowrap">
                        WASD / Arrows Steer · Shift Boost · Space {modeSpec.actionLabel} · 1/2/3 Camera · P Pause
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-xl bg-[#050a18]/90 border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-200">
                        Isolated 3D Arena · {modeSpec.title}
                      </div>
                      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-[#050a18]/90 border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                        <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Drag to orbit<span className="hidden sm:inline"> 3D arena</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('boost', hapticsEnabled);
                          soundEngine.playMatchStart(sfxEnabled);
                          handleLaunchMatch(true);
                        }}
                        className="absolute bottom-3 right-3 z-10 min-h-[42px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs uppercase tracking-wide inline-flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Drive Now</span>
                      </button>
                    </>
                  )}
                </div>

                {/* On-Screen Touch Gamepad Overlay */}
                {isPlayingOverlay && matchPhase === 'playing' && showOverlayPad && (
                  <TouchGamepad
                    modeSpec={modeSpec}
                    variant="overlay"
                    rotatedLandscape={isRotatedLandscape}
                    sfxEnabled={sfxEnabled}
                    hapticsEnabled={hapticsEnabled}
                    onInputChange={handleControlInputChange}
                    onTriggerAction={handleTriggerAction}
                  />
                )}

                {/* Lobby Footer */}
                {!isPlayingOverlay && (
                  <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-cyan-400 font-semibold">Dedicated Stage:</span>
                      <span className="text-slate-200">{modeSpec.title}</span>
                      <span aria-hidden="true">·</span>
                      <span>Real-time WebSocket multiplayer room #{roomPin}</span>
                    </div>
                    <span className="font-mono-code text-emerald-400 whitespace-nowrap">
                      {readyCount}/8 Squad Ready
                    </span>
                  </div>
                )}

                {/* PAUSE MODAL */}
                {matchPhase === 'paused' && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pause-modal-title"
                    className="absolute inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
                  >
                    <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0b1326] p-5 sm:p-6 space-y-4 shadow-2xl">
                      <div className="text-center space-y-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                          Match Paused
                        </div>
                        <h2 id="pause-modal-title" className="text-xl sm:text-2xl font-black text-white">
                          {modeSpec.title}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-2.5 sm:p-3">
                          <div className="text-xs text-slate-400">Current Score</div>
                          <div className="text-lg sm:text-xl font-black font-mono-code text-emerald-400 tabular-nums">
                            {Math.round(telemetry.score)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-2.5 sm:p-3">
                          <div className="text-xs text-slate-400">
                            {effectiveMode === 'tank' ? 'Direct Hits' : 'Drift Bonus'}
                          </div>
                          <div className="text-lg sm:text-xl font-black font-mono-code text-cyan-400 tabular-nums">
                            {effectiveMode === 'tank'
                              ? telemetry.hitsLanded
                              : Math.round(telemetry.driftPoints)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => pauseMatch(false)}
                          className="w-full min-h-[44px] rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm cursor-pointer"
                        >
                          Resume Match
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLaunchMatch(isSandbox)}
                          className="w-full min-h-[42px] rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Restart Round</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            endMatch();
                            setCameraPreset('orbit');
                          }}
                          className="w-full min-h-[42px] rounded-2xl border border-slate-700 text-slate-300 hover:text-white font-semibold text-sm cursor-pointer"
                        >
                          Return to {LOBBY_SHORT_NAMES[effectiveMode]} Lobby
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* RESULTS PODIUM MODAL */}
                {matchPhase === 'results' && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="results-modal-title"
                    className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                  >
                    <div className="w-full max-w-md rounded-3xl border border-cyan-400/35 bg-[#0b1326] p-5 sm:p-6 space-y-4 shadow-2xl">
                      <div className="text-center space-y-1">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto mb-2">
                          <Award className="w-6 h-6" />
                        </div>
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Round {roundNumber} Complete
                        </div>
                        <h2 id="results-modal-title" className="text-2xl font-black text-white">
                          {modeSpec.title} Standings
                        </h2>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {rankedResults.map((player, idx) => (
                          <div
                            key={player.id}
                            className={`rounded-2xl p-3 border flex items-center justify-between ${
                              idx === 0
                                ? 'bg-amber-500/10 border-amber-400/40'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono-code font-extrabold text-sm text-slate-200 w-6">
                                #{idx + 1}
                              </span>
                              <span className="text-sm font-bold text-white truncate">
                                {player.name}
                              </span>
                            </div>
                            <span className="font-mono-code font-extrabold text-sm text-cyan-300 tabular-nums">
                              {Math.round(player.score)} pts
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          data-start="true"
                          onClick={() => handleLaunchMatch(false)}
                          className="min-h-[48px] rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm cursor-pointer"
                        >
                          Play Next Round
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            endMatch();
                            setCameraPreset('orbit');
                          }}
                          className="min-h-[48px] rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
                        >
                          Back to Lobby
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* DEDICATED LOBBY SQUAD ROSTER */}
              <div
                id="section-squad"
                className={mobileTab === 'squad' ? 'block space-y-5' : 'hidden lg:block space-y-6'}
              >
                <SquadRosterSection
                  slots={slots}
                  lobbyTitle={modeSpec.lobbyTitle}
                  sfxEnabled={sfxEnabled}
                  onAddGuest={(customName) => addBot(customName)}
                  onRemoveGuest={(num) => removeSlot(num)}
                  onToggleReady={() => setReady(!(selfSlot?.ready ?? true))}
                  onLaunchMatch={() => handleLaunchMatch(false)}
                  onLaunchSandbox={() => handleLaunchMatch(true)}
                />

                {/* Live Multiplayer Room Activity Feed */}
                {roomEvents.length > 0 && (
                  <section className="rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                      <Radio className="w-4 h-4" />
                      <span>Live Multiplayer Room Feed</span>
                    </div>
                    <div className="space-y-1.5">
                      {roomEvents.map((ev) => (
                        <div key={ev.id} className="text-xs text-slate-300 flex items-center gap-2">
                          <span
                            style={{ backgroundColor: ev.accent ?? '#00f5ff' }}
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                          />
                          <span>{ev.text}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <div className="lg:hidden">
                  <LeaderboardSection
                    slots={slots}
                    roomPin={roomPin}
                    roundNumber={roundNumber}
                    sfxEnabled={sfxEnabled}
                    onSimulateGuestJoin={() => {
                      triggerHaptic('switch', hapticsEnabled);
                      soundEngine.playJoinChime(sfxEnabled);
                      addBot();
                    }}
                  />
                </div>
              </div>

              {/* DEDICATED ANDROID CONTROLLER TAB */}
              <div className={mobileTab === 'gamepad' ? 'block lg:hidden space-y-5' : 'hidden'}>
                <TouchGamepad
                  modeSpec={modeSpec}
                  variant="full"
                  sfxEnabled={sfxEnabled}
                  hapticsEnabled={hapticsEnabled}
                  onInputChange={handleControlInputChange}
                  onTriggerAction={handleTriggerAction}
                  liveTelemetry={telemetry}
                />

                <section className="rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
                    Device Feedback Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !hapticsEnabled;
                        setHapticsEnabled(next);
                        if (next) triggerHaptic('switch', true);
                      }}
                      aria-pressed={hapticsEnabled}
                      className={`min-h-[48px] rounded-2xl border px-3 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer ${
                        hapticsEnabled
                          ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <Vibrate className="w-4 h-4" />
                      <span>Haptics: {hapticsEnabled ? 'On' : 'Off'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSfxEnabled((v) => !v)}
                      aria-pressed={sfxEnabled}
                      className={`min-h-[48px] rounded-2xl border px-3 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer ${
                        sfxEnabled
                          ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {sfxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      <span>Audio: {sfxEnabled ? 'On' : 'Off'}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchMatch(true)}
                    className="w-full min-h-[48px] rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Drive in {LOBBY_SHORT_NAMES[effectiveMode]}</span>
                  </button>
                </section>
              </div>
            </div>

            {/* RIGHT COLUMN: PAIRING, TUNING & STANDINGS FOR THIS LOBBY */}
            <aside
              id="section-pairing"
              className={`lg:col-span-4 flex flex-col gap-6 ${
                mobileTab === 'pairing' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <QRCodeCard
                roomPin={roomPin}
                lobbyTitle={modeSpec.lobbyTitle}
                wsConnected={wsConnected}
                pingMs={pingMs}
                onRegeneratePin={regeneratePin}
                onOpenTouchPad={() => {
                  setMobileTab('gamepad');
                  handleLaunchMatch(true);
                }}
                sfxEnabled={sfxEnabled}
              />

              <ModeSpecsPanel
                modeSpec={modeSpec}
                liveryColor={hostLivery}
                roundSeconds={roundSeconds}
                sfxEnabled={sfxEnabled}
                onSelectLivery={(hex) => setLivery(hex)}
                onSelectRoundSeconds={(secs) => setRoundSeconds(secs)}
              />

              <LeaderboardSection
                slots={slots}
                roomPin={roomPin}
                roundNumber={roundNumber}
                sfxEnabled={sfxEnabled}
                onSimulateGuestJoin={() => {
                  triggerHaptic('switch', hapticsEnabled);
                  soundEngine.playJoinChime(sfxEnabled);
                  addBot();
                }}
              />

              <section className="hidden lg:flex rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      Real-Time WebSocket Sync
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Multi-device play · Touch haptics · Offline PWA
                    </div>
                  </div>
                </div>
                <PWAInstallButton compact />
              </section>
            </aside>
          </main>

          {/* MOBILE LOBBY BOTTOM NAVIGATION BAR */}
          {!isPlayingOverlay && (
            <nav
              aria-label="Mobile lobby navigation"
              className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#070d1d] pb-safe"
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
                  const active = mobileTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap', hapticsEnabled);
                        soundEngine.playClick(sfxEnabled);
                        setMobileTab(item.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={`flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors cursor-pointer ${
                        active ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[11px] font-semibold tracking-tight">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </>
      )}

      <OfflineIndicator />
    </div>
  );
}
