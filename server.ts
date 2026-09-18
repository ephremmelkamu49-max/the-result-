import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { splitScriptIntoScenes, generateNarrationTTS, getGeminiClient } from "./server/gemini.ts";
import { searchPexelsVideos } from "./server/pexels.ts";
import { downloadFile, createAssSubtitleFile, renderSceneClip, assembleFinalVideo } from "./server/ffmpeg.ts";
import type { SceneRenderItem } from "./server/ffmpeg.ts";
import { GenerateVideosOperation } from "@google/genai";

dotenv.config();

const ROOT_DIR = process.cwd();
const app = express();

// Set up directories for media and output safely
const STORAGE_DIR = path.join(ROOT_DIR, "storage");
const UPLOADS_DIR = path.join(STORAGE_DIR, "uploads");
const RENDERS_DIR = path.join(STORAGE_DIR, "renders");
const TEMP_DIR = path.join(STORAGE_DIR, "temp");
const ASSETS_DIR = path.join(STORAGE_DIR, "assets");

try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
} catch (e) {
  console.warn("Storage directory initialization warning:", e);
}

// Middleware
app.use(express.json({ limit: "60mb" }));
app.use(express.urlencoded({ extended: true, limit: "60mb" }));

// Liveness & health check endpoints for Cloud Run container probes
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// In-memory render job status tracking
interface RenderJob {
  id: string;
  stage: "audio" | "video" | "captions" | "concat" | "completed" | "error";
  progress: number;
  message: string;
  currentScene: number;
  totalScenes: number;
  videoUrl?: string;
  downloadUrl?: string;
  duration?: number;
  error?: string;
}

const renderJobs = new Map<string, RenderJob>();

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// System configuration status
app.get("/api/config", (req, res) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
  const hasPexelsKey = Boolean(process.env.PEXELS_API_KEY && process.env.PEXELS_API_KEY !== "MY_PEXELS_API_KEY");

  res.json({
    hasGeminiKey,
    hasPexelsKey,
    serverReady: true,
  });
});

// 1. Split script into scenes with Gemini
app.post("/api/scenes/split", async (req, res) => {
  try {
    const { script } = req.body;
    if (!script || typeof script !== "string" || script.trim().length === 0) {
      return res.status(400).json({ error: "Script text is required" });
    }

    const result = await splitScriptIntoScenes(script.trim());
    res.json(result);
  } catch (err: any) {
    console.error("Script split error:", err);
    res.status(500).json({
      error: err?.message || "Failed to split script with Gemini",
    });
  }
});

// 2. Search Pexels for stock video clips
app.post("/api/pexels/search", async (req, res) => {
  try {
    const { query, perPage = 10 } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const result = await searchPexelsVideos(String(query), Number(perPage) || 10);
    res.json(result);
  } catch (err: any) {
    console.error("Pexels search error:", err);
    res.status(500).json({
      error: err?.message || "Failed to search stock footage",
    });
  }
});

// 3. Optional Veo AI Video generation per scene
app.post("/api/scenes/generate-ai-video", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required for AI video generation" });
    }

    const ai = getGeminiClient();
    const operation = await ai.models.generateVideos({
      model: "veo-3.1-lite-generate-preview",
      prompt: String(prompt),
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: "16:9",
      },
    });

    res.json({
      operationName: operation.name,
      message: "AI video generation started with Veo",
    });
  } catch (err: any) {
    console.error("Veo video generation error:", err);
    res.status(500).json({
      error: err?.message || "Failed to start Veo video generation. You can use stock footage instead.",
    });
  }
});

// Check status of Veo generation
app.post("/api/scenes/check-ai-video", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    const ai = getGeminiClient();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    if (!updated.done) {
      return res.json({ done: false, message: "AI clip is still rendering..." });
    }

    if (updated.error) {
      return res.status(500).json({
        done: true,
        error: updated.error.message || "Veo video generation failed",
      });
    }

    const videoObj = updated.response?.generatedVideos?.[0]?.video;
    const uri = videoObj?.uri;

    if (!uri) {
      return res.status(500).json({ error: "No video URI returned from Veo" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const videoFetchRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey || "" },
    });

    if (!videoFetchRes.ok) {
      return res.status(500).json({ error: "Failed to download generated Veo video" });
    }

    const arrayBuf = await videoFetchRes.arrayBuffer();
    const filename = `veo_${Date.now()}.mp4`;
    const localPath = path.join(UPLOADS_DIR, filename);
    await fs.promises.writeFile(localPath, Buffer.from(arrayBuf));

    const videoUrl = `/api/media/${filename}`;

    res.json({
      done: true,
      videoUrl,
      title: "AI Generated Clip (Veo)",
      thumbnailUrl: videoUrl,
    });
  } catch (err: any) {
    console.error("Veo status check error:", err);
    res.status(500).json({
      error: err?.message || "Failed to check Veo status",
    });
  }
});

// 4. Custom media upload (Image or Video)
app.post("/api/scenes/upload-media", async (req, res) => {
  try {
    const { dataUrl, filename, mediaType } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: "dataUrl payload is required" });
    }

    // Extract base64
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid data URL format" });
    }

    const mime = matches[1];
    const base64Data = matches[2];
    const isVideo = mime.startsWith("video") || mediaType === "video";
    const ext = isVideo ? ".mp4" : ".jpg";
    const safeFilename = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    await fs.promises.writeFile(filePath, Buffer.from(base64Data, "base64"));

    const mediaUrl = `/api/media/${safeFilename}`;

    res.json({
      mediaUrl,
      mediaType: isVideo ? "video" : "image",
      thumbnailUrl: isVideo ? "" : mediaUrl,
      title: filename || "User Uploaded Media",
    });
  } catch (err: any) {
    console.error("Media upload error:", err);
    res.status(500).json({ error: err?.message || "Failed to upload media" });
  }
});

// Serve uploaded and local media
app.get("/api/media/:filename", (req, res) => {
  const file = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send("File not found");
  }
});

// 5. Job progress polling endpoint
app.get("/api/video/progress/:jobId", (req, res) => {
  const job = renderJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Render job not found" });
  }
  res.json(job);
});

// Helper function for parallel processing with controlled concurrency
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

// 6. Main Video Rendering Pipeline (Background job with parallel per-scene processing)
app.post("/api/video/render", async (req, res) => {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const { scenes, language = "Amharic", voice = "Charon", bgMusic = true } = req.body;

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: "At least one scene is required" });
  }

  const totalScenes = scenes.length;

  // Initialize job tracking
  const initialJob: RenderJob = {
    id: jobId,
    stage: "audio",
    progress: 5,
    message: `Starting 1080p render pipeline for ${totalScenes} scene(s)...`,
    currentScene: 0,
    totalScenes,
  };
  renderJobs.set(jobId, initialJob);

  // Return jobId immediately so the client can display real-time progress without timeouts
  res.json({ jobId, message: "Render job initiated" });

  // Execute rendering in the background
  (async () => {
    const jobTempDir = path.join(TEMP_DIR, jobId);
    await fs.promises.mkdir(jobTempDir, { recursive: true });

    try {
      let completedScenesCount = 0;

      // Process scenes with controlled concurrency (4 parallel workers for TTS + footage + clip rendering)
      const sceneResults = await runWithConcurrency(scenes, 4, async (scene, idx) => {
        const sceneNum = idx + 1;

        // 1. Synthesize TTS narration audio
        const sceneAudioFile = path.join(jobTempDir, `audio_scene_${sceneNum}.wav`);
        const ttsResult = await generateNarrationTTS(
          scene.narration,
          sceneAudioFile,
          voice === "Fenrir" ? "Fenrir" : "Charon"
        );
        const sceneDuration = Math.max(2.5, ttsResult.durationSeconds);

        // 2. Obtain visual media (cached or downloaded)
        const mediaUrl = scene.selectedClip?.videoUrl || "";
        const mediaType = scene.selectedClip?.mediaType || "video";
        const rawMediaExt = mediaType === "image" ? ".jpg" : ".mp4";
        const rawMediaPath = path.join(jobTempDir, `raw_media_scene_${sceneNum}${rawMediaExt}`);

        let effectiveUrl = mediaUrl;
        if (effectiveUrl.startsWith("/api/media/")) {
          effectiveUrl = path.join(UPLOADS_DIR, path.basename(effectiveUrl));
        }

        await downloadFile(effectiveUrl, rawMediaPath);

        // 3. Render standardized clip with FFmpeg (1080p, 30fps, Ken Burns for images)
        const sceneClipOutput = path.join(jobTempDir, `rendered_scene_${sceneNum}.mp4`);
        const renderItem: SceneRenderItem = {
          id: scene.id || `scene-${sceneNum}`,
          order: sceneNum,
          narration: scene.narration,
          videoUrl: mediaUrl,
          mediaType,
          duration: sceneDuration,
          audioPath: sceneAudioFile,
        };

        await renderSceneClip(renderItem, rawMediaPath, sceneClipOutput);

        // 4. Release raw media download immediately to prevent disk exhaustion on long videos
        try {
          if (fs.existsSync(rawMediaPath)) {
            await fs.promises.unlink(rawMediaPath);
          }
        } catch {
          // ignore cleanup of raw media
        }

        // 5. Update progress in real-time
        completedScenesCount++;
        renderJobs.set(jobId, {
          ...initialJob,
          stage: "video",
          currentScene: completedScenesCount,
          totalScenes,
          progress: Math.round(10 + (completedScenesCount / totalScenes) * 75),
          message: `Scene ${completedScenesCount}/${totalScenes} complete (Ken Burns & 1080p master synced)`,
        });

        return {
          order: sceneNum,
          narration: scene.narration,
          duration: sceneDuration,
          sceneClipOutput,
        };
      });

      // Sort results by original scene order to ensure exact sequential flow
      sceneResults.sort((a, b) => a.order - b.order);

      // Compute sequential timeline for captions (accounting for 0.5s transition overlaps)
      const transOverlap = sceneResults.length > 1 ? 0.5 : 0;
      let totalDuration = 0;
      const subtitleScenes = sceneResults.map((s, idx) => {
        const startTime = totalDuration;
        const endTime = totalDuration + s.duration;
        totalDuration = endTime - (idx < sceneResults.length - 1 ? transOverlap : 0);
        return {
          narration: s.narration,
          startTime,
          endTime,
        };
      });

      const renderedSceneFiles = sceneResults.map((s) => s.sceneClipOutput);
      const sceneDurations = sceneResults.map((s) => s.duration);

      // Step 3: Create ASS subtitle file with animated captions
      renderJobs.set(jobId, {
        ...initialJob,
        stage: "captions",
        currentScene: totalScenes,
        totalScenes,
        progress: 88,
        message: "Burning in 1080p animated captions & Ken Burns transitions...",
      });

      const assFilePath = path.join(jobTempDir, "captions.ass");
      await createAssSubtitleFile(subtitleScenes, assFilePath);

      // Step 4: Assemble final video (crossfade transitions + background music + 1080p encode)
      renderJobs.set(jobId, {
        ...initialJob,
        stage: "concat",
        currentScene: totalScenes,
        totalScenes,
        progress: 93,
        message: bgMusic ? "Mixing background music & rendering transitions..." : "Rendering smooth crossfades...",
      });

      const finalVideoPath = path.join(RENDERS_DIR, `${jobId}.mp4`);
      await assembleFinalVideo({
        scenePaths: renderedSceneFiles,
        sceneDurations,
        assSubtitlePath: assFilePath,
        finalOutputPath: finalVideoPath,
        tempDir: jobTempDir,
        bgMusicEnabled: bgMusic !== false,
        bgMusicPath: path.join(ASSETS_DIR, "bg_ambient.mp3"),
      });

      // Step 5: Mark complete and expose download/stream URLs ONLY when final video is 100% written
      const stat = await fs.promises.stat(finalVideoPath);
      if (stat.size === 0) {
        throw new Error("Final video output file is empty.");
      }

      const videoUrl = `/api/video/stream/${jobId}`;
      const downloadUrl = `/api/video/download/${jobId}`;

      renderJobs.set(jobId, {
        id: jobId,
        stage: "completed",
        progress: 100,
        message: "1080p Video rendering complete! Ready to preview & download.",
        currentScene: totalScenes,
        totalScenes,
        videoUrl,
        downloadUrl,
        duration: Math.round(totalDuration),
      });

      // Cleanup temp scene directory after slight delay, while preserving the final video in RENDERS_DIR
      setTimeout(async () => {
        try {
          await fs.promises.rm(jobTempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      }, 60000);
    } catch (err: any) {
      console.error(`Rendering failed for job ${jobId}:`, err);
      renderJobs.set(jobId, {
        ...initialJob,
        stage: "error",
        progress: 0,
        message: err?.message || "Video rendering failed",
        error: err?.message || "An unexpected error occurred during video processing.",
      });
    }
  })();
});

// Stream video with HTTP 206 partial content support for seekable video playback in browser
app.get("/api/video/stream/:id", (req, res) => {
  const cleanId = path.basename(req.params.id);
  const filePath = path.join(RENDERS_DIR, `${cleanId}.mp4`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Video not found");
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Download video directly from server storage straight to phone/desktop download manager without browser memory bloat
app.get("/api/video/download/:id", (req, res) => {
  const cleanId = path.basename(req.params.id);
  const filePath = path.join(RENDERS_DIR, `${cleanId}.mp4`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Video file not found or render has not completed yet." });
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return res.status(425).json({ error: "Video file is still being finalized on the server." });
  }

  // Allow custom filename query parameter, e.g. ?filename=my-video.mp4
  let filename = req.query.filename as string;
  if (!filename || typeof filename !== "string") {
    filename = `scriptreel-${cleanId}.mp4`;
  } else {
    // Sanitize filename and ensure .mp4 extension
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!filename.endsWith(".mp4")) {
      filename += ".mp4";
    }
  }

  const encodedFilename = encodeURIComponent(filename);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=86400");

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
});

// -------------------------------------------------------------
// VITE / STATIC SERVING & PORT BINDING
// -------------------------------------------------------------
async function startServer() {
  const isCjsBundle = typeof __filename !== "undefined" && __filename.endsWith("server.cjs");
  
  // Search for the dist directory across common execution contexts
  const candidateDirs = [
    path.join(process.cwd(), "dist"),
    process.cwd(),
    typeof __dirname !== "undefined" ? __dirname : "",
    typeof __dirname !== "undefined" ? path.join(__dirname, "..", "dist") : "",
  ].filter(Boolean);

  let resolvedDistPath = path.join(process.cwd(), "dist");
  let resolvedIndexPath = path.join(resolvedDistPath, "index.html");
  let hasBuiltAssets = false;

  for (const dir of candidateDirs) {
    const candidateIndex = path.join(dir, "index.html");
    if (fs.existsSync(candidateIndex)) {
      resolvedDistPath = dir;
      resolvedIndexPath = candidateIndex;
      hasBuiltAssets = true;
      break;
    }
  }

  const isProduction = process.env.NODE_ENV === "production" || isCjsBundle || hasBuiltAssets;

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(resolvedDistPath));
    app.get("*", (req, res) => {
      if (fs.existsSync(resolvedIndexPath)) {
        res.sendFile(resolvedIndexPath);
      } else {
        res.status(200).send("<!doctype html><html><body><div id='root'></div><script>location.reload()</script></body></html>");
      }
    });
  }

  // Detect environment:
  // In AI Studio Dev Sandbox: NGINX_PORT (8080) and CONTROL_PLANE_PORT (8000) are set.
  // The Nginx reverse proxy routes external traffic exclusively to port 3000.
  // In Cloud Run Production: No Nginx proxy; Cloud Run passes PORT (typically 8080) and routes directly to it.
  const isDevSandbox = Boolean(process.env.NGINX_PORT || process.env.CONTROL_PLANE_PORT);
  const cloudRunTargetPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  
  const primaryPort = isDevSandbox ? 3000 : cloudRunTargetPort;
  const secondaryPort = primaryPort === 3000 ? cloudRunTargetPort : 3000;

  // Primary listener
  const primaryServer = app.listen(primaryPort, "0.0.0.0", () => {
    console.log(`ScriptReel primary server listening on http://0.0.0.0:${primaryPort} (${isDevSandbox ? "AI Studio dev sandbox" : "Cloud Run production"})`);
  });
  primaryServer.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Primary port ${primaryPort} already active; continuing.`);
    } else {
      console.warn(`Primary port ${primaryPort} warning:`, err.message);
    }
  });

  // Secondary listener (enables dual-compatibility across port 3000 and Cloud Run port)
  if (secondaryPort !== primaryPort) {
    try {
      const secondaryServer = app.listen(secondaryPort, "0.0.0.0", () => {
        console.log(`ScriptReel secondary server listening on http://0.0.0.0:${secondaryPort}`);
      });
      secondaryServer.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Secondary port ${secondaryPort} already bound; traffic served via port ${primaryPort}.`);
        } else {
          console.warn(`Secondary port ${secondaryPort} warning:`, err.message);
        }
      });
    } catch (e: any) {
      console.log(`Secondary port ${secondaryPort} setup notice:`, e?.message);
    }
  }
}

startServer();
