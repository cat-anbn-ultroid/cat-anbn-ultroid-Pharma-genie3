import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DeskGate } from "@/components/desk-gate";
import { ResultsScreen } from "@/components/results-screen";
import { loadRun, type SavedRun } from "@/lib/run-store";

export const Route = createFileRoute("/results")({ component: ResultsPage });

function ResultsPage() {
  return (
    <DeskGate>
      <ResultsBody />
    </DeskGate>
  );
}

function ResultsBody() {
  const navigate = useNavigate();
  const [run, setRun] = useState<SavedRun | null | undefined>(undefined);

  useEffect(() => {
    const saved = loadRun();
    if (!saved) {
      void navigate({ to: "/bench", replace: true });
      return;
    }
    setRun(saved);
  }, [navigate]);

  if (!run) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 font-sans text-sm text-muted">
        No result yet. <Link to="/bench">Upload a VCF.</Link>
      </main>
    );
  }

  return <ResultsScreen run={run} />;
}
