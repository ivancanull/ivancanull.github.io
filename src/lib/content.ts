import { parse } from "yaml";
import { z } from "zod";
import cvSource from "../data/cv.yml?raw";
import publicationSource from "../data/publications.yml?raw";
import siteSource from "../data/site.yml?raw";

const requiredString = z.string().min(1);
const urlLike = z
  .string()
  .refine((value) => /^(https?:\/\/|mailto:)/.test(value), "Must be an HTTP(S) or mailto URL");
const linkSchema = z.object({ label: requiredString, url: urlLike }).strict();

const siteSchema = z
  .object({
    name: requiredString,
    role: requiredString,
    institution: requiredString,
    location: requiredString,
    email: z.email(),
    availability: requiredString,
    tagline: requiredString,
    summary: requiredString,
    portrait: z.object({ src: z.string().startsWith("/"), alt: requiredString }).strict(),
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
    education: z.array(
      z
        .object({
          degree: requiredString,
          institution: requiredString,
          period: requiredString,
          detail: requiredString.optional(),
        })
        .strict(),
    ),
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

export function resolveSelectedPublications<T extends { id: string }>(
  items: T[],
  selectedIds: string[],
): T[] {
  const publicationById = new Map<string, T>();

  for (const item of items) {
    if (publicationById.has(item.id)) {
      throw new Error(`Duplicate publication ID: "${item.id}"`);
    }
    publicationById.set(item.id, item);
  }

  return selectedIds.map((id) => {
    const publication = publicationById.get(id);
    if (!publication) {
      throw new Error(`Unknown selected publication ID: "${id}"`);
    }
    return publication;
  });
}

export const site = siteSchema.parse(parse(siteSource));
export const publications = z
  .array(publicationSchema)
  .parse(parse(publicationSource))
  .sort((a, b) => b.year - a.year);
export const cv = cvSchema.parse(parse(cvSource));
export const selectedPublications = resolveSelectedPublications(
  publications,
  site.selectedPublications,
);
