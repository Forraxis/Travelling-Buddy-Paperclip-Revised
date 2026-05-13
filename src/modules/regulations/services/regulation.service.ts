import type { PrismaClient } from "@prisma/client";
import type {
  RegulationData,
  RegulationSetDto,
  RegulationVersionDto,
} from "../types/regulation.types";
import { defaultRegulationData } from "../types/regulation.types";

export function createRegulationService(prisma: PrismaClient) {
  async function listSets(): Promise<RegulationSetDto[]> {
    const sets = await prisma.regulationSet.findMany({
      orderBy: [{ market: "asc" }, { code: "asc" }],
      include: {
        versions: {
          where: { effectiveDate: { lte: new Date() } },
          orderBy: { effectiveDate: "desc" },
          take: 1,
          select: {
            id: true,
            effectiveDate: true,
            createdAt: true,
          },
        },
        _count: { select: { versions: true } },
      },
    });

    return sets.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      market: s.market,
      parentSetCode: s.parentSetCode,
      currentVersionId: s.versions[0]?.id ?? null,
      currentVersionDate: s.versions[0]?.effectiveDate ?? null,
      currentVersionNumber: s._count.versions,
      lastUpdatedAt: s.updatedAt,
    }));
  }

  async function getSetByCode(
    code: string
  ): Promise<{ set: RegulationSetDto; currentData: RegulationData } | null> {
    const s = await prisma.regulationSet.findUnique({
      where: { code },
      include: {
        versions: {
          where: { effectiveDate: { lte: new Date() } },
          orderBy: { effectiveDate: "desc" },
          take: 1,
        },
        _count: { select: { versions: true } },
      },
    });
    if (!s) return null;

    const currentVersion = s.versions[0];
    const currentData = currentVersion
      ? (currentVersion.data as unknown as RegulationData)
      : defaultRegulationData;

    return {
      set: {
        id: s.id,
        code: s.code,
        name: s.name,
        market: s.market,
        parentSetCode: s.parentSetCode,
        currentVersionId: currentVersion?.id ?? null,
        currentVersionDate: currentVersion?.effectiveDate ?? null,
        currentVersionNumber: s._count.versions,
        lastUpdatedAt: s.updatedAt,
      },
      currentData,
    };
  }

  async function listVersions(code: string): Promise<RegulationVersionDto[]> {
    const set = await prisma.regulationSet.findUnique({ where: { code } });
    if (!set) return [];

    const versions = await prisma.regulationSetVersion.findMany({
      where: { setId: set.id },
      orderBy: { effectiveDate: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return versions.map((v, idx) => ({
      id: v.id,
      setId: v.setId,
      effectiveDate: v.effectiveDate,
      changeSummary: v.changeSummary,
      data: v.data as unknown as RegulationData,
      createdById: v.createdById,
      createdByName: v.createdBy.name,
      createdAt: v.createdAt,
      versionNumber: versions.length - idx,
    }));
  }

  async function getVersion(id: string): Promise<RegulationVersionDto | null> {
    const v = await prisma.regulationSetVersion.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        set: { select: { versions: { select: { id: true }, orderBy: { effectiveDate: "asc" } } } },
      },
    });
    if (!v) return null;

    const versionNumber = v.set.versions.findIndex((x) => x.id === id) + 1;
    return {
      id: v.id,
      setId: v.setId,
      effectiveDate: v.effectiveDate,
      changeSummary: v.changeSummary,
      data: v.data as unknown as RegulationData,
      createdById: v.createdById,
      createdByName: v.createdBy.name,
      createdAt: v.createdAt,
      versionNumber,
    };
  }

  async function saveVersion(
    code: string,
    data: RegulationData,
    effectiveDate: Date,
    changeSummary: string,
    createdById: string
  ): Promise<RegulationVersionDto> {
    const set = await prisma.regulationSet.findUnique({ where: { code } });
    if (!set) throw new Error(`Regulation set not found: ${code}`);

    const version = await prisma.regulationSetVersion.create({
      data: {
        setId: set.id,
        effectiveDate,
        changeSummary,
        data: JSON.parse(JSON.stringify(data)),
        createdById,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await prisma.regulationSet.update({
      where: { id: set.id },
      data: { rules: JSON.parse(JSON.stringify(data)) },
    });

    const totalVersions = await prisma.regulationSetVersion.count({
      where: { setId: set.id },
    });

    return {
      id: version.id,
      setId: version.setId,
      effectiveDate: version.effectiveDate,
      changeSummary: version.changeSummary,
      data: version.data as unknown as RegulationData,
      createdById: version.createdById,
      createdByName: version.createdBy.name,
      createdAt: version.createdAt,
      versionNumber: totalVersions,
    };
  }

  return { listSets, getSetByCode, listVersions, getVersion, saveVersion };
}
