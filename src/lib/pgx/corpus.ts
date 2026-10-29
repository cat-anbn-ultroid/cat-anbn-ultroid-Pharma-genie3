export type ChunkKind = "evidence" | "index";

export type Chunk = {
  id: string;
  url: string;
  title: string;
  pageType: string;
  text: string;
  drugs: string[];
  genes: string[];
  kind: ChunkKind;
};

export type CorpusIndex = {
  chunks: Chunk[];
  rowCount: number;
  skipped: number;
  notes: string[];
};

type Loose = Record<string, unknown>;

function asRecord(value: unknown): Loose | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Loose;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function geneToken(value: string): string | null {
  if (/2c19/i.test(value) || value === "PA124") return "CYP2C19";
  if (/2c9/i.test(value) || value === "PA126") return "CYP2C9";
  if (/^cyp/i.test(value)) return value.toUpperCase();
  return null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function chunksFromJsonl(raw: string): CorpusIndex {
  const chunks: Chunk[] = [];
  const seen = new Set<string>();
  const notes: string[] = [];
  let rowCount = 0;
  let skipped = 0;

  const lines = raw.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    rowCount += 1;
    let row: Loose;
    try {
      row = JSON.parse(trimmed) as Loose;
    } catch {
      skipped += 1;
      if (notes.length < 4) notes.push(`Line ${index + 1} is not valid JSON.`);
      return;
    }

    const data = asRecord(row.data);
    const title = asText(row.title) || asText(data?.name) || "Untitled record";
    const url = asText(row.url);
    const pageType = asText(row.page_type) || "other";
    const parts: string[] = [];
    const drugs = asList(data?.related_drugs);
    const genes = asList(data?.related_genes)
      .map((gene) => geneToken(gene) ?? gene)
      .filter(Boolean);

    const annotations = Array.isArray(data?.variant_annotations) ? data.variant_annotations : [];
    for (const item of annotations) {
      const note = asRecord(item);
      if (!note) continue;
      const sentence = asText(note.sentence);
      const variant = asText(note.variant);
      const category = asText(note.phenotype_category);
      if (sentence) parts.push(sentence);
      if (variant) parts.push(`Genotype noted: ${variant}.`);
      if (category) parts.push(`Phenotype category: ${category}.`);
    }

    const extracted = asRecord(data?.extracted_fields);
    const fn = asText(extracted?.functionTerm);
    const hgvs = asText(extracted?.hgvs);
    if (fn) parts.push(`Function term: ${fn}.`);
    if (hgvs) parts.push(hgvs);

    const summary = asText(data?.summary);
    const name = asText(data?.name);
    if (name && name !== title && !parts.some((part) => part.startsWith(name))) parts.push(name);
    if (summary && !parts.includes(summary)) parts.push(summary);
    const abstract = asText(extracted?.abstract);
    if (abstract && abstract !== summary && !parts.includes(abstract)) parts.push(abstract);

    const literature = Array.isArray(data?.literature) ? data.literature : [];
    for (const item of literature) {
      const paper = asRecord(item);
      const paperTitle = asText(paper?.title);
      if (paperTitle && paperTitle !== title) parts.push(paperTitle);
    }

    const text = unique(parts).join(" ");
    const geneHits = unique([
      ...genes,
      ...(/cyp2c19|2c19/i.test(`${title} ${text}`) ? ["CYP2C19"] : []),
      ...(/cyp2c9/i.test(`${title} ${text}`) && !/cyp2c19/i.test(`${title} ${text}`) ? ["CYP2C9"] : []),
    ]);

    if (text.length >= 40 && title !== "Loading...") {
      const id = `row-${index + 1}`;
      const key = `${url}|${title}|${text.slice(0, 80)}`;
      if (!seen.has(key)) {
        seen.add(key);
        chunks.push({
          id,
          url,
          title: title === "Loading..." ? id : title,
          pageType,
          text,
          drugs,
          genes: geneHits,
          kind: "evidence",
        });
      }
    } else if (!Array.isArray(row.links) || row.links.length === 0) {
      skipped += 1;
    }

    const links = Array.isArray(row.links) ? row.links : [];
    for (const item of links) {
      const link = asRecord(item);
      if (!link) continue;
      const linkText = asText(link.text);
      const linkUrl = asText(link.url);
      const linkType = asText(link.page_type);
      if (!linkText || (!/guideline/i.test(linkText) && linkType !== "guideline")) continue;
      const key = `${linkUrl}|${linkText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const linkGenes = /2c19/i.test(linkText) ? ["CYP2C19"] : geneHits;
      chunks.push({
        id: `link-${chunks.length + 1}-${index + 1}`,
        url: linkUrl || url,
        title: linkText,
        pageType: "guideline",
        text: linkText,
        drugs: [],
        genes: linkGenes.length ? linkGenes : ["CYP2C19"],
        kind: "index",
      });
    }
  });

  return { chunks, rowCount, skipped, notes };
}
