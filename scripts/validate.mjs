import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { methodHref, safeWeb } from '../src/links.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const readJSON = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const schema = new Ajv({ allErrors: true }).compile(readJSON('schema/organisation.schema.json'));
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Indian/Antananarivo' });
export const daysOld = (value, date = today()) => (Date.parse(date) - Date.parse(value)) / 86_400_000;

function validDate(value) {
  if (!datePattern.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function overdue({ operations, contacts }, date = today()) {
  return [...operations, ...contacts].flatMap(item => [
    ...(daysOld(item.web_reviewed_on, date) > 365 ? [item.id + ' web review ' + item.web_reviewed_on] : []),
    ...(item.direct_confirmed_on && daysOld(item.direct_confirmed_on, date) > 180
      ? [item.id + ' direct confirmation ' + item.direct_confirmed_on] : [])
  ]);
}

export function inspectRecord(record, regionIds, sectorIds, date = today()) {
  if (!schema(record)) {
    return { errors: schema.errors.map(e => (e.instancePath || '/') + ' ' + e.message + (e.params.missingProperty ? ' (' + e.params.missingProperty + ')' : '')), warnings: [] };
  }
  const errors = [];
  const warnings = overdue(record, date);
  const check = (condition, path, message) => { if (!condition) errors.push(path + ' ' + message); };
  const refs = (values, valid, path) => values.forEach(id => check(valid.has(id), path, 'unknown ID ' + id));
  const ids = (values, path) => {
    const seen = new Set();
    for (const { id } of values) {
      check(!seen.has(id), path, 'duplicate ID ' + id);
      seen.add(id);
    }
    return seen;
  };
  const sources = ids(record.sources, '/sources');
  const operations = ids(record.operations, '/operations');
  const offices = ids(record.offices, '/offices');
  ids(record.contacts, '/contacts');

  function dates(value, path) {
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== null && key.endsWith('_on')) check(validDate(entry), path + '/' + key, 'invalid calendar date');
    }
  }

  if (record.publication_status === 'listed') {
    check(Boolean(record.mission.trim()), '/mission', 'listed records need a mission');
    check(operations.size > 0, '/operations', 'listed records need an operation');
    check(sources.size > 0, '/sources', 'listed records need evidence');
    check(record.contacts.length > 0 || record.offices.some(office => office.address?.trim()), '/contacts', 'listed records need a contact route or usable address');
  }
  for (const source of record.sources) {
    const path = '/sources/' + source.id;
    check(safeWeb(source.url), path + '/url', 'expected a safe HTTP(S) URL');
    dates(source, path);
  }
  for (const op of record.operations) {
    const path = '/operations/' + op.id;
    refs(op.region_ids, regionIds, path + '/region_ids');
    refs(op.sector_ids, sectorIds, path + '/sector_ids');
    refs(op.source_ids, sources, path + '/source_ids');
    check(op.region_scope === 'specified' ? op.region_ids.length > 0 : op.region_ids.length === 0,
      path + '/region_ids', 'only specified work may carry region IDs and it needs at least one');
    if (op.region_scope === 'nationwide') {
      check(op.source_ids.some(id => record.sources.find(s => s.id === id)?.supports.includes('nationwide operation')),
        path + '/source_ids', 'nationwide work needs explicit evidence with a nationwide operation claim');
    }
    dates(op, path);
    if (op.starts_on && op.ends_on) check(op.starts_on <= op.ends_on, path + '/ends_on', 'precedes start date');
    if (op.ends_on && op.ends_on < date && op.activity_status !== 'historical') {
      const message = path + ' ended ' + op.ends_on + ' and must be marked historical';
      warnings.push(message);
      if (record.publication_status === 'listed') errors.push(message);
    }
    if (op.activity_status === 'historical') warnings.push(op.id + ' is historical');
  }
  for (const office of record.offices) {
    const path = '/offices/' + office.id;
    if (office.region_id) refs([office.region_id], regionIds, path + '/region_id');
    check(office.country === 'MG' || office.region_id === null, path + '/region_id', 'overseas office cannot carry a Madagascar region');
    refs(office.source_ids, sources, path + '/source_ids');
    if (!office.address || /not (located|published|given|established)/i.test(office.address)) warnings.push(office.id + ' has an incomplete address');
  }
  for (const contact of record.contacts) {
    const path = '/contacts/' + contact.id;
    if (contact.office_id) refs([contact.office_id], offices, path + '/office_id');
    refs(contact.operation_ids, operations, path + '/operation_ids');
    refs(contact.source_ids, sources, path + '/source_ids');
    dates(contact, path);
    contact.methods.forEach((method, i) => {
      refs(method.source_ids, sources, path + '/methods/' + i + '/source_ids');
      check(Boolean(methodHref(method)), path + '/methods/' + i, 'invalid or unsafe ' + method.type + ' link');
    });
  }
  for (const item of record.relationships ?? []) refs(item.source_ids, sources, '/relationships/' + item.name + '/source_ids');
  if ([...record.notes, ...record.contacts.flatMap(c => c.notes)].some(note => /different|conflict|discrepan/i.test(note))) warnings.push('conflicting details recorded in notes');
  return { errors, warnings };
}

function catalogue(path, key, errors) {
  const doc = readJSON(path);
  const list = doc[key];
  if (!Array.isArray(list) || !list.length) throw new Error(path + ' needs a nonempty ' + key + ' array');
  const seen = new Set();
  for (const entry of list) {
    if (!entry || typeof entry.id !== 'string' || !slug.test(entry.id) || typeof entry.name !== 'string' || !entry.name.trim()) {
      errors.push(path + ' contains an invalid entry');
    } else if (seen.has(entry.id)) {
      errors.push(path + ' duplicate ID ' + entry.id);
    } else {
      seen.add(entry.id);
    }
  }
  if (key === 'regions' && (!safeWeb(doc.catalogue_source_url) || !validDate(doc.reviewed_on))) errors.push(path + ' needs a safe catalogue source and valid review date');
  return list;
}

export function validateData({ quiet = false } = {}) {
  const errors = [];
  const regions = catalogue('data/regions.json', 'regions', errors);
  const sectors = catalogue('data/sectors.json', 'sectors', errors);
  const regionIds = new Set(regions.map(item => item.id));
  const sectorIds = new Set(sectors.map(item => item.id));
  const records = [];
  const seen = new Set();
  const date = today();
  const paths = readdirSync(resolve(root, 'data/organisations')).filter(name => name.endsWith('.json')).sort()
    .map(name => 'data/organisations/' + name);
  for (const path of [...paths, 'inputs/organisation-example.json']) {
    try {
      const record = readJSON(path);
      const result = inspectRecord(record, regionIds, sectorIds, date);
      errors.push(...result.errors.map(error => path + ' ' + error));
      if (result.errors.length) continue;
      if (paths.includes(path)) {
        if (!path.endsWith('/' + record.id + '.json')) errors.push(path + ' filename must match ID ' + record.id);
        if (seen.has(record.id)) errors.push(path + ' duplicate organisation ID ' + record.id);
        seen.add(record.id);
        records.push(record);
        if (!quiet) result.warnings.forEach(warning => console.warn(path + ' ' + warning));
      }
    } catch (error) {
      errors.push(path + ' ' + error.message);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  if (!quiet) console.log('Validated ' + records.length + ' canonical records and the Soakoja example');
  return { records, regions, sectors, date };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { validateData(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
