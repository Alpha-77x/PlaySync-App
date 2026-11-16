import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, RefreshCw, Share2, Smartphone } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { soundEngine } from '../utils/soundEngine';

interface QRCodeCardProps {
  roomPin: string;
  lobbyTitle?: string;
  wsConnected?: boolean;
  pingMs?: number;
  onRegeneratePin: () => void;
  onOpenTouchPad: () => void;
  sfxEnabled: boolean;
}

export const QRCodeCard: React.FC<QRCodeCardProps> = ({
  roomPin,
  lobbyTitle,
  wsConnected = true,
  pingMs = 8,
  onRegeneratePin,
  onOpenTouchPad,
  sfxEnabled,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedType, setCopiedType] = useState<'pin' | 'url' | null>(null);

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://playsync.gg';
  const joinUrl = `${origin}/?join=${roomPin}`;
  const displayJoinUrl = `playsync.gg/join/${roomPin}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(joinUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [joinUrl]);

  const handleCopy = async (text: string, type: 'pin' | 'url') => {
    triggerHaptic('tap');
    soundEngine.playClick(sfxEnabled);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard fallback ignored silently
    }
    setCopiedType(type);
    window.setTimeout(() => setCopiedType(null), 1600);
  };

  const handleNativeShare = async () => {
    triggerHaptic('tap');
    soundEngine.playClick(sfxEnabled);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${lobbyTitle ?? 'PlaySync'} #${roomPin}`,
          text: `Tap to pair your Android phone as a live controller in ${lobbyTitle ?? 'PlaySync Arena'} (Room #${roomPin}).`,
          url: joinUrl,
        });
        return;
      } catch {
        // User dismissed or share unavailable; fall back to copy
      }
    }
    await handleCopy(joinUrl, 'url');
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1222]/90 p-5 sm:p-6 flex flex-col items-center text-center">
      <div className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 tracking-wider uppercase truncate">
          <Smartphone className="w-4 h-4 shrink-0" />
          <span className="truncate">{lobbyTitle ?? 'Gamepad Pairing'}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('switch');
            soundEngine.playClick(sfxEnabled);
            onRegeneratePin();
          }}
          aria-label="Generate new room PIN"
          className="min-h-[36px] px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>New PIN</span>
        </button>
      </div>

      <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight mb-1">
        Scan to Connect Phone
      </h3>
      <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
        Point your Android camera at the QR code to pair directly into this game lobby.
      </p>

      <div className="p-3.5 rounded-3xl bg-slate-900/90 border border-cyan-400/35 mb-5 shadow-lg shadow-cyan-500/10">
        <div className="w-44 h-44 sm:w-48 sm:h-48 bg-white rounded-2xl p-2.5 flex items-center justify-center overflow-hidden">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code to join PlaySync room ${roomPin}`}
              className="w-full h-full object-contain rounded-lg"
            />
          ) : (
            <div className="w-full h-full rounded-lg bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
              PIN {roomPin}
            </div>
          )}
        </div>
      </div>

      <div className="w-full space-y-3">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Room Access Code
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <span
              data-testid="room-pin-value"
              className="text-3xl sm:text-4xl font-black font-mono-code tracking-widest text-cyan-400"
            >
              {roomPin}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(roomPin, 'pin')}
              aria-label={`Copy room PIN ${roomPin}`}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              {copiedType === 'pin' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="w-full p-2.5 rounded-xl bg-slate-950/75 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono-code text-slate-400">
          <span className="truncate pl-1">{displayJoinUrl}</span>
          <button
            type="button"
            onClick={() => handleCopy(joinUrl, 'url')}
            aria-label="Copy room join link"
            className="min-h-[36px] px-3 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-300 font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {copiedType === 'url' ? 'Copied' : 'Copy Link'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleNativeShare}
            className="min-h-[44px] px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/70 text-xs font-semibold text-slate-200 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span>Share Invite</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('switch');
              soundEngine.playClick(sfxEnabled);
              onOpenTouchPad();
            }}
            className="min-h-[44px] px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-xs font-semibold text-cyan-200 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>Use This Phone</span>
          </button>
        </div>
      </div>

      <div className="w-full mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono-code">
          {wsConnected ? `WebSocket Live · ${pingMs}ms` : 'Local & Offline Ready'}
        </span>
        <span>Zero-Install Sync</span>
      </div>
    </section>
  );
};
