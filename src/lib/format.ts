const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fullDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export function formatFullDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : fullDateTimeFormatter.format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) {
    return "尚未运行";
  }
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "尚未运行";
  }
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) {
    return "刚刚";
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} 分钟前`;
  }
  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)} 小时前`;
  }
  return formatDateTime(value);
}

export function formatDuration(
  startedAt: string,
  finishedAt: string | null,
  now = Date.now(),
): string {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  const milliseconds = Math.max(0, end - start);
  if (milliseconds < 1000) {
    return `${milliseconds} ms`;
  }
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${Math.floor(seconds % 60)} 秒`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function pathTail(value: string): string {
  const trimmed = value.replace(/[\\/]+$/, "");
  const segments = trimmed.split(/[\\/]/);
  return segments.at(-1) || value;
}

export function pluralize(count: number, unit: string): string {
  return `${count} ${unit}`;
}

export function statusLabel(status: "running" | "success" | "failed" | null): string {
  switch (status) {
    case "running":
      return "运行中";
    case "success":
      return "成功";
    case "failed":
      return "失败";
    default:
      return "待运行";
  }
}
