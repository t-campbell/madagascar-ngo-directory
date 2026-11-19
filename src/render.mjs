import { methodHref } from './links.mjs';
import { applicableContacts, labelMap, regionNames, scopeNames, statusNames, typeNames } from './search.mjs';

const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const html = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => escapes[char]);
export const nameOf = record => record.acronym && record.acronym !== record.name ? record.name + ' (' + record.acronym + ')' : record.name;
export const profileUrl = record => '/ngo/' + encodeURIComponent(record.id) + '/';
export const methods = { phone: 'Call', email: 'Email', website: 'Website', web_form: 'Contact page', whatsapp: 'WhatsApp' };
const isoToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Indian/Antananarivo' });
const age = (date, asOf) => (Date.parse(asOf) - Date.parse(date)) / 86_400_000;

export function freshness(item, asOf = isoToday(), label = 'Direct confirmation') {
  const direct = item.direct_confirmed_on;
  return `<span>Web reviewed <time datetime="${html(item.web_reviewed_on)}">${html(item.web_reviewed_on)}</time>${age(item.web_reviewed_on, asOf) > 365 ? ' · review overdue' : ''}</span>
    <span>${label} ${direct ? `<time datetime="${html(direct)}">${html(direct)}</time>${age(direct, asOf) > 180 ? ' · reconfirm' : ''}` : 'needed'}</span>`;
}

export function methodLink(method, showValue = false) {
  const href = methodHref(method);
  if (!href) return '';
  const label = showValue ? methods[method.type] + ' · ' + method.value : methods[method.type];
  return `<a href="${html(href)}">${html(label)}</a>`;
}

export function operationTags(op, regions, sectors) {
  return `<div class="tags">${[...regionNames(op, regions), ...op.sector_ids.map(id => sectors.get(id))]
    .map(name => `<span>${html(name)}</span>`).join('')}<span class="status ${html(op.activity_status)}">${html(statusNames[op.activity_status])}</span></div>`;
}

export function renderCards(matches, catalogues, asOf = isoToday(), emptyMessage = 'No organisations documented for these filters.') {
  if (!matches.length) return '<div class="empty"><p>' + html(emptyMessage) + '</p><p><a href="/">Clear filters</a> · <a href="/contribute/">Suggest an organisation</a></p></div>';
  const regions = labelMap(catalogues.regions);
  const sectors = labelMap(catalogues.sectors);
  return matches.map(({ record, operations }) => {
    const contacts = applicableContacts(record, operations);
    const primary = contacts[0];
    const links = primary?.methods.map(m => methodLink(m)).filter(Boolean) ?? [];
    const primaryHasWebsite = primary?.methods.some(m => m.type === 'website' || m.type === 'web_form');
    const webContact = contacts.slice(1).find(c => c.scope !== 'local' && c.methods.some(m => m.type === 'website' || m.type === 'web_form'));
    const web = webContact?.methods.find(m => m.type === 'website' || m.type === 'web_form');
    const address = record.offices.find(o => o.address);
    return `<article class="card"><p class="type">${html(typeNames[record.type])}</p>
      <h3><a href="${profileUrl(record)}">${html(nameOf(record))}</a></h3>
      ${operations.map(op => `<div class="work">${operationTags(op, regions, sectors)}<p>${html(op.summary)}</p>
        <p class="fresh">${freshness(op, asOf, 'Activity confirmation')}</p></div>`).join('')}
      ${primary ? `<div class="card-contact"><p><strong>${html(scopeNames[primary.scope])}</strong> · ${html(primary.role)}${primary.methods.find(m => m.type === 'phone' || m.type === 'email') ? ' · ' + html(primary.methods.find(m => m.type === 'phone' || m.type === 'email').value) : ''}</p>
        <p class="fresh">${freshness(primary, asOf, 'Contact confirmation')}</p>
        <div class="actions">${links.join('')}${!primaryHasWebsite && web ? methodLink(web) : ''}</div></div>`
      : address ? `<p class="muted">Office · ${html(address.address)}</p>` : ''}
      <a class="details-link" href="${profileUrl(record)}" aria-label="View details for ${html(nameOf(record))}">View details <span aria-hidden="true">→</span></a>
      </article>`;
  }).join('');
}

const csvCell = value => {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};

export function csv(matches, catalogues) {
  const regions = labelMap(catalogues.regions);
  const sectors = labelMap(catalogues.sectors);
  const header = ['Organisation ID', 'Organisation', 'Type', 'Operation ID', 'Region', 'Locality', 'Sector',
    'Status', 'Local work', 'Start date', 'End date', 'Web reviewed', 'Activity directly confirmed',
    'Contact scopes and methods', 'Contact web reviews', 'Contact confirmations', 'Sources'];
  const rows = matches.flatMap(({ record, operations }) => operations.map(op => {
    const contacts = applicableContacts(record, [op]);
    const methods = contacts.flatMap(contact => contact.methods.map(m =>
      scopeNames[contact.scope] + ' · ' + contact.role + ' · ' + m.type + ' ' + m.value));
    if (!methods.length) methods.push(...record.offices.filter(o => o.address).map(o => 'Office · ' + o.address));
    const sourceIds = new Set([...op.source_ids, ...contacts.flatMap(c => [...c.source_ids, ...c.methods.flatMap(m => m.source_ids)])]);
    return [record.id, nameOf(record), typeNames[record.type], op.id, regionNames(op, regions).join('; '), op.localities.join('; '),
      op.sector_ids.map(id => sectors.get(id)).join('; '), statusNames[op.activity_status], op.summary, op.starts_on, op.ends_on,
      op.web_reviewed_on, op.direct_confirmed_on, [...new Set(methods)].join('; '),
      [...new Set(contacts.map(c => c.web_reviewed_on))].join('; '),
      [...new Set(contacts.map(c => c.direct_confirmed_on ?? 'Unconfirmed'))].join('; '),
      record.sources.filter(s => sourceIds.has(s.id)).map(s => s.url).join('; ')];
  }));
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
