import React, { useRef, useState } from "react";
import { Download, Film, Sparkles, ArrowLeft, RefreshCw, CheckCircle2, Play, Volume2, AlertCircle, Share2, Copy } from "lucide-react";
import { RenderProgressUpdate } from "../types.js";

interface StepPreviewDownloadProps {
  isRendering: boolean;
  renderProgress: RenderProgressUpdate | null;
  videoUrl: string | null;
  downloadUrl: string | null;
  videoTitle: string;
  scenesCount: number;
  detectedLanguage: string;
  voice: string;
  onEditScenes: () => void;
  onRetryRender: () => void;
}

export const StepPreviewDownload: React.FC<StepPreviewDownloadProps> = ({
  isRendering,
  renderProgress,
  videoUrl,
  downloadUrl,
  videoTitle,
  scenesCount,
  detectedLanguage,
  voice,
  onEditScenes,
  onRetryRender,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const isReady =
    !isRendering &&
    renderProgress?.stage === "completed" &&
    renderProgress?.progress === 100 &&
    Boolean(videoUrl && downloadUrl);

  const safeTitle =
    videoTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "scriptreel-video";
  const fileName = `${safeTitle}.mp4`;
  const directDownloadHref = downloadUrl
    ? `${downloadUrl}?filename=${encodeURIComponent(fileName)}`
    : "";

  const handleCopyLink = () => {
    if (!downloadUrl && !videoUrl) return;
    const targetUrl = directDownloadHref || videoUrl || "";
    const fullUrl = targetUrl.startsWith("http") ? targetUrl : `${window.location.origin}${targetUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDirectDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isReady || !downloadUrl) {
      e.preventDefault();
      return;
    }
    // Direct native browser download — streams straight from server to disk/phone without memory bloat
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* 1. Rendering in Progress View */}
      {isRendering && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Producing Your Narrated Video
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-md mx-auto">
            ScriptReel is running the multi-stage pipeline on the server: generating natural narration, timing video loops, and burning captions.
          </p>

          {/* Scene counter badge during processing */}
          {renderProgress?.totalScenes ? (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-medium text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>
                Scene {renderProgress.currentScene || 1} of {renderProgress.totalScenes}
              </span>
            </div>
          ) : null}

          {/* Progress bar */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between items-center text-xs text-neutral-300 font-semibold px-1">
              <span>{renderProgress?.message || "Processing video..."}</span>
              <span className="text-indigo-400 font-mono">{renderProgress?.progress || 10}%</span>
            </div>
            <div className="w-full bg-neutral-950 rounded-full h-3.5 p-0.5 border border-neutral-800 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.max(5, renderProgress?.progress || 10)}%` }}
              />
            </div>
          </div>

          {/* Pipeline Stages Checklist */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
            <div
              className={`p-3 rounded-xl border text-xs transition-colors ${
                (renderProgress?.progress || 0) >= 35
                  ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                  : renderProgress?.stage === "audio"
                  ? "bg-indigo-950/30 border-indigo-800/50 text-indigo-300"
                  : "bg-neutral-950/40 border-neutral-800/60 text-neutral-500"
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {(renderProgress?.progress || 0) >= 35 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">
                    1
                  </div>
                )}
                <span>1. Gemini Narration</span>
              </div>
              <p className="text-[11px] opacity-80 mt-1">High fidelity male voice synthesis</p>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs transition-colors ${
                (renderProgress?.progress || 0) >= 80
                  ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                  : renderProgress?.stage === "video"
                  ? "bg-indigo-950/30 border-indigo-800/50 text-indigo-300"
                  : "bg-neutral-950/40 border-neutral-800/60 text-neutral-500"
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {(renderProgress?.progress || 0) >= 80 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">
                    2
                  </div>
                )}
                <span>2. Visual & Audio Sync</span>
              </div>
              <p className="text-[11px] opacity-80 mt-1">Trimming & looping clips in FFmpeg</p>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs transition-colors ${
                (renderProgress?.progress || 0) === 100
                  ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                  : renderProgress?.stage === "captions" || renderProgress?.stage === "concat"
                  ? "bg-indigo-950/30 border-indigo-800/50 text-indigo-300"
                  : "bg-neutral-950/40 border-neutral-800/60 text-neutral-500"
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {(renderProgress?.progress || 0) === 100 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">
                    3
                  </div>
                )}
                <span>3. Subtitles & Render</span>
              </div>
              <p className="text-[11px] opacity-80 mt-1">Burned animated ASS subtitles</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Error View */}
      {!isRendering && renderProgress?.stage === "error" && (
        <div className="bg-red-950/20 border border-red-800/50 rounded-3xl p-8 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-red-900/30 border border-red-700/50 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Rendering Issue Encountered</h2>
          <p className="text-xs sm:text-sm text-red-300 mt-2">
            {renderProgress.error || "An error occurred during video rendering."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              id="error-edit-scenes-btn"
              type="button"
              onClick={onEditScenes}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors"
            >
              Modify Scenes
            </button>
            <button
              id="error-retry-render-btn"
              type="button"
              onClick={onRetryRender}
              className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Try Rendering Again
            </button>
          </div>
        </div>
      )}

      {/* 3. Completed Video Player & Download View */}
      {!isRendering && videoUrl && (
        <div className="space-y-6">
          {/* Top Bar with Title & Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Render Completed</span>
                </span>
                <span className="text-xs text-neutral-400">
                  {scenesCount} Scenes · {detectedLanguage} · Voice: {voice}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-white">{videoTitle}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="edit-scenes-again-btn"
                type="button"
                onClick={onEditScenes}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Scenes</span>
              </button>

              <a
                id="download-video-btn"
                href={isReady ? directDownloadHref : undefined}
                download={fileName}
                onClick={handleDirectDownload}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg transition-all ${
                  isReady && !isDownloading
                    ? "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-indigo-600/30 cursor-pointer"
                    : "bg-neutral-800 text-neutral-500 border border-neutral-700 pointer-events-none shadow-none"
                }`}
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
                    <span>Saving Video...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download 1080p MP4</span>
                  </>
                )}
              </a>
            </div>
          </div>

          {/* Main Video Player Container */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl aspect-video">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          {/* Metadata & Actions Panel */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Master 1080p Specifications
              </span>
              <p className="text-xs text-neutral-200 font-medium">1920 × 1080 Full HD · 16:9 Widescreen</p>
              <p className="text-[11px] text-neutral-400">H.264 High Profile · 8 Mbps · Smooth Crossfades & Ken Burns</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Narration & Subtitles
              </span>
              <p className="text-xs text-neutral-200 font-medium">
                Gemini TTS ({voice}) · {detectedLanguage}
              </p>
              <p className="text-[11px] text-neutral-400">
                Burned-in animated ASS subtitles (Noto Sans Ethiopic support)
              </p>
            </div>

            <div className="flex flex-col justify-center sm:items-end gap-2">
              <button
                id="copy-video-link-btn"
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Link Copied!" : "Copy Video Link"}</span>
              </button>

              <button
                id="re-render-button"
                type="button"
                onClick={onRetryRender}
                className="w-full sm:w-auto text-[11px] text-neutral-400 hover:text-indigo-400 transition-colors text-right"
              >
                Re-render with fresh audio/captions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
