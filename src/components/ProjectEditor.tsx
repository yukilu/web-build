import { useState } from "react";
import {
  Archive,
  FileArchive,
  FolderOpen,
  GitBranch,
  Info,
  LoaderCircle,
  Save,
  Trash,
  X,
} from "lucide-react";
import type { ConfigMode } from "../../shared/types";
import type {
  ProjectFormField,
  ProjectFormState,
} from "../lib/projectForm";
import { DirectoryPicker } from "./DirectoryPicker";

export const PROJECT_FORM_ID = "project-form";

type PickerTarget = "projectDir" | "outputDir" | "extraDir";

const ABSOLUTE_PATH_PATTERN = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/;

function pickerStartPath(value: string, fallback = ""): string | undefined {
  const current = value.trim();
  if (ABSOLUTE_PATH_PATTERN.test(current)) {
    return current;
  }
  const base = fallback.trim();
  return ABSOLUTE_PATH_PATTERN.test(base) ? base : undefined;
}

type ProjectEditorProps = {
  mode: "create" | "edit";
  form: ProjectFormState;
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  busy: boolean;
  projectIsRunning: boolean;
  onChange: (field: ProjectFormField, value: string) => void;
  onSubmit: () => void;
  onDelete?: () => void;
};

const inputBase =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60";
const pathButton =
  "flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-left transition hover:border-slate-300 hover:bg-white disabled:opacity-60";
const hintClass =
  "truncate text-right font-mono text-sm font-normal text-slate-400";

const configModes: Array<{
  value: ConfigMode;
  title: string;
  detail: string;
}> = [
  {
    value: "all",
    title: "所有",
    detail: "保留 ax-config 中的全部文件",
  },
  {
    value: "default",
    title: "仅默认",
    detail: "只保留 config.js",
  },
  {
    value: "defaultAndCjf",
    title: "仅默认和城建发",
    detail: "保留 config.js、config_cjf.js、config_cjf_cloud.js",
  },
];

function RequiredDot() {
  return <span className="size-1.5 rounded-full bg-orange-500" aria-hidden="true" />;
}

export function ProjectEditor({
  mode,
  form,
  dirty,
  saving,
  canSave,
  busy,
  projectIsRunning,
  onChange,
  onSubmit,
  onDelete,
}: ProjectEditorProps) {
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const pickerTitle =
    pickerTarget === "outputDir"
      ? "选择 ZIP 输出目录"
      : pickerTarget === "extraDir"
        ? "选择 Taro 文件目录"
        : "选择项目根目录";
  const pickerInitialPath =
    pickerTarget === "outputDir"
      ? pickerStartPath(form.outputDir, form.projectDir)
      : pickerTarget === "extraDir"
        ? pickerStartPath(form.extraDir, form.projectDir)
        : pickerStartPath(form.projectDir);

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.03] animate-rise sm:p-6">
      <form
        id={PROJECT_FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        autoComplete="off"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1.5" htmlFor="project-name">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                项目名称
                <RequiredDot />
              </span>
              <span className={hintClass}>ZIP 名称展示</span>
            </span>
            <span className="relative block">
              <FileArchive
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                id="project-name"
                value={form.name}
                onChange={(event) => onChange("name", event.target.value)}
                placeholder="例如：官网前端"
                maxLength={80}
                disabled={saving}
                className={`${inputBase} pl-9 pr-3`}
              />
            </span>
          </label>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                项目根目录
                <RequiredDot />
              </span>
              <span className={hintClass}>脚本执行目录</span>
            </span>
            <button
              type="button"
              className={`${pathButton} w-full`}
              onClick={() => setPickerTarget("projectDir")}
              disabled={saving}
              aria-label={`选择项目根目录，当前${form.projectDir ? `为 ${form.projectDir}` : "未选择"}`}
              title={form.projectDir || "选择项目文件夹"}
            >
              <FolderOpen
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="shrink-0 text-slate-400"
              />
              <span
                className={`min-w-0 flex-1 truncate font-mono text-sm ${
                  form.projectDir ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {form.projectDir || "选择项目文件夹"}
              </span>
              <span className="shrink-0 rounded-lg bg-orange-100 px-2 py-1 text-sm font-semibold text-orange-600">
                选择
              </span>
            </button>
          </div>

          <label className="flex min-w-0 flex-col gap-1.5" htmlFor="package-dir">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                打包目录
                <RequiredDot />
              </span>
              <span className={hintClass}>相对或绝对路径</span>
            </span>
            <span className="relative block">
              <FolderOpen
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                id="package-dir"
                value={form.packageDir}
                onChange={(event) => onChange("packageDir", event.target.value)}
                placeholder="dist"
                spellCheck={false}
                disabled={saving}
                className={`${inputBase} pl-9 pr-3 font-mono`}
              />
            </span>
          </label>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                ZIP 输出目录
                <RequiredDot />
              </span>
              <span className={hintClass}>最终产物位置</span>
            </span>
            <button
              type="button"
              className={`${pathButton} w-full`}
              onClick={() => setPickerTarget("outputDir")}
              disabled={saving}
              aria-label={`选择 ZIP 输出目录，当前${form.outputDir ? `为 ${form.outputDir}` : "未选择"}`}
              title={form.outputDir || "选择 ZIP 输出文件夹"}
            >
              <FolderOpen
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="shrink-0 text-slate-400"
              />
              <span
                className={`min-w-0 flex-1 truncate font-mono text-sm ${
                  form.outputDir ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {form.outputDir || "选择输出文件夹"}
              </span>
              <span className="shrink-0 rounded-lg bg-orange-100 px-2 py-1 text-sm font-semibold text-orange-600">
                选择
              </span>
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">Taro 文件目录</span>
              <span className={hintClass}>可选 · 复制为 taro</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${pathButton} min-w-0 flex-1`}
                onClick={() => setPickerTarget("extraDir")}
                disabled={saving}
                aria-label={`选择 Taro 文件目录，当前${form.extraDir ? `为 ${form.extraDir}` : "未选择"}`}
                title={form.extraDir || "选择 Taro 文件夹"}
              >
                <FolderOpen
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="shrink-0 text-slate-400"
                />
                <span
                  className={`min-w-0 flex-1 truncate font-mono text-sm ${
                    form.extraDir ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {form.extraDir || "选择 Taro 文件夹"}
                </span>
                <span className="shrink-0 rounded-lg bg-orange-100 px-2 py-1 text-sm font-semibold text-orange-600">
                  选择
                </span>
              </button>
              {form.extraDir && (
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  onClick={() => onChange("extraDir", "")}
                  disabled={saving}
                  aria-label="清除 Taro 文件目录"
                  title="清除 Taro 文件目录"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          <label className="flex min-w-0 flex-col gap-1.5" htmlFor="release-name">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                打包文件名前缀
                <RequiredDot />
              </span>
              <span className={hintClass}>自动追加日期</span>
            </span>
            <span className="relative block">
              <Archive
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                id="release-name"
                value={form.releaseName}
                onChange={(event) => onChange("releaseName", event.target.value)}
                placeholder="例如：dist_for_client"
                maxLength={120}
                spellCheck={false}
                disabled={saving}
                className={`${inputBase} pl-9 pr-3 font-mono`}
              />
            </span>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5" htmlFor="git-branch">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                Git 分支
                <RequiredDot />
              </span>
              <span className={hintClass}>打包前自动切换</span>
            </span>
            <span className="relative block">
              <GitBranch
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                id="git-branch"
                value={form.branch}
                onChange={(event) => onChange("branch", event.target.value)}
                placeholder="例如：master"
                maxLength={200}
                spellCheck={false}
                disabled={saving}
                className={`${inputBase} pl-9 pr-3 font-mono`}
              />
            </span>
          </label>

          <label
            className="flex min-w-0 flex-col gap-1.5 xl:col-span-2"
            htmlFor="build-param"
          >
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                打包参数
                <RequiredDot />
              </span>
              <span className={hintClass}>npm run build:参数</span>
            </span>
            <span className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50/70 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/10">
              <span className="shrink-0 pl-3 font-mono text-sm text-slate-400">
                npm run build:
              </span>
              <input
                id="build-param"
                value={form.buildParam}
                onChange={(event) => onChange("buildParam", event.target.value)}
                placeholder="client"
                maxLength={100}
                spellCheck={false}
                disabled={saving}
                className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </span>
          </label>

          <div className="col-span-full flex min-w-0 flex-col gap-1.5">
            <span className="flex min-h-[22px] items-end justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">保留 config</span>
              <span className={hintClass}>仅作用于输出副本</span>
            </span>
            <div
              role="radiogroup"
              aria-label="config 保留方式"
              className="grid gap-2 md:grid-cols-3"
            >
              {configModes.map((option) => {
                const checked = form.configMode === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex h-full items-start gap-2.5 rounded-2xl border p-3 transition focus-within:ring-2 focus-within:ring-blue-300/50 ${
                      checked
                        ? "border-blue-300 bg-blue-50/60"
                        : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                    } ${saving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name="config-mode"
                      value={option.value}
                      checked={checked}
                      onChange={() => onChange("configMode", option.value)}
                      disabled={saving}
                      className="sr-only"
                    />
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition ${
                        checked
                          ? "border-blue-600 bg-blue-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full bg-white transition ${
                          checked ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-700">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-sm leading-5 text-slate-400">
                        {option.detail}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

        </div>

        <div className="mt-5 flex items-start gap-2 px-1 text-sm leading-6 text-slate-400">
          <Info
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            className="mt-1 shrink-0 text-slate-400"
          />
          <p>
            将执行{" "}
            <code className="font-mono text-slate-500">npm run build:参数</code>
            。直接打包生成「前缀_YYMMDD」；带后缀打包会弹窗填写后缀，生成「前缀_后缀_YYMMDD」，并记住上次的值。重名时依次追加
            _1、_2；打包前会校验 Git 工作区并切换到指定分支，Taro 文件夹统一命名为 taro，config 按所选策略保留。
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {mode === "edit" && onDelete ? (
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 transition hover:bg-rose-500 disabled:opacity-45 disabled:shadow-none"
              onClick={onDelete}
              disabled={busy || projectIsRunning}
              title={projectIsRunning ? "运行中无法删除项目" : "删除项目"}
            >
              <Trash size={15} strokeWidth={1.9} />
              删除项目
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-45 disabled:shadow-none"
            disabled={!canSave || !dirty || busy}
          >
            {saving ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <Save size={15} strokeWidth={2} />
            )}
            {saving ? "保存中" : "保存配置"}
          </button>
        </div>
      </form>

      <DirectoryPicker
        open={pickerTarget !== null}
        title={pickerTitle}
        initialPath={pickerInitialPath}
        allowCreate={pickerTarget === "outputDir"}
        onClose={() => setPickerTarget(null)}
        onSelect={(selectedPath) => {
          if (!pickerTarget) {
            return;
          }
          onChange(pickerTarget, selectedPath);
          setPickerTarget(null);
        }}
      />
    </section>
  );
}
