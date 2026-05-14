import fs from "fs";
import path from "path";
import matter from "gray-matter";

const GUIDES_DIR = path.join(process.cwd(), "src/content/guides");

export type GuideCategory =
  | "regulatory"
  | "state-guidance"
  | "accessory-category"
  | "decision";

export interface GuideFrontmatter {
  title: string;
  slug: string;
  description: string;
  category: GuideCategory;
  tags: string[];
  last_updated: string;
  regulatory_references?: string[];
}

export interface GuideFile {
  frontmatter: GuideFrontmatter;
  content: string;
}

export function getAllGuideSlugs(): string[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx?$/, ""));
}

export function getGuideBySlug(slug: string): GuideFile | null {
  const mdxPath = path.join(GUIDES_DIR, `${slug}.mdx`);
  const mdPath = path.join(GUIDES_DIR, `${slug}.md`);
  const filePath = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null;
  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    frontmatter: data as GuideFrontmatter,
    content,
  };
}

export function getAllGuides(): GuideFile[] {
  return getAllGuideSlugs()
    .map(getGuideBySlug)
    .filter((g): g is GuideFile => g !== null);
}
