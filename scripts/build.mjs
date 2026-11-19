import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { methodHref, safeWeb } from '../src/links.mjs';
import { csv, freshness, html, methodLink, nameOf, operationTags, profileUrl, renderCards } from '../src/render.mjs';
import { labelMap, prepare, readState, scopeNames, search, typeNames } from '../src/search.mjs';
import { readJSON, root, validateData } from './validate.mjs';

const { records, regions, sectors, date } = validateData();
const config = readJSON('site.config.json');
const siteUrl = config.site_url ?? 'http://localhost:4173';
if (!safeWeb(siteUrl) || new URL(siteUrl).origin !== siteUrl || config.site_url && !siteUrl.startsWith('https://')) throw new Error('site_url must be an HTTPS origin without a trailing slash, or null');
if (config.maintainer_email && !methodHref({ type: 'email', value: config.maintainer_email })) throw new Error('Invalid maintainer email');
if (config.public_issue_url && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues(?:\/new(?:\/choose)?)?$/.test(config.public_issue_url)) throw new Error('public_issue_url must be a public GitHub issues URL');
const catalogues = { regions, sectors };
const regionLabels = labelMap(regions);
const sectorLabels = labelMap(sectors);
const published = prepare(records.filter(record => record.publication_status === 'listed'));
const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });
const pages = [];
const title = 'Madagascar NGO directory';
const description = 'Find organisations working in Madagascar by region, sector and name.';
const write = (path, body) => {
  const file = resolve(dist, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
};
const stamp = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
const asset = (name, content) => {
  const ext = name.slice(name.lastIndexOf('.'));
  const path = '/assets/' + name.slice(0, -ext.length) + '.' + stamp(content) + ext;
  write(path.slice(1), content);
  return path;
};
const links = {};
const sizes = {};
for (const file of ['links.mjs', 'search.mjs', 'render.mjs', 'app.mjs', 'contribute.mjs', 'site.css']) {
  const content = readFileSync(resolve(root, 'src', file), 'utf8').replace(/(['"])\.\/([a-z]+\.mjs)\1/g, (match, quote, dependency) => {
    if (!links[dependency]) throw new Error('Asset dependency must be written first: ' + dependency);
    return quote + links[dependency] + quote;
  });
  links[file] = asset(file, content);
  sizes[file] = gzipSync(content).length;
}
const searchData = {
  regions: regions.map(({ id, name }) => ({ id, name })),
  sectors: sectors.map(({ id, name }) => ({ id, name })),
  records: published.map(({ record }) => ({
    id: record.id, name: record.name, acronym: record.acronym, aliases: record.aliases,
    type: record.type,
    operations: record.operations.map(({ notes, ...operation }) => operation),
    contacts: record.contacts.map(({ notes, person_name, office_id, ...contact }) => contact),
    offices: record.offices.filter(office => office.address).map(({ address }) => ({ address })),
    sources: record.sources.map(({ id, url }) => ({ id, url }))
  }))
};
const searchJSON = JSON.stringify(searchData);
write('search-index.json', searchJSON);

function layout(path, heading, intro, body, script, metaDescription = intro || description) {
  const documentTitle = path === '/' ? title : heading + ' | ' + title;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(documentTitle)}</title><meta name="description" content="${html(metaDescription)}">
${config.site_url && path !== '/404.html' ? `<link rel="canonical" href="${html(siteUrl + path)}">` : '<meta name="robots" content="noindex">'}
<link rel="stylesheet" href="${links['site.css']}">${script ? `<script type="module" src="${script}"></script>` : ''}
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header><div class="shell topbar"><a class="brand" href="/">Madagascar NGO directory</a>
<nav aria-label="Main">${[['/','Search'], ['/regions/','Regions'], ['/all/','All organisations'], ['/contribute/','Contribute']].map(([url,label]) =>
  `<a href="${url}"${path === url ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></div></header>
<main id="main" class="shell"><div class="intro"><h1>${html(heading)}</h1>${intro ? `<p>${html(intro)}</p>` : ''}</div>
${body}</main>
<footer><div class="shell"><a href="/about/">About this independent directory</a> · <a href="/contribute/">Suggest a correction</a></div></footer>
</body></html>`;
}

function page(path, heading, intro, body, script, metaDescription) {
  if (path !== '/404.html') pages.push(path);
  const content = layout(path, heading, intro, body, script, metaDescription);
  write(path === '/404.html' ? '404.html' : path.slice(1) + 'index.html', content);
  return content;
}

const orgList = matches => matches.length
  ? `<ul class="listing">${matches.map(({ record }) => `<li><a href="${profileUrl(record)}">${html(nameOf(record))}</a> <span class="muted">· ${html(typeNames[record.type])}</span></li>`).join('')}</ul>`
  : '<div class="empty"><p>No organisations documented here yet.</p><a href="/contribute/">Suggest an organisation</a></div>';

const checks = (key, options, label, state) => `<details><summary>${label}<span data-filter-count="${key}"></span></summary>
<fieldset aria-label="${label}">${options.map(option => `<label class="check"><input type="checkbox" name="${key}" value="${html(option.id)}"${state.includes(option.id) ? ' checked' : ''}> <span>${html(option.name)}</span></label>`).join('')}</fieldset></details>`;

function directory(path, heading, intro, preset = '') {
  const state = readState(new URLSearchParams(preset), catalogues);
  const matches = search(published, state);
  const emptyRegion = preset.startsWith('region=') && !matches.length;
  return page(path, heading, intro, `<div class="directory">
  <aside aria-label="Search controls">
    <form id="filters" class="filters" data-index="/search-index.json" data-preset="${html(preset)}" hidden>
      <label for="q">Organisation name</label><input id="q" name="q" type="search" placeholder="e.g. Soakoja or AVSF" autocomplete="off">
      ${checks('region', regions, 'Regions', state.regions)}
      ${checks('sector', sectors, 'Sectors', state.sectors)}
      <label for="type">Organisation type</label>
      <select id="type" name="type"><option value="">Default types</option>${Object.entries(typeNames).map(([key,label]) => `<option value="${key}">${html(label)}</option>`).join('')}</select>
      <fieldset aria-label="Include additional records">
        <label class="check"><input type="checkbox" name="national" value="1"> <span>Include documented nationwide work</span></label>
        <label class="check"><input type="checkbox" name="history" value="1"> <span>Include historical and planned work</span></label>
        <label class="check"><input type="checkbox" name="coordination" value="1"> <span>Include coordination contacts</span></label>
      </fieldset>
      <div class="filter-actions"><button type="submit">Search</button><button class="secondary" type="button" data-clear>Clear filters</button></div>
    </form>
    <noscript><p>Combined filters require JavaScript. <a href="/regions/">Browse regions</a> or <a href="/all/">browse all organisations</a>.</p></noscript>
    <p id="search-error" hidden>Search could not load. <a href="/regions/">Browse regions</a> or <a href="/all/">browse all organisations</a>.</p>
  </aside>
  <section aria-label="Directory results">
    <div class="result-actions"><p id="result-count" role="status">${matches.length} ${matches.length === 1 ? 'organisation' : 'organisations'}</p>
      <button id="export-filtered" class="secondary" type="button" hidden>Download filtered CSV</button>
      <a href="/madagascar-ngo-directory.csv" download>Download full CSV</a>
    </div>
    <div id="results">${emptyRegion ? orgList([]) : renderCards(matches, catalogues, date)}</div>
  </section></div>`, links['app.mjs']);
}

const home = directory('/', title, 'Find organisations by region, sector and name. Coverage varies by region.');
const regionCounts = new Map(regions.map(({ id }) => [id, published.filter(({ record }) =>
  !['government','un_bilateral'].includes(record.type) && record.operations.some(op => op.region_ids.includes(id))).length]));
const regionsCovered = [...regionCounts.values()].filter(Boolean).length;
page('/regions/', 'Browse by region', 'Counts reflect the listings we have documented, including historical work. Research depth varies by region.',
  `<ul class="listing region-grid">${regions.map(({ id, name }) => `<li><a href="/regions/${id}/">${html(name)}</a> · ${regionCounts.get(id)} listed</li>`).join('')}</ul>
  <h2>Browse by sector</h2><ul class="listing region-grid">${sectors.map(({ id, name }) => `<li><a href="/sectors/${id}/">${html(name)}</a></li>`).join('')}</ul>`);
for (const { id, name } of regions) directory('/regions/' + id + '/', name,
  regionCounts.get(id) ? 'Organisations with documented work in this region.' : 'No organisations documented here yet.', 'region=' + id);
for (const { id, name } of sectors) directory('/sectors/' + id + '/', name[0].toUpperCase() + name.slice(1),
  'Organisations with documented work in this sector.', 'sector=' + id);
page('/all/', 'All organisations', 'Alphabetical list including historical records and government and UN coordination contacts.', orgList(published));

const notes = values => values?.length ? '<ul>' + values.map(value => '<li>' + html(value) + '</li>').join('') + '</ul>' : '';
const evidence = sourceIds => sourceIds.length ? `<p>Evidence · ${sourceIds.map(id => `<a href="#source-${html(id)}">${html(id)}</a>`).join(' · ')}</p>` : '';
const section = (heading, items) => items ? `<section class="profile-section"><h2>${heading}</h2>${items}</section>` : '';
for (const { record } of published) {
  const operationList = record.operations.map(op => `<article>
    ${operationTags(op, regionLabels, sectorLabels)}<h3>${html(op.localities.join(' · ') || 'Programme area')}</h3><p>${html(op.summary)}</p>
    ${op.starts_on ? '<p>Started ' + html(op.starts_on) + '</p>' : ''}${op.ends_on ? '<p>Ended ' + html(op.ends_on) + '</p>' : ''}
    <p class="fresh">${freshness(op, date, 'Activity confirmation')}</p>${evidence(op.source_ids)}${notes(op.notes)}</article>`).join('');
  const officeList = record.offices.map(office => `<article><h3>${html(office.label)}</h3>
    <p>${html([office.town, regionLabels.get(office.region_id), new Intl.DisplayNames('en', { type: 'region' }).of(office.country)].filter(Boolean).join(' · '))}</p>
    ${office.address ? `<p>${html(office.address)}</p>` : ''}${evidence(office.source_ids)}</article>`).join('');
  const contactList = record.contacts.map(contact => `<article><h3>${html(contact.role)}</h3>
    <p>${html(scopeNames[contact.scope])}${contact.person_name ? ' · ' + html(contact.person_name) : ''}
    ${contact.office_id ? ' · ' + html(record.offices.find(office => office.id === contact.office_id).town) : ''}</p>
    <div class="actions">${contact.methods.map(method => methodLink(method, true)).join('')}</div>
    <p class="fresh">${freshness(contact, date, 'Contact confirmation')}</p>${evidence(contact.source_ids)}${notes(contact.notes)}</article>`).join('');
  const sourceList = record.sources.map(s => `<article id="source-${html(s.id)}"><h3><a href="${html(s.url)}">${html(s.title)}</a></h3>
    <p>${html(s.publisher)} · web reviewed ${html(s.checked_on)}${s.published_on ? ' · published ' + html(s.published_on) : ''}</p>
    <p>Supports ${html(s.supports.join(', '))}</p>${notes(s.notes)}</article>`).join('');
  const relationships = (record.relationships ?? []).map(item => `<article><h3>${html(item.name)}</h3><p>${html(item.kind)} · ${html(item.description)}</p>${evidence(item.source_ids)}</article>`).join('');
  page(profileUrl(record), nameOf(record), record.mission,
    `<div class="readable"><p class="type">${html(typeNames[record.type])}${record.aliases.length ? ' · Also listed as ' + html(record.aliases.join(', ')) : ''} · ID ${html(record.id)}</p>
    ${section('Work in Madagascar', operationList)}${section('Public contacts', contactList)}${section('Offices and addresses', officeList)}
    ${section('Relationships', relationships)}${section('What to confirm', notes(record.notes))}
    <details class="profile-section" id="sources"><summary>Sources and evidence (${record.sources.length})</summary>${sourceList}</details>
    <p>Freshness shown as of ${date}. <a href="/contribute/">Suggest a correction</a></p></div>`,
    links['contribute.mjs']);
}
const templates = [
  ['suggest','Suggest an organisation','Organisation name and acronym:\nRegion and locality:\nSector:\nWhat they do locally:\nPublic professional contact:\nSource URL or professional confirmation:\n'],
  ['confirm','Confirm a listing','Organisation name or profile link:\nProgramme, region and commune:\nCurrent activity and service area:\nPublic contact route confirmed, if checked:\nDate and how you confirmed it:\n'],
  ['correct','Correct a contact','Organisation name or profile ID:\nRegion and sector:\nCurrent listing:\nProposed change:\nPublic source URL or professional confirmation:\n'],
  ['inactive','Report an inactive programme','Organisation name or profile ID:\nProgramme, region and sector:\nLast known activity or end date:\nSource URL or professional confirmation:\n']
];
page('/contribute/', 'Contribute', 'A maintainer reviews suggestions before they appear. Use public professional details. Your contact information is optional.',
  `<div class="readable">${!config.maintainer_email && !config.public_issue_url ? '<p>The submission address is pending. You can prepare a suggestion using the templates below.</p>' : ''}
  ${config.public_issue_url ? `<p><a href="${html(config.public_issue_url)}">Open a GitHub issue</a>. GitHub submissions are public and require an account.</p>` : ''}
  ${templates.map(([id,label,template]) => `<section class="profile-section"><h2>${label}</h2>
  <label for="${id}">Template</label><textarea id="${id}" rows="6" readonly>${html(template)}</textarea>
  <div class="actions"><button type="button" data-copy="${id}" hidden>Copy template</button>
  ${config.maintainer_email ? `<a href="${html(methodHref({ type: 'email', value: config.maintainer_email }) + '?subject=' + encodeURIComponent(label) + '&body=' + encodeURIComponent(template))}">Open email draft</a>` : ''}
  <span role="status"></span></div></section>`).join('')}</div>`, links['contribute.mjs']);
page('/about/', 'About the directory', 'A community-maintained resource for volunteers looking for organisations to work with in Madagascar.',
  `<div class="readable">${section('Coverage', `<p>The directory began with the Analanjirofo registry and now documents organisations in ${regionsCovered} of ${regions.length} regions. <a href="/regions/">Browse regional coverage</a>. Volunteers can confirm local programmes and contact routes through the <a href="/contribute/#confirm">contribution page</a>.</p>
  <p>Coverage is still growing. Some regions have had a deeper research pass than others, and organisations with little public information may be missing. A regional listing requires a documented programme or service in that region. Office locations and contact scope appear on each profile. Ambatosoa includes Maroantsetra and Mananara-Nord under <a href="${html(readJSON('data/regions.json').catalogue_source_url)}">Law 2023-012</a>.</p>`)}
  ${section('Activity and review dates', '<dl><dt>Reported active</dt><dd>A source reports ongoing or recent work.</dd><dt>Activity needs confirmation</dt><dd>The evidence is undated or the current status is unclear.</dd><dt>Historical or planned</dt><dd>The work has ended or was described as planned.</dd></dl><p>A web review records when an editor checked a source. A direct confirmation requires contact with the organisation or other professional verification. Web reviews older than 365 days and direct confirmations older than 180 days are flagged.</p>')}
  ${section('Maintenance', '<p>Maintainers review public sources and contact corrections before publishing updates. <a href="/contribute/">Suggest an update</a>. The directory is independent of the Peace Corps.</p>')}</div>`);
page('/404.html', 'Page not found', 'The link may be out of date.', '<p><a href="/">Search the directory</a> or <a href="/all/">browse all organisations</a>.</p>');

write('madagascar-ngo-directory.csv', csv(published.map(({ record }) => ({ record, operations: record.operations })), catalogues));
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.map(path => '<url><loc>' + html(siteUrl + path) + '</loc></url>').join('\n') + '\n</urlset>\n');
write('robots.txt', config.site_url ? 'User-agent: *\nAllow: /\nSitemap: ' + siteUrl + '/sitemap.xml\n' : 'User-agent: *\nDisallow: /\n');
write('_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate\n  Content-Security-Policy: default-src \'self\'; base-uri \'self\'; object-src \'none\'; frame-ancestors \'none\'\n/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n');
console.log('Built ' + published.length + ' listed profiles and ' + pages.length + ' indexed routes.');
console.log('Home shell (HTML, CSS, app and imports) ' + (gzipSync(home).length + ['site.css','app.mjs','links.mjs','search.mjs','render.mjs'].reduce((sum, file) => sum + sizes[file], 0)) + ' bytes gzip. Search index ' + gzipSync(searchJSON).length + ' bytes gzip.');
