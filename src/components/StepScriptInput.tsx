import React, { useState } from "react";
import { Sparkles, Mic, FileText, ArrowRight, BookOpen, Volume2, Globe } from "lucide-react";

interface StepScriptInputProps {
  script: string;
  onChangeScript: (value: string) => void;
  voice: "Charon" | "Fenrir";
  onChangeVoice: (voice: "Charon" | "Fenrir") => void;
  onGenerateScenes: () => void;
  isLoading: boolean;
}

const PRESET_SCRIPTS = [
  {
    title: "የኢትዮጵያ ቡና ሥነ ሥርዓት (Amharic)",
    language: "Amharic",
    text: `ቡና በኢትዮጵያ ባህል ውስጥ ትልቅ እና የተቀደሰ ቦታ አለው። በየቀኑ ቤተሰቦች እና ጎረቤቶች ተሰብስበው ባህላዊውን የቡና ማፍላት ሥነ ሥርዓት ያካሂዳሉ። ትኩስ የቡና ቅጠል እና ዕጣን ይጨሳል፤ ጀበናው በከሰል ላይ ይንተከተካል። ይህ የቡና ወግ ፍቅርን፣ አንድነትን እና ወንድማማችነትን በህብረተሰቡ ውስጥ ያጠናክራል።`,
  },
  {
    title: "The Legend of Kaldi & Coffee (English)",
    language: "English",
    text: `Centuries ago in the lush green highlands of Ethiopia, a young goat herder named Kaldi noticed his flock dancing with unusual energy after eating bright red berries from an unfamiliar shrub. Intrigued, he tasted them himself and felt an invigorating surge of vitality. Kaldi brought the berries to a local monastery, giving birth to the ancient ritual of coffee that now fuels millions across the planet.`,
  },
  {
    title: "የተፈጥሮ ድንቅ ገጽታዎች (Amharic)",
    language: "Amharic",
    text: `የሰሜን ተራሮች ብሔራዊ ፓርክ አስደናቂ የተፈጥሮ ውበት አለው። በጉም የተሸፈኑት ከፍተኛ ጫፎች እና ማራኪ ሸለቆዎች ለብዙ ብርቅዬ እንስሳት መኖሪያ ናቸው። ጸሐይ ስትወጣ ወርቃማው ብርሃን በደጋማው ምድር ላይ ሲያርፍ እጅግ የሚያስደንቅ ገጽታ ይፈጥራል።`,
  },
];

export const StepScriptInput: React.FC<StepScriptInputProps> = ({
  script,
  onChangeScript,
  voice,
  onChangeVoice,
  onGenerateScenes,
  isLoading,
}) => {
  const wordsCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  // Average speaking pace ~130 words per minute (2.1 words per second)
  const estimatedSeconds = Math.max(0, Math.round(wordsCount / 2.2));
  const estimatedScenes = Math.max(1, Math.ceil(estimatedSeconds / 10));

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Introduction Card */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Turn Any Script Into Narrated Video in Seconds</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Write or Paste Your Story
        </h1>
        <p className="mt-2 text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
          Gemini will split your script into timed scenes, match cinematic Pexels stock clips, and generate natural male narration with synced captions.
        </p>
      </div>

      {/* Main Form Container */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 sm:p-7 shadow-xl backdrop-blur-sm">
        {/* Presets Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <label htmlFor="script-textarea" className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Script Content</span>
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-400 mr-1 hidden sm:inline">Try an example:</span>
            {PRESET_SCRIPTS.map((preset, idx) => (
              <button
                id={`preset-btn-${idx}`}
                key={preset.title}
                type="button"
                onClick={() => onChangeScript(preset.text)}
                className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors"
              >
                {preset.title.split(" (")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            id="script-textarea"
            rows={8}
            value={script}
            onChange={(e) => onChangeScript(e.target.value)}
            placeholder="Paste your story, documentary narration, or product script here... (e.g. In Amharic, English, or any language)"
            className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 text-sm sm:text-base text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-y font-sans leading-relaxed"
          />

          {/* Quick Metrics Bar */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
            <div className="flex items-center gap-4">
              <span>
                <strong className="text-neutral-200 font-semibold">{wordsCount}</strong> words
              </span>
              <span>
                <strong className="text-neutral-200 font-semibold">{script.length}</strong> chars
              </span>
              {wordsCount > 0 && (
                <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  ~{estimatedSeconds}s duration ({estimatedScenes} scene{estimatedScenes > 1 ? "s" : ""})
                </span>
              )}
            </div>

            <button
              id="clear-script-btn"
              type="button"
              onClick={() => onChangeScript("")}
              disabled={!script}
              className="text-neutral-500 hover:text-neutral-300 disabled:opacity-0 transition-opacity"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Settings & Voice Selection */}
        <div className="mt-6 pt-6 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Voice configuration */}
          <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-3.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-300 mb-2">
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              <span>Narration Voice (Natural Male)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="voice-charon-btn"
                type="button"
                onClick={() => onChangeVoice("Charon")}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  voice === "Charon"
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold text-neutral-200">Charon</div>
                  <div className="text-[10px] text-neutral-400">Warm & Authoritative</div>
                </div>
                <Volume2 className={`w-3.5 h-3.5 ${voice === "Charon" ? "text-indigo-400" : "text-neutral-600"}`} />
              </button>

              <button
                id="voice-fenrir-btn"
                type="button"
                onClick={() => onChangeVoice("Fenrir")}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  voice === "Fenrir"
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold text-neutral-200">Fenrir</div>
                  <div className="text-[10px] text-neutral-400">Deep & Cinematic</div>
                </div>
                <Volume2 className={`w-3.5 h-3.5 ${voice === "Fenrir" ? "text-indigo-400" : "text-neutral-600"}`} />
              </button>
            </div>
          </div>

          {/* Language & Captions notice */}
          <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 mb-1">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Multilingual & Captions</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                If written in Amharic, Gemini narrates in natural Amharic. If written in another language, it narrates in that language. Synchronized animated captions are automatically burned into the video.
              </p>
            </div>
            <div className="text-[11px] text-neutral-500 mt-2">
              Resolution: 1280x720 HD · 30 FPS · MP4
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            id="split-script-submit-btn"
            type="button"
            disabled={!script.trim() || isLoading}
            onClick={onGenerateScenes}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Splitting Script with Gemini...</span>
              </>
            ) : (
              <>
                <span>Next: Split into Scenes</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
