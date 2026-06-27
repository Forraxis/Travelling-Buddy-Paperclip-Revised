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
  parseVehicleQuery,
  driveTypeToDbLabel,
  driveTypeFromDbLabel,
  TRGM_THRESHOLD,
} from '@/lib/catalogue/facet-tokens';

const schema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// Raw row shape (enum columns selected ::text so we control the mapping).
interface RawRow {
  id: string;
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  gvmKg: number | null;
  gcmKg: number | null;
  maxTowingCapacityKg: number | null;
  kerbWeightKg: number | null;
  fuelType: string | null;
  status: string;
  generation: string | null;
  cabType: string | null;
  driveType: string | null;
  badge: string | null;
  transmission: string | null;
  buildOrigin: string | null;
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
    // Split the query into exact facet filters + a free-text remainder.
    // "navara 4x4 dual cab" → {driveType:4X4, cabType:DUAL_CAB, remainder:"navara"}
    const { driveType, cabType, year, buildOrigin, remainder } =
      parseVehicleQuery(q);

    const facet: Prisma.Sql[] = [];
    if (driveType)
      facet.push(
        Prisma.sql`v."driveType"::text = ${driveTypeToDbLabel(driveType)}`,
      );
    if (cabType) facet.push(Prisma.sql`v."cabType"::text = ${cabType}`);
    if (buildOrigin) facet.push(Prisma.sql`v."buildOrigin" = ${buildOrigin}`);
    if (year != null)
      facet.push(
        Prisma.sql`(v."yearFrom" <= ${year} AND (v."yearTo" >= ${year} OR v."isCurrentProduction" = true))`,
      );
    const facetClause = facet.length
      ? Prisma.sql`AND ${Prisma.join(facet, ' AND ')}`
      : Prisma.empty;

    // Free-text remainder: tokenise so a make+model query ("toyota hilux") matches
    // across columns. Each token must hit SOME column via substring ILIKE (incl.
    // badge/generation) OR pg_trgm word-similarity for typo tolerance ("navarra"→Navara).
    const term = remainder;
    const tokens = term.split(/\s+/).filter((t) => t.length >= 2);
    const tokenClauses = tokens.map((tok) => {
      const lk = `%${tok}%`;
      return Prisma.sql`(
        v.name ILIKE ${lk} OR md.name ILIKE ${lk} OR mk.name ILIKE ${lk}
        OR COALESCE(v.badge, '') ILIKE ${lk}
        OR COALESCE(v.generation, '') ILIKE ${lk}
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

    // Demote un-named OEM codes (≥6-char alnum token WITH a digit) to the bottom
    // so clean names lead. A digit is required so single-word trims (PLATINUM) stay.
    const crypticDemote = Prisma.sql`(CASE WHEN v.name ~ '^[A-Za-z0-9-]{6,}$' AND v.name ~ '[0-9]' THEN 1 ELSE 0 END) ASC`;

    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT v.id, v.name, v.slug, v."yearFrom", v."yearTo", v."isCurrentProduction",
        v."gvmKg", v."gcmKg", v."maxTowingCapacityKg", v."kerbWeightKg",
        v."fuelType"::text AS "fuelType", v.status::text AS status,
        v.generation, v."cabType"::text AS "cabType",
        v."driveType"::text AS "driveType", v.badge, v.transmission,
        v."buildOrigin",
        md.id AS "modelId", md.name AS "modelName", md.slug AS "modelSlug",
        md."bodyType"::text AS "bodyType",
        mk.id AS "makeId", mk.name AS "makeName", mk.slug AS "makeSlug",
        ${simExpr} AS sim
      FROM "VehicleVariant" v
      JOIN "VehicleModel" md ON v."modelId" = md.id
      JOIN "VehicleMake" mk ON md."makeId" = mk.id
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
        type: 'vehicle' as const,
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
          gvmKg: v.gvmKg,
          gcmKg: v.gcmKg,
          maxTowingCapacityKg: v.maxTowingCapacityKg,
          kerbWeightKg: v.kerbWeightKg,
          fuelType: v.fuelType,
          bodyType: v.bodyType,
          generation: v.generation,
          cabType: v.cabType,
          driveType: driveTypeFromDbLabel(v.driveType),
          badge: v.badge,
          transmission: v.transmission,
          buildOrigin: v.buildOrigin,
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
