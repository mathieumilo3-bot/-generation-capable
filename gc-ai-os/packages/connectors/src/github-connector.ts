import type { Connector, ConnectorExecutionContext, ConnectorResult } from "@gc-ai-os/shared-types";

interface GithubRequest {
  owner: string;
  repo: string;
}

/**
 * Real GitHub REST connector.
 *
 * The token is read only from GITHUB_TOKEN. It is never included in
 * parameters, logs, or returned errors. The connector remains fail-closed
 * when the credential is absent, so a configured-but-unusable integration
 * can never masquerade as a successful action.
 */
export class GithubConnector implements Connector {
  readonly id = "github";

  readonly capabilities = [
    { name: "create_pull_request", riskLevel: "low" as const },
    { name: "merge_pull_request", riskLevel: "medium" as const },
    { name: "create_branch", riskLevel: "low" as const },
  ];

  async execute<T = unknown>(
    capability: string,
    params: Record<string, unknown>,
    _context: ConnectorExecutionContext,
  ): Promise<ConnectorResult<T>> {
    const token = readToken();
    if (!token) {
      return {
        ok: false,
        error: "GitHub connector unavailable: GITHUB_TOKEN is not configured.",
      };
    }

    try {
      switch (capability) {
        case "create_pull_request":
          return await this.createPullRequest<T>(token, params);
        case "merge_pull_request":
          return await this.mergePullRequest<T>(token, params);
        case "create_branch":
          return await this.createBranch<T>(token, params);
        default:
          return { ok: false, error: `Capacité inconnue : ${capability}` };
      }
    } catch (error) {
      return {
        ok: false,
        error: `GitHub request failed: ${safeErrorMessage(error)}`,
      };
    }
  }

  private async createPullRequest<T>(token: string, params: Record<string, unknown>): Promise<ConnectorResult<T>> {
    const { owner, repo } = repositoryFrom(params);
    const title = requiredString(params.title, "title");
    const head = requiredString(params.head, "head");
    const base = requiredString(params.base, "base");
    const body = optionalString(params.body);

    return requestJson<T>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, {
      method: "POST",
      body: JSON.stringify({ title, head, base, ...(body === undefined ? {} : { body }) }),
    });
  }

  private async mergePullRequest<T>(token: string, params: Record<string, unknown>): Promise<ConnectorResult<T>> {
    const { owner, repo } = repositoryFrom(params);
    const pullNumber = requiredPositiveInt(params.pullNumber, "pullNumber");
    const expectedHeadSha = optionalString(params.expectedHeadSha);
    const mergeMethod = optionalEnum(params.mergeMethod, ["merge", "squash", "rebase"] as const);

    return requestJson<T>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify({
        ...(expectedHeadSha === undefined ? {} : { sha: expectedHeadSha }),
        ...(mergeMethod === undefined ? {} : { merge_method: mergeMethod }),
      }),
    });
  }

  private async createBranch<T>(token: string, params: Record<string, unknown>): Promise<ConnectorResult<T>> {
    const { owner, repo } = repositoryFrom(params);
    const branch = requiredString(params.branch, "branch");
    const sha = requiredString(params.sha, "sha");

    return requestJson<T>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    });
  }
}

async function requestJson<T>(token: string, path: string, init: RequestInit): Promise<ConnectorResult<T>> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `HTTP ${response.status}`;
    return { ok: false, error: `GitHub API ${response.status}: ${message}` };
  }

  return { ok: true, data: payload as T };
}

function readToken(): string | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  return token ? token : null;
}

function repositoryFrom(params: Record<string, unknown>): GithubRequest {
  return {
    owner: requiredString(params.owner, "owner"),
    repo: requiredString(params.repo, "repo"),
  };
}

function requiredString(value: unknown, name: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`Missing required parameter: ${name}`);
  return result;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("Expected string parameter");
  return value.trim();
}

function requiredPositiveInt(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`Invalid positive integer parameter: ${name}`);
  }
  return value as number;
}

function optionalEnum<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error("Invalid enum parameter");
  return value as T[number];
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "unknown error";
}
