import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';
import { methodHref } from '../src/links.mjs';
import { csv, renderCards } from '../src/render.mjs';
import { prepare, readState, search, stateParams } from '../src/search.mjs';
import { inspectRecord, readJSON, root, validateData } from '../scripts/validate.mjs';

const { records, regions, sectors } = validateData({ quiet: true });
const catalogues = { regions, sectors };
const published = records.filter(r => r.publication_status === 'listed');
const index = prepare(published);
const regionIds = new Set(regions.map(r => r.id));
const sectorIds = new Set(sectors.map(s => s.id));
const state = query => readState(new URLSearchParams(query), catalogues);
const matches = query => search(index, state(query));
const ids = query => matches(query).map(({ record }) => record.id);

test('name, punctuation, diacritics, acronyms and mixed aliases are normalised', () => {
  for (const name of ['raneau', 'Ran’Eau', 'ran eau', 'Ran-Eau', 'RÂN eau']) assert.deepEqual(ids('q=' + name), ['raneau']);
  assert.deepEqual(ids('q=AVSF&history=1'), ids('q=agronomes vétérinaires sans frontières&history=1'));
  assert.deepEqual(ids('q=ong jeunes développement&history=1'), ['jade']);
  assert.deepEqual(ids('q=vavatenina'), []);
});

test('filter cross-product only accepts region and sector from the same operation', () => {
  const original = published.find(r => r.id === 'soakoja');
  const op = original.operations[0];
  const fixture = { ...original, operations: [op, { ...op, id: 'elsewhere', region_ids: ['boeny'], sector_ids: ['health'] }] };
  const data = prepare([fixture]);
  assert.equal(search(data, state('region=boeny&sector=wash')).length, 0);
  assert.equal(search(data, state('region=analanjirofo&sector=health')).length, 0);
  assert.equal(search(data, state('region=analanjirofo&region=boeny&sector=health&sector=wash'))[0].operations.length, 2);
  assert.deepEqual(ids('q=soakoja&region=analanjirofo&sector=wash'), ['soakoja']);
  assert.deepEqual(ids('q=soakoja&region=analanjirofo&sector=agriculture'), []);
});

test('work locations, office locations and historical boundaries remain separate', () => {
  assert.deepEqual(ids('q=csb&region=analanjirofo'), ['csb']);
  assert.deepEqual(ids('q=tany&region=analamanga'), []);
  assert.deepEqual(ids('q=tany&region=analanjirofo'), ['tany-ifandovana']);
  assert.deepEqual(ids('q=sepali&region=analanjirofo'), []);
  assert.deepEqual(ids('q=sepali&region=ambatosoa'), ['sepali-madagascar']);
  assert.deepEqual(ids('q=ppi&region=atsinanana&sector=nutrition&history=1'), []);
});

test('national, historical, planned and coordination toggles change matching operations', () => {
  const record = published.find(r => r.id === 'soakoja');
  const op = { ...record.operations[0], region_scope: 'nationwide', region_ids: [] };
  const fixture = prepare([{ ...record, operations: [op] }]);
  assert.equal(search(fixture, state('region=boeny')).length, 0);
  assert.equal(search(fixture, state('region=boeny&national=1')).length, 1);
  assert.deepEqual(ids('q=avsf'), []);
  assert.deepEqual(ids('q=avsf&history=1'), ['avsf']);
  assert.equal(matches('q=pfsce')[0].operations.length, 1);
  assert.equal(matches('q=pfsce&history=1')[0].operations.length, 2);
  assert.deepEqual(ids('q=dreah'), []);
  assert.deepEqual(ids('q=dreah&coordination=1'), ['dreah-analanjirofo']);
  assert.equal(matches('q=tany')[0].operations[0].activity_status, 'unknown');
  assert.deepEqual(ids('q=gret&sector=health'), []);
  assert.deepEqual(ids('q=gret&sector=health&history=1'), ['gret']);
});

test('URL state supports repeat selections and ignores unknown values', () => {
  const selected = state('q=AVSF&region=analanjirofo&region=boeny&region=typo&sector=agriculture&history=1&x=2');
  assert.deepEqual(selected.regions, ['analanjirofo', 'boeny']);
  assert.deepEqual(state(stateParams(selected).toString()), selected);
});

test('validation catches dangling references, duplicates, ended work, invalid dates and unsafe URLs', () => {
  const example = readJSON('inputs/organisation-example.json');
  const inspect = record => inspectRecord(record, regionIds, sectorIds, '2026-11-11').errors.join('\n');
  assert.equal(inspect(example), '');
  example.operations[0].region_ids.push('typo');
  example.operations[0].web_reviewed_on = '2026-02-30';
  example.operations[0].ends_on = '2026-01-01';
  example.operations[0].source_ids.push('missing');
  example.sources[0].url = 'javascript:alert(1)';
  example.contacts[0].methods[0].href = 'javascript:alert(1)';
  example.offices.push({ ...example.offices[0], address: 'different address' });
  for (const message of ['unknown ID typo', 'unknown ID missing', 'invalid calendar date', 'must be marked historical',
    'safe HTTP(S)', 'unsafe phone', 'duplicate ID']) assert.match(inspect(example), new RegExp(message.replace(/[()]/g, '\\$&')));
  assert.equal(methodHref({ type: 'website', value: 'https://example.org', href: 'javascript:alert(1)' }), null);
});

test('filtered CSV includes matching operation only, escapes cells and retains international numbers', () => {
  const results = matches('q=soakoja&region=analanjirofo&sector=wash');
  const value = csv(results, catalogues);
  assert.equal(value.trim().split('\r\n').length, 2);
  assert.match(value, /\+261 34 85 214 08/);
  assert.match(value, /Local · General organisation contact/);
  const injected = structuredClone(results);
  injected[0].operations[0].summary = '  =1+1';
  assert.match(csv(injected, catalogues), /"'  =1\+1"/);
  injected[0].record.name = '<img src=x onerror=alert(1)>';
  assert.doesNotMatch(renderCards(injected, catalogues), /<img/);
});

test('build excludes drafts and withdrawals, keeps source review dates and reconciles every seed', () => {
  const report = readFileSync(resolve(root, 'docs/IMPORT_REPORT.md'), 'utf8');
  for (let row = 1; row <= 28; row++) {
    assert.ok(report.includes('| seed-' + String(row).padStart(3, '0') + ' |'));
  }
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = readJSON('dist/search-index.json');
  assert.equal(output.records.length, published.length);
  for (const record of records.filter(r => r.publication_status !== 'listed')) {
    assert.ok(!output.records.some(r => r.id === record.id));
    assert.ok(!existsSync(resolve(root, 'dist/ngo', record.id)));
    for (const name of ['sitemap.xml', 'madagascar-ngo-directory.csv']) {
      assert.ok(!readFileSync(resolve(root, 'dist', name), 'utf8').includes(record.id));
    }
  }
  assert.ok(!existsSync(resolve(root, 'dist/inputs')));
  assert.equal(output.records.find(r => r.id === 'soakoja').operations[0].web_reviewed_on, '2026-11-10');
});
