import { prepare, readState, search, stateParams } from './search.mjs';
import { csv, renderCards } from './render.mjs';

const form = document.querySelector('#filters');
const status = document.querySelector('#result-count');
const results = document.querySelector('#results');
const exportButton = document.querySelector('#export-filtered');

async function init() {
  const response = await fetch(form.dataset.index);
  if (!response.ok) throw new Error('Index unavailable');
  const { records, regions, sectors } = await response.json();
  const catalogues = { regions, sectors };
  const index = prepare(records);
  const controls = [...form.elements].filter(el => el.name);
  const query = form.elements.namedItem('q');
  let matches = [];
  let timer;
  const localPreset = new URLSearchParams(form.dataset.preset);
  const defaults = () => readState(localPreset, catalogues);

  function stateFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.size) return defaults();
    return readState(params, catalogues);
  }
  function apply(state) {
    const params = stateParams(state);
    for (const el of controls) {
      if (el.type === 'checkbox') el.checked = params.getAll(el.name).includes(el.value);
      else el.value = el.name === 'q' ? state.q : params.get(el.name) ?? '';
    }
  }
  function update(state) {
    matches = search(index, state);
    const regionPage = localPreset.get('region');
    const emptyRegion = regionPage && state.regions.length === 1 && state.regions[0] === regionPage &&
      !records.some(record => record.operations.some(op => op.region_ids.includes(regionPage)));
    results.innerHTML = renderCards(matches, catalogues, undefined, emptyRegion
      ? 'No organisations documented here yet.' : undefined);
    status.textContent = matches.length + (matches.length === 1 ? ' organisation' : ' organisations');
    exportButton.disabled = matches.length === 0;
    const selected = form.querySelectorAll('[data-filter-count]');
    for (const label of selected) {
      const count = form.querySelectorAll('input[name="' + label.dataset.filterCount + '"]:checked').length;
      label.textContent = count ? ' · ' + count + ' selected' : '';
    }
  }
  function commit() {
    clearTimeout(timer);
    const state = readState(new URLSearchParams(new FormData(form)), catalogues);
    const url = location.pathname + '?' + stateParams(state);
    if (url !== location.pathname + location.search) history.pushState(null, '', url);
    update(state);
  }
  form.addEventListener('submit', event => { event.preventDefault(); commit(); });
  form.addEventListener('change', event => { if (event.target !== query) commit(); });
  query.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(commit, 140); });
  form.querySelector('[data-clear]').addEventListener('click', () => {
    apply(readState(new URLSearchParams(), catalogues));
    commit();
    query.focus();
  });
  window.addEventListener('popstate', () => {
    clearTimeout(timer);
    const state = stateFromUrl();
    apply(state);
    update(state);
  });
  exportButton.addEventListener('click', () => {
    const href = URL.createObjectURL(new Blob([csv(matches, catalogues)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'madagascar-ngo-directory-filtered.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
  const initial = stateFromUrl();
  apply(initial);
  update(initial);
  form.hidden = false;
  exportButton.hidden = false;
}

if (form) init().catch(() => {
  document.querySelector('#search-error').hidden = false;
});
