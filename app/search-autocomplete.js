(() => {
  const catalog = window.AUTO_DEAL_CAR_CATALOG || [];
  const form = document.getElementById('searchForm');
  if (!form || !catalog.length) return;

  const originalMake = form.querySelector('input[name="make"]');
  const originalModel = form.querySelector('input[name="model"]');
  if (!originalMake || !originalModel) return;

  const buildAutocomplete = (input, hiddenId, boxId) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.autocomplete = 'off';
    input.removeAttribute('name');
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = hiddenId === 'makeValue' ? 'make' : 'model';
    hidden.id = hiddenId;
    const box = document.createElement('div');
    box.id = boxId;
    box.className = 'autocomplete-menu hidden';
    wrapper.appendChild(hidden);
    wrapper.appendChild(box);
    return {input, hidden, box};
  };

  const make = buildAutocomplete(originalMake, 'makeValue', 'makeSuggestions');
  const model = buildAutocomplete(originalModel, 'modelValue', 'modelSuggestions');
  make.input.id = 'makeAutocomplete';
  model.input.id = 'modelAutocomplete';
  make.input.placeholder = 'הקלד יצרן, למשל טויוטה';
  model.input.placeholder = 'בחר קודם יצרן';
  model.input.disabled = true;

  const norm = value => String(value || '').trim().toLowerCase().replace(/[׳'״".\-\s]/g, '');
  const matches = (query, ...values) => {
    const q = norm(query);
    return !q || values.some(v => norm(v).includes(q));
  };
  const hide = box => { box.classList.add('hidden'); box.innerHTML = ''; };
  const show = (box, items) => {
    if (!items.length) return hide(box);
    box.innerHTML = items.join('');
    box.classList.remove('hidden');
  };

  let selectedMake = null;

  const renderMakes = () => {
    const found = catalog.filter(m => matches(make.input.value, m.he, m.name)).slice(0, 12);
    show(make.box, found.map(m => `<button type="button" class="autocomplete-item" data-make="${m.name}"><strong>${m.he}</strong><span>${m.name}</span></button>`));
  };

  const renderModels = () => {
    if (!selectedMake) return show(model.box, ['<div class="autocomplete-hint">קודם בחר יצרן</div>']);
    const found = selectedMake.models.filter(([name, he]) => matches(model.input.value, he, name)).slice(0, 16);
    show(model.box, found.map(([name, he]) => `<button type="button" class="autocomplete-item" data-model="${name}"><strong>${he}</strong><span>${name}</span></button>`));
  };

  const chooseMake = canonical => {
    const item = catalog.find(m => m.name === canonical);
    if (!item) return;
    selectedMake = item;
    make.input.value = item.he;
    make.hidden.value = item.name;
    model.input.value = '';
    model.hidden.value = '';
    model.input.disabled = false;
    model.input.placeholder = `בחר דגם של ${item.he}`;
    hide(make.box);
    model.input.focus();
    renderModels();
  };

  const chooseModel = canonical => {
    if (!selectedMake) return;
    const item = selectedMake.models.find(([name]) => name === canonical);
    if (!item) return;
    model.input.value = item[1];
    model.hidden.value = item[0];
    hide(model.box);
  };

  make.input.addEventListener('focus', renderMakes);
  make.input.addEventListener('input', () => {
    selectedMake = null;
    make.hidden.value = make.input.value.trim();
    model.input.value = '';
    model.hidden.value = '';
    model.input.disabled = true;
    model.input.placeholder = 'בחר קודם יצרן';
    renderMakes();
  });

  model.input.addEventListener('focus', renderModels);
  model.input.addEventListener('input', () => {
    model.hidden.value = model.input.value.trim();
    renderModels();
  });

  make.box.addEventListener('click', event => {
    const button = event.target.closest('[data-make]');
    if (button) chooseMake(button.dataset.make);
  });
  model.box.addEventListener('click', event => {
    const button = event.target.closest('[data-model]');
    if (button) chooseModel(button.dataset.model);
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.autocomplete')) {
      hide(make.box);
      hide(model.box);
    }
  });

  form.addEventListener('reset', () => setTimeout(() => {
    selectedMake = null;
    make.hidden.value = '';
    model.hidden.value = '';
    model.input.disabled = true;
    model.input.placeholder = 'בחר קודם יצרן';
    hide(make.box);
    hide(model.box);
  }, 0));
})();