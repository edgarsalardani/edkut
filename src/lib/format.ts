/** Formata uma data ISO como tempo relativo em português ("há 2 horas"). */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;
  if (diffHour < 24) return `há ${diffHour} ${diffHour === 1 ? "hora" : "horas"}`;
  if (diffDay < 7) return `há ${diffDay} ${diffDay === 1 ? "dia" : "dias"}`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
