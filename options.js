function load() {
  chrome.storage.local.get({ apiKey: "", profile: "Default", enabled: true }, (cfg) => {
    document.getElementById('apiKey').value = cfg.apiKey || '';
    document.getElementById('profile').value = cfg.profile || 'Default';
    document.getElementById('enabled').checked = !!cfg.enabled;
  });
}

function save() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const profile = document.getElementById('profile').value.trim() || 'Default';
  const enabled = document.getElementById('enabled').checked;
  chrome.storage.local.set({ apiKey, profile, enabled }, () => {
    const s = document.getElementById('status');
    s.textContent = 'Saved';
    s.className = 'ok';
    setTimeout(() => { s.textContent = ''; s.className=''; }, 1500);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('save').addEventListener('click', save);
});
