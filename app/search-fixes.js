(() => {
  const YAD2_MODELS = {
    'toyota|yaris': {manufacturer: '19', model: '10247'},
    'טויוטה|יאריס': {manufacturer: '19', model: '10247'},
    'toyota|corolla': {manufacturer: '19', model: '10226'},
    'טויוטה|קורולה': {manufacturer: '19', model: '10226'},
    'toyota|rav4': {manufacturer: '19', model: '10238'},
    'טויוטה|rav4': {manufacturer: '19', model: '10238'},
    'toyota|c-hr': {manufacturer: '19', model: '10225'},
    'toyota|c hr': {manufacturer: '19', model: '10225'},
    'טויוטה|c-hr': {manufacturer: '19', model: '10225'}
  };

  const clean = value => String(value || '').trim().toLowerCase();
  const fmt = value => new Intl.NumberFormat('he-IL').format(Number(value) || 0);

  function resolveYad2(make, model) {
    return YAD2_MODELS[`${clean(make)}|${clean(model)}`] || null;
  }

  function buildYad2Url(search) {
    if (search.sourceUrl) return search.sourceUrl;
    const ids = resolveYad2(search.make, search.model);
    if (!ids) return '';
    const url = new URL('https://www.yad2.co.il/vehicles/cars');
    url.searchParams.set('manufacturer', ids.manufacturer);
    url.searchParams.set('model', ids.model);
    if (search.yearMin && search.yearMax) url.searchParams.set('year', `${search.yearMin}-${search.yearMax}`);
    else if (search.yearMin) url.searchParams.set('min-year', String(search.yearMin));
    else if (search.yearMax) url.searchParams.set('max-year', String(search.yearMax));
    if (search.maxPrice) url.searchParams.set('max-price', String(search.maxPrice));
    if (search.maxMileage) url.searchParams.set('max-km', String(search.maxMileage));
    return url.toString();
  }

  function autoName(search) {
    const parts = [`${search.make || ''} ${search.model || ''}`.trim() || 'חיפוש רכב'];
    if (search.yearMin || search.yearMax) {
      parts.push(search.yearMin && search.yearMax ? `${search.yearMin}-${search.yearMax}` : search.yearMin ? `מ-${search.yearMin}` : `עד ${search.yearMax}`);
    }
    if (search.maxPrice) parts.push(`עד ${fmt(search.maxPrice)} ₪`);
    return parts.join(' · ');
  }

  function wireSearchForm() {
    const form = document.querySelector('#searchForm');
    if (!form) return;
    form.onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(form);
      const search = {
        id: `s-${Date.now()}`,
        make: String(data.get('make') || '').trim(),
        model: String(data.get('model') || '').trim(),
        yearMin: Number(data.get('yearMin')) || null,
        yearMax: Number(data.get('yearMax')) || null,
        maxPrice: Number(data.get('maxPrice')) || null,
        maxMileage: Number(data.get('maxMileage')) || null,
        sourceUrl: String(data.get('sourceUrl') || '').trim(),
        active: true
      };
      search.name = autoName(search);
      search.sourceUrl = buildYad2Url(search);
      state.searches.push(search);
      if (state.settings.serverUrl) {
        try { await api('/api/searches', 'POST', search); } catch (_) {}
      }
      form.reset();
      document.querySelector('#searchModal')?.classList.add('hidden');
      toast('החיפוש נשמר');
      render();
    };
  }

  window.runSearch = async id => {
    const search = state.searches.find(item => item.id === id);
    if (!search) return;
    if (!search.sourceUrl) search.sourceUrl = buildYad2Url(search);
    try {
      const result = await api('/api/search/run', 'POST', search);
      if (Array.isArray(result.listings) && result.listings.length) {
        merge(result.listings);
        toast(`נמצאו ${result.listings.length} מודעות`);
        return;
      }
      if (result.providerError && search.sourceUrl) {
        toast('יד2 חוסם כרגע ייבוא אוטומטי. פותח את התוצאות החיות ביד2');
        setTimeout(() => openUrl(search.sourceUrl), 350);
        return;
      }
      if (search.sourceUrl) {
        toast('לא התקבלו מודעות לייבוא. פותח את החיפוש החי ביד2');
        setTimeout(() => openUrl(search.sourceUrl), 350);
        return;
      }
      toast('עדיין אין חיבור אוטומטי לדגם הזה ביד2');
    } catch (_) {
      if (search.sourceUrl) {
        toast('הייבוא נכשל. פותח את החיפוש החי ביד2');
        setTimeout(() => openUrl(search.sourceUrl), 350);
      } else {
        toast('השרת זמין, אבל אין עדיין מיפוי יד2 לדגם הזה');
      }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireSearchForm);
  else wireSearchForm();
})();
