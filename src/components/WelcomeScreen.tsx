import {
  Archive,
  ArrowUpRight,
  Check,
  FolderOpen,
  Play,
  Terminal,
} from "lucide-react";

type WelcomeScreenProps = {
  onCreate: () => void;
};

const features = [
  {
    index: "A",
    title: "逐项目配置",
    description:
      "为每个仓库保存独立的目录、构建参数与输出位置，切换项目不会丢失上下文。",
  },
  {
    index: "B",
    title: "真实运行环境",
    description:
      "执行 npm run build 子命令，构建输出实时进入控制台并写入本地 SQLite。",
  },
  {
    index: "C",
    title: "产物自动归档",
    description:
      "构建完成后自动整理发布文件夹与 ZIP，可直接下载或继续交付。",
  },
];

export function WelcomeScreen({ onCreate }: WelcomeScreenProps) {
  return (
    <div className="mx-auto w-full max-w-[1440px] py-4">
      <section className="grid items-center gap-12 pb-12 xl:grid-cols-[minmax(0,1fr)_430px] xl:gap-16">
        <div className="min-w-0 max-w-3xl animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50 px-3 py-1.5 text-sm font-semibold tracking-[0.14em] text-orange-600 uppercase">
            <span className="size-1.5 rounded-full bg-orange-500" />
            Local build orchestrator
          </span>

          <h1 className="mt-6 text-5xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl xl:text-7xl">
            把项目，
            <br />
            <span className="text-orange-600">干净地</span> 交出去。
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-slate-500">
            一个停留在本机的打包工作台。保存项目配置、执行固定构建命令，
            让产物自动整理成可交付的文件夹与 ZIP。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-600/25 transition hover:-translate-y-0.5 hover:bg-orange-500 active:translate-y-0"
            >
              <Play size={17} fill="currentColor" strokeWidth={2} />
              创建第一个项目
            </button>
            <span className="text-sm text-slate-400">
              无需登录 · 数据留在本机
            </span>
          </div>

          <div className="mt-10 grid gap-2 text-sm text-slate-500 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            {["01 项目配置", "02 执行构建", "03 收集归档"].map(
              (step, index) => (
                <div key={step} className="flex items-center gap-3">
                  {index > 0 && (
                    <span
                      className="hidden h-px w-7 bg-slate-300 sm:block"
                      aria-hidden="true"
                    />
                  )}
                  <span className="rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1 font-mono text-sm text-slate-500">
                    {step}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="relative mx-auto min-w-0 w-full max-w-md animate-rise">
          <div
            className="absolute top-6 left-6 size-64 rounded-full bg-orange-400/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute right-0 bottom-10 size-44 rounded-full border border-slate-300/70"
            aria-hidden="true"
          />

          <div className="relative rounded-[2rem] border border-slate-800 bg-slate-950 p-5 text-slate-300 shadow-2xl shadow-slate-950/25 ring-1 ring-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-mono text-sm font-medium tracking-[0.14em] text-slate-400">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.1)]" />
                BUILD PIPELINE
              </span>
              <span className="font-mono text-sm text-slate-600">03 / 03</span>
            </div>

            <div className="mt-5 space-y-2.5">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3.5">
                <span className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-slate-300">
                  <FolderOpen size={17} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-100">
                    PROJECT
                  </span>
                  <span className="block truncate font-mono text-sm text-slate-500">
                    website-client
                  </span>
                </span>
                <span className="grid size-6 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
                  <Check size={13} strokeWidth={3} />
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3.5">
                <span className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-slate-300">
                  <Terminal size={17} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-100">
                    BUILD COMMAND
                  </span>
                  <span className="block truncate font-mono text-sm text-slate-500">
                    $ npm run build:client
                  </span>
                </span>
                <span className="grid size-6 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
                  <Check size={13} strokeWidth={3} />
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] p-3.5">
                <span className="grid size-9 place-items-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-950/40">
                  <Archive size={17} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">
                    RELEASE ARCHIVE
                  </span>
                  <span className="block truncate font-mono text-sm text-orange-200/60">
                    packaging → release.zip
                  </span>
                </span>
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full w-2/3 rounded-full bg-orange-400" />
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-black/25 px-3 py-2.5 font-mono text-sm text-slate-500">
              <span className="text-emerald-400">›</span>
              <span className="truncate">script completed with exit code 0</span>
              <span className="ml-auto inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-slate-500" />
            </div>
          </div>

          <div className="absolute right-0 -bottom-4 flex size-24 flex-col items-center justify-center rounded-full border border-orange-200 bg-orange-500 text-center text-white shadow-xl shadow-orange-500/30 ring-[7px] ring-stone-100">
            <Archive size={18} strokeWidth={1.8} />
            <span className="mt-1 text-sm font-bold tracking-wide">ZIP</span>
            <span className="text-sm text-orange-100">READY</span>
          </div>

          <div className="absolute -bottom-2 left-4 flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-sm text-slate-500 shadow-sm backdrop-blur">
            <ArrowUpRight size={14} strokeWidth={2} className="text-orange-500" />
            一个构建，一个出口
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-slate-200/80 pt-8 md:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.index}
            className="rounded-3xl border border-slate-200/80 bg-white/70 p-5 shadow-sm shadow-slate-900/[0.02] backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-orange-50 font-mono text-sm font-semibold text-orange-600 ring-1 ring-orange-100">
              {feature.index}
            </span>
            <h2 className="mt-4 text-base font-semibold tracking-tight text-slate-900">
              {feature.title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
