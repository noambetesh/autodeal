(() => {
  const form = document.querySelector('#searchForm');
  if (!form) return;

  const makeSearchName = search => {
    const car = [search.make, search.model].filter(Boolean).join(' ').trim();
    const year = search.yearMin && search.yearMax
      ? `${search.yearMin}-${search.yearMax}`
      : search.yearMin
        ? `מ-${search.yearMin}`
        : search.yearMax
          ? `עד ${search.yearMax}`
          : '';
    const price = search.maxPrice ? `עד ${money(search.maxPrice)}` : '';
    return [car || 'חיפוש רכב', year, price].filter(Boolean).join(' · ');
  };

  form.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(form);
    const search = {
      id: `s-${Date.now()}`,
      name: '',
      make: data.get('make'),
      model: data.get('model'),
      yearMin: +data.get('yearMin') || null,
      yearMax: +data.get('yearMax') || null,
      maxPrice: +data.get('maxPrice') || null,
      maxMileage: +data.get('maxMileage') || null,
      sourceUrl: data.get('sourceUrl') || '',
      active: true
    };

    search.name = makeSearchName(search);
    state.searches.push(search);

    if (state.settings.serverUrl) {
      try {
        await api('/api/searches', 'POST', search);
      } catch (_) {
        // Keep the search locally when the server is temporarily unavailable.
      }
    }

    form.reset();
    document.querySelector('#searchModal')?.classList.add('hidden');
    toast('החיפוש נשמר');
    render();
  };
})();
