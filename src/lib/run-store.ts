import type { PgxReport } from "@/lib/pgx/rag";
import type { PgxCall } from "@/lib/pgx/vcf";

const KEY = "pharmagenie.run";

export type SavedRun = {
  vcfName: string;
  call: PgxCall;
  report: PgxReport;
};

export function saveRun(run: SavedRun) {
  sessionStorage.setItem(KEY, JSON.stringify(run));
}

export function loadRun(): SavedRun | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedRun;
  } catch {
    return null;
  }
}
