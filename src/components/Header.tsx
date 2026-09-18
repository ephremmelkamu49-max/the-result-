import React from "react";
import { Film, Sparkles, CheckCircle2, ChevronRight, KeyRound } from "lucide-react";
import { PWAInstallButton } from "./PWAInstallButton.tsx";

interface HeaderProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
  canNavigateToStep2: boolean;
  canNavigateToStep3: boolean;
  hasPexelsKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onStepClick,
  canNavigateToStep2,
  canNavigateToStep3,
  hasPexelsKey,
}) => {
  const steps = [
    { num: 1, label: "Script Input" },
    { num: 2, label: "Scene Review" },
    { num: 3, label: "Preview & Export" },
  ];

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/70 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand & Name */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">ScriptReel</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider bg-neutral-800 border border-neutral-700/70 text-indigo-300 px-2 py-0.5 rounded-full">
                  Studio
                </span>
              </div>
              <p className="text-xs text-neutral-400 hidden sm:block">
                Turn any text script into narrated video
              </p>
            </div>
          </div>

          {/* Key status indicator */}
          <div className="flex items-center gap-2 sm:hidden">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                hasPexelsKey
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {hasPexelsKey ? "Pexels Connected" : "Stock Mode"}
            </span>
          </div>
        </div>

        {/* 3-Step Navigation Bar */}
        <nav aria-label="Creation Steps" className="flex items-center gap-1.5 sm:gap-2">
          {steps.map((step, idx) => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            const isClickable =
              (step.num === 1) ||
              (step.num === 2 && canNavigateToStep2) ||
              (step.num === 3 && canNavigateToStep3);

            return (
              <React.Fragment key={step.num}>
                {idx > 0 && (
                  <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0" />
                )}
                <button
                  id={`nav-step-${step.num}`}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(step.num as 1 | 2 | 3)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : isCompleted
                      ? "bg-neutral-800/90 text-neutral-200 hover:bg-neutral-800 hover:text-white cursor-pointer"
                      : isClickable
                      ? "bg-neutral-800/40 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                      : "text-neutral-500 cursor-not-allowed opacity-60"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? "bg-white text-indigo-600"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-neutral-700 text-neutral-400"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.num}
                  </span>
                  <span className="hidden md:inline">{step.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Status badges & Install App Button */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <PWAInstallButton />

          <div
            className={`hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              hasPexelsKey
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
            title={
              hasPexelsKey
                ? "Pexels API Key loaded from Secrets"
                : "Using high-res stock footage catalog. Add PEXELS_API_KEY in Settings > Secrets for direct Pexels access."
            }
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{hasPexelsKey ? "Pexels Live API" : "Pexels Stock Ready"}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>1080p AI Studio</span>
          </div>
        </div>
      </div>
    </header>
  );
};
