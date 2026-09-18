import React, { useState } from "react";
import { usePWAInstall } from "../hooks/usePWAInstall.ts";
import { Download, Smartphone, X } from "lucide-react";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the install button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 text-xs font-semibold shadow-md transition-all active:scale-95"
        title="Install ScriptReel to your device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-install-ios-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 px-3 py-1.5 text-xs font-medium transition"
          title="Install ScriptReel on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-neutral-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <img src="/icon.svg" alt="ScriptReel" className="w-8 h-8 rounded-lg" />
                  <h3 className="text-base font-semibold text-white">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm text-neutral-300">
                <div className="flex items-start gap-3 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">1</span>
                  <p>Tap the <strong>Share</strong> button in Safari's bottom toolbar (the square with an arrow pointing up).</p>
                </div>
                <div className="flex items-start gap-3 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">2</span>
                  <p>Scroll down the menu and tap <strong>Add to Home Screen</strong>.</p>
                </div>
                <div className="flex items-start gap-3 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">3</span>
                  <p>Tap <strong>Add</strong> in the top-right corner. ScriptReel will launch full-screen from your home screen!</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-neutral-800 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for browsers without beforeinstallprompt support (or desktop preview)
  return (
    <button
      id="pwa-install-guide-btn"
      onClick={() => setShowIOSGuide(true)}
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 px-3 py-1.5 text-xs font-medium transition"
      title="Install as Progressive Web App"
    >
      <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
      <span>Install App</span>
    </button>
  );
};
