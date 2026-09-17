import React, { useState } from "react";
import { Scene, VideoClip } from "../types.js";
import { Film, Sparkles, Upload, RefreshCw, Trash2, Plus, ArrowLeft, ArrowRight, Play, Edit3, Check, Volume2, AlertCircle } from "lucide-react";
import { MediaSearchModal } from "./MediaSearchModal.js";

interface StepSceneReviewProps {
  scenes: Scene[];
  detectedLanguage: string;
  isAmharic: boolean;
  videoTitle: string;
  onChangeVideoTitle: (title: string) => void;
  onUpdateScene: (sceneId: string, updated: Partial<Scene>) => void;
  onDeleteScene: (sceneId: string) => void;
  onAddScene: () => void;
  onBackToScript: () => void;
  onProceedToRender: () => void;
  onRetryScene?: (sceneId: string) => void;
}

export const StepSceneReview: React.FC<StepSceneReviewProps> = ({
  scenes,
  detectedLanguage,
  isAmharic,
  videoTitle,
  onChangeVideoTitle,
  onUpdateScene,
  onDeleteScene,
  onAddScene,
  onBackToScript,
  onProceedToRender,
  onRetryScene,
}) => {
  const [activeModalSceneId, setActiveModalSceneId] = useState<string | null>(null);
  const [editingNarrationId, setEditingNarrationId] = useState<string | null>(null);

  const totalDuration = scenes.reduce((sum, s) => sum + (s.estimatedDuration || 6), 0);
  const activeSceneForModal = scenes.find((s) => s.id === activeModalSceneId);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Header & Title bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {detectedLanguage} {isAmharic ? "(Amharic Narration)" : ""}
            </span>
            <span className="text-xs text-neutral-400">
              {scenes.length} Scenes · ~{totalDuration}s Total Duration
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => onChangeVideoTitle(e.target.value)}
              placeholder="Video Project Title..."
              className="text-xl sm:text-2xl font-extrabold text-white bg-transparent border-b border-dashed border-neutral-700 hover:border-neutral-500 focus:border-indigo-500 focus:outline-none transition-colors px-1 py-0.5"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="add-scene-top-btn"
            type="button"
            onClick={onAddScene}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scene</span>
          </button>

          <button
            id="proceed-render-top-btn"
            type="button"
            onClick={onProceedToRender}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <span>Render Video</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Helper banner */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Preview each scene clip. You can swap any clip with another Pexels match, upload your own video/image, or generate with AI.
          </span>
        </div>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        {scenes.map((scene, idx) => {
          const isFailed = scene.status === "failed";
          const isGeneratingAi = scene.status === "generating_ai";
          const isEditing = editingNarrationId === scene.id;

          return (
            <div
              id={`scene-card-${scene.id}`}
              key={scene.id}
              className={`bg-neutral-900/80 border rounded-2xl p-4 sm:p-5 transition-all shadow-md ${
                isFailed
                  ? "border-red-500/50 bg-red-950/10"
                  : "border-neutral-800 hover:border-neutral-700/90"
              }`}
            >
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Left: Video Clip Preview Card */}
                <div className="w-full lg:w-72 shrink-0">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 group shadow-inner">
                    {scene.selectedClip?.videoUrl ? (
                      scene.selectedClip.mediaType === "image" ? (
                        <img
                          src={scene.selectedClip.videoUrl}
                          alt={scene.selectedClip.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={scene.selectedClip.videoUrl}
                          poster={scene.selectedClip.thumbnailUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-neutral-950 text-neutral-500">
                        <Film className="w-8 h-8 mb-2 opacity-40" />
                        <span className="text-xs">No clip assigned</span>
                      </div>
                    )}

                    {/* Clip Source Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-white border border-white/10 shadow">
                        Scene {idx + 1}
                      </span>
                      {scene.selectedClip?.source === "ai" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-600 text-white shadow flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Veo AI</span>
                        </span>
                      )}
                      {scene.selectedClip?.source === "custom" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shadow flex items-center gap-1">
                          <Upload className="w-2.5 h-2.5" />
                          <span>Custom</span>
                        </span>
                      )}
                    </div>

                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 pointer-events-none">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-neutral-300">
                        ~{scene.estimatedDuration}s
                      </span>
                    </div>
                  </div>

                  {/* Clip Actions */}
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <button
                      id={`swap-clip-btn-${scene.id}`}
                      type="button"
                      onClick={() => setActiveModalSceneId(scene.id)}
                      className="w-full py-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Film className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Swap Clip</span>
                    </button>

                    <button
                      id={`ai-veo-btn-${scene.id}`}
                      type="button"
                      onClick={() => setActiveModalSceneId(scene.id)}
                      className="w-full py-1.5 px-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 text-xs font-medium border border-indigo-800/40 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Veo / Upload</span>
                    </button>
                  </div>
                </div>

                {/* Right: Scene Narration & Visual Directives */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header info */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                          Scene {idx + 1} Narration
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          ({scene.narration.trim().split(/\s+/).length} words)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingNarrationId(isEditing ? null : scene.id)}
                          className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors text-xs flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="text-[11px]">{isEditing ? "Done" : "Edit"}</span>
                        </button>
                        {scenes.length > 1 && (
                          <button
                            id={`delete-scene-${scene.id}`}
                            type="button"
                            onClick={() => onDeleteScene(scene.id)}
                            className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                            title="Delete this scene"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Narration Text Box */}
                    {isEditing ? (
                      <textarea
                        rows={3}
                        value={scene.narration}
                        onChange={(e) => onUpdateScene(scene.id, { narration: e.target.value })}
                        className="w-full bg-neutral-950 border border-indigo-500/60 rounded-xl p-3 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
                      />
                    ) : (
                      <p className="text-sm sm:text-base text-neutral-100 bg-neutral-950/40 border border-neutral-800/70 rounded-xl p-3 leading-relaxed font-sans">
                        {scene.narration}
                      </p>
                    )}

                    {/* Visual Description & Keywords */}
                    <div className="mt-3 space-y-2">
                      {scene.visualDescription && (
                        <p className="text-xs text-neutral-400 italic">
                          "{scene.visualDescription}"
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-neutral-400 mr-1">Visual tags:</span>
                        {scene.keywords.map((kw, kwIdx) => (
                          <button
                            key={kwIdx}
                            type="button"
                            onClick={() => setActiveModalSceneId(scene.id)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60 transition-colors"
                          >
                            #{kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Failure / Retry handler */}
                  {isFailed && (
                    <div className="mt-3 p-2.5 bg-red-950/30 border border-red-800/40 rounded-xl flex items-center justify-between text-xs text-red-300">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Scene encountered an issue during processing.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRetryScene?.(scene.id)}
                        className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded-md text-[11px] font-medium transition-colors"
                      >
                        Retry Scene
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Scene Banner */}
      <div className="mt-6 flex justify-center">
        <button
          id="add-scene-bottom-btn"
          type="button"
          onClick={onAddScene}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 text-xs font-medium transition-all"
        >
          <Plus className="w-4 h-4 text-indigo-400" />
          <span>Add Another Scene</span>
        </button>
      </div>

      {/* Navigation Footer */}
      <div className="mt-8 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          id="back-to-script-btn"
          type="button"
          onClick={onBackToScript}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Script</span>
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="hidden sm:block text-right text-xs text-neutral-400">
            <div>Ready to render video</div>
            <div className="text-[11px] text-neutral-500">Audio + Video + Subtitles</div>
          </div>

          <button
            id="proceed-render-bottom-btn"
            type="button"
            onClick={onProceedToRender}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <span>Render Video</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Media Search / Replace Modal */}
      {activeSceneForModal && (
        <MediaSearchModal
          isOpen={Boolean(activeModalSceneId)}
          onClose={() => setActiveModalSceneId(null)}
          sceneId={activeSceneForModal.id}
          sceneOrder={activeSceneForModal.order}
          initialQuery={activeSceneForModal.keywords[0] || "cinematic landscape"}
          currentSelectedClip={activeSceneForModal.selectedClip}
          onSelectClip={(clip: VideoClip) => {
            onUpdateScene(activeSceneForModal.id, {
              selectedClip: clip,
              status: "ready",
            });
          }}
        />
      )}
    </div>
  );
};
