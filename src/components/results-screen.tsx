import { Link } from "@tanstack/react-router";
import { Brain, Bug, Download, HeartPulse, Info, Pill, X } from "lucide-react";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RISK_LABEL, riskTone, type DepartmentCard, type RiskTone } from "@/lib/pgx/rag";
import type { SavedRun } from "@/lib/run-store";

const ICONS = {
  cardiology: HeartPulse,
  gastro: Pill,
  psych: Brain,
  infectious: Bug,
} as const;

const TONE: Record<RiskTone, string> = {
  high: "border-risk bg-risk text-onrisk",
  caution: "border-caution bg-caution text-ink",
  low: "border-line bg-safe text-ink",
};

const INFO: Record<RiskTone, string> = {
  high: "border-onrisk text-onrisk",
  caution: "border-ink text-ink",
  low: "border-ink text-ink",
};

function saveText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ResultsScreen({ run }: { run: SavedRun }) {
  const [open, setOpen] = useState<DepartmentCard | null>(null);
  const tone = open ? riskTone(open.lane, run.call.phenotype) : "low";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
        <p className="font-sans text-xs font-semibold tracking-widest text-sage uppercase">Results</p>
        <h1 className="mt-1 text-4xl">{run.call.diplotype}</h1>
        <p className="mt-1 font-sans text-base font-semibold text-sage">{run.call.phenotype}</p>
        <p className="mt-1 font-sans text-sm text-muted">{run.vcfName}</p>
        <div className="mt-6 grid gap-4">
          {run.report.cards.map((card) => {
            const Icon = ICONS[card.id as keyof typeof ICONS] ?? Pill;
            const cardTone = riskTone(card.lane, run.call.phenotype);
            return (
              <article key={card.id} className={`rounded-xl border p-4 ${TONE[cardTone]}`}>
                <div className="flex items-start gap-3">
                  <Icon className="mt-1 size-5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl">{card.department}</h2>
                    <p className="font-sans text-sm">{card.drug}</p>
                    <p className="mt-2 font-sans text-base font-semibold">{RISK_LABEL[cardTone]}</p>
                    <p className="mt-1 font-sans text-sm leading-relaxed">{card.reading}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Reasoning for ${card.department}`}
                    onClick={() => setOpen(card)}
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${INFO[cardTone]}`}
                  >
                    <Info className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link to="/bench" className="font-sans text-sm font-semibold text-sage">
            Upload another VCF
          </Link>
          <button
            type="button"
            onClick={() => saveText(`${run.call.sample}-cyp2c19-report.json`, JSON.stringify(run, null, 2))}
            className="inline-flex h-11 items-center gap-2 font-sans text-sm font-semibold text-sage"
          >
            <Download className="size-4" aria-hidden="true" />
            Download JSON
          </button>
        </div>
      </main>
      {open ? (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reason-title"
            className="w-full max-w-lg rounded-xl border border-line bg-safe p-5 text-ink"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-sans text-xs font-semibold tracking-widest uppercase ${tone === "high" ? "text-risk" : "text-sage"}`}>
                  {RISK_LABEL[tone]}
                </p>
                <h2 id="reason-title" className="mt-1 text-2xl">
                  {open.department}
                </h2>
                <p className="font-sans text-sm text-muted">{open.drug}</p>
              </div>
              <button
                type="button"
                aria-label="Close reasoning"
                onClick={() => setOpen(null)}
                className="flex size-11 items-center justify-center rounded-full border border-line"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-4 font-sans text-base leading-relaxed">{open.why}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
