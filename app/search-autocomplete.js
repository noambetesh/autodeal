(() => {
  const catalog = window.AUTO_DEAL_CAR_CATALOG || [];
  const form = document.getElementById('searchForm');
  if (!form || !catalog.length) return;

  const originalMake = form.querySelector('input[name="make"]');
  const originalModel = form.querySelector('input[name="model"]');
  if (!originalMake || !originalModel) return;

  const buildAutocomplete = (input, hiddenId, fieldName, boxId) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.autocomplete = 'off';
    input.removeAttribute('name');
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = fieldName;
    hidden.id = hiddenId;
    const box = document.createElement('div');
    box.id = boxId;
    box.className = 'autocomplete-menu hidden';
    wrapper.appendChild(hidden);
    wrapper.appendChild(box);
    return {input, hidden, box};
  };

  const make = buildAutocomplete(originalMake, 'makeValue', 'make', 'makeSuggestions');
  const model = buildAutocomplete(originalModel, 'modelValue', 'model', 'modelSuggestions');
  make.input.id = 'makeAutocomplete';
  model.input.id = 'modelAutocomplete';
  make.input.placeholder = 'הקלד יצרן, למשל טויוטה';
  model.input.placeholder = 'בחר יצרן או הקלד דגם';

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
    const found = catalog.filter(m => matches(make.input.value, m.he, m.name));
    show(make.box, found.map(m => `<button type="button" class="autocomplete-item" data-make="${m.name}"><strong>${m.he}</strong><span>${m.name} · ${m.models.length} דגמים</span></button>`));
  };

  const renderModels = () => {
    let found = [];
    if (selectedMake) {
      found = selectedMake.models.filter(([name, he]) => matches(model.input.value, he, name));
    } else {
      for (const maker of catalog) {
        for (const [name, he] of maker.models) {
          if (matches(model.input.value, he, name)) found.push([name, he, maker]);
        }
      }
    }
    show(model.box, found.slice(0, 40).map(item => {
      const [name, he, maker] = item;
      const hint = maker ? maker.he : selectedMake?.he || '';
      return `<button type="button" class="autocomplete-item" data-model="${name}" data-maker="${maker?.name || selectedMake?.name || ''}"><strong>${he}</strong><span>${name}${hint ? ` · ${hint}` : ''}</span></button>`;
    }));
  };

  const chooseMake = canonical => {
    const item = catalog.find(m => m.name === canonical);
    if (!item) return;
    selectedMake = item;
    make.input.value = item.he;
    make.hidden.value = item.name;
    model.input.value = '';
    model.hidden.value = '';
    model.input.placeholder = `בחר דגם של ${item.he}`;
    hide(make.box);
    model.input.focus();
    renderModels();
  };

  const chooseModel = (canonical, makerCanonical = '') => {
    if (!selectedMake && makerCanonical) {
      selectedMake = catalog.find(m => m.name === makerCanonical) || null;
      if (selectedMake) {
        make.input.value = selectedMake.he;
        make.hidden.value = selectedMake.name;
      }
    }
    const pool = selectedMake?.models || [];
    const item = pool.find(([name]) => name === canonical);
    if (!item) {
      model.input.value = canonical;
      model.hidden.value = canonical;
      hide(model.box);
      return;
    }
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
    model.input.placeholder = 'בחר יצרן או הקלד דגם';
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
    if (button) chooseModel(button.dataset.model, button.dataset.maker || '');
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
    model.input.placeholder = 'בחר יצרן או הקלד דגם';
    hide(make.box);
    hide(model.box);
  }, 0));
})();
