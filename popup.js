function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function fmtDur(sec) {
  if (sec == null) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function toCsv(rows) {
  const header = ["watchedAt","profile","videoId","title","channelTitle","durationSeconds","url","description"];
  const esc = (s) => '"' + String(s ?? "").replaceAll('"', '""') + '"';
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.watchedAt,
      r.profile,
      r.videoId,
      r.title,
      r.channelTitle,
      r.durationSeconds ?? "",
      r.url,
      r.description
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

function render(list, q="") {
  const root = document.getElementById("list");
  root.innerHTML = "";

  let rows = [...list].sort((a,b) => new Date(b.watchedAt) - new Date(a.watchedAt));
  if (q) {
    const qq = q.toLowerCase();
    rows = rows.filter(r => (r.title||"").toLowerCase().includes(qq) || (r.channelTitle||"").toLowerCase().includes(qq));
  }

  if (!rows.length) {
    root.innerHTML = '<div class="empty">No items logged yet.</div>';
    return;
  }

  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div class="row">
        <a class="title wrap" href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title || r.videoId}</a>
        <span class="pill">${r.profile}</span>
      </div>
      <div class="meta">
        <span>${r.channelTitle || ""}</span>
        · <span class="muted">${fmtDur(r.durationSeconds)}</span>
        · <span class="muted">${fmtDate(r.watchedAt)}</span>
      </div>
    `;
    root.appendChild(div);
  }
}

async function loadAndRender() {
  chrome.storage.local.get({ watchLog: [] }, ({ watchLog }) => {
    const q = document.getElementById("q").value.trim();
    render(watchLog || [], q);
  });
}

document.getElementById("q").addEventListener("input", loadAndRender);

document.getElementById("export").addEventListener("click", () => {
  chrome.storage.local.get({ watchLog: [] }, ({ watchLog }) => {
    const csv = toCsv(watchLog || []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube_watch_log_${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
});

document.getElementById("clear").addEventListener("click", () => {
  if (!confirm("Clear all logged items?")) return;
  chrome.storage.local.set({ watchLog: [] }, loadAndRender);
});

loadAndRender();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.watchLog) loadAndRender();
});