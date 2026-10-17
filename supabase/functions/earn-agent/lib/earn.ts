import type {
  AgentIdentity,
  AgentStatus,
  ListingDetails,
  ListingType,
  LiveListing,
  SubmissionPayload,
  Winner,
} from './types.ts';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class EarnApiError extends Error {
  status: number;
  body: unknown;
  endpoint: string;
  constructor(status: number, body: unknown, endpoint: string) {
    super(`Earn API ${endpoint} -> ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

/** Client for the official agent API documented at https://superteam.fun/skill.md */
export class EarnClient {
  private apiKey: string | null;
  private baseUrl: string;
  private fetchFn: FetchFn;
  private timeoutMs: number;
  constructor(apiKey: string | null, baseUrl = 'https://superteam.fun', fetchFn: FetchFn = fetch, timeoutMs = 20_000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  withKey(apiKey: string): EarnClient {
    return new EarnClient(apiKey, this.baseUrl, this.fetchFn, this.timeoutMs);
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      if (!this.apiKey) throw new Error('Earn API key not configured');
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // keep raw text
      }
      if (!res.ok) throw new EarnApiError(res.status, parsed, `${method} ${path.split('?')[0]}`);
      return parsed as T;
    } finally {
      clearTimeout(timer);
    }
  }

  register(name: string): Promise<AgentIdentity & { apiKey: string; claimCode: string }> {
    return this.call('POST', '/api/agents', { name }, false);
  }

  status(): Promise<AgentStatus> {
    return this.call('GET', '/api/agents/status');
  }

  /**
   * Live agent-eligible listings. The endpoint caps `take` at 50 and sorts by
   * deadline, so page with excludeIds[] until a short page comes back.
   */
  async liveListings(type?: ListingType, maxPages = 6): Promise<LiveListing[]> {
    const all: LiveListing[] = [];
    for (let page = 0; page < maxPages; page++) {
      const qs = new URLSearchParams({ take: '50' });
      if (type) qs.set('type', type);
      for (const l of all) qs.append('excludeIds[]', l.id);
      const batch = await this.call<LiveListing[]>('GET', `/api/agents/listings/live?${qs}`);
      all.push(...batch);
      if (batch.length < 50) break;
    }
    return all;
  }

  details(slug: string): Promise<ListingDetails> {
    return this.call('GET', `/api/agents/listings/details/${encodeURIComponent(slug)}`);
  }

  submit(payload: SubmissionPayload): Promise<{ id: string; [k: string]: unknown }> {
    return this.call('POST', '/api/agents/submissions/create', payload);
  }

  /** Public endpoint used by the listing page once winners are announced. */
  winners(listingId: string): Promise<Winner[]> {
    return this.call('GET', `/api/listings/${encodeURIComponent(listingId)}/winners`, undefined, false);
  }

  /** Public token list (symbol -> mint) used to price non-stable rewards. */
  tokens(): Promise<{ tokens: { tokenSymbol: string; mintAddress: string }[] }> {
    return this.call('GET', '/api/tokens', undefined, false);
  }
}
