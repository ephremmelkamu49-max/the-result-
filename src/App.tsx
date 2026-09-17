import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { StepScriptInput } from "./components/StepScriptInput.js";
import { StepSceneReview } from "./components/StepSceneReview.js";
import { StepPreviewDownload } from "./components/StepPreviewDownload.js";
import { Scene, VideoClip, RenderProgressUpdate } from "./types.js";
import { AlertCircle, X } from "lucide-react";

export default function App() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [script, setScript] = useState<string>(
    `ቡና በኢትዮጵያ ባህል ውስጥ ትልቅ እና የተቀደሰ ቦታ አለው። በየቀኑ ቤተሰቦች እና ጎረቤቶች ተሰብስበው ባህላዊውን የቡና ማፍላት ሥነ ሥርዓት ያካሂዳሉ። ትኩስ የቡና ቅጠል እና ዕጣን ይጨሳል፤ ጀበናው በከሰል ላይ ይንተከተካል። ይህ የቡና ወግ ፍቅርን፣ አንድነትን እና ወንድማማችነትን በህብረተሰቡ ውስጥ ያጠናክራል።`
  );
  const [voice, setVoice] = useState<"Charon" | "Fenrir">("Charon");

  // Scene state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("Amharic");
  const [isAmharic, setIsAmharic] = useState<boolean>(true);
  const [videoTitle, setVideoTitle] = useState<string>("የኢትዮጵያ ቡና ሥነ ሥርዓት");

  // Loading & Processing states
  const [isSplittingScript, setIsSplittingScript] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgressUpdate | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // System config
  const [hasPexelsKey, setHasPexelsKey] = useState<boolean>(false);

  // Check config on initial load
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setHasPexelsKey(Boolean(data.hasPexelsKey));
      })
      .catch((err) => console.warn("Failed to check /api/config:", err));
  }, []);

  // Step 1 -> Step 2: Split script with Gemini and search Pexels clips for each scene
  const handleGenerateScenes = async () => {
    if (!script.trim()) return;
    setIsSplittingScript(true);
    setErrorMessage(null);

    try {
      // 1. Call Gemini to split script
      const splitRes = await fetch("/api/scenes/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.trim() }),
      });

      if (!splitRes.ok) {
        const errData = await splitRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to split script with Gemini");
      }

      const splitData = await splitRes.json();
      setDetectedLanguage(splitData.detectedLanguage || "Amharic");
      setIsAmharic(Boolean(splitData.isAmharic));
      if (splitData.title) {
        setVideoTitle(splitData.title);
      }

      const rawScenes: Scene[] = splitData.scenes || [];
      if (rawScenes.length === 0) {
        throw new Error("No scenes were generated. Please try again.");
      }

      // 2. Fetch best Pexels match for each scene sequentially/in parallel
      const populatedScenes = await Promise.all(
        rawScenes.map(async (scene) => {
          const searchQuery = scene.keywords?.[0] || scene.keywords?.join(" ") || "cinematic landscape";
          try {
            const pexelsRes = await fetch("/api/pexels/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: searchQuery, perPage: 8 }),
            });

            if (pexelsRes.ok) {
              const pexelsData = await pexelsRes.json();
              const clips: VideoClip[] = pexelsData.clips || [];
              const chosenClip = clips[0] || undefined;
              return {
                ...scene,
                selectedClip: chosenClip,
                availableClips: clips,
                status: "ready" as const,
              };
            }
          } catch (e) {
            console.warn(`Pexels search failed for scene ${scene.order}:`, e);
          }

          return {
            ...scene,
            status: "ready" as const,
          };
        })
      );

      setScenes(populatedScenes);
      setCurrentStep(2);
    } catch (err: any) {
      console.error("Generate scenes error:", err);
      setErrorMessage(err?.message || "An error occurred while analyzing the script.");
    } finally {
      setIsSplittingScript(false);
    }
  };

  // Step 2 -> Step 3: Render Final Video with FFmpeg + TTS
  const handleProceedToRender = async () => {
    if (scenes.length === 0) return;

    setIsRendering(true);
    setErrorMessage(null);
    setCurrentStep(3);
    setRenderProgress({
      stage: "audio",
      progress: 5,
      message: "Starting video generation...",
      currentScene: 0,
      totalScenes: scenes.length,
    });

    try {
      const renderRes = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
          language: detectedLanguage,
          voice,
        }),
      });

      if (!renderRes.ok) {
        const errData = await renderRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to start render pipeline");
      }

      const { jobId } = await renderRes.json();

      // Poll progress until completion
      const interval = setInterval(async () => {
        try {
          const progressRes = await fetch(`/api/video/progress/${jobId}`);
          if (!progressRes.ok) return;

          const progressData = await progressRes.json();
          setRenderProgress(progressData);

          if (progressData.stage === "completed") {
            clearInterval(interval);
            setIsRendering(false);
            setVideoUrl(progressData.videoUrl);
            setDownloadUrl(progressData.downloadUrl);
          } else if (progressData.stage === "error") {
            clearInterval(interval);
            setIsRendering(false);
            setErrorMessage(progressData.error || "Video rendering failed");
          }
        } catch (pollErr) {
          console.warn("Error polling progress:", pollErr);
        }
      }, 1500);
    } catch (err: any) {
      console.error("Render initiation error:", err);
      setIsRendering(false);
      setRenderProgress({
        stage: "error",
        progress: 0,
        message: err?.message || "Failed to render video",
        currentScene: 0,
        totalScenes: scenes.length,
        error: err?.message,
      });
      setErrorMessage(err?.message || "Failed to start render pipeline");
    }
  };

  // Scene management helpers
  const handleUpdateScene = (sceneId: string, updated: Partial<Scene>) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, ...updated } : s))
    );
  };

  const handleDeleteScene = (sceneId: string) => {
    setScenes((prev) => {
      const filtered = prev.filter((s) => s.id !== sceneId);
      return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
  };

  const handleAddScene = () => {
    const newOrder = scenes.length + 1;
    const newScene: Scene = {
      id: `scene-${newOrder}-${Date.now()}`,
      order: newOrder,
      narration: "አዲስ ትዕይንት ወይም የቀጣይ ታሪክ ክፍል...",
      keywords: ["cinematic landscape", "story documentary", "nature"],
      visualDescription: "Visual scene complementing narration",
      estimatedDuration: 6,
      status: "ready",
      selectedClip: {
        id: `default-${newOrder}`,
        source: "sample",
        title: "Scenic Landscape",
        thumbnailUrl: "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=640",
        videoUrl: "https://videos.pexels.com/video-files/855564/855564-hd_1280_720_24fps.mp4",
        duration: 15,
        mediaType: "video",
        author: "Pexels Creator",
      },
    };
    setScenes((prev) => [...prev, newScene]);
  };

  const handleRetryScene = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    handleUpdateScene(sceneId, { status: "ready" });
    try {
      const res = await fetch("/api/pexels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: scene.keywords[0] || "cinematic visual", perPage: 6 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.clips?.length > 0) {
          handleUpdateScene(sceneId, { selectedClip: data.clips[0] });
        }
      }
    } catch (e) {
      console.warn("Retry scene error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Header with Step Indicator */}
      <Header
        currentStep={currentStep}
        onStepClick={(step) => {
          if (!isRendering && !isSplittingScript) {
            setCurrentStep(step);
          }
        }}
        canNavigateToStep2={scenes.length > 0}
        canNavigateToStep3={Boolean(videoUrl || isRendering)}
        hasPexelsKey={hasPexelsKey}
      />

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-red-950/40 border-b border-red-800/40 px-4 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="p-1 text-red-400 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {currentStep === 1 && (
          <StepScriptInput
            script={script}
            onChangeScript={setScript}
            voice={voice}
            onChangeVoice={setVoice}
            onGenerateScenes={handleGenerateScenes}
            isLoading={isSplittingScript}
          />
        )}

        {currentStep === 2 && (
          <StepSceneReview
            scenes={scenes}
            detectedLanguage={detectedLanguage}
            isAmharic={isAmharic}
            videoTitle={videoTitle}
            onChangeVideoTitle={setVideoTitle}
            onUpdateScene={handleUpdateScene}
            onDeleteScene={handleDeleteScene}
            onAddScene={handleAddScene}
            onBackToScript={() => setCurrentStep(1)}
            onProceedToRender={handleProceedToRender}
            onRetryScene={handleRetryScene}
          />
        )}

        {currentStep === 3 && (
          <StepPreviewDownload
            isRendering={isRendering}
            renderProgress={renderProgress}
            videoUrl={videoUrl}
            downloadUrl={downloadUrl}
            videoTitle={videoTitle}
            scenesCount={scenes.length}
            detectedLanguage={detectedLanguage}
            voice={voice}
            onEditScenes={() => setCurrentStep(2)}
            onRetryRender={handleProceedToRender}
          />
        )}
      </main>

      {/* Clean Studio Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/80 py-4 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ScriptReel · Automated Text-to-Narrated Video Studio</span>
          <span>Powered by Gemini TTS, Pexels Footage & FFmpeg</span>
        </div>
      </footer>
    </div>
  );
}
