/** Convert total seconds to HH:MM:SS string */
export function formatTime(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(totalSec / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSec % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Parse HH:MM:SS (or MM:SS or plain number string) to total seconds. Returns 0 on invalid. */
export function parseTime(hhmmss: string): number {
  const trimmed = hhmmss.trim();
  // plain number fallback
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Decompose total seconds into { h, m, s } parts */
export function decomposeTime(totalSeconds: number): {
  h: number;
  m: number;
  s: number;
} {
  const total = Math.max(0, Math.floor(totalSeconds));
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}
