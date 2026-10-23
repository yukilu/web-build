import type {
  DirectoryListing,
  HealthResponse,
  Project,
  ProjectInput,
  ProjectSummary,
  Run,
  RunSummary,
} from "../shared/types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Packforge-Client", "web");
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, { ...init, headers });
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `请求失败（HTTP ${response.status}）`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  stopService: () =>
    request<{ ok: boolean }>("/service/stop", { method: "POST" }),
  restartService: () =>
    request<{ ok: boolean }>("/service/restart", { method: "POST" }),
  listProjects: () => request<ProjectSummary[]>("/projects"),
  createProject: (input: ProjectInput) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProject: (id: string, input: ProjectInput) =>
    request<Project>(`/projects/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listRuns: (projectId: string) =>
    request<RunSummary[]>(`/projects/${encodeURIComponent(projectId)}/runs`),
  startRun: (projectId: string, suffix?: string) =>
    request<Run>(`/projects/${encodeURIComponent(projectId)}/runs`, {
      method: "POST",
      body: JSON.stringify(suffix ? { suffix } : {}),
    }),
  getRun: (runId: string) =>
    request<Run>(`/runs/${encodeURIComponent(runId)}`),
  listDirectories: (path?: string) =>
    request<DirectoryListing>(
      `/fs/directories${path ? `?path=${encodeURIComponent(path)}` : ""}`,
    ),
  createDirectory: (parent: string, name: string) =>
    request<DirectoryListing>("/fs/directories", {
      method: "POST",
      body: JSON.stringify({ parent, name }),
    }),
};

export function archiveUrl(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/archive`;
}
