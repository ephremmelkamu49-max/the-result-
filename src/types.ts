export interface Scene {
  id: string;
  order: number;
  narration: string;
  keywords: string[];
  visualDescription: string;
  estimatedDuration: number; // in seconds
  selectedClip?: VideoClip;
  isAiGenerating?: boolean;
  aiOperationName?: string;
  aiError?: string;
  status: 'pending' | 'ready' | 'error' | 'failed' | 'generating_ai';
  errorMessage?: string;
}

export interface VideoClip {
  id: string | number;
  source: 'pexels' | 'veo' | 'upload' | 'sample' | 'custom' | 'ai';
  title?: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration?: number;
  width?: number;
  height?: number;
  author?: string;
  mediaType: 'video' | 'image';
}

export interface ScriptSplitResponse {
  detectedLanguage: string;
  isAmharic: boolean;
  title: string;
  scenes: {
    id: string;
    order: number;
    narration: string;
    keywords: string[];
    visualDescription: string;
    estimatedDuration: number;
  }[];
}

export interface PexelsSearchResponse {
  clips: VideoClip[];
  query: string;
  isFallback?: boolean;
  message?: string;
}

export interface RenderProgressUpdate {
  stage: 'audio' | 'video' | 'captions' | 'concat' | 'completed' | 'error';
  progress: number; // 0 to 100
  message: string;
  currentScene?: number;
  totalScenes?: number;
  videoId?: string;
  videoUrl?: string;
  downloadUrl?: string;
  duration?: number;
  error?: string;
}

export interface SystemConfig {
  hasGeminiKey: boolean;
  hasPexelsKey: boolean;
  serverReady: boolean;
}
