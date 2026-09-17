import React, { useState, useEffect, useRef } from "react";
import { Search, X, Upload, Sparkles, Film, Check, AlertCircle, RefreshCw, Play, Pause } from "lucide-react";
import { VideoClip } from "../types.js";

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneId: string;
  sceneOrder: number;
  initialQuery: string;
  currentSelectedClip?: VideoClip;
  onSelectClip: (clip: VideoClip) => void;
}

export const MediaSearchModal: React.FC<MediaSearchModalProps> = ({
  isOpen,
  onClose,
  sceneId,
  sceneOrder,
  initialQuery,
  currentSelectedClip,
  onSelectClip,
}) => {
  const [activeTab, setActiveTab] = useState<"pexels" | "upload" | "ai">("pexels");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<VideoClip[]>([]);
  const [isLoadingPexels, setIsLoadingPexels] = useState(false);
  const [pexelsError, setPexelsError] = useState<string | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState<string | number | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Veo Generation state
  const [aiPrompt, setAiPrompt] = useState(initialQuery);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setAiPrompt(initialQuery);
      performSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoadingPexels(true);
    setPexelsError(null);

    try {
      const res = await fetch("/api/pexels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, perPage: 12 }),
      });

      if (!res.ok) {
        throw new Error(`Search failed: ${res.statusText}`);
      }

      const data = await res.json();
      setResults(data.clips || []);
    } catch (err: any) {
      console.error("Stock video search error:", err);
      setPexelsError(err?.message || "Failed to search footage");
    } finally {
      setIsLoadingPexels(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const isVideo = file.type.startsWith("video/");

          const res = await fetch("/api/scenes/upload-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataUrl,
              filename: file.name,
              mediaType: isVideo ? "video" : "image",
            }),
          });

          if (!res.ok) {
            throw new Error(`Upload failed: ${res.statusText}`);
          }

          const uploadedData = await res.json();
          const customClip: VideoClip = {
            id: `custom-${Date.now()}`,
            source: "custom",
            title: uploadedData.title || file.name,
            thumbnailUrl: uploadedData.thumbnailUrl || uploadedData.mediaUrl,
            videoUrl: uploadedData.mediaUrl,
            duration: 10,
            mediaType: uploadedData.mediaType,
            author: "User Upload",
          };

          onSelectClip(customClip);
          onClose();
        } catch (err: any) {
          setUploadError(err?.message || "Error uploading file");
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadError("Error reading file");
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err?.message || "Error processing upload");
      setIsUploading(false);
    }
  };

  const handleStartAiGeneration = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiError(null);
    setAiStatusMessage("Requesting AI video generation with Veo...");

    try {
      const res = await fetch("/api/scenes/generate-ai-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start Veo video generation");
      }

      const { operationName } = await res.json();
      setAiStatusMessage("Veo is rendering your AI clip (this may take 30-60s)...");

      // Poll until done
      let attempts = 0;
      const maxAttempts = 40;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          setIsGeneratingAi(false);
          setAiError("AI generation timed out. Please try again or select stock footage.");
          return;
        }

        try {
          const pollRes = await fetch("/api/scenes/check-ai-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operationName }),
          });

          const pollData = await pollRes.json();
          if (pollData.done) {
            clearInterval(interval);
            setIsGeneratingAi(false);

            if (pollData.error) {
              setAiError(pollData.error);
              return;
            }

            const aiClip: VideoClip = {
              id: `veo-${Date.now()}`,
              source: "ai",
              title: pollData.title || `Veo AI: ${aiPrompt.slice(0, 30)}`,
              thumbnailUrl: pollData.thumbnailUrl || pollData.videoUrl,
              videoUrl: pollData.videoUrl,
              duration: 8,
              mediaType: "video",
              author: "Google Veo AI",
            };

            onSelectClip(aiClip);
            onClose();
          } else {
            setAiStatusMessage(`Rendering with Veo... (${attempts * 3}s elapsed)`);
          }
        } catch (e: any) {
          console.warn("Polling error:", e);
        }
      }, 3000);
    } catch (err: any) {
      setIsGeneratingAi(false);
      setAiError(err?.message || "AI generation failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-indigo-400" />
              <span>Choose Visual Clip for Scene {sceneOrder}</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Select stock footage from Pexels, upload your own video/image, or generate with AI
            </p>
          </div>
          <button
            id="modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-5 pt-2">
          <button
            id="tab-pexels-btn"
            type="button"
            onClick={() => setActiveTab("pexels")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "pexels"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Pexels Stock Footage</span>
          </button>

          <button
            id="tab-upload-btn"
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "upload"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Custom Media</span>
          </button>

          <button
            id="tab-ai-btn"
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "ai"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate with AI (Veo)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: Pexels Stock */}
          {activeTab === "pexels" && (
            <div className="space-y-4">
              {/* Search bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  performSearch(query);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search stock footage (e.g. coffee ceremony, nature, city)..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  id="stock-search-submit-btn"
                  type="submit"
                  disabled={isLoadingPexels || !query.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
                >
                  {isLoadingPexels ? "Searching..." : "Search"}
                </button>
              </form>

              {/* Error message if any */}
              {pexelsError && (
                <div className="p-3 bg-red-900/20 border border-red-800/40 rounded-xl flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pexelsError}</span>
                </div>
              )}

              {/* Results Grid */}
              {isLoadingPexels ? (
                <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <p className="text-xs">Finding best cinematic stock footage...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 text-xs">
                  No stock clips found. Try searching for broader terms or upload a custom image/video.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {results.map((clip) => {
                    const isSelected = currentSelectedClip?.videoUrl === clip.videoUrl;
                    const isHovered = hoveredClipId === clip.id;

                    return (
                      <div
                        id={`clip-choice-${clip.id}`}
                        key={clip.id}
                        onMouseEnter={() => setHoveredClipId(clip.id)}
                        onMouseLeave={() => setHoveredClipId(null)}
                        onClick={() => {
                          onSelectClip(clip);
                          onClose();
                        }}
                        className={`group relative rounded-xl overflow-hidden border cursor-pointer aspect-video bg-neutral-950 transition-all ${
                          isSelected
                            ? "border-indigo-500 ring-2 ring-indigo-500/40"
                            : "border-neutral-800 hover:border-neutral-600"
                        }`}
                      >
                        {/* Video preview on hover if videoUrl exists */}
                        {isHovered && clip.videoUrl ? (
                          <video
                            src={clip.videoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={clip.thumbnailUrl}
                            alt={clip.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}

                        {/* Overlays */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          {isSelected && (
                            <span className="bg-indigo-600 text-white p-1 rounded-full shadow">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <span className="text-[10px] font-medium bg-black/60 backdrop-blur-sm text-neutral-300 px-1.5 py-0.5 rounded">
                            {clip.duration}s
                          </span>
                        </div>

                        {/* Title */}
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-[11px] font-medium text-white truncate drop-shadow">
                            {clip.title}
                          </p>
                          <p className="text-[9px] text-neutral-400 truncate">
                            by {clip.author || "Pexels Creator"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Upload Custom Media */}
          {activeTab === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-700 hover:border-indigo-500/70 bg-neutral-950/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Drop your video or image here, or browse
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  Supports MP4, WebM, JPG, PNG. Images will be smoothly animated (Ken Burns effect) to match narration duration.
                </p>

                {isUploading && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-indigo-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing & uploading media...</span>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="p-3 bg-red-900/20 border border-red-800/40 rounded-xl flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Generate with AI (Veo) */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 mb-1">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Google Veo AI Video Generation</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Generate a completely unique 720p HD clip specifically tailored to this scene using Google's state-of-the-art Veo video model.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Visual Prompt for Veo
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe the visual scene in detail (e.g. Cinematic wide shot of steam rising from traditional clay jebena pot in Ethiopian sunlight)..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {aiStatusMessage && (
                <div className="p-3 bg-neutral-800/60 border border-neutral-700/60 rounded-xl flex items-center gap-2 text-xs text-indigo-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>{aiStatusMessage}</span>
                </div>
              )}

              {aiError && (
                <div className="p-3 bg-amber-900/20 border border-amber-800/40 rounded-xl flex items-start gap-2 text-xs text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Notice</p>
                    <p className="mt-0.5">{aiError}</p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Tip: You can switch back to the "Pexels Stock Footage" tab to select high quality verified stock clips immediately.
                    </p>
                  </div>
                </div>
              )}

              <button
                id="generate-ai-clip-submit-btn"
                type="button"
                disabled={isGeneratingAi || !aiPrompt.trim()}
                onClick={handleStartAiGeneration}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rendering AI Video...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Video with Veo</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
