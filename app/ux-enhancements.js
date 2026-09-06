(() => {
  const digits = value => String(value || '').replace(/\D/g, '');
  const formatDigits = value => {
    const raw = digits(value);
    return raw ? Number(raw).toLocaleString('en-US') : '';
  };

  function bindFormatted(displayId, hiddenId) {
    const display = document.getElementById(displayId);
    const hidden = document.getElementById(hiddenId);
    if (!display || !hidden) return;
    const sync = () => {
      const raw = digits(display.value);
      display.value = formatDigits(raw);
      hidden.value = raw;
      hidden.dispatchEvent(new Event('input', {bubbles: true}));
    };
    display.addEventListener('input', sync);
    display.addEventListener('focus', () => display.select());
    const form = display.closest('form');
    if (form) form.addEventListener('reset', () => setTimeout(() => {
      display.value = '';
      hidden.value = '';
    }, 0));
  }

  bindFormatted('filterPriceDisplay', 'filterPrice');
  bindFormatted('maxPriceDisplay', 'maxPriceRaw');
  bindFormatted('maxMileageDisplay', 'maxMileageRaw');

  const priceText = value => value ? money(value) : 'לא זמין';
  const yad2Text = listing => {
    if (listing.yad2PriceMin && listing.yad2PriceMax && listing.yad2PriceMin !== listing.yad2PriceMax) {
      return `${money(listing.yad2PriceMin)} - ${money(listing.yad2PriceMax)}`;
    }
    return priceText(listing.yad2Price);
  };
  const comparisonRef = listing => +listing.leviPrice || +listing.yad2Price || +listing.referencePrice || +listing.marketMedian || 0;
  const comparisonDiff = listing => {
    const ref = comparisonRef(listing);
    if (!ref || !listing.price) return null;
    return (ref - listing.price) / ref * 100;
  };

  card = function(listing) {
    const diff = comparisonDiff(listing);
    const hasRealPrice = !!(listing.leviPrice || listing.yad2Price);
    const sourceBadge = listing.leviPrice ? 'לוי יצחק' : listing.yad2Price ? 'מחירון יד2' : listing.marketMedian ? 'חציון שוק' : 'ללא מחירון';
    const analysis = diff === null
      ? 'עדיין אין מחירון להשוואה. פתח את המודעה כדי לבדוק את פרטי הרכב.'
      : `<span class="${diff >= 0 ? 'positive' : 'negative'}">${Math.abs(diff).toFixed(1)}% ${diff >= 0 ? 'מתחת' : 'מעל'} ל-${sourceBadge}</span>`;
    return `<article class="card modern-card">
      <div class="car-image">${carVisual(listing)}<span class="badge">${esc(listing.status || 'מודעה')}</span><span class="score">${listing.score || '-'}</span></div>
      <div class="card-body">
        <div class="car-title"><div><h3><bdi>${esc(listing.make)} ${esc(listing.model)}</bdi></h3><div class="muted small">${esc(listing.trim || '')}</div></div><div class="price">${money(listing.price)}</div></div>
        <div class="meta"><span>${listing.year || '-'}</span><span>${listing.mileage ? num(listing.mileage) + ' ק״מ' : 'ק״מ לא צוין'}</span><span>יד ${listing.hand || '-'}</span>${listing.location ? `<span>${esc(listing.location)}</span>` : ''}</div>
        <div class="price-compare">
          <div><small>מחיר מודעה</small><strong>${money(listing.price)}</strong></div>
          <div class="${listing.yad2Price ? 'has-price' : ''}"><small>מחירון יד2</small><strong>${yad2Text(listing)}</strong></div>
          <div class="${listing.leviPrice ? 'has-price' : ''}"><small>לוי יצחק</small><strong>${priceText(listing.leviPrice)}</strong></div>
        </div>
        <div class="analysis ${hasRealPrice ? 'analysis-live' : ''}">${analysis}</div>
        <div class="card-actions"><button class="btn primary" onclick="details('${esc(listing.id)}')">כל הפרטים</button><button class="btn" onclick="toggleSave('${esc(listing.id)}')">${state.saved.includes(listing.id) ? 'נשמר ✓' : 'שמור'}</button><button class="btn ghost" onclick="ignoreCar('${esc(listing.id)}')">הסתר</button></div>
      </div>
    </article>`;
  };

  details = function(id) {
    const listing = state.listings.find(item => item.id === id);
    if (!listing) return;
    const diff = comparisonDiff(listing);
    $('#detailContent').innerHTML = `<button class="close" onclick="$('#detailModal').classList.add('hidden')">×</button>
      <div class="detail-head"><div><span class="eyebrow">פרטי מודעה</span><h2><bdi>${esc(listing.make)} ${esc(listing.model)}</bdi></h2><p>${esc(listing.trim || '')}</p></div><div class="detail-price">${money(listing.price)}</div></div>
      <div class="car-image detail-image">${carVisual(listing)}</div>
      <div class="detail-specs"><span>${listing.year || '-'}</span><span>${listing.mileage ? num(listing.mileage) + ' ק״מ' : 'ק״מ לא צוין'}</span><span>יד ${listing.hand || '-'}</span>${listing.location ? `<span>${esc(listing.location)}</span>` : ''}${listing.fuel ? `<span>${esc(listing.fuel)}</span>` : ''}</div>
      <div class="price-board">
        <div class="price-board-item asking"><small>מחיר מבוקש</small><strong>${money(listing.price)}</strong><span>המחיר במודעה</span></div>
        <div class="price-board-item yad2"><small>מחירון יד2</small><strong>${yad2Text(listing)}</strong><span>${listing.yad2Price ? 'נשלף ממחירון יד2' : 'לא נמצא זיהוי מחירון לדגם'}</span></div>
        <div class="price-board-item levi"><small>מחירון לוי יצחק</small><strong>${priceText(listing.leviPrice)}</strong><span>${listing.leviPrice ? esc(listing.leviSource || 'מקור מורשה') : 'דורש חיבור API מורשה'}</span></div>
        <div class="price-board-item market"><small>חציון מודעות</small><strong>${priceText(listing.marketMedian)}</strong><span>מבוסס על מודעות שנאספו</span></div>
      </div>
      <div class="analysis detail-analysis">${diff === null ? 'אין עדיין מספיק נתוני מחירון להשוואה.' : `המודעה ${diff >= 0 ? 'זולה' : 'יקרה'} ב-${Math.abs(diff).toFixed(1)}% ביחס למקור המחירון הזמין הטוב ביותר.`}</div>
      <div class="actions detail-actions"><button class="btn primary" onclick="openUrl('${esc(listing.sourceUrl || '')}')">פתח את המודעה ביד2</button>${listing.yad2PriceUrl ? `<button class="btn" onclick="openUrl('${esc(listing.yad2PriceUrl)}')">פתח מחירון יד2</button>` : ''}<button class="btn" onclick="toggleSave('${esc(listing.id)}')">שמור</button></div>`;
    $('#detailModal').classList.remove('hidden');
  };

  const originalRunSearch = window.runSearch;
  window.runSearch = async id => {
    const search = state.searches.find(item => item.id === id);
    if (!search) return;
    try {
      const data = await api('/api/search/run', 'POST', search);
      merge(data.listings || []);
      if (data.providerError) {
        toast(data.providerError === 'yad2_blocked' ? 'יד2 חסם כרגע את הקריאה האוטומטית' : 'החיפוש בוצע, אך מקור יד2 לא החזיר נתונים');
      } else {
        toast(`נמצאו ${data.listings?.length || 0} מודעות מתאימות`);
      }
    } catch {
      if (typeof originalRunSearch === 'function') return originalRunSearch(id);
    }
  };

  try { render(); } catch (_) {}
})();
