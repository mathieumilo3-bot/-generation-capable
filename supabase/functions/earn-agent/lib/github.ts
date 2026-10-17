import type { FetchFn } from './earn.ts';

/**
 * Read-only access to the public workspace branch. Deliverables are trusted
 * because only collaborators can push to the branch, so the hub always
 * resolves the branch head itself (git smart-HTTP ref advertisement, no API
 * rate limit) and reads files pinned to that commit — never a caller-supplied
 * SHA, which could point at a commit from a fork.
 */
export class GitHubWorkspace {
  private owner: string;
  private repo: string;
  private branch: string;
  private fetchFn: FetchFn;
  constructor(owner: string, repo: string, branch: string, fetchFn: FetchFn = fetch) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.fetchFn = fetchFn;
  }

  async headSha(): Promise<string> {
    const res = await this.fetchFn(
      `https://github.com/${this.owner}/${this.repo}.git/info/refs?service=git-upload-pack`,
      { headers: { 'User-Agent': 'earn-agent-hub' } },
    );
    if (!res.ok) throw new Error(`git ref advertisement -> ${res.status}`);
    const text = await res.text();
    const want = `refs/heads/${this.branch}`;
    for (const m of text.matchAll(/([0-9a-f]{40}) (refs\/heads\/[^\s\0]+)/g)) {
      if (m[2] === want) return m[1];
    }
    throw new Error(`branch ${this.branch} not found`);
  }

  async readFile(sha: string, path: string): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${sha}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const res = await this.fetchFn(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`raw ${path} -> ${res.status}`);
    return res.text();
  }

  /**
   * The submitted link must resolve publicly before we hand it to a sponsor.
   * Only a 404 counts as missing: github.com throttles anonymous page loads
   * from shared cloud IPs, and the raw read already proved the file exists.
   */
  async isPublic(url: string): Promise<boolean> {
    const res = await this.fetchFn(url, { method: 'GET', headers: { 'User-Agent': 'earn-agent-hub' } });
    await res.body?.cancel();
    return res.status !== 404;
  }
}
