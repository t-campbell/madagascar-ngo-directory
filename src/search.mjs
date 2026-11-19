export const typeNames = {
  ngo_association: 'NGO / association', nonprofit_network: 'Nonprofit network',
  red_cross_society: 'Red Cross / Red Crescent society', government: 'Government',
  un_bilateral: 'UN / bilateral agency', other_nonprofit: 'Other nonprofit'
};
export const statusNames = {
  reported_active: 'Reported active', unknown: 'Activity needs confirmation',
  historical: 'Historical', planned: 'Planned'
};
export const scopeNames = {
  local: 'Local', regional: 'Regional', national: 'National', international: 'International',
  organisation: 'Organisation-wide', programme: 'Programme', referral: 'Referral',
  referral_international: 'International referral'
};
const coordinationTypes = new Set(['government', 'un_bilateral']);
const defaultTypes = new Set(['ngo_association', 'nonprofit_network', 'red_cross_society', 'other_nonprofit']);
const collator = new Intl.Collator('en', { sensitivity: 'base' });

export function normalise(value) {
  return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function prepare(records) {
  return records.map(record => {
    const names = [record.name, record.acronym, ...record.aliases].filter(Boolean).map(normalise);
    return { record, names, compact: names.map(name => name.replaceAll(' ', '')) };
  }).sort((a, b) => collator.compare(a.record.name, b.record.name) || collator.compare(a.record.id, b.record.id));
}

export function readState(params, catalogues) {
  const picked = (key, options) => [...new Set(params.getAll(key).filter(value => options.includes(value)))];
  const type = params.get('type');
  return {
    q: params.get('q') ?? '', regions: picked('region', catalogues.regions.map(r => r.id)),
    sectors: picked('sector', catalogues.sectors.map(s => s.id)),
    type: Object.hasOwn(typeNames, type) ? type : '',
    national: params.get('national') === '1', history: params.get('history') === '1',
    coordination: params.get('coordination') === '1'
  };
}

export function stateParams(state) {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q.trim());
  for (const id of state.regions) params.append('region', id);
  for (const id of state.sectors) params.append('sector', id);
  if (state.type) params.set('type', state.type);
  for (const flag of ['national', 'history', 'coordination']) params.set(flag, state[flag] ? '1' : '0');
  return params;
}

export function search(index, state) {
  const query = normalise(state.q);
  const tokens = query ? query.split(' ') : [];
  const joined = query.replaceAll(' ', '');
  const exact = [];
  const other = [];
  for (const { record, names, compact } of index) {
    const isCoordination = coordinationTypes.has(record.type);
    if (isCoordination && !state.coordination) continue;
    if (state.type ? record.type !== state.type : !defaultTypes.has(record.type) && !isCoordination) continue;
    const isExact = query && compact.includes(joined);
    if (!isExact && !tokens.every(token => names.some(name => name.includes(token)) || compact.some(name => name.includes(token)))) continue;
    const operations = record.operations.filter(op => {
      if (!state.history && (op.activity_status === 'historical' || op.activity_status === 'planned')) return false;
      const localMatch = !state.regions.length ||
        (op.region_scope === 'specified' && op.region_ids.some(id => state.regions.includes(id))) ||
        (op.region_scope === 'nationwide' && state.national);
      return localMatch && (!state.sectors.length || op.sector_ids.some(id => state.sectors.includes(id)));
    });
    if (operations.length) (isExact ? exact : other).push({ record, operations });
  }
  return exact.concat(other);
}

export function applicableContacts(record, operations) {
  const ids = new Set(operations.map(op => op.id));
  const priority = { local: 0, programme: 1, regional: 2, organisation: 3, national: 4, referral: 5, international: 6, referral_international: 7 };
  const websiteOnly = contact => Number(contact.methods.every(method => method.type === 'website'));
  return record.contacts.filter(contact => !contact.operation_ids.length || contact.operation_ids.some(id => ids.has(id)))
    .sort((a, b) => websiteOnly(a) - websiteOnly(b) || priority[a.scope] - priority[b.scope]);
}

export const labelMap = list => new Map(list.map(({ id, name }) => [id, name]));
export function regionNames(operation, regions) {
  if (operation.region_scope === 'nationwide') return ['Nationwide'];
  if (operation.region_scope === 'unknown') return ['Work location needs confirmation'];
  return operation.region_ids.map(id => regions.get(id));
}
