export type RunStatus = "running" | "success" | "failed";
export type ConfigMode = "all" | "default" | "defaultAndCjf";

export interface Project {
  id: string;
  name: string;
  projectDir: string;
  branch: string;
  buildParam: string;
  packageDir: string;
  outputDir: string;
  releaseName: string;
  releaseSuffix: string;
  extraDir: string;
  configMode: ConfigMode;
  createdAt: string;
  updatedAt: string;
}

export interface RunSummary {
  id: string;
  projectId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  archiveName: string | null;
  archiveSize: number | null;
  error: string | null;
}

export interface Run extends RunSummary {
  log: string;
}

export interface ProjectSummary extends Project {
  lastRun: RunSummary | null;
}

export interface ProjectInput {
  name: string;
  projectDir: string;
  branch: string;
  buildParam: string;
  packageDir: string;
  outputDir: string;
  releaseName: string;
  releaseSuffix: string;
  extraDir: string;
  configMode: ConfigMode;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  pythonVersion: string;
  processId: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  directories: DirectoryEntry[];
  roots: DirectoryEntry[];
  home: string;
  workspace: string;
}
