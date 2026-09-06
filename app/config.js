(() => {
  const DEFAULT_SERVER_URL = 'https://autodeal-api-v2-production.up.railway.app';
  const LEGACY_SERVER_URLS = new Set([
    'https://autodeal-api-noambeteshs-projects.vercel.app',
    'https://autodeal-api-production.up.railway.app'
  ]);

  try {
    const key = 'autodeal.settings';
    const current = JSON.parse(localStorage.getItem(key) || '{}');
    if (!current.serverUrl || LEGACY_SERVER_URLS.has(current.serverUrl)) {
      current.serverUrl = DEFAULT_SERVER_URL;
      localStorage.setItem(key, JSON.stringify(current));
    }
  } catch (_) {
    localStorage.setItem('autodeal.settings', JSON.stringify({serverUrl: DEFAULT_SERVER_URL}));
  }

  window.AUTO_DEAL_DEFAULT_SERVER_URL = DEFAULT_SERVER_URL;
})();
