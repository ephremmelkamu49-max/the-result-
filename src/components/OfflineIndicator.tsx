import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/90 backdrop-blur-sm border border-amber-500/50 px-4 py-2 text-xs font-medium text-white shadow-xl">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>Offline Mode — Cached assets are being used.</span>
    </div>
  );
};
