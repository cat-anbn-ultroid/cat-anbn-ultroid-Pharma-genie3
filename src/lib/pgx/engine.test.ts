import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chunksFromJsonl } from "./corpus.ts";
import { buildReport } from "./rag.ts";
import { demoVcf, parseVcf } from "./vcf.ts";

test("calls CYP2C19 star alleles from a three-SNP VCF", () => {
  const pm = parseVcf(demoVcf("pm"));
  assert.ok(!("error" in pm));
  if ("error" in pm) return;
  assert.equal(pm.call.diplotype, "*2/*2");
  assert.equal(pm.call.phenotype, "Poor metabolizer");
  assert.equal(pm.call.status, "called");

  const im = parseVcf(demoVcf("im"));
  assert.ok(!("error" in im));
  if ("error" in im) return;
  assert.equal(im.call.diplotype, "*1/*2");
  assert.equal(im.call.phenotype, "Intermediate metabolizer");

  const rm = parseVcf(demoVcf("rm"));
  assert.ok(!("error" in rm));
  if ("error" in rm) return;
  assert.equal(rm.call.diplotype, "*1/*17");
  assert.equal(rm.call.phenotype, "Rapid metabolizer");

  const ambiguous = parseVcf(demoVcf("ambiguous"));
  assert.ok(!("error" in ambiguous));
  if ("error" in ambiguous) return;
  assert.equal(ambiguous.call.status, "ambiguous");
  assert.match(ambiguous.call.diplotype, /\*2\/\*17/);
});

test("a VCF with only *2 is provisional, not a silent *1", () => {
  const only = [
    "##fileformat=VCFv4.2",
    "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tONLY2",
    "10\t94781859\trs4244285\tG\tA\t90\tPASS\t.\tGT\t0/1",
  ].join("\n");
  const parsed = parseVcf(only);
  assert.ok(!("error" in parsed));
  if ("error" in parsed) return;
  assert.equal(parsed.call.diplotype, "*1/*2");
  assert.equal(parsed.call.status, "partial");
  assert.match(parsed.call.statusNote, /rs12248560/);
});

test("JSONL retrieval grounds cardiology and leaves voriconazole as a title", () => {
  const raw = readFileSync(new URL("../../data/cyp2c19.jsonl", import.meta.url), "utf8");
  const corpus = chunksFromJsonl(raw);
  assert.ok(corpus.chunks.some((chunk) => /clopidogrel/i.test(chunk.text)));
  assert.ok(corpus.chunks.some((chunk) => /voriconazole/i.test(chunk.title)));

  const pm = parseVcf(demoVcf("pm"));
  assert.ok(!("error" in pm));
  if ("error" in pm) return;
  const report = buildReport(pm.call, corpus);
  const heart = report.cards.find((card) => card.id === "cardiology");
  const infect = report.cards.find((card) => card.id === "infectious");
  assert.equal(heart?.lane, "concern");
  assert.equal(infect?.lane, "indexed");
  assert.match(heart?.reading ?? "", /clopidogrel/i);

  const nm = parseVcf(demoVcf("nm"));
  assert.ok(!("error" in nm));
  if ("error" in nm) return;
  const normal = buildReport(nm.call, corpus).cards.find((card) => card.id === "cardiology");
  assert.notEqual(normal?.lane, "concern");
});
