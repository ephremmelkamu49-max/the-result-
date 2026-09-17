import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SceneRenderItem {
  id: string;
  order: number;
  narration: string;
  videoUrl: string;
  mediaType: "video" | "image";
  duration: number; // in seconds
  audioPath: string;
}

/**
 * Downloads a remote URL to a local destination file, with graceful visual fallback.
 */
export async function downloadFile(url: string, destPath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  // If local file path
  if (url.startsWith("/") || url.startsWith("./")) {
    if (fs.existsSync(url)) {
      await fs.promises.copyFile(url, destPath);
      return;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ScriptReel/1.0",
        Accept: "*/*",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 500) {
      await fs.promises.writeFile(destPath, buffer);
      return;
    }
    throw new Error("Downloaded asset buffer is too small");
  } catch (err: any) {
    console.warn(`Asset download failed for ${url} (${err.message}), generating cinematic background fallback.`);
    // Generate a sleek dark cinematic gradient background with subtle movement
    const fallbackCmd = `ffmpeg -y -f lavfi -i "color=c=0x141a29:s=1280x720:d=15,format=yuv420p" -c:v libx264 -preset ultrafast "${destPath}"`;
    await execAsync(fallbackCmd);
  }
}

/**
 * Formats seconds into ASS timecode: H:MM:SS.CC (centiseconds)
 */
function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds - Math.floor(seconds)) * 100);

  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const ccs = String(cs).padStart(2, "0");

  return `${h}:${mm}:${ss}.${ccs}`;
}

/**
 * Creates an ASS (Advanced SubStation Alpha) subtitle file.
 * ASS provides font fallback, styling, drop shadows, and subtle animation.
 */
export async function createAssSubtitleFile(
  scenes: { narration: string; startTime: number; endTime: number }[],
  outputPath: string
): Promise<void> {
  const lines: string[] = [
    "[Script Info]",
    "Title: ScriptReel Synced Captions",
    "ScriptType: v4.00+",
    "PlayResX: 1280",
    "PlayResY: 720",
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // FreeSerif supports Ethiopic (Amharic) glyphs and Latin scripts
    "Style: Default,FreeSerif,34,&H00FFFFFF,&H000000FF,&H000F0F0F,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,60,60,50,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const scene of scenes) {
    const text = scene.narration.replace(/\r?\n/g, " ").trim();
    if (!text) continue;

    const start = formatAssTime(scene.startTime);
    const end = formatAssTime(scene.endTime);

    // Escape special ASS characters if any
    const safeText = text.replace(/[{}]/g, "");

    // Break long lines into two if greater than 50 chars
    let formattedText = safeText;
    if (safeText.length > 55) {
      const words = safeText.split(" ");
      const mid = Math.ceil(words.length / 2);
      formattedText = words.slice(0, mid).join(" ") + "\\N" + words.slice(mid).join(" ");
    }

    // Include subtle 120ms fade in/out animation
    lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,{\\fad(120,120)}${formattedText}`);
  }

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, lines.join("\n"), "utf-8");
}

/**
 * Renders a single scene:
 * - Loops or trims video clip (or image) to match the narration duration.
 * - Scales to 1280x720, 30fps, 16:9 letterbox/pillarbox.
 * - Mixes the narration audio.
 */
export async function renderSceneClip(
  item: SceneRenderItem,
  rawMediaLocalPath: string,
  outputScenePath: string
): Promise<void> {
  await fs.promises.mkdir(path.dirname(outputScenePath), { recursive: true });

  const duration = Math.max(2, item.duration);
  const isImage = item.mediaType === "image";

  let cmd: string;

  if (isImage) {
    // For images: loop static image, scale and pad to 1280:720, add audio
    cmd = `ffmpeg -y -loop 1 -t ${duration.toFixed(2)} -i "${rawMediaLocalPath}" -i "${item.audioPath}" ` +
      `-filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v];[1:a]apad=pad_dur=0.5,atrim=0:${duration.toFixed(2)}[a]" ` +
      `-map "[v]" -map "[a]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k -movflags +faststart "${outputScenePath}"`;
  } else {
    // For videos: stream_loop -1 so if clip is shorter than narration, it seamlessly loops!
    // Scale and pad to 1280x720, set fps to 30, mix narration audio
    cmd = `ffmpeg -y -stream_loop -1 -i "${rawMediaLocalPath}" -i "${item.audioPath}" -t ${duration.toFixed(2)} ` +
      `-filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v];[1:a]apad=pad_dur=0.5,atrim=0:${duration.toFixed(2)}[a]" ` +
      `-map "[v]" -map "[a]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k -movflags +faststart "${outputScenePath}"`;
  }

  try {
    await execAsync(cmd);
  } catch (err: any) {
    console.error(`Failed to render scene ${item.order}:`, err?.stderr || err?.message || err);
    throw new Error(`FFmpeg scene render failed: ${err?.stderr || err?.message}`);
  }
}

/**
 * Concatenates all scene clips into one final video and burns in synchronized captions.
 */
export async function assembleFinalVideo(
  scenePaths: string[],
  assSubtitlePath: string,
  finalOutputPath: string,
  tempDir: string
): Promise<void> {
  await fs.promises.mkdir(path.dirname(finalOutputPath), { recursive: true });

  // 1. Create concat manifest
  const manifestPath = path.join(tempDir, "concat_manifest.txt");
  const manifestContent = scenePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.promises.writeFile(manifestPath, manifestContent, "utf-8");

  const uncaptionedConcatPath = path.join(tempDir, "combined_raw.mp4");

  // Fast concatenation of rendered scenes (all share identical 1280x720, 30fps yuv420p & aac format)
  const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${manifestPath}" -c copy "${uncaptionedConcatPath}"`;
  try {
    await execAsync(concatCmd);
  } catch (err: any) {
    // If copy fails due to container sync, fallback to re-encode concat
    console.warn("Concat copy failed, trying re-encode concat:", err?.stderr || err?.message);
    const reencodeCmd = `ffmpeg -y -f concat -safe 0 -i "${manifestPath}" -c:v libx264 -preset ultrafast -c:a aac "${uncaptionedConcatPath}"`;
    await execAsync(reencodeCmd);
  }

  // 2. Burn in the ASS subtitles onto the combined video
  const burnCmd = `ffmpeg -y -i "${uncaptionedConcatPath}" -vf "ass=${assSubtitlePath.replace(/'/g, "'\\''")}" ` +
    `-c:v libx264 -preset veryfast -crf 22 -c:a copy -movflags +faststart "${finalOutputPath}"`;

  try {
    await execAsync(burnCmd);
  } catch (burnErr: any) {
    console.warn("ASS burning failed, attempting fallback without subtitles:", burnErr?.stderr || burnErr?.message);
    // If ASS failed for some reason, copy raw concat to final output
    await fs.promises.copyFile(uncaptionedConcatPath, finalOutputPath);
  }
}
