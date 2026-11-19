import { DurableObject } from 'cloudflare:workers';
import { enqueueSuggestion, handleSubmission, initialiseQueue } from './submissions.mjs';

export class SubmissionQueue extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    initialiseQueue(this.sql);
  }

  enqueue(suggestion, fingerprint) {
    return enqueueSuggestion(this.sql, suggestion, fingerprint);
  }
}

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/api/submissions') return handleSubmission(request, env);
    return env.ASSETS.fetch(request);
  }
};
