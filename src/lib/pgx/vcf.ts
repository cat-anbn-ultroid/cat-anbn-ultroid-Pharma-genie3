import {
  CYP2C19_SITES,
  PHENOTYPE,
  formatDiplotype,
  type PanelSite,
  type Star,
} from "./panel.ts";

export type CallStatus = "called" | "partial" | "ambiguous" | "complex" | "no-call";

export type AltSide = "left" | "right" | "both" | "neither" | "unknown";

export type SiteCall = {
  site: PanelSite;
  presence: "missing" | "called";
  genotype: string;
  altCopies: number;
  phased: boolean;
  altOn: AltSide;
  warnings: string[];
};

export type PgxCall = {
  sample: string;
  gene: "CYP2C19";
  diplotype: string;
  phenotype: string;
  status: CallStatus;
  statusNote: string;
  sites: SiteCall[];
  variantCount: number;
  panelHitCount: number;
  warnings: string[];
  starsPresent: Star[];
};

type RawVariant = {
  chrom: string;
  pos: number;
  id: string;
  ref: string;
  alt: string;
  filter: string;
  genotype: string;
};

function splitCols(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  return line.trim().split(/\s+/);
}

function parseGt(gt: string): {
  missing: boolean;
  copies: number;
  phased: boolean;
  altOn: AltSide;
  multi: boolean;
} {
  const raw = gt.trim();
  if (!raw || raw === "." || raw === "./." || raw === ".|.") {
    return { missing: true, copies: 0, phased: false, altOn: "unknown", multi: false };
  }
  const phased = raw.includes("|");
  const parts = raw.split(/[|/]/);
  const nums = parts.map((part) => (part === "." ? null : Number(part)));
  if (nums.some((num) => num === null || Number.isNaN(num))) {
    return { missing: true, copies: 0, phased, altOn: "unknown", multi: false };
  }
  const called = nums as number[];
  const copies = called.filter((num) => num > 0).length;
  const multi = called.some((num) => num > 1);
  let altOn: AltSide = "unknown";
  if (copies === 0) altOn = "neither";
  else if (copies >= 2) altOn = "both";
  else if (phased) altOn = called[0]! > 0 ? "left" : "right";
  return { missing: false, copies, phased, altOn, multi };
}

function matchSite(variant: RawVariant, site: PanelSite): boolean {
  const ids = variant.id.split(/[;,]/).map((item) => item.trim());
  if (ids.includes(site.rsid)) return true;
  const chrom = variant.chrom.replace(/^chr/i, "");
  if (chrom !== "10") return false;
  return variant.pos === site.grch38 || variant.pos === site.grch37;
}

export function parseVcf(text: string): { call: PgxCall } | { error: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let sample = "SAMPLE";
  let sawHeader = false;
  let sampleCount = 0;
  const variants: RawVariant[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("##")) continue;
    if (trimmed.startsWith("#CHROM") || trimmed.startsWith("#chrom")) {
      const cols = splitCols(trimmed);
      const samples = cols.slice(9).filter(Boolean);
      sampleCount = samples.length;
      if (samples[0]) sample = samples[0];
      sawHeader = true;
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    const cols = splitCols(trimmed);
    if (cols.length < 10) {
      return {
        error: "Each variant needs a sample genotype column. This file does not look like a single-sample VCF.",
      };
    }
    const format = cols[8] ?? "GT";
    const gtIndex = format.split(":").indexOf("GT");
    const sampleField = cols[9] ?? "";
    const genotype = (gtIndex >= 0 ? sampleField.split(":")[gtIndex] : sampleField.split(":")[0]) ?? ".";
    const pos = Number(cols[1]);
    if (!Number.isFinite(pos)) {
      return { error: `Could not read a position from: ${trimmed.slice(0, 80)}` };
    }
    variants.push({
      chrom: cols[0] ?? "",
      pos,
      id: cols[2] ?? ".",
      ref: (cols[3] ?? "").toUpperCase(),
      alt: (cols[4] ?? "").toUpperCase(),
      filter: cols[6] ?? ".",
      genotype,
    });
  }

  if (!sawHeader && variants.length === 0) {
    return { error: "No VCF header or variants were found. Paste or upload a single-sample VCF." };
  }
  if (variants.length === 0) {
    return { error: "The VCF has a header but no variant rows." };
  }

  const warnings: string[] = [];
  if (sampleCount > 1) warnings.push(`Using the first sample only (${sample}).`);

  const sites: SiteCall[] = CYP2C19_SITES.map((site) => {
    const hit = variants.find((variant) => matchSite(variant, site));
    if (!hit) {
      return {
        site,
        presence: "missing",
        genotype: "absent",
        altCopies: 0,
        phased: false,
        altOn: "unknown",
        warnings: [],
      };
    }
    const parsed = parseGt(hit.genotype);
    const siteWarnings: string[] = [];
    if (hit.filter && hit.filter !== "." && hit.filter !== "PASS") {
      siteWarnings.push(`FILTER is ${hit.filter}, not PASS.`);
    }
    if (parsed.missing) siteWarnings.push("Genotype is missing at this site.");
    if (hit.ref && hit.ref !== site.ref) {
      siteWarnings.push(`REF is ${hit.ref}; the panel expects ${site.ref}.`);
    }
    if (parsed.copies > 0 && hit.alt && hit.alt !== "." && !hit.alt.split(",").includes(site.alt)) {
      siteWarnings.push(`ALT is ${hit.alt}; the defining allele is ${site.alt}.`);
    }
    if (parsed.multi) siteWarnings.push("Genotype uses an ALT index above 1.");
    return {
      site,
      presence: parsed.missing ? "missing" : "called",
      genotype: parsed.missing ? hit.genotype || "." : hit.genotype,
      altCopies: parsed.missing ? 0 : parsed.copies,
      phased: parsed.phased,
      altOn: parsed.altOn,
      warnings: siteWarnings,
    };
  });

  const call = assembleCall({
    sample,
    sites,
    warnings,
    variantCount: variants.length,
  });
  return { call };
}

function assembleCall(input: {
  sample: string;
  sites: SiteCall[];
  warnings: string[];
  variantCount: number;
}): PgxCall {
  const { sample, sites, warnings, variantCount } = input;
  const panelHitCount = sites.filter((site) => site.presence === "called").length;
  const missing = sites.filter((site) => site.presence === "missing");
  const alts = sites.filter((site) => site.altCopies > 0);
  const starsPresent = alts.map((site) => site.site.star);
  for (const site of sites) warnings.push(...site.warnings.map((warning) => `${site.site.rsid}: ${warning}`));

  const base = {
    sample,
    gene: "CYP2C19" as const,
    sites,
    variantCount,
    panelHitCount,
    warnings,
    starsPresent,
  };

  if (panelHitCount === 0) {
    return {
      ...base,
      diplotype: "not called",
      phenotype: "Indeterminate",
      status: "no-call",
      statusNote:
        "None of rs4244285 (*2), rs4986893 (*3), or rs12248560 (*17) were found. Other CYP2C19 variants are outside this prototype panel.",
    };
  }

  const missingNote =
    missing.length > 0
      ? ` Missing from the file: ${missing.map((site) => `${site.site.star} (${site.site.rsid})`).join(", ")}. A missing site is not proof of reference.`
      : "";

  if (alts.length === 0) {
    if (missing.length === 0) {
      return {
        ...base,
        diplotype: "*1/*1",
        phenotype: PHENOTYPE["*1/*1"] ?? "Normal metabolizer",
        status: "called",
        statusNote: "All three panel sites are reference. Called as *1/*1 on this limited panel only.",
        starsPresent: ["*1"],
      };
    }
    return {
      ...base,
      diplotype: "not called",
      phenotype: "Indeterminate",
      status: "partial",
      statusNote: `No alternate allele at the sites that were present.${missingNote}`,
    };
  }

  if (alts.length === 1) {
    const only = alts[0]!;
    const star = only.site.star;
    if (only.altCopies === 1 || only.altCopies === 2) {
      const pair: [Star, Star] = only.altCopies === 2 ? [star, star] : ["*1", star];
      const diplotype = formatDiplotype(pair[0], pair[1]);
      return {
        ...base,
        diplotype,
        phenotype: PHENOTYPE[diplotype] ?? "Indeterminate",
        status: missing.length ? "partial" : "called",
        statusNote:
          (missing.length
            ? `${diplotype} is provisional because the file does not cover the whole panel.`
            : `${diplotype} uses the three-SNP panel.`) + missingNote,
      };
    }
  }

  if (alts.length === 2 && alts.every((site) => site.altCopies === 1)) {
    const [first, second] = alts;
    const phased =
      Boolean(first?.phased && second?.phased) &&
      first?.altOn !== "unknown" &&
      second?.altOn !== "unknown";
    if (phased && first && second && first.altOn !== second.altOn) {
      const diplotype = formatDiplotype(first.site.star, second.site.star);
      return {
        ...base,
        diplotype,
        phenotype: PHENOTYPE[diplotype] ?? "Indeterminate",
        status: missing.length ? "partial" : "called",
        statusNote: `Phased genotypes place ${first.site.star} and ${second.site.star} on opposite haplotypes.${missingNote}`,
      };
    }
    if (phased && first && second) {
      return {
        ...base,
        diplotype: "not called",
        phenotype: "Indeterminate",
        status: "complex",
        statusNote: `${first.site.star} and ${second.site.star} sit on the same haplotype. This panel has no star allele that carries both.`,
      };
    }
    const possible = formatDiplotype(alts[0]!.site.star, alts[1]!.site.star);
    return {
      ...base,
      diplotype: `${possible} if trans`,
      phenotype: "Indeterminate",
      status: "ambiguous",
      statusNote: `Two heterozygous sites are unphased. If they are on opposite haplotypes the diplotype would be ${possible} (${PHENOTYPE[possible] ?? "unassigned"}). Phase is not in the file.${missingNote}`,
    };
  }

  return {
    ...base,
    diplotype: "not called",
    phenotype: "Indeterminate",
    status: "complex",
    statusNote:
      "The genotype pattern needs more than this three-SNP panel (for example a homozygous site plus a second defining variant).",
  };
}

const VCF_HEAD = [
  "##fileformat=VCFv4.2",
  "##reference=GRCh38",
  '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
  "##contig=<ID=10>",
].join("\n");

function vcfRow(site: PanelSite, gt: string): string {
  return ["10", site.grch38, site.rsid, site.ref, site.alt, "99", "PASS", ".", "GT", gt].join("\t");
}

export function demoVcf(kind: "pm" | "im" | "nm" | "rm" | "um" | "ambiguous"): string {
  const [star17, star3, star2] = CYP2C19_SITES;
  const genotypes: Record<typeof kind, [string, string, string]> = {
    pm: ["0/0", "0/0", "1/1"],
    im: ["0/0", "0/0", "0/1"],
    nm: ["0/0", "0/0", "0/0"],
    rm: ["0/1", "0/0", "0/0"],
    um: ["1/1", "0/0", "0/0"],
    ambiguous: ["0/1", "0/0", "0/1"],
  };
  const sample = {
    pm: "PG-DEMO-PM",
    im: "PG-DEMO-IM",
    nm: "PG-DEMO-NM",
    rm: "PG-DEMO-RM",
    um: "PG-DEMO-UM",
    ambiguous: "PG-DEMO-UNPHASED",
  }[kind];
  const [g17, g3, g2] = genotypes[kind];
  return [
    VCF_HEAD,
    `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${sample}`,
    vcfRow(star17!, g17),
    vcfRow(star3!, g3),
    vcfRow(star2!, g2),
    "",
  ].join("\n");
}
