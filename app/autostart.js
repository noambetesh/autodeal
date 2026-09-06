window.addEventListener('load', async () => {
  try {
    const hasLiveListing = state.listings.some(x => x.sourceUrl && /yad2\.co\.il/i.test(x.sourceUrl));
    if (hasLiveListing) return;
    const d = await api('/api/yad2/import', 'POST', {url:'https://www.yad2.co.il/vehicles/cars', notify:false});
    if (Array.isArray(d.listings) && d.listings.length) {
      merge(d.listings);
      toast(`נטענו ${d.listings.length} מודעות חיות עם תמונות`);
    }
  } catch (_) {
    // Keep local data available when the live source is temporarily unavailable.
  }
});
