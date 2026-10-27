import type {
  ConfigMode,
  Project,
  ProjectInput,
} from "../../shared/types";

export type ProjectFormState = ProjectInput;
export type ProjectFormField = keyof ProjectInput;

export const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: "",
  projectDir: "",
  branch: "",
  packageDir: "dist",
  outputDir: "",
  releaseName: "",
  releaseSuffix: "",
  extraDir: "",
  configMode: "default",
  buildParam: "",
};

const RELEASE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f]/;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function projectToForm(project: Project): ProjectFormState {
  return {
    name: project.name,
    projectDir: project.projectDir,
    branch: project.branch,
    packageDir: project.packageDir,
    outputDir: project.outputDir,
    releaseName: project.releaseName,
    releaseSuffix: project.releaseSuffix,
    extraDir: project.extraDir,
    configMode: project.configMode,
    buildParam: project.buildParam,
  };
}

export function normalizeReleaseName(value: string): string {
  return value.trim().replace(/\.zip$/i, "");
}

export function validateReleasePrefix(value: string): string | null {
  const name = normalizeReleaseName(value);
  if (!name) {
    return "请填写打包文件名前缀";
  }
  if (name.length > 120) {
    return "打包文件名前缀不能超过 120 个字符";
  }
  if (RELEASE_NAME_PATTERN.test(name)) {
    return "打包文件名前缀包含不支持的字符";
  }
  if (/[. ]$/.test(name)) {
    return "打包文件名前缀不能以点或空格结尾";
  }
  if (WINDOWS_RESERVED_NAME.test(name)) {
    return "打包文件名前缀不能使用系统保留名称";
  }
  return null;
}

export function validateReleaseSuffix(value: string): string | null {
  const name = normalizeReleaseName(value);
  if (!name) {
    return "请填写打包文件名后缀";
  }
  if (name.length > 120) {
    return "打包文件名后缀不能超过 120 个字符";
  }
  if (RELEASE_NAME_PATTERN.test(name)) {
    return "打包文件名后缀包含不支持的字符";
  }
  if (/[. ]$/.test(name)) {
    return "打包文件名后缀不能以点或空格结尾";
  }
  if (WINDOWS_RESERVED_NAME.test(name)) {
    return "打包文件名后缀不能使用系统保留名称";
  }
  return null;
}

export function normalizeBuildParam(value: string): string {
  return value
    .trim()
    .replace(/^npm\s+run\s+build:/i, "")
    .replace(/^build:/i, "")
    .trim();
}

export function normalizeProjectForm(form: ProjectFormState): ProjectInput {
  return {
    name: form.name.trim(),
    projectDir: form.projectDir.trim(),
    branch: form.branch.trim(),
    packageDir: form.packageDir.trim(),
    outputDir: form.outputDir.trim(),
    releaseName: normalizeReleaseName(form.releaseName),
    releaseSuffix: normalizeReleaseName(form.releaseSuffix),
    extraDir: form.extraDir.trim(),
    configMode: form.configMode,
    buildParam: normalizeBuildParam(form.buildParam),
  };
}

export function validateProjectForm(form: ProjectFormState): string | null {
  const normalized = normalizeProjectForm(form);
  if (!normalized.name) {
    return "请填写项目名称";
  }
  if (!normalized.projectDir) {
    return "请选择项目根目录";
  }
  if (normalized.branch) {
    if (normalized.branch.length > 200) {
      return "Git 分支不能超过 200 个字符";
    }
    if (/\s/.test(normalized.branch) || normalized.branch.startsWith("-")) {
      return "Git 分支名称不合法";
    }
  }
  if (!normalized.packageDir) {
    return "请填写需要压缩的打包目录";
  }
  if (!normalized.outputDir) {
    return "请选择 ZIP 输出目录";
  }
  const prefixError = validateReleasePrefix(normalized.releaseName);
  if (prefixError) {
    return prefixError;
  }
  if (normalized.extraDir.length > 1000) {
    return "Taro 文件目录不能超过 1000 个字符";
  }
  if (!(["all", "default", "defaultAndCjf"] as ConfigMode[]).includes(normalized.configMode)) {
    return "请选择 config 保留方式";
  }
  if (!normalized.buildParam) {
    return "请填写打包参数";
  }
  if (
    normalized.buildParam.length > 100 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized.buildParam)
  ) {
    return "打包参数只能包含字母、数字、点、下划线和短横线";
  }
  return null;
}

export function formsEqual(
  first: ProjectFormState,
  second: ProjectFormState,
): boolean {
  return (
    first.name === second.name &&
    first.projectDir === second.projectDir &&
    first.branch === second.branch &&
    first.packageDir === second.packageDir &&
    first.outputDir === second.outputDir &&
    first.releaseName === second.releaseName &&
    first.releaseSuffix === second.releaseSuffix &&
    first.extraDir === second.extraDir &&
    first.configMode === second.configMode &&
    first.buildParam === second.buildParam
  );
}
