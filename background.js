const YT_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";

function parseISODurationToSeconds(iso) {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

function extractVideoId(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (!host.endsWith("youtube.com")) return null;

    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/shorts/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[1] || null;
    }

    if (url.pathname.startsWith("/embed/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[1] || null;
    }

    return null;
  } catch (e) {
    return null;
  }
}

const recentByTab = new Map();

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ apiKey: "", profile: "Default", enabled: true }, resolve);
  });
}

async function setLogEntry(entry) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ watchLog: [] }, (data) => {
      const log = data.watchLog || [];
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const isDup = log.some(
        (e) => e.videoId === entry.videoId && new Date(e.watchedAt).getTime() >= fiveMinutesAgo
      );
      if (!isDup) {
        log.push(entry);
      }
      chrome.storage.local.set({ watchLog: log }, () => resolve());
    });
  });
}

async function fetchVideoMetadata(videoId, apiKey) {
  const url = new URL(YT_API_ENDPOINT);
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`YouTube API error: ${resp.status}`);
  const json = await resp.json();
  const item = json.items && json.items[0];
  if (!item) throw new Error("Video not found in API response");

  const { snippet, contentDetails } = item;
  return {
    title: snippet?.title || "",
    description: snippet?.description || "",
    durationSeconds: (function () {
      const d = contentDetails?.duration; 
      if (!d) return null; 
      return parseISODurationToSeconds(d);
    })(),
    channelTitle: snippet?.channelTitle || "",
    thumbnails: snippet?.thumbnails || {},
  };
}

async function handlePossibleWatch(url, tabId) {
  const videoId = extractVideoId(url);
  if (!videoId) return;

  const now = Date.now();
  const last = recentByTab.get(tabId);
  if (last && last.videoId === videoId && now - last.ts < 10_000) {
    return;
  }
  recentByTab.set(tabId, { videoId, ts: now });

  const { apiKey, profile, enabled } = await getSettings();
  if (!enabled) return;
  if (!apiKey) {
    console.warn("YouTube Watch Logger: No API key set. Open Options to configure.");
    return;
  }

  try {
    const meta = await fetchVideoMetadata(videoId, apiKey);
    const entry = {
      videoId,
      url,
      title: meta.title,
      description: meta.description,
      durationSeconds: meta.durationSeconds,
      channelTitle: meta.channelTitle,
      profile,
      watchedAt: new Date().toISOString(),
    };
    await setLogEntry(entry);
    console.info("Logged YouTube watch:", entry);
  } catch (err) {
    console.error("Failed to log video via API:", err);
  }
}

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  handlePossibleWatch(details.url, details.tabId);
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  handlePossibleWatch(details.url, details.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  recentByTab.delete(tabId);
});