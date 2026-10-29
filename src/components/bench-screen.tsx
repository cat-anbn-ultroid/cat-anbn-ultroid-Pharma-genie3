import { useNavigate } from "@tanstack/react-router";
import { Download, Upload } from "lucide-react";
import { useState, type DragEvent } from "react";
import corpusRaw from "@/data/cyp2c19.jsonl?raw";
import { AppHeader } from "@/components/app-header";
import { chunksFromJsonl, type CorpusIndex } from "@/lib/pgx/corpus";
import { autoQuery, buildReport } from "@/lib/pgx/rag";
import { demoVcf, parseVcf } from "@/lib/pgx/vcf";
import { saveRun } from "@/lib/run-store";

function saveText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fileLabel(name: string): string {
  const cleaned = name.replace(/clinpgx/gi, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === ".jsonl") return "CYP2C19 guideline file";
  return cleaned;
}

export function BenchScreen() {
  const navigate = useNavigate();
  const [corpus, setCorpus] = useState<CorpusIndex>(() => chunksFromJsonl(corpusRaw));
  const [corpusName, setCorpusName] = useState("CYP2C19 guideline file");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function runText(name: string, text: string) {
    const parsed = parseVcf(text);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    saveRun({
      vcfName: name,
      call: parsed.call,
      report: buildReport(parsed.call, corpus, autoQuery(parsed.call)),
    });
    void navigate({ to: "/results" });
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => runText(file.name, String(reader.result ?? ""));
    reader.onerror = () => setError("That file could not be read.");
    reader.readAsText(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files[0]);
  }

  function onCorpusFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCorpus(chunksFromJsonl(String(reader.result ?? "")));
      setCorpusName(fileLabel(file.name));
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader />
      <p className="bg-mint px-4 py-3 font-sans text-sm leading-relaxed text-ink lg:px-6">
        Research prototype. Not for prescribing.
      </p>
      <main className="mx-auto max-w-xl px-4 py-8 lg:px-6">
        <h1 className="text-4xl">VCF processor</h1>
        <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
          Upload a single-sample CYP2C19 VCF. Results open on the next page.
        </p>
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-6 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center ${
            dragging ? "border-sage bg-mint" : "border-line bg-surface"
          }`}
        >
          <Upload className="size-5 text-sage" aria-hidden="true" />
          <span className="mt-2 font-sans text-sm font-semibold">Upload a .vcf file</span>
          <span className="mt-1 font-sans text-sm text-muted">or drop it here</span>
          <input
            type="file"
            accept=".vcf,.txt,text/plain"
            className="sr-only"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => saveText("sample-cyp2c19.vcf", demoVcf("pm"), "text/plain")}
          className="mt-4 inline-flex h-11 items-center gap-2 font-sans text-sm font-semibold text-sage"
        >
          <Download className="size-4" aria-hidden="true" />
          Download a sample VCF
        </button>
        {error ? (
          <p className="mt-4 font-sans text-sm font-semibold text-risk" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="font-sans text-sm text-muted">{corpusName}</p>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-line bg-surface px-4 font-sans text-sm font-semibold">
            Replace file
            <input
              type="file"
              accept=".jsonl,application/jsonl,application/x-ndjson,text/plain"
              className="sr-only"
              onChange={(event) => {
                onCorpusFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </main>
    </div>
  );
}
