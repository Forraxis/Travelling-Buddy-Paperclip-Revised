import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFitmentService,
  VEHICLE_BASE_LOCATIONS,
} from '../services/fitment.service';
import type { FitmentService } from '../services/fitment.service';

function makePrismaModel() {
  return {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
  };
}

function createMockPrisma() {
  return { accessoryFitment: makePrismaModel() };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const now = new Date('2026-01-01T00:00:00Z');

function makeDecimal(n: number) {
  return { toNumber: () => n };
}

const FITMENT_BULLBAR: Record<string, unknown> = {
  id: 'fit-1',
  accessoryId: 'acc-1',
  vehicleVariantId: 'vv-1',
  caravanVariantId: null,
  installedWeightKg: makeDecimal(45),
  positionType: 'FIXED',
  cogXMm: -800,
  cogYMm: 0,
  startXMm: -900,
  endXMm: -700,
  mountingLocation: 'CHASSIS_FRONT',
  providesMountingLocations: ['BULL_BAR'],
  mountOffsetXMm: -900,
  mountOffsetYMm: 0,
  mountOffsetZMm: 0,
  tankCapacityL: null,
  tankContentsKgPerL: null,
  confidence: 'MANUFACTURER_SPEC',
  source: 'AFTERMARKET_VERIFIED',
  notes: null,
  verifiedById: null,
  createdAt: now,
  updatedAt: now,
};

const FITMENT_WINCH: Record<string, unknown> = {
  id: 'fit-2',
  accessoryId: 'acc-2',
  vehicleVariantId: 'vv-1',
  caravanVariantId: null,
  installedWeightKg: makeDecimal(18),
  positionType: 'FIXED',
  cogXMm: -50,
  cogYMm: 0,
  startXMm: null,
  endXMm: null,
  mountingLocation: 'BULL_BAR',
  providesMountingLocations: [],
  mountOffsetXMm: -50,
  mountOffsetYMm: 0,
  mountOffsetZMm: 0,
  tankCapacityL: null,
  tankContentsKgPerL: null,
  confidence: 'MANUFACTURER_SPEC',
  source: 'AFTERMARKET_VERIFIED',
  notes: null,
  verifiedById: null,
  createdAt: now,
  updatedAt: now,
};

let prisma: MockPrisma;
let service: FitmentService;

beforeEach(() => {
  prisma = createMockPrisma();
  service = createFitmentService(prisma as never);
});

// ── CRUD ───────────────────────────────────────────

describe('Fitment CRUD', () => {
  it('create calls prisma.accessoryFitment.create and converts Decimal', async () => {
    prisma.accessoryFitment.create.mockResolvedValue(FITMENT_BULLBAR);
    const result = await service.create({
      accessoryId: 'acc-1',
      vehicleVariantId: 'vv-1',
      installedWeightKg: 45,
      positionType: 'FIXED',
      mountingLocation: 'CHASSIS_FRONT',
    });
    expect(prisma.accessoryFitment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accessoryId: 'acc-1' }),
    });
    expect(result.installedWeightKg).toBe(45);
  });

  it('update calls prisma.accessoryFitment.update', async () => {
    const updated = { ...FITMENT_BULLBAR, notes: 'Updated notes' };
    prisma.accessoryFitment.update.mockResolvedValue(updated);
    const result = await service.update('fit-1', { notes: 'Updated notes' });
    expect(result.notes).toBe('Updated notes');
    expect(prisma.accessoryFitment.update).toHaveBeenCalledWith({
      where: { id: 'fit-1' },
      data: { notes: 'Updated notes' },
    });
  });

  it('remove calls prisma.accessoryFitment.delete', async () => {
    prisma.accessoryFitment.delete.mockResolvedValue(FITMENT_BULLBAR);
    await service.remove('fit-1');
    expect(prisma.accessoryFitment.delete).toHaveBeenCalledWith({
      where: { id: 'fit-1' },
    });
  });

  it('getById returns fitment with converted Decimal', async () => {
    prisma.accessoryFitment.findUnique.mockResolvedValue(FITMENT_BULLBAR);
    const result = await service.getById('fit-1');
    expect(result).not.toBeNull();
    expect(result!.installedWeightKg).toBe(45);
  });

  it('getById returns null for non-existent id', async () => {
    prisma.accessoryFitment.findUnique.mockResolvedValue(null);
    expect(await service.getById('nope')).toBeNull();
  });

  it('getFitmentsForVehicleVariant queries by vehicleVariantId', async () => {
    prisma.accessoryFitment.findMany.mockResolvedValue([FITMENT_BULLBAR]);
    const results = await service.getFitmentsForVehicleVariant('vv-1');
    expect(results).toHaveLength(1);
    expect(prisma.accessoryFitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vehicleVariantId: 'vv-1' } }),
    );
  });

  it('getFitmentsForCaravanVariant queries by caravanVariantId', async () => {
    prisma.accessoryFitment.findMany.mockResolvedValue([]);
    await service.getFitmentsForCaravanVariant('cv-1');
    expect(prisma.accessoryFitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { caravanVariantId: 'cv-1' } }),
    );
  });

  it('getFitmentsForAccessory queries by accessoryId', async () => {
    prisma.accessoryFitment.findMany.mockResolvedValue([FITMENT_BULLBAR]);
    const results = await service.getFitmentsForAccessory('acc-1');
    expect(results).toHaveLength(1);
    expect(prisma.accessoryFitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accessoryId: 'acc-1' } }),
    );
  });
});

// ── Decimal conversion ─────────────────────────────

describe('Fitment Decimal conversion', () => {
  it('converts null tankCapacityL and tankContentsKgPerL to null', async () => {
    prisma.accessoryFitment.findUnique.mockResolvedValue(FITMENT_BULLBAR);
    const result = await service.getById('fit-1');
    expect(result!.tankCapacityL).toBeNull();
    expect(result!.tankContentsKgPerL).toBeNull();
  });

  it('converts tank Decimals when present', async () => {
    const withTank = {
      ...FITMENT_BULLBAR,
      tankCapacityL: makeDecimal(130),
      tankContentsKgPerL: makeDecimal(0.74),
    };
    prisma.accessoryFitment.findUnique.mockResolvedValue(withTank);
    const result = await service.getById('fit-1');
    expect(result!.tankCapacityL).toBe(130);
    expect(result!.tankContentsKgPerL).toBe(0.74);
  });
});

// ── Mounting location resolution ───────────────────

describe('getAvailableMountingLocations', () => {
  it('returns all base vehicle locations when no fitments installed', async () => {
    const result = await service.getAvailableMountingLocations('vv-1', []);
    expect(result).toContain('CHASSIS_FRONT');
    expect(result).toContain('CHASSIS_MID');
    expect(result).toContain('REAR_BAR');
    expect(result).not.toContain('BULL_BAR');
  });

  it('adds provided locations when a bullbar is installed', async () => {
    prisma.accessoryFitment.findMany.mockResolvedValue([
      {
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
      },
    ]);
    const result = await service.getAvailableMountingLocations('vv-1', [
      'fit-1',
    ]);
    expect(result).toContain('BULL_BAR');
  });

  it('removes the occupied mountingLocation after installation', async () => {
    prisma.accessoryFitment.findMany.mockResolvedValue([
      {
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
      },
    ]);
    const result = await service.getAvailableMountingLocations('vv-1', [
      'fit-1',
    ]);
    // CHASSIS_FRONT is now occupied by the bullbar
    expect(result).not.toContain('CHASSIS_FRONT');
  });

  it('provides BULL_BAR but winch installation removes it', async () => {
    prisma.accessoryFitment.findMany.mockResolvedValue([
      {
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
      },
      { mountingLocation: 'BULL_BAR', providesMountingLocations: [] },
    ]);
    const result = await service.getAvailableMountingLocations('vv-1', [
      'fit-1',
      'fit-2',
    ]);
    expect(result).not.toContain('BULL_BAR');
    expect(result).not.toContain('CHASSIS_FRONT');
  });

  it('supports multiple fitments providing multiple locations', async () => {
    prisma.accessoryFitment.findMany.mockResolvedValue([
      {
        mountingLocation: 'ROOF_RACK',
        providesMountingLocations: ['CANOPY_ROOF'],
      },
      {
        mountingLocation: 'REAR_BAR',
        providesMountingLocations: ['TOW_HITCH'],
      },
    ]);
    const result = await service.getAvailableMountingLocations('vv-1', [
      'fit-a',
      'fit-b',
    ]);
    expect(result).toContain('CANOPY_ROOF');
    expect(result).toContain('TOW_HITCH');
    expect(result).not.toContain('ROOF_RACK');
    expect(result).not.toContain('REAR_BAR');
  });
});

// ── Position chain resolution ──────────────────────

describe('resolvePositionChain', () => {
  it('resolves absolute CoG X without parent (mountOffset + cogX)', async () => {
    prisma.accessoryFitment.findUniqueOrThrow.mockResolvedValue({
      cogXMm: -50,
      mountOffsetXMm: -900,
    });
    const result = await service.resolvePositionChain('fit-1');
    // -900 + -50 = -950
    expect(result.absoluteCogXMm).toBe(-950);
    expect(result.parentCogXMm).toBeNull();
  });

  it('resolves absolute CoG X with parent (parentCogX + mountOffset + cogX)', async () => {
    prisma.accessoryFitment.findUniqueOrThrow
      .mockResolvedValueOnce({ cogXMm: -50, mountOffsetXMm: 0 })
      .mockResolvedValueOnce({ cogXMm: -800 });
    const result = await service.resolvePositionChain('fit-2', 'fit-1');
    // -800 (parent cogX) + 0 (mount offset) + -50 (fitment cogX) = -850
    expect(result.absoluteCogXMm).toBe(-850);
    expect(result.parentCogXMm).toBe(-800);
    expect(result.fitmentCogXMm).toBe(-50);
  });

  it('treats null cogXMm and mountOffsetXMm as zero', async () => {
    prisma.accessoryFitment.findUniqueOrThrow.mockResolvedValue({
      cogXMm: null,
      mountOffsetXMm: null,
    });
    const result = await service.resolvePositionChain('fit-1');
    expect(result.absoluteCogXMm).toBe(0);
  });

  it('treats null parent cogXMm as zero in chain', async () => {
    prisma.accessoryFitment.findUniqueOrThrow
      .mockResolvedValueOnce({ cogXMm: -100, mountOffsetXMm: -200 })
      .mockResolvedValueOnce({ cogXMm: null });
    const result = await service.resolvePositionChain('fit-2', 'fit-parent');
    // 0 + -200 + -100 = -300
    expect(result.absoluteCogXMm).toBe(-300);
  });
});

// ── Mounting compatibility validation ──────────────

describe('validateMountingCompatibility', () => {
  it('returns compatible=true when parent provides required location', async () => {
    prisma.accessoryFitment.findUniqueOrThrow
      .mockResolvedValueOnce({ mountingLocation: 'BULL_BAR' })
      .mockResolvedValueOnce({
        providesMountingLocations: ['BULL_BAR', 'TRAY_FLOOR'],
      });
    const result = await service.validateMountingCompatibility(
      'fit-winch',
      'fit-bullbar',
    );
    expect(result.compatible).toBe(true);
    expect(result.requiredLocation).toBe('BULL_BAR');
  });

  it('returns compatible=false when parent does not provide required location', async () => {
    prisma.accessoryFitment.findUniqueOrThrow
      .mockResolvedValueOnce({ mountingLocation: 'BULL_BAR' })
      .mockResolvedValueOnce({ providesMountingLocations: ['TRAY_FLOOR'] });
    const result = await service.validateMountingCompatibility(
      'fit-winch',
      'fit-tray',
    );
    expect(result.compatible).toBe(false);
    expect(result.requiredLocation).toBe('BULL_BAR');
    expect(result.parentProvides).toEqual(['TRAY_FLOOR']);
  });

  it('returns compatible=false when parent provides nothing', async () => {
    prisma.accessoryFitment.findUniqueOrThrow
      .mockResolvedValueOnce({ mountingLocation: 'BULL_BAR' })
      .mockResolvedValueOnce({ providesMountingLocations: [] });
    const result = await service.validateMountingCompatibility(
      'fit-winch',
      'fit-chassis',
    );
    expect(result.compatible).toBe(false);
    expect(result.parentProvides).toHaveLength(0);
  });

  it('returns all parentProvides in result for caller inspection', async () => {
    prisma.accessoryFitment.findUniqueOrThrow
      .mockResolvedValueOnce({ mountingLocation: 'BULL_BAR' })
      .mockResolvedValueOnce({
        providesMountingLocations: ['BULL_BAR', 'SNORKEL', 'CANOPY_EXTERIOR'],
      });
    const result = await service.validateMountingCompatibility(
      'fit-winch',
      'fit-bullbar',
    );
    expect(result.parentProvides).toEqual([
      'BULL_BAR',
      'SNORKEL',
      'CANOPY_EXTERIOR',
    ]);
  });
});

// ── VEHICLE_BASE_LOCATIONS export ─────────────────

describe('VEHICLE_BASE_LOCATIONS', () => {
  it('includes essential vehicle mounting points', () => {
    expect(VEHICLE_BASE_LOCATIONS.has('CHASSIS_FRONT')).toBe(true);
    expect(VEHICLE_BASE_LOCATIONS.has('TOW_HITCH')).toBe(true);
    expect(VEHICLE_BASE_LOCATIONS.has('CABIN_INTERIOR')).toBe(true);
  });

  it('does not include accessory-provided locations like BULL_BAR', () => {
    expect(VEHICLE_BASE_LOCATIONS.has('BULL_BAR')).toBe(false);
  });
});
