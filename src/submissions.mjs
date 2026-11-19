export const queueName = 'directory-submissions';

export const suggestionTypes = {
  addition: 'Add an organisation',
  correction: 'Suggest a correction',
  confirmation: 'Confirm a listing',
  inactive: 'Report an inactive programme'
};

export const fieldLimits = { organisation: 160, locality: 200, details: 2000, source: 600 };
const bodyLimit = 28000;

function reply(request, status, message, headers = {}) {
  const json = request.headers.get('Accept')?.includes('application/json');
  return new Response(json
    ? JSON.stringify({ message })
    : `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Directory suggestion</title><main><h1>Directory suggestion</h1><p>${message}</p><p><a href="/contribute/">Back to the form</a></p></main></html>`, {
    status,
    headers: {
      'Content-Type': (json ? 'application/json' : 'text/html') + '; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

async function readForm(body) {
  const reader = body?.getReader();
  if (!reader) return new URLSearchParams();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return new URLSearchParams(text + decoder.decode());
    bytes += value.byteLength;
    if (bytes > bodyLimit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

function isPublicSource(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function handleSubmission(request, env) {
  const respond = (status, message, headers) => reply(request, status, message, headers);
  if (request.method !== 'POST') return respond(405, 'Open the contribution form to send a suggestion.', { Allow: 'POST' });
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return respond(403, 'Open the contribution form on this site and try again.');
  }
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    return respond(415, 'Please send your suggestion through the contribution form.');
  }
  if (Number(request.headers.get('Content-Length')) > bodyLimit) return respond(413, 'Your suggestion is too long.');
  try {
    const key = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.SUBMISSION_LIMIT.limit({ key });
    if (!success) return respond(429, 'Too many attempts. Wait a minute and try again.', { 'Retry-After': '60' });
    const form = await readForm(request.body);
    if (!form) return respond(413, 'Your suggestion is too long.');
    const received = () => respond(202, 'Suggestion received. A maintainer will review it.');
    if (form.get('company_url')) return received();

    const kind = form.get('kind');
    if (!Object.hasOwn(suggestionTypes, kind)) return respond(400, 'Choose a type of suggestion.');
    const suggestion = { kind };
    for (const [field, max] of Object.entries(fieldLimits)) {
      const value = (form.get(field) ?? '').trim().replace(/\r\n?/g, '\n');
      if (value.length > max || value.includes('\0')) return respond(400, 'Check the field lengths and try again.');
      suggestion[field] = value;
    }
    if (!suggestion.organisation || !suggestion.details) return respond(400, 'Enter the organisation name and a description.');
    if (suggestion.source && !isPublicSource(suggestion.source)) return respond(400, 'Enter a source link starting with https:// or http://.');

    const bytes = new TextEncoder().encode(JSON.stringify(suggestion));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    const saved = await env.SUBMISSIONS.getByName(queueName).enqueue(suggestion, fingerprint);
    return saved ? received() : respond(503, 'The review queue is full. Please try again later.');
  } catch {
    return respond(503, 'The form is temporarily unavailable. Please try again later.');
  }
}

export function initialiseQueue(sql) {
  sql.exec(`CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    kind TEXT NOT NULL,
    organisation TEXT NOT NULL,
    locality TEXT NOT NULL,
    details TEXT NOT NULL,
    source TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    reviewed_at TEXT
  )`);
  sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS pending_fingerprints ON suggestions(fingerprint) WHERE reviewed_at IS NULL');
  sql.exec('CREATE INDEX IF NOT EXISTS pending_order ON suggestions(id) WHERE reviewed_at IS NULL');
}

export function enqueueSuggestion(sql, { kind, organisation, locality, details, source }, fingerprint) {
  if (sql.exec('SELECT 1 FROM suggestions WHERE fingerprint = ? AND reviewed_at IS NULL', fingerprint).toArray().length) return true;
  // The object executes this synchronously and serialises writes to its own storage.
  return sql.exec(`INSERT INTO suggestions(kind, organisation, locality, details, source, fingerprint)
    SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM suggestions WHERE reviewed_at IS NULL) < 500
    RETURNING id`, kind, organisation, locality, details, source, fingerprint).toArray().length === 1;
}
