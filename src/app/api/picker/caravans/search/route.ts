import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  parseSearchParams,
  withRateLimit,
  serverError,
} from '@/lib/api-helpers';
import {
  parseCaravanQuery,
  TRGM_THRESHOLD,
} from '@/lib/catalogue/facet-tokens';

const schema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

interface RawRow {
  id: string;
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  atmKg: number | null;
  gtmKg: number | null;
  tbmKg: number | null;
  bodyLengthMm: number | null;
  axleConfiguration: string;
  freshWaterCapacityL: number | null;
  greyWaterCapacityL: number | null;
  floorplan: string | null;
  berths: number | null;
  status: string;
  modelId: string;
  modelName: string;
  modelSlug: string;
  bodyType: string;
  makeId: string;
  makeName: string;
  makeSlug: string;
}

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, schema);
  if ('error' in parsed) return parsed.error;

  const { q, limit } = parsed.data;
  const session = await auth();
  const userMatch = session?.user?.id ?? '__no_match__';

  try {
    // "jayco journey 6 berth" → {berths:6, remainder:"jayco journey"}
    const { berths, year, lengthFt, remainder } = parseCaravanQuery(q);

    const facetParts: Prisma.Sql[] = [];
    if (berths != null) facetParts.push(Prisma.sql`v.berths = ${berths}`);
    if (year != null)
      facetParts.push(
        Prisma.sql`(v."yearFrom" <= ${year} AND (v."yearTo" >= ${year} OR v."isCurrentProduction" = true))`,
      );
    if (lengthFt != null) {
      // Same ½-foot bucket the display + browse chip use, so they always agree.
      facetParts.push(
        Prisma.sql`(v."bodyLengthMm" IS NOT NULL AND round((v."bodyLengthMm"::numeric / 304.8) * 2) / 2 = ${lengthFt})`,
      );
    }
    const facetClause = facetParts.length
      ? Prisma.sql`AND ${Prisma.join(facetParts, ' AND ')}`
      : Prisma.empty;

    // Free-text remainder, tokenised so a make+model query ("jayco journey") matches
    // across columns. Each token hits some column via ILIKE (incl. floorplan) OR
    // pg_trgm word-similarity (typo tolerance).
    const term = remainder;
    const tokens = term.split(/\s+/).filter((t) => t.length >= 2);
    const tokenClauses = tokens.map((tok) => {
      const lk = `%${tok}%`;
      return Prisma.sql`(
        v.name ILIKE ${lk} OR md.name ILIKE ${lk} OR mk.name ILIKE ${lk}
        OR COALESCE(v.floorplan, '') ILIKE ${lk}
        OR word_similarity(${tok}, mk.name) > ${TRGM_THRESHOLD}
        OR word_similarity(${tok}, md.name) > ${TRGM_THRESHOLD}
        OR word_similarity(${tok}, v.name) > ${TRGM_THRESHOLD}
      )`;
    });
    const textClause = tokenClauses.length
      ? Prisma.sql`AND ${Prisma.join(tokenClauses, ' AND ')}`
      : Prisma.empty;
    const simExpr = term
      ? Prisma.sql`word_similarity(${term}, mk.name || ' ' || md.name || ' ' || v.name)`
      : Prisma.sql`0`;

    // Demote un-named OEM codes (≥6-char alnum token WITH a digit) so clean names lead.
    const crypticDemote = Prisma.sql`(CASE WHEN v.name ~ '^[A-Za-z0-9-]{6,}$' AND v.name ~ '[0-9]' THEN 1 ELSE 0 END) ASC`;

    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT v.id, v.name, v.slug, v."yearFrom", v."yearTo", v."isCurrentProduction",
        v."atmKg", v."gtmKg", v."tbmKg", v."bodyLengthMm",
        v."axleConfiguration"::text AS "axleConfiguration",
        v."freshWaterCapacityL", v."greyWaterCapacityL",
        v.floorplan, v.berths, v.status::text AS status,
        md.id AS "modelId", md.name AS "modelName", md.slug AS "modelSlug",
        md."bodyType"::text AS "bodyType",
        mk.id AS "makeId", mk.name AS "makeName", mk.slug AS "makeSlug",
        ${simExpr} AS sim
      FROM "CaravanVariant" v
      JOIN "CaravanModel" md ON v."modelId" = md.id
      JOIN "CaravanMake" mk ON md."makeId" = mk.id
      WHERE (v.status = 'CATALOGUE' OR (v.status = 'COMMUNITY' AND v."communitySubmitterId" = ${userMatch}))
      ${facetClause}
      ${textClause}
      ORDER BY ${crypticDemote},
               sim DESC, mk.name ASC, md.name ASC, v."yearFrom" DESC, v.name ASC
      LIMIT ${limit}
    `);

    const items = rows.map((v) => {
      const yearSpan = v.isCurrentProduction
        ? `${v.yearFrom}–present`
        : `${v.yearFrom}–${v.yearTo}`;
      return {
        id: v.id,
        type: 'caravan' as const,
        label: `${v.makeName} ${v.modelName} ${v.name} (${yearSpan})`,
        make: v.makeName,
        makeId: v.makeId,
        makeSlug: v.makeSlug,
        model: v.modelName,
        modelId: v.modelId,
        modelSlug: v.modelSlug,
        variant: v.name,
        variantSlug: v.slug,
        yearSpan,
        specs: {
          atmKg: v.atmKg,
          gtmKg: v.gtmKg,
          tbmKg: v.tbmKg,
          bodyLengthMm: v.bodyLengthMm,
          axleConfiguration: v.axleConfiguration,
          bodyType: v.bodyType,
          freshWaterCapacityL: v.freshWaterCapacityL,
          greyWaterCapacityL: v.greyWaterCapacityL,
          floorplan: v.floorplan,
          berths: v.berths,
        },
        confidenceBadge: (v.status === 'COMMUNITY'
          ? 'community'
          : 'manufacturer_spec') as 'community' | 'manufacturer_spec',
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    return serverError(err);
  }
}
