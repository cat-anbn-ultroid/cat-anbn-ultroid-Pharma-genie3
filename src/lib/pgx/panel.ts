export type Star = "*1" | "*2" | "*3" | "*17";

export type PanelSite = {
  rsid: string;
  star: Exclude<Star, "*1">;
  effect: "no function" | "increased function";
  hgvs: string;
  ref: string;
  alt: string;
  grch38: number;
  grch37: number;
};

/** Three defining SNPs. Positions are the public GRCh38 / GRCh37 loci for these rsIDs. */
export const CYP2C19_SITES: PanelSite[] = [
  {
    rsid: "rs12248560",
    star: "*17",
    effect: "increased function",
    hgvs: "c.-806C>T",
    ref: "C",
    alt: "T",
    grch38: 94761900,
    grch37: 96521657,
  },
  {
    rsid: "rs4986893",
    star: "*3",
    effect: "no function",
    hgvs: "c.636G>A",
    ref: "G",
    alt: "A",
    grch38: 94780653,
    grch37: 96540410,
  },
  {
    rsid: "rs4244285",
    star: "*2",
    effect: "no function",
    hgvs: "c.681G>A",
    ref: "G",
    alt: "A",
    grch38: 94781859,
    grch37: 96541616,
  },
];

export const PHENOTYPE: Record<string, string> = {
  "*1/*1": "Normal metabolizer",
  "*1/*2": "Intermediate metabolizer",
  "*1/*3": "Intermediate metabolizer",
  "*1/*17": "Rapid metabolizer",
  "*2/*2": "Poor metabolizer",
  "*2/*3": "Poor metabolizer",
  "*3/*3": "Poor metabolizer",
  "*2/*17": "Intermediate metabolizer",
  "*3/*17": "Intermediate metabolizer",
  "*17/*17": "Ultrarapid metabolizer",
};

export function starOrder(star: Star): number {
  return Number(star.slice(1));
}

export function formatDiplotype(a: Star, b: Star): string {
  const pair = [a, b].sort((left, right) => starOrder(left) - starOrder(right));
  return `${pair[0]}/${pair[1]}`;
}
