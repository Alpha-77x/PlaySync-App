import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Install PlaySync Android App"
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/25 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'min-h-[40px] px-3 py-1.5 text-xs' : 'min-h-[44px] px-4 py-2 text-xs'
        }`}
      >
        <Download className="w-4 h-4 text-cyan-400" />
        <span>{compact ? 'Get App' : 'Install Android App'}</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-dialog-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#050609] p-6 shadow-2xl text-left">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="install-dialog-title" className="text-base font-bold text-white">
                    Install PlaySync on {isIOS ? 'iPhone / iPad' : 'Android'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Standalone fullscreen mode · Offline cached assets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-sm text-slate-300 mb-5">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-300 font-mono-code text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Tap the <strong className="text-white">Share</strong> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-300 font-mono-code text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Scroll down and select <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-300 mb-5">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-300 font-mono-code text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Open this console in <strong className="text-white">{isAndroid ? 'Chrome on Android' : 'Chrome or Edge'}</strong> and tap the browser menu (<strong className="text-white">⋮</strong>).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-300 font-mono-code text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Tap <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong> to launch PlaySync as a standalone Android app.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm hover:bg-cyan-300 transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
