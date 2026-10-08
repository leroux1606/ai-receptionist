const TIME_ZONE = "Africa/Johannesburg";

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds < 0) {
    return "—";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
  }
  return `${remaining}s`;
}

export function formatPhone(value: string | null): string {
  return value?.trim() || "Unknown caller";
}
