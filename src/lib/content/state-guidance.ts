import fs from "fs";
import path from "path";
import matter from "gray-matter";

const STATE_GUIDANCE_DIR = path.join(process.cwd(), "src/content/state-guidance");

export const AU_STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "nt", "act"] as const;
export type AUStateCode = (typeof AU_STATES)[number];

export const STATE_NAMES: Record<AUStateCode, string> = {
  nsw: "New South Wales",
  vic: "Victoria",
  qld: "Queensland",
  wa: "Western Australia",
  sa: "South Australia",
  tas: "Tasmania",
  nt: "Northern Territory",
  act: "Australian Capital Territory",
};

export const STATE_AUTHORITY: Record<AUStateCode, { name: string; url: string }> = {
  nsw: { name: "Transport for NSW", url: "https://www.transport.nsw.gov.au/" },
  vic: { name: "VicRoads", url: "https://www.vicroads.vic.gov.au/" },
  qld: { name: "Transport and Main Roads QLD", url: "https://www.tmr.qld.gov.au/" },
  wa: { name: "Department of Transport WA", url: "https://www.transport.wa.gov.au/" },
  sa: { name: "Department for Infrastructure and Transport SA", url: "https://dit.sa.gov.au/" },
  tas: { name: "Department of State Growth TAS", url: "https://www.transport.tas.gov.au/" },
  nt: { name: "Department of Infrastructure, Planning and Logistics NT", url: "https://nt.gov.au/driving" },
  act: { name: "Access Canberra", url: "https://www.accesscanberra.act.gov.au/" },
};

export interface StateGuidanceFrontmatter {
  title: string;
  slug: string;
  description: string;
  state: AUStateCode;
  regulation_set_code: string;
  last_reviewed: string;
  tags?: string[];
  regulatory_references?: string[];
}

export interface StateGuidanceFile {
  frontmatter: StateGuidanceFrontmatter;
  content: string;
  stateCode: AUStateCode;
  topicSlug: string;
}

function stateDirPath(stateCode: string): string {
  return path.join(STATE_GUIDANCE_DIR, stateCode);
}

export function getAllStateGuidanceParams(): { stateCode: string; topic: string }[] {
  if (!fs.existsSync(STATE_GUIDANCE_DIR)) return [];
  const params: { stateCode: string; topic: string }[] = [];
  for (const state of AU_STATES) {
    const dir = stateDirPath(state);
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
    for (const file of files) {
      params.push({ stateCode: state, topic: file.replace(/\.mdx?$/, "") });
    }
  }
  return params;
}

export function getTopicSlugsForState(stateCode: AUStateCode): string[] {
  const dir = stateDirPath(stateCode);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx?$/, ""));
}

export function getStateGuidance(
  stateCode: string,
  topicSlug: string
): StateGuidanceFile | null {
  if (!AU_STATES.includes(stateCode as AUStateCode)) return null;
  const dir = stateDirPath(stateCode);
  const mdxPath = path.join(dir, `${topicSlug}.mdx`);
  const mdPath = path.join(dir, `${topicSlug}.md`);
  const filePath = fs.existsSync(mdxPath)
    ? mdxPath
    : fs.existsSync(mdPath)
      ? mdPath
      : null;
  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    frontmatter: data as StateGuidanceFrontmatter,
    content,
    stateCode: stateCode as AUStateCode,
    topicSlug,
  };
}
