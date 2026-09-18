import type { VideoClip } from "../src/types.ts";

// Curated high quality royalty-free video clips from Pexels CDN for fallback when Pexels API key is not configured or query yields zero results
const SAMPLE_FALLBACK_CLIPS: VideoClip[] = [
  {
    id: "sample-coffee-culture",
    source: "sample",
    title: "Artisanal Coffee & Steaming Ceremony",
    thumbnailUrl: "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=640",
    videoUrl: "https://videos.pexels.com/video-files/855564/855564-hd_1280_720_24fps.mp4",
    duration: 15,
    mediaType: "video",
    author: "Stock Creator",
  },
  {
    id: "sample-mountain-landscape",
    source: "sample",
    title: "Dramatic Mountain Highlands & Cloudscape",
    thumbnailUrl: "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=640",
    videoUrl: "https://videos.pexels.com/video-files/855564/855564-hd_1280_720_24fps.mp4",
    duration: 15,
    mediaType: "video",
    author: "Nature Reels",
  },
  {
    id: "sample-african-landscape",
    source: "sample",
    title: "Scenic Sunset & Horizon",
    thumbnailUrl: "https://images.pexels.com/photos/247376/pexels-photo-247376.jpeg?auto=compress&cs=tinysrgb&w=640",
    videoUrl: "https://videos.pexels.com/video-files/4058097/4058097-hd_1280_720_25fps.mp4",
    duration: 16,
    mediaType: "video",
    author: "Wild Horizon",
  },
  {
    id: "sample-urban-city",
    source: "sample",
    title: "Modern City Skyline & Streets",
    thumbnailUrl: "https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=640",
    videoUrl: "https://videos.pexels.com/video-files/3129957/3129957-hd_1280_720_25fps.mp4",
    duration: 15,
    mediaType: "video",
    author: "Cityscape",
  },
  {
    id: "sample-traditional-craft",
    source: "sample",
    title: "Traditional Crafts & Artisan Work",
    thumbnailUrl: "https://images.pexels.com/photos/2162938/pexels-photo-2162938.jpeg?auto=compress&cs=tinysrgb&w=640",
    videoUrl: "https://videos.pexels.com/video-files/4933924/4933924-hd_1280_720_25fps.mp4",
    duration: 12,
    mediaType: "video",
    author: "Artisan Craft",
  },
  {
    id: "sample-people-talking",
    source: "sample",
    title: "People Connecting & Gathering",
    thumbnailUrl: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=640",
    videoUrl: "https://videos.pexels.com/video-files/3248357/3248357-hd_1280_720_25fps.mp4",
    duration: 14,
    mediaType: "video",
    author: "Human Stories",
  },
  {
    id: "sample-nature-forest",
    source: "sample",
    title: "Lush Green Forest & Natural Light",
    thumbnailUrl: "https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=640",
    videoUrl: "https://videos.pexels.com/video-files/4828604/4828604-hd_1280_720_25fps.mp4",
    duration: 15,
    mediaType: "video",
    author: "Earth & Flora",
  },
];

export interface PexelsSearchResult {
  clips: VideoClip[];
  query: string;
  isFallback: boolean;
  message?: string;
}

/**
 * Searches the Pexels Video API for high quality stock footage matching keywords.
 */
export async function searchPexelsVideos(
  query: string,
  perPage = 8
): Promise<PexelsSearchResult> {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey || apiKey === "MY_PEXELS_API_KEY") {
    // Return relevant filtered sample clips
    const matched = filterSampleClips(query);
    return {
      clips: matched,
      query,
      isFallback: true,
      message: "Pexels API key not configured in environment secrets. Displaying curated royalty-free stock clips.",
    };
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const url = `https://api.pexels.com/videos/search?query=${encodedQuery}&per_page=${perPage}&orientation=landscape`;

    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Pexels API responded with ${res.status}: ${errText}`);
      const matched = filterSampleClips(query);
      return {
        clips: matched,
        query,
        isFallback: true,
        message: `Pexels API returned status ${res.status}. Falling back to sample stock clips.`,
      };
    }

    const data: any = await res.json();
    const videos = data.videos || [];

    if (videos.length === 0) {
      // Try a broader fallback query or sample clips
      const matched = filterSampleClips(query);
      return {
        clips: matched,
        query,
        isFallback: true,
        message: `No Pexels videos found for "${query}". Provided related stock footage clips.`,
      };
    }

    const clips: VideoClip[] = videos.map((v: any) => {
      // Find highest resolution MP4 file: prioritize 1080p (1920x1080) or 4K, avoid low-res previews
      const files: any[] = v.video_files || [];
      const mp4Files = files.filter(
        (f: any) => f.file_type === "video/mp4" || (f.link && f.link.includes(".mp4"))
      );

      // Sort descending by resolution (width * height) so highest quality is always first
      mp4Files.sort((a: any, b: any) => {
        const resA = (a.width || 0) * (a.height || 0);
        const resB = (b.width || 0) * (b.height || 0);
        return resB - resA;
      });

      // Best file is highest resolution MP4 (1080p or higher)
      const bestFile = mp4Files[0] || files[0];

      return {
        id: v.id,
        source: "pexels",
        title: `${query} (${v.user?.name || "Pexels Creator"})`,
        thumbnailUrl: v.image || (v.video_pictures?.[0]?.picture) || "",
        videoUrl: bestFile?.link || "",
        duration: v.duration || 10,
        width: bestFile?.width || v.width,
        height: bestFile?.height || v.height,
        author: v.user?.name || "Pexels Creator",
        mediaType: "video",
      };
    }).filter((c: VideoClip) => Boolean(c.videoUrl));

    return {
      clips: clips.length > 0 ? clips : filterSampleClips(query),
      query,
      isFallback: clips.length === 0,
    };
  } catch (err: any) {
    console.error("Error searching Pexels:", err);
    return {
      clips: filterSampleClips(query),
      query,
      isFallback: true,
      message: `Search failed: ${err.message}. Using curated stock clips.`,
    };
  }
}

function filterSampleClips(query: string): VideoClip[] {
  const q = query.toLowerCase();
  if (q.includes("coffee") || q.includes("drink") || q.includes("cup") || q.includes("roast")) {
    return [SAMPLE_FALLBACK_CLIPS[0], SAMPLE_FALLBACK_CLIPS[4], SAMPLE_FALLBACK_CLIPS[1]];
  }
  if (q.includes("mountain") || q.includes("highland") || q.includes("cloud") || q.includes("landscape")) {
    return [SAMPLE_FALLBACK_CLIPS[1], SAMPLE_FALLBACK_CLIPS[2], SAMPLE_FALLBACK_CLIPS[6]];
  }
  if (q.includes("africa") || q.includes("sunset") || q.includes("sun") || q.includes("sky")) {
    return [SAMPLE_FALLBACK_CLIPS[2], SAMPLE_FALLBACK_CLIPS[1], SAMPLE_FALLBACK_CLIPS[0]];
  }
  if (q.includes("city") || q.includes("urban") || q.includes("building") || q.includes("street")) {
    return [SAMPLE_FALLBACK_CLIPS[3], SAMPLE_FALLBACK_CLIPS[5], SAMPLE_FALLBACK_CLIPS[1]];
  }
  if (q.includes("people") || q.includes("friend") || q.includes("community") || q.includes("culture")) {
    return [SAMPLE_FALLBACK_CLIPS[5], SAMPLE_FALLBACK_CLIPS[4], SAMPLE_FALLBACK_CLIPS[0]];
  }
  return SAMPLE_FALLBACK_CLIPS;
}
