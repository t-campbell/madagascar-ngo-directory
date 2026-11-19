import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { enqueueSuggestion, handleSubmission, initialiseQueue, queueName } from '../src/submissions.mjs';

const origin = 'https://directory.example';
const url = origin + '/api/submissions';
const valid = { kind: 'correction', organisation: 'Example NGO', locality: 'Ambovombe',
  details: "The organisation's contact changed.", source: 'https://example.org/update' };
const post = (data, headers = {}) => new Request(url, {
  method: 'POST', body: new URLSearchParams(data), headers: { Origin: origin, Accept: 'application/json', ...headers }
});

test('the public form commits a private suggestion once and accepts a retry', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const sql = { exec: (query, ...args) => ({ toArray: () => db.prepare(query).all(...args) }) };
    const setup = { exec: query => db.exec(query) };
    initialiseQueue(setup);
    initialiseQueue(setup);
    const env = {
      SUBMISSION_LIMIT: { limit: async () => ({ success: true }) },
      SUBMISSIONS: { getByName(name) {
        assert.equal(name, queueName);
        return { enqueue: (suggestion, hash) => enqueueSuggestion(sql, suggestion, hash) };
      } }
    };
    for (const headers of [{}, { Accept: 'text/html' }]) {
      const result = await handleSubmission(post(valid, headers), env);
      assert.equal(result.status, 202);
      assert.match(await result.text(), /Suggestion received/);
    }
    const rows = db.prepare('SELECT organisation, details, reviewed_at FROM suggestions').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].organisation, valid.organisation);
    assert.equal(rows[0].details, valid.details);
    assert.equal(rows[0].reviewed_at, null);
    db.exec('UPDATE suggestions SET reviewed_at = CURRENT_TIMESTAMP');
    assert.equal((await handleSubmission(post(valid), env)).status, 202);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM suggestions').get().count, 2);
  } finally {
    db.close();
  }
});

test('suggestion endpoint rejects out-of-scope requests and filters spam before writing', async () => {
  const env = { SUBMISSION_LIMIT: { limit: async () => ({ success: true }) } };
  const cases = [
    [new Request(url), 405],
    [post(valid, { Origin: 'https://different.example' }), 403],
    [post(valid, { 'Content-Type': 'text/plain' }), 415],
    [post({ ...valid, details: '😾'.repeat(2400) }), 413],
    [post({ ...valid, source: 'javascript:alert(1)' }), 400],
    [post({ ...valid, organisation: '  ' }), 400],
    [post({ ...valid, company_url: 'bot' }), 202],
    [post(valid), 503]
  ];
  for (const [request, status] of cases) assert.equal((await handleSubmission(request, env)).status, status);

  const throttled = await handleSubmission(post(valid), { SUBMISSION_LIMIT: { limit: async () => ({ success: false }) } });
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers.get('Retry-After'), '60');
});
