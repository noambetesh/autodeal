(() => {
  const catalog = window.AUTO_DEAL_CAR_CATALOG || [];
  const norm = value => String(value || '').trim().toLowerCase().replace(/[׳'״".\-\s]/g, '');
  const makeInput = document.getElementById('makeAutocomplete');
  const makeValue = document.getElementById('makeValue');
  const makeBox = document.getElementById('makeSuggestions');
  const modelInput = document.getElementById('modelAutocomplete');
  const modelValue = document.getElementById('modelValue');
  const modelBox = document.getElementById('modelSuggestions');
  const form = document.getElementById('searchForm');
  if (!makeInput || !modelInput || !makeValue || !modelValue) return;

  let selectedMake = null;

  const matches = (query, ...values) => {
    const q = norm(query);
    return !q || values.some(v => norm(v).includes(q));
  };

  const hide = box => {
    box.classList.add('hidden');
    box.innerHTML = '';
  };

  const show = (box, items) => {
    if (!items.length) return hide(box);
    box.innerHTML = items.join('');
    box.classList.remove('hidden');
  };

  const renderMakes = () => {
    const q = makeInput.value;
    const found = catalog.filter(m => matches(q, m.he, m.name)).slice(0, 12);
    show(makeBox, found.map(m => `
      <button type="button" class="autocomplete-item" data-make="${m.name}">
        <strong>${m.he}</strong><span>${m.name}</span>
      </button>`));
  };

  const renderModels = () => {
    if (!selectedMake) {
      show(modelBox, ['<div class="autocomplete-hint">קודם בחר יצרן</div>']);
      return;
    }
    const q = modelInput.value;
    const found = selectedMake.models.filter(([name, he]) => matches(q, he, name)).slice(0, 16);
    show(modelBox, found.map(([name, he]) => `
      <button type="button" class="autocomplete-item" data-model="${name}">
        <strong>${he}</strong><span>${name}</span>
      </button>`));
  };

  const chooseMake = canonical => {
    const make = catalog.find(m => m.name === canonical);
    if (!make) return;
    selectedMake = make;
    makeInput.value = make.he;
    makeValue.value = make.name;
    modelInput.value = '';
    modelValue.value = '';
    hide(makeBox);
    modelInput.disabled = false;
    modelInput.placeholder = `בחר דגם של ${make.he}`;
    modelInput.focus();
    renderModels();
  };

  const chooseModel = canonical => {
    if (!selectedMake) return;
    const model = selectedMake.models.find(([name]) => name === canonical);
    if (!model) return;
    modelInput.value = model[1];
    modelValue.value = model[0];
    hide(modelBox);
  };

  makeInput.addEventListener('focus', renderMakes);
  makeInput.addEventListener('input', () => {
    selectedMake = null;
    makeValue.value = makeInput.value.trim();
    modelInput.value = '';
    modelValue.value = '';
    modelInput.disabled = true;
    modelInput.placeholder = 'בחר קודם יצרן';
    renderMakes();
  });

  modelInput.addEventListener('focus', renderModels);
  modelInput.addEventListener('input', () => {
    modelValue.value = modelInput.value.trim();
    renderModels();
  });

  makeBox.addEventListener('click', event => {
    const button = event.target.closest('[data-make]');
    if (button) chooseMake(button.dataset.make);
  });

  modelBox.addEventListener('click', event => {
    const button = event.target.closest('[data-model]');
    if (button) chooseModel(button.dataset.model);
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.autocomplete')) {
      hide(makeBox);
      hide(modelBox);
    }
  });

  form?.addEventListener('reset', () => {
    selectedMake = null;
    makeValue.value = '';
    modelValue.value = '';
    modelInput.disabled = true;
    modelInput.placeholder = 'בחר קודם יצרן';
    hide(makeBox);
    hide(modelBox);
  });

  modelInput.disabled = true;
})();