import { parse } from "yaml";
import { z } from "zod";
import cvSource from "../data/cv.yml?raw";
import publicationSource from "../data/publications.yml?raw";
import siteSource from "../data/site.yml?raw";

const requiredString = z.string().trim().min(1);
const email = z.string().trim().pipe(z.email());

export function isExternalHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function isSupportedLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.hostname.length > 0;
    }
    if (url.protocol === "mailto:") {
      return email.safeParse(decodeURIComponent(url.pathname)).success;
    }
    return false;
  } catch {
    return false;
  }
}

const urlLike = requiredString.refine(
  isSupportedLinkUrl,
  "Must be a valid HTTP(S) URL or mailto URL with a valid recipient",
);
const linkSchema = z.object({ label: requiredString, url: urlLike }).strict();

const siteSchema = z
  .object({
    name: requiredString,
    role: requiredString,
    institution: requiredString,
    location: requiredString,
    email,
    availability: requiredString,
    tagline: requiredString,
    summary: requiredString,
    portrait: z
      .object({
        src: requiredString.refine((value) => value.startsWith("/"), "Must be an absolute path"),
        alt: requiredString,
      })
      .strict(),
    researchAreas: z
      .array(z.object({ title: requiredString, description: requiredString }).strict())
      .length(3),
    selectedPublications: z.array(requiredString).min(1),
    links: z.array(linkSchema).min(1),
  })
  .strict();

const publicationSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: requiredString,
    authors: requiredString,
    venue: requiredString,
    year: z.number().int().min(1900),
    type: z.enum(["journal", "conference"]),
    summary: requiredString,
    selected: z.boolean().default(false),
    links: z.array(linkSchema).default([]),
  })
  .strict();

const cvSchema = z
  .object({
    education: z
      .array(
        z
          .object({
            degree: requiredString,
            institution: requiredString,
            period: requiredString,
            detail: requiredString.optional(),
          })
          .strict(),
      )
      .min(1),
    projects: z.array(
      z
        .object({
          title: requiredString,
          organization: requiredString,
          period: requiredString,
          highlights: z.array(requiredString).min(1),
        })
        .strict(),
    ),
    teaching: z.array(
      z
        .object({
          role: requiredString,
          course: requiredString,
          institution: requiredString,
          period: requiredString,
        })
        .strict(),
    ),
    skills: z
      .object({
        Programming: z.array(requiredString).min(1),
        "EDA / Simulation": z.array(requiredString).min(1),
        Languages: z.array(requiredString).min(1),
      })
      .strict(),
  })
  .strict();

export function resolveSelectedPublications<T extends { id: string; selected: boolean }>(
  items: T[],
  selectedIds: string[],
): T[] {
  const publicationById = new Map<string, T>();
  const selectedIdSet = new Set<string>();

  for (const item of items) {
    if (publicationById.has(item.id)) {
      throw new Error(`Duplicate publication ID: "${item.id}"`);
    }
    publicationById.set(item.id, item);
  }

  for (const id of selectedIds) {
    if (selectedIdSet.has(id)) {
      throw new Error(`Duplicate selected publication ID: "${id}"`);
    }
    selectedIdSet.add(id);
  }

  const selected = selectedIds.map((id) => {
    const publication = publicationById.get(id);
    if (!publication) {
      throw new Error(`Unknown selected publication ID: "${id}"`);
    }
    if (!publication.selected) {
      throw new Error(
        `Selected publication mismatch: "${id}" is listed in site.yml but selected is false`,
      );
    }
    return publication;
  });

  for (const publication of items) {
    if (publication.selected && !selectedIdSet.has(publication.id)) {
      throw new Error(
        `Selected publication mismatch: "${publication.id}" is selected in publications.yml but missing from site.yml`,
      );
    }
  }

  return selected;
}

interface ContentSources {
  siteSource: string;
  publicationSource: string;
  cvSource: string;
}

function parseContentSource<T>(filename: string, source: string, schema: z.ZodType<T>): T {
  try {
    return schema.parse(parse(source));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${filename}: ${message}`, { cause: error });
  }
}

export function loadPortfolioContent(sources: ContentSources) {
  const site = parseContentSource("site.yml", sources.siteSource, siteSchema);
  const publications = parseContentSource(
    "publications.yml",
    sources.publicationSource,
    z.array(publicationSchema),
  ).sort((a, b) => b.year - a.year);
  const cv = parseContentSource("cv.yml", sources.cvSource, cvSchema);
  const selectedPublications = resolveSelectedPublications(publications, site.selectedPublications);

  return { site, publications, cv, selectedPublications };
}

export const { site, publications, cv, selectedPublications } = loadPortfolioContent({
  siteSource,
  publicationSource,
  cvSource,
});
