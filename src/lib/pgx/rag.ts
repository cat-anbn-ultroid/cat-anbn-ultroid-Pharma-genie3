import type { Chunk, CorpusIndex } from "./corpus.ts";
import type { PgxCall } from "./vcf.ts";

export type Lane = "concern" | "exposure" | "reference" | "unaddressed" | "indexed" | "gap" | "conflict";

export type ScoredChunk = {
  chunk: Chunk;
  score: number;
};

export type DepartmentCard = {
  id: string;
  department: string;
  blurb: string;
  drug: string;
  lane: Lane;
  why: string;
  reading: string;
  hits: ScoredChunk[];
};

export type PgxReport = {
  query: string;
  cards: DepartmentCard[];
  passages: ScoredChunk[];
};

type Department = {
  id: string;
  department: string;
  blurb: string;
  drug: string;
  keys: string[];
};

const DEPARTMENTS: Department[] = [
  {
    id: "cardiology",
    department: "Cardiology",
    blurb: "Antiplatelet therapy",
    drug: "Clopidogrel",
    keys: ["clopidogrel", "antiplatelet", "coronary", "mace", "platelet", "pru", "p2y12", "atherothrombotic"],
  },
  {
    id: "gastro",
    department: "Gastroenterology",
    blurb: "Acid suppression",
    drug: "Omeprazole and proton pump inhibitors",
    keys: ["omeprazole", "proton pump", "5-hydroxyomeprazole"],
  },
  {
    id: "psych",
    department: "Psychiatry",
    blurb: "Antidepressants",
    drug: "SSRIs and tricyclic antidepressants",
    keys: ["escitalopram", "sertraline", "antidepressant", "tricyclic", "serotonin reuptake"],
  },
  {
    id: "infectious",
    department: "Infectious diseases",
    blurb: "Antifungal therapy",
    drug: "Voriconazole",
    keys: ["voriconazole", "antifungal"],
  },
];

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "are",
  "was",
  "were",
  "has",
  "have",
  "been",
  "into",
  "gene",
  "when",
  "than",
  "its",
  "not",
]);

export function autoQuery(call: PgxCall): string {
  return `CYP2C19 ${call.diplotype} ${call.phenotype}`;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9*]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

export function scoreChunk(chunk: Chunk, query: string): number {
  const blob = `${chunk.title} ${chunk.text} ${chunk.drugs.join(" ")} ${chunk.genes.join(" ")}`.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  for (const star of q.match(/\*\d+/g) ?? []) {
    if (blob.includes(star)) score += 5;
  }
  const phrases = [
    "poor metabolizer",
    "intermediate metabolizer",
    "rapid metabolizer",
    "ultrarapid metabolizer",
    "normal metabolizer",
    "loss of function",
    "loss-of-function",
  ];
  for (const phrase of phrases) {
    if (q.includes(phrase) && blob.includes(phrase)) score += 4;
  }
  if (q.includes("cyp2c19") && blob.includes("cyp2c19")) score += 1;
  const tokens = new Set(tokenize(blob));
  for (const token of tokenize(q)) {
    if (tokens.has(token)) score += 1;
  }
  if (chunk.kind === "evidence") score += 2;
  if (blob.includes("cyp2c9") && !blob.includes("cyp2c19")) score -= 6;
  return score;
}

export function searchChunks(chunks: Chunk[], query: string, limit = 6): ScoredChunk[] {
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, query) }))
    .filter((hit) => hit.score >= 3)
    .sort((a, b) => b.score - a.score || a.chunk.title.localeCompare(b.chunk.title))
    .slice(0, limit);
}

function blobOf(chunk: Chunk): string {
  return `${chunk.title} ${chunk.text} ${chunk.drugs.join(" ")}`.toLowerCase();
}

function mentionsDepartment(department: Department, chunk: Chunk): boolean {
  const blob = blobOf(chunk);
  return department.keys.some((key) => blob.includes(key));
}

type Relation = "lof" | "reference" | "increased" | "mention";

function relation(text: string, call: PgxCall): Relation {
  const blob = text.toLowerCase();
  const lofCall = call.starsPresent.includes("*2") || call.starsPresent.includes("*3");
  const increasedCall = call.starsPresent.includes("*17");
  const normal = call.phenotype.startsWith("Normal");
  const lofLanguage =
    /poor metabolizer|intermediate metabolizer|loss of function|loss-of-function|no-function|no function|\*2\/\*2|increased risk|increased pru/.test(
      blob,
    );
  const referenceLanguage = /\*1\/\*1|normal metabolizer/.test(blob);
  const increasedLanguage = /increased metabolism|increased function|rapid metabolizer|ultrarapid/.test(blob);
  const namesIncreasedAllele = /\*17|rapid metabolizer|ultrarapid/.test(blob);

  if (lofCall && lofLanguage) return "lof";
  if (normal && referenceLanguage && !lofLanguage) return "reference";
  if (increasedCall && increasedLanguage && namesIncreasedAllele) return "increased";
  return "mention";
}

function decisionLine(drug: string, lane: Lane): string {
  switch (lane) {
    case "concern":
      return `Higher risk with ${drug}.`;
    case "conflict":
      return `${drug}: the records do not agree.`;
    case "exposure":
      return `${drug} may have higher activity.`;
    case "reference":
      return `Lower risk for ${drug}.`;
    case "unaddressed":
      return `${drug} is not described for this genotype.`;
    case "indexed":
      return `${drug} is listed, without a recommendation.`;
    default:
      return `${drug} is not covered.`;
  }
}

function reasonFor(drug: string, department: string, call: PgxCall, lane: Lane): string {
  if (call.status === "no-call") {
    return "CYP2C19 *2, *3, and *17 were not in the VCF, so no department decision was made.";
  }
  const tone = riskTone(lane, call.phenotype);
  const color = tone === "high" ? "red" : tone === "caution" ? "yellow" : "white";
  const who = `${call.diplotype}, ${call.phenotype.toLowerCase()}`;
  const limit =
    call.status === "partial"
      ? "Some panel sites were missing, so the call is provisional. "
      : call.status === "ambiguous"
        ? "Two heterozygous sites are unphased, so the phenotype is not final. "
        : "";
  if (lane === "concern" || lane === "conflict") {
    return `${limit}The call is ${who}. For ${department.toLowerCase()}, the loaded records connect a loss-of-function CYP2C19 genotype with a weaker effect of ${drug} and a higher chance of treatment failure. The card is ${color} because that risk is present. No dose and no substitute drug are stated.`;
  }
  if (lane === "exposure") {
    return `${limit}The call is ${who}. Records for ${drug} describe higher CYP2C19 activity for this kind of allele. The card is ${color} because activity may change exposure, and no dose is stated.`;
  }
  if (lane === "reference") {
    return `${limit}The call is ${who}. No loss-of-function allele was found for ${drug} in ${department.toLowerCase()}. The card is ${color} because the file does not raise a risk for this genotype.`;
  }
  if (lane === "indexed") {
    return `${limit}The call is ${who}. ${drug} is named for CYP2C19 in ${department.toLowerCase()}, but the recommendation text is not in the file. The card is ${color} until that text is available.`;
  }
  if (lane === "unaddressed") {
    return `${limit}The call is ${who}. ${department} has records for ${drug}, and they do not describe this genotype. The card is ${color}.`;
  }
  return `${limit}${department} has no ${drug} record for this call. The card is ${color}.`;
}

export function buildReport(call: PgxCall, corpus: CorpusIndex, query = autoQuery(call)): PgxReport {
  if (call.status === "no-call") {
    return {
      query,
      passages: searchChunks(corpus.chunks, query),
      cards: DEPARTMENTS.map((department) => ({
        id: department.id,
        department: department.department,
        blurb: department.blurb,
        drug: department.drug,
        lane: "gap",
        why: "CYP2C19 was not called, so this department stays closed.",
        reading: "No CYP2C19 call yet.",
        hits: [],
      })),
    };
  }

  const cards = DEPARTMENTS.map((department) => {
    const matched = corpus.chunks
      .filter((chunk) => mentionsDepartment(department, chunk))
      .map((chunk) => ({ chunk, score: scoreChunk(chunk, query) + 1 }))
      .sort((a, b) => b.score - a.score || a.chunk.title.localeCompare(b.chunk.title));
    const evidence = matched.filter((hit) => hit.chunk.kind === "evidence");
    const indexed = matched.filter((hit) => hit.chunk.kind === "index");

    if (matched.length === 0) {
      return {
        id: department.id,
        department: department.department,
        blurb: department.blurb,
        drug: department.drug,
        lane: "gap" as Lane,
        why: `No record in the loaded file matches ${department.department.toLowerCase()}.`,
        reading: decisionLine(department.drug, "gap"),
        hits: [],
      };
    }

    if (evidence.length === 0) {
      return {
        id: department.id,
        department: department.department,
        blurb: department.blurb,
        drug: department.drug,
        lane: "indexed" as Lane,
        why: reasonFor(department.drug, department.department, call, "indexed"),
        reading: decisionLine(department.drug, "indexed"),
        hits: indexed.slice(0, 3),
      };
    }

    const relations = evidence.map((hit) => relation(`${hit.chunk.title} ${hit.chunk.text}`, call));
    const hasLof = relations.includes("lof");
    const hasRef = relations.includes("reference");
    const hasIncreased = relations.includes("increased");
    const disagrees = evidence.some((hit) => /no association|not associated/.test(hit.chunk.text.toLowerCase()));
    let lane: Lane = "unaddressed";
    if (hasLof && disagrees) lane = "conflict";
    else if (hasLof) lane = "concern";
    else if (hasIncreased) lane = "exposure";
    else if (hasRef) lane = "reference";

    const why = reasonFor(department.drug, department.department, call, lane);
    const reading = decisionLine(department.drug, lane);

    return {
      id: department.id,
      department: department.department,
      blurb: department.blurb,
      drug: department.drug,
      lane,
      why,
      reading,
      hits: [...evidence, ...indexed].slice(0, 3),
    };
  });

  return {
    query,
    cards,
    passages: searchChunks(corpus.chunks, query),
  };
}

export type RiskTone = "high" | "caution" | "low";

export function riskTone(lane: Lane, phenotype = ""): RiskTone {
  if (lane === "concern" || lane === "conflict") return "high";
  if (lane === "reference" || lane === "gap") return "low";
  if (lane === "unaddressed" && phenotype.startsWith("Normal")) return "low";
  return "caution";
}

export const RISK_LABEL: Record<RiskTone, string> = {
  high: "High risk",
  caution: "Caution",
  low: "Lower risk",
};
