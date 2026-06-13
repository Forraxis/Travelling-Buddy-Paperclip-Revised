import { config as loadDotenv } from 'dotenv';
// jiti doesn't load .env files automatically; load .env.local first so
// DATABASE_URL is available when running `npx prisma db seed`.
loadDotenv({ path: '.env.local' });
loadDotenv(); // fallback to .env if .env.local doesn't have the var

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type {
  MountingLocation,
  PositionType,
  FitmentConfidence,
  FitmentSource,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Vehicle seed data
// ---------------------------------------------------------------------------

const vehicleMakes = [
  { name: 'Toyota', slug: 'toyota', countryOfOrigin: 'Japan' },
  { name: 'Ford', slug: 'ford', countryOfOrigin: 'USA' },
  { name: 'Nissan', slug: 'nissan', countryOfOrigin: 'Japan' },
  { name: 'Mitsubishi', slug: 'mitsubishi', countryOfOrigin: 'Japan' },
  { name: 'Isuzu', slug: 'isuzu', countryOfOrigin: 'Japan' },
  { name: 'Mazda', slug: 'mazda', countryOfOrigin: 'Japan' },
  { name: 'Land Rover', slug: 'land-rover', countryOfOrigin: 'UK' },
  { name: 'Jeep', slug: 'jeep', countryOfOrigin: 'USA' },
] as const;

type VehicleBodyType =
  | 'DUAL_CAB_UTE'
  | 'SINGLE_CAB_UTE'
  | 'EXTRA_CAB_UTE'
  | 'WAGON'
  | 'SUV'
  | 'VAN'
  | 'TROOPCARRIER'
  | 'OTHER';

type FuelType = 'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC';

interface VehicleVariantSeed {
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  gvmKg: number;
  gcmKg: number;
  kerbWeightKg: number;
  maxTowingCapacityKg: number;
  frontAxleLimitKg: number;
  rearAxleLimitKg: number;
  wheelbaseMm: number;
  frontOverhangMm?: number;
  rearOverhangMm?: number;
  totalLengthMm?: number;
  maxTowBallDownloadKg: number;
  fuelTankCapacityL: number;
  fuelType: FuelType;
}

interface VehicleModelSeed {
  name: string;
  slug: string;
  bodyType: VehicleBodyType;
  variants: VehicleVariantSeed[];
}

interface VehicleMakeSeed {
  name: string;
  slug: string;
  countryOfOrigin: string;
  models: VehicleModelSeed[];
}

const vehicleData: VehicleMakeSeed[] = [
  {
    name: 'Toyota',
    slug: 'toyota',
    countryOfOrigin: 'Japan',
    models: [
      {
        name: 'HiLux',
        slug: 'hilux',
        bodyType: 'DUAL_CAB_UTE',
        variants: [
          {
            name: 'SR5 Auto 4x4',
            slug: 'sr5-auto-4x4-2015-2022',
            yearFrom: 2015,
            yearTo: 2022,
            isCurrentProduction: false,
            gvmKg: 3350,
            gcmKg: 6350,
            kerbWeightKg: 2115,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1450,
            rearAxleLimitKg: 1700,
            wheelbaseMm: 3085,
            frontOverhangMm: 935,
            rearOverhangMm: 1280,
            totalLengthMm: 5300,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
          {
            name: 'SR5 Auto 4x4',
            slug: 'sr5-auto-4x4-2023-2026',
            yearFrom: 2023,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3350,
            gcmKg: 6350,
            kerbWeightKg: 2170,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1450,
            rearAxleLimitKg: 1700,
            wheelbaseMm: 3085,
            frontOverhangMm: 935,
            rearOverhangMm: 1280,
            totalLengthMm: 5315,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
          {
            name: 'WorkMate 4x2',
            slug: 'workmate-4x2-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3175,
            gcmKg: 5675,
            kerbWeightKg: 1930,
            maxTowingCapacityKg: 2500,
            frontAxleLimitKg: 1350,
            rearAxleLimitKg: 1600,
            wheelbaseMm: 3085,
            frontOverhangMm: 935,
            rearOverhangMm: 1280,
            totalLengthMm: 5300,
            maxTowBallDownloadKg: 250,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'LandCruiser 200 Series',
        slug: 'landcruiser-200-series',
        bodyType: 'WAGON',
        variants: [
          {
            name: 'GXL Diesel',
            slug: 'gxl-diesel-2012-2021',
            yearFrom: 2012,
            yearTo: 2021,
            isCurrentProduction: false,
            gvmKg: 3355,
            gcmKg: 6855,
            kerbWeightKg: 2690,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1680,
            rearAxleLimitKg: 1720,
            wheelbaseMm: 2850,
            frontOverhangMm: 880,
            rearOverhangMm: 1020,
            totalLengthMm: 4950,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 93,
            fuelType: 'DIESEL',
          },
          {
            name: 'Sahara Diesel',
            slug: 'sahara-diesel-2012-2021',
            yearFrom: 2012,
            yearTo: 2021,
            isCurrentProduction: false,
            gvmKg: 3355,
            gcmKg: 6855,
            kerbWeightKg: 2790,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1680,
            rearAxleLimitKg: 1720,
            wheelbaseMm: 2850,
            frontOverhangMm: 880,
            rearOverhangMm: 1020,
            totalLengthMm: 4950,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 93,
            fuelType: 'DIESEL',
          },
          {
            name: 'VX Diesel',
            slug: 'vx-diesel-2015-2021',
            yearFrom: 2015,
            yearTo: 2021,
            isCurrentProduction: false,
            gvmKg: 3355,
            gcmKg: 6855,
            kerbWeightKg: 2755,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1680,
            rearAxleLimitKg: 1720,
            wheelbaseMm: 2850,
            frontOverhangMm: 880,
            rearOverhangMm: 1020,
            totalLengthMm: 4950,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 93,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'LandCruiser 300 Series',
        slug: 'landcruiser-300-series',
        bodyType: 'WAGON',
        variants: [
          {
            name: 'GXL Diesel',
            slug: 'gxl-diesel-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3500,
            gcmKg: 7000,
            kerbWeightKg: 2540,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1800,
            rearAxleLimitKg: 2000,
            wheelbaseMm: 2850,
            frontOverhangMm: 880,
            rearOverhangMm: 1020,
            totalLengthMm: 4950,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 110,
            fuelType: 'DIESEL',
          },
          {
            name: 'VX Diesel',
            slug: 'vx-diesel-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3500,
            gcmKg: 7000,
            kerbWeightKg: 2605,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1800,
            rearAxleLimitKg: 2000,
            wheelbaseMm: 2850,
            frontOverhangMm: 880,
            rearOverhangMm: 1020,
            totalLengthMm: 4950,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 110,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'Fortuner',
        slug: 'fortuner',
        bodyType: 'SUV',
        variants: [
          {
            name: 'GXL Diesel',
            slug: 'gxl-diesel-2016-2022',
            yearFrom: 2016,
            yearTo: 2022,
            isCurrentProduction: false,
            gvmKg: 3050,
            gcmKg: 5550,
            kerbWeightKg: 2025,
            maxTowingCapacityKg: 2500,
            frontAxleLimitKg: 1300,
            rearAxleLimitKg: 1550,
            wheelbaseMm: 2750,
            frontOverhangMm: 830,
            rearOverhangMm: 1010,
            totalLengthMm: 4795,
            maxTowBallDownloadKg: 250,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
          {
            name: 'GXL Diesel',
            slug: 'gxl-diesel-2023-2026',
            yearFrom: 2023,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3050,
            gcmKg: 5550,
            kerbWeightKg: 2070,
            maxTowingCapacityKg: 2500,
            frontAxleLimitKg: 1300,
            rearAxleLimitKg: 1550,
            wheelbaseMm: 2750,
            frontOverhangMm: 830,
            rearOverhangMm: 1010,
            totalLengthMm: 4795,
            maxTowBallDownloadKg: 250,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
          {
            name: 'GR Sport Diesel',
            slug: 'gr-sport-diesel-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3050,
            gcmKg: 5550,
            kerbWeightKg: 2100,
            maxTowingCapacityKg: 2500,
            frontAxleLimitKg: 1300,
            rearAxleLimitKg: 1550,
            wheelbaseMm: 2750,
            frontOverhangMm: 830,
            rearOverhangMm: 1010,
            totalLengthMm: 4795,
            maxTowBallDownloadKg: 250,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'Prado',
        slug: 'prado',
        bodyType: 'SUV',
        variants: [
          {
            name: 'GXL Diesel',
            slug: 'gxl-diesel-2010-2024',
            yearFrom: 2010,
            yearTo: 2024,
            isCurrentProduction: false,
            gvmKg: 3060,
            gcmKg: 6060,
            kerbWeightKg: 2275,
            maxTowingCapacityKg: 3000,
            frontAxleLimitKg: 1350,
            rearAxleLimitKg: 1620,
            wheelbaseMm: 2790,
            frontOverhangMm: 870,
            rearOverhangMm: 1015,
            totalLengthMm: 4840,
            maxTowBallDownloadKg: 300,
            fuelTankCapacityL: 87,
            fuelType: 'DIESEL',
          },
          {
            name: 'VX Diesel',
            slug: 'vx-diesel-2010-2024',
            yearFrom: 2010,
            yearTo: 2024,
            isCurrentProduction: false,
            gvmKg: 3060,
            gcmKg: 6060,
            kerbWeightKg: 2345,
            maxTowingCapacityKg: 3000,
            frontAxleLimitKg: 1350,
            rearAxleLimitKg: 1620,
            wheelbaseMm: 2790,
            frontOverhangMm: 870,
            rearOverhangMm: 1015,
            totalLengthMm: 4840,
            maxTowBallDownloadKg: 300,
            fuelTankCapacityL: 87,
            fuelType: 'DIESEL',
          },
        ],
      },
    ],
  },
  {
    name: 'Ford',
    slug: 'ford',
    countryOfOrigin: 'USA',
    models: [
      {
        name: 'Ranger',
        slug: 'ranger',
        bodyType: 'DUAL_CAB_UTE',
        variants: [
          {
            name: 'XLT 4x4 Auto',
            slug: 'xlt-4x4-auto-2015-2022',
            yearFrom: 2015,
            yearTo: 2022,
            isCurrentProduction: false,
            gvmKg: 3350,
            gcmKg: 6350,
            kerbWeightKg: 2080,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1500,
            rearAxleLimitKg: 1800,
            wheelbaseMm: 3220,
            frontOverhangMm: 950,
            rearOverhangMm: 1230,
            totalLengthMm: 5362,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
          {
            name: 'XLT 4x4 Auto',
            slug: 'xlt-4x4-auto-2023-2026',
            yearFrom: 2023,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3350,
            gcmKg: 6350,
            kerbWeightKg: 2120,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1500,
            rearAxleLimitKg: 1800,
            wheelbaseMm: 3270,
            frontOverhangMm: 950,
            rearOverhangMm: 1240,
            totalLengthMm: 5370,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 70,
            fuelType: 'DIESEL',
          },
          {
            name: 'Raptor V6',
            slug: 'raptor-v6-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 5600,
            kerbWeightKg: 2250,
            maxTowingCapacityKg: 2500,
            frontAxleLimitKg: 1450,
            rearAxleLimitKg: 1700,
            wheelbaseMm: 3270,
            frontOverhangMm: 950,
            rearOverhangMm: 1240,
            totalLengthMm: 5405,
            maxTowBallDownloadKg: 250,
            fuelTankCapacityL: 70,
            fuelType: 'PETROL',
          },
          {
            name: 'Wildtrak 4x4 Auto',
            slug: 'wildtrak-4x4-auto-2023-2026',
            yearFrom: 2023,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3350,
            gcmKg: 6350,
            kerbWeightKg: 2140,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1500,
            rearAxleLimitKg: 1800,
            wheelbaseMm: 3270,
            frontOverhangMm: 950,
            rearOverhangMm: 1240,
            totalLengthMm: 5370,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 70,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'Everest',
        slug: 'everest',
        bodyType: 'SUV',
        variants: [
          {
            name: 'Trend 4x4 Auto',
            slug: 'trend-4x4-auto-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3140,
            gcmKg: 6140,
            kerbWeightKg: 2285,
            maxTowingCapacityKg: 3000,
            frontAxleLimitKg: 1450,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 2900,
            frontOverhangMm: 950,
            rearOverhangMm: 1000,
            totalLengthMm: 5010,
            maxTowBallDownloadKg: 300,
            fuelTankCapacityL: 72,
            fuelType: 'DIESEL',
          },
          {
            name: 'Titanium+ 4x4 Auto',
            slug: 'titanium-plus-4x4-auto-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3140,
            gcmKg: 6140,
            kerbWeightKg: 2360,
            maxTowingCapacityKg: 3000,
            frontAxleLimitKg: 1450,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 2900,
            frontOverhangMm: 950,
            rearOverhangMm: 1000,
            totalLengthMm: 5010,
            maxTowBallDownloadKg: 300,
            fuelTankCapacityL: 72,
            fuelType: 'DIESEL',
          },
        ],
      },
    ],
  },
  {
    name: 'Nissan',
    slug: 'nissan',
    countryOfOrigin: 'Japan',
    models: [
      {
        name: 'Navara',
        slug: 'navara',
        bodyType: 'DUAL_CAB_UTE',
        variants: [
          {
            name: 'ST-X 4x4 Auto',
            slug: 'st-x-4x4-auto-2015-2020',
            yearFrom: 2015,
            yearTo: 2020,
            isCurrentProduction: false,
            gvmKg: 3100,
            gcmKg: 5600,
            kerbWeightKg: 1975,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1380,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 3150,
            frontOverhangMm: 900,
            rearOverhangMm: 1210,
            totalLengthMm: 5255,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
          {
            name: 'Pro-4X 4x4 Auto',
            slug: 'pro-4x-4x4-auto-2021-2026',
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 5600,
            kerbWeightKg: 2040,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1380,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 3150,
            frontOverhangMm: 900,
            rearOverhangMm: 1210,
            totalLengthMm: 5260,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 80,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'Patrol',
        slug: 'patrol',
        bodyType: 'WAGON',
        variants: [
          {
            name: 'Ti Diesel 4x4',
            slug: 'ti-diesel-4x4-2013-2025',
            yearFrom: 2013,
            yearTo: 2025,
            isCurrentProduction: false,
            gvmKg: 3300,
            gcmKg: 6800,
            kerbWeightKg: 2750,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1700,
            rearAxleLimitKg: 1850,
            wheelbaseMm: 2950,
            frontOverhangMm: 890,
            rearOverhangMm: 1025,
            totalLengthMm: 5000,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 140,
            fuelType: 'DIESEL',
          },
          {
            name: 'Ti-L Diesel 4x4',
            slug: 'ti-l-diesel-4x4-2013-2025',
            yearFrom: 2013,
            yearTo: 2025,
            isCurrentProduction: false,
            gvmKg: 3300,
            gcmKg: 6800,
            kerbWeightKg: 2780,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1700,
            rearAxleLimitKg: 1850,
            wheelbaseMm: 2950,
            frontOverhangMm: 890,
            rearOverhangMm: 1025,
            totalLengthMm: 5000,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 140,
            fuelType: 'DIESEL',
          },
        ],
      },
    ],
  },
  {
    name: 'Mitsubishi',
    slug: 'mitsubishi',
    countryOfOrigin: 'Japan',
    models: [
      {
        name: 'Triton',
        slug: 'triton',
        bodyType: 'DUAL_CAB_UTE',
        variants: [
          {
            name: 'GLS Premium 4x4 Auto',
            slug: 'gls-premium-4x4-auto-2015-2023',
            yearFrom: 2015,
            yearTo: 2023,
            isCurrentProduction: false,
            gvmKg: 3100,
            gcmKg: 5600,
            kerbWeightKg: 1965,
            maxTowingCapacityKg: 3100,
            frontAxleLimitKg: 1360,
            rearAxleLimitKg: 1600,
            wheelbaseMm: 3000,
            frontOverhangMm: 880,
            rearOverhangMm: 1185,
            totalLengthMm: 5285,
            maxTowBallDownloadKg: 310,
            fuelTankCapacityL: 75,
            fuelType: 'DIESEL',
          },
          {
            name: 'GLS Premium 4x4 Auto',
            slug: 'gls-premium-4x4-auto-2024-2026',
            yearFrom: 2024,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 5600,
            kerbWeightKg: 2000,
            maxTowingCapacityKg: 3100,
            frontAxleLimitKg: 1360,
            rearAxleLimitKg: 1600,
            wheelbaseMm: 3000,
            frontOverhangMm: 880,
            rearOverhangMm: 1185,
            totalLengthMm: 5285,
            maxTowBallDownloadKg: 310,
            fuelTankCapacityL: 75,
            fuelType: 'DIESEL',
          },
          {
            name: 'GSR 4x4 Auto',
            slug: 'gsr-4x4-auto-2019-2026',
            yearFrom: 2019,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 5600,
            kerbWeightKg: 1985,
            maxTowingCapacityKg: 3100,
            frontAxleLimitKg: 1360,
            rearAxleLimitKg: 1600,
            wheelbaseMm: 3000,
            frontOverhangMm: 880,
            rearOverhangMm: 1185,
            totalLengthMm: 5285,
            maxTowBallDownloadKg: 310,
            fuelTankCapacityL: 75,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'Pajero Sport',
        slug: 'pajero-sport',
        bodyType: 'SUV',
        variants: [
          {
            name: 'GLS 4x4 Auto',
            slug: 'gls-4x4-auto-2016-2022',
            yearFrom: 2016,
            yearTo: 2022,
            isCurrentProduction: false,
            gvmKg: 2950,
            gcmKg: 5450,
            kerbWeightKg: 2000,
            maxTowingCapacityKg: 3000,
            frontAxleLimitKg: 1300,
            rearAxleLimitKg: 1550,
            wheelbaseMm: 2800,
            frontOverhangMm: 850,
            rearOverhangMm: 970,
            totalLengthMm: 4785,
            maxTowBallDownloadKg: 300,
            fuelTankCapacityL: 68,
            fuelType: 'DIESEL',
          },
          {
            name: 'Exceed 4x4 Auto',
            slug: 'exceed-4x4-auto-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 2950,
            gcmKg: 5450,
            kerbWeightKg: 2060,
            maxTowingCapacityKg: 3000,
            frontAxleLimitKg: 1300,
            rearAxleLimitKg: 1550,
            wheelbaseMm: 2800,
            frontOverhangMm: 850,
            rearOverhangMm: 970,
            totalLengthMm: 4785,
            maxTowBallDownloadKg: 300,
            fuelTankCapacityL: 68,
            fuelType: 'DIESEL',
          },
        ],
      },
    ],
  },
  {
    name: 'Isuzu',
    slug: 'isuzu',
    countryOfOrigin: 'Japan',
    models: [
      {
        name: 'D-Max',
        slug: 'd-max',
        bodyType: 'DUAL_CAB_UTE',
        variants: [
          {
            name: 'X-Terrain 4x4 Auto',
            slug: 'x-terrain-4x4-auto-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 6100,
            kerbWeightKg: 2090,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1400,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 3125,
            frontOverhangMm: 910,
            rearOverhangMm: 1210,
            totalLengthMm: 5295,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 76,
            fuelType: 'DIESEL',
          },
          {
            name: 'LS-T 4x4 Auto',
            slug: 'ls-t-4x4-auto-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 6100,
            kerbWeightKg: 2055,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1400,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 3125,
            frontOverhangMm: 910,
            rearOverhangMm: 1210,
            totalLengthMm: 5295,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 76,
            fuelType: 'DIESEL',
          },
        ],
      },
      {
        name: 'MU-X',
        slug: 'mu-x',
        bodyType: 'SUV',
        variants: [
          {
            name: 'LS-T 4x4 Auto',
            slug: 'ls-t-4x4-auto-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3200,
            gcmKg: 6200,
            kerbWeightKg: 2285,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1450,
            rearAxleLimitKg: 1700,
            wheelbaseMm: 2860,
            frontOverhangMm: 890,
            rearOverhangMm: 970,
            totalLengthMm: 4780,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 72,
            fuelType: 'DIESEL',
          },
        ],
      },
    ],
  },
  {
    name: 'Mazda',
    slug: 'mazda',
    countryOfOrigin: 'Japan',
    models: [
      {
        name: 'BT-50',
        slug: 'bt-50',
        bodyType: 'DUAL_CAB_UTE',
        variants: [
          {
            name: 'Thunder 4x4 Auto',
            slug: 'thunder-4x4-auto-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 6100,
            kerbWeightKg: 2090,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1400,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 3125,
            frontOverhangMm: 910,
            rearOverhangMm: 1210,
            totalLengthMm: 5295,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 76,
            fuelType: 'DIESEL',
          },
          {
            name: 'SP 4x4 Auto',
            slug: 'sp-4x4-auto-2021-2026',
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3100,
            gcmKg: 6100,
            kerbWeightKg: 2055,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1400,
            rearAxleLimitKg: 1650,
            wheelbaseMm: 3125,
            frontOverhangMm: 910,
            rearOverhangMm: 1210,
            totalLengthMm: 5295,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 76,
            fuelType: 'DIESEL',
          },
        ],
      },
    ],
  },
  {
    name: 'Land Rover',
    slug: 'land-rover',
    countryOfOrigin: 'UK',
    models: [
      {
        name: 'Defender',
        slug: 'defender',
        bodyType: 'WAGON',
        variants: [
          {
            name: '110 D300 SE',
            slug: '110-d300-se-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3500,
            gcmKg: 7000,
            kerbWeightKg: 2225,
            maxTowingCapacityKg: 3500,
            frontAxleLimitKg: 1800,
            rearAxleLimitKg: 2000,
            wheelbaseMm: 3022,
            frontOverhangMm: 870,
            rearOverhangMm: 1010,
            totalLengthMm: 5018,
            maxTowBallDownloadKg: 350,
            fuelTankCapacityL: 90,
            fuelType: 'DIESEL',
          },
          {
            name: '110 V8 Carpathian',
            slug: '110-v8-carpathian-2021-2026',
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 3500,
            gcmKg: 6500,
            kerbWeightKg: 2395,
            maxTowingCapacityKg: 3000,
            frontAxleLimitKg: 1800,
            rearAxleLimitKg: 2000,
            wheelbaseMm: 3022,
            frontOverhangMm: 870,
            rearOverhangMm: 1010,
            totalLengthMm: 5018,
            maxTowBallDownloadKg: 300,
            fuelTankCapacityL: 90,
            fuelType: 'PETROL',
          },
        ],
      },
    ],
  },
  {
    name: 'Jeep',
    slug: 'jeep',
    countryOfOrigin: 'USA',
    models: [
      {
        name: 'Wrangler',
        slug: 'wrangler',
        bodyType: 'SUV',
        variants: [
          {
            name: 'Rubicon 4xe PHEV',
            slug: 'rubicon-4xe-phev-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            gvmKg: 2993,
            gcmKg: 5493,
            kerbWeightKg: 2365,
            maxTowingCapacityKg: 2500,
            frontAxleLimitKg: 1500,
            rearAxleLimitKg: 1600,
            wheelbaseMm: 2459,
            frontOverhangMm: 765,
            rearOverhangMm: 1030,
            totalLengthMm: 4355,
            maxTowBallDownloadKg: 250,
            fuelTankCapacityL: 70,
            fuelType: 'HYBRID',
          },
          {
            name: 'Sahara Diesel 4x4',
            slug: 'sahara-diesel-4x4-2017-2023',
            yearFrom: 2017,
            yearTo: 2023,
            isCurrentProduction: false,
            gvmKg: 2721,
            gcmKg: 5221,
            kerbWeightKg: 2034,
            maxTowingCapacityKg: 2500,
            frontAxleLimitKg: 1350,
            rearAxleLimitKg: 1500,
            wheelbaseMm: 2459,
            frontOverhangMm: 765,
            rearOverhangMm: 1030,
            totalLengthMm: 4355,
            maxTowBallDownloadKg: 250,
            fuelTankCapacityL: 81,
            fuelType: 'DIESEL',
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Caravan seed data
// ---------------------------------------------------------------------------

type CaravanBodyType =
  | 'CARAVAN_POP_TOP'
  | 'CARAVAN_FULL_HEIGHT'
  | 'OFF_ROAD_CARAVAN'
  | 'CAMPER_TRAILER'
  | 'HYBRID'
  | 'FIFTH_WHEELER'
  | 'OTHER';

type AxleConfiguration =
  | 'SINGLE_AXLE'
  | 'DUAL_AXLE_CLOSE_COUPLED'
  | 'DUAL_AXLE_SPREAD'
  | 'TRIPLE_AXLE';

interface CaravanVariantSeed {
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  atmKg: number;
  gtmKg: number;
  tareKg: number;
  tbmKg: number;
  axleConfiguration: AxleConfiguration;
  couplingToAxleMm: number;
  axleSpacingMm?: number;
  bodyLengthMm: number;
  overallLengthMm: number;
  freshWaterCapacityL: number;
  greyWaterCapacityL: number;
  gasBottleConfig?: string;
}

interface CaravanModelSeed {
  name: string;
  slug: string;
  bodyType: CaravanBodyType;
  variants: CaravanVariantSeed[];
}

interface CaravanMakeSeed {
  name: string;
  slug: string;
  countryOfOrigin: string;
  models: CaravanModelSeed[];
}

const caravanData: CaravanMakeSeed[] = [
  {
    name: 'Jayco',
    slug: 'jayco',
    countryOfOrigin: 'Australia',
    models: [
      {
        name: 'Silverline',
        slug: 'silverline',
        bodyType: 'CARAVAN_FULL_HEIGHT',
        variants: [
          {
            name: '21.65-3',
            slug: '21-65-3-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3300,
            gtmKg: 3000,
            tareKg: 2460,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 5200,
            axleSpacingMm: 1000,
            bodyLengthMm: 6600,
            overallLengthMm: 9400,
            freshWaterCapacityL: 120,
            greyWaterCapacityL: 90,
            gasBottleConfig: '2x9kg',
          },
          {
            name: '24.65-3',
            slug: '24-65-3-2022-2026',
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3500,
            gtmKg: 3200,
            tareKg: 2650,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 5600,
            axleSpacingMm: 1000,
            bodyLengthMm: 7300,
            overallLengthMm: 10100,
            freshWaterCapacityL: 135,
            greyWaterCapacityL: 110,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
      {
        name: 'Journey',
        slug: 'journey',
        bodyType: 'CARAVAN_POP_TOP',
        variants: [
          {
            name: '17.58-3',
            slug: '17-58-3-2018-2022',
            yearFrom: 2018,
            yearTo: 2022,
            isCurrentProduction: false,
            atmKg: 2200,
            gtmKg: 1900,
            tareKg: 1560,
            tbmKg: 300,
            axleConfiguration: 'SINGLE_AXLE',
            couplingToAxleMm: 4200,
            bodyLengthMm: 5200,
            overallLengthMm: 7400,
            freshWaterCapacityL: 95,
            greyWaterCapacityL: 60,
            gasBottleConfig: '2x9kg',
          },
          {
            name: '17.58-3',
            slug: '17-58-3-2023-2026',
            yearFrom: 2023,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2200,
            gtmKg: 1900,
            tareKg: 1580,
            tbmKg: 300,
            axleConfiguration: 'SINGLE_AXLE',
            couplingToAxleMm: 4200,
            bodyLengthMm: 5200,
            overallLengthMm: 7400,
            freshWaterCapacityL: 100,
            greyWaterCapacityL: 60,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
      {
        name: 'Expanda',
        slug: 'expanda',
        bodyType: 'CARAVAN_POP_TOP',
        variants: [
          {
            name: '17.56-2OB',
            slug: '17-56-2ob-2019-2026',
            yearFrom: 2019,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2000,
            gtmKg: 1700,
            tareKg: 1380,
            tbmKg: 300,
            axleConfiguration: 'SINGLE_AXLE',
            couplingToAxleMm: 4000,
            bodyLengthMm: 4980,
            overallLengthMm: 7000,
            freshWaterCapacityL: 80,
            greyWaterCapacityL: 55,
            gasBottleConfig: '1x9kg',
          },
        ],
      },
      {
        name: 'Starcraft',
        slug: 'starcraft',
        bodyType: 'CARAVAN_FULL_HEIGHT',
        variants: [
          {
            name: '19.53-3',
            slug: '19-53-3-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2800,
            gtmKg: 2500,
            tareKg: 2060,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 4800,
            axleSpacingMm: 1000,
            bodyLengthMm: 5960,
            overallLengthMm: 8700,
            freshWaterCapacityL: 100,
            greyWaterCapacityL: 80,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
    ],
  },
  {
    name: 'Coromal',
    slug: 'coromal',
    countryOfOrigin: 'Australia',
    models: [
      {
        name: 'Lifestyle',
        slug: 'lifestyle',
        bodyType: 'CARAVAN_FULL_HEIGHT',
        variants: [
          {
            name: '563S',
            slug: '563s-2019-2025',
            yearFrom: 2019,
            yearTo: 2025,
            isCurrentProduction: false,
            atmKg: 2900,
            gtmKg: 2600,
            tareKg: 2150,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 4900,
            axleSpacingMm: 1000,
            bodyLengthMm: 5900,
            overallLengthMm: 8700,
            freshWaterCapacityL: 115,
            greyWaterCapacityL: 85,
            gasBottleConfig: '2x9kg',
          },
          {
            name: '623S',
            slug: '623s-2021-2026',
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3100,
            gtmKg: 2800,
            tareKg: 2320,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 5300,
            axleSpacingMm: 1000,
            bodyLengthMm: 6400,
            overallLengthMm: 9200,
            freshWaterCapacityL: 130,
            greyWaterCapacityL: 95,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
      {
        name: 'Element',
        slug: 'element',
        bodyType: 'CARAVAN_FULL_HEIGHT',
        variants: [
          {
            name: '560S',
            slug: '560s-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2100,
            gtmKg: 1800,
            tareKg: 1480,
            tbmKg: 300,
            axleConfiguration: 'SINGLE_AXLE',
            couplingToAxleMm: 4350,
            bodyLengthMm: 5200,
            overallLengthMm: 7300,
            freshWaterCapacityL: 90,
            greyWaterCapacityL: 65,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
    ],
  },
  {
    name: 'Avan',
    slug: 'avan',
    countryOfOrigin: 'Australia',
    models: [
      {
        name: 'Aspire',
        slug: 'aspire',
        bodyType: 'CARAVAN_FULL_HEIGHT',
        variants: [
          {
            name: '499 Ensuite',
            slug: '499-ensuite-2017-2022',
            yearFrom: 2017,
            yearTo: 2022,
            isCurrentProduction: false,
            atmKg: 1750,
            gtmKg: 1500,
            tareKg: 1180,
            tbmKg: 250,
            axleConfiguration: 'SINGLE_AXLE',
            couplingToAxleMm: 3800,
            bodyLengthMm: 4700,
            overallLengthMm: 6600,
            freshWaterCapacityL: 80,
            greyWaterCapacityL: 50,
            gasBottleConfig: '1x9kg',
          },
          {
            name: '555 Outback',
            slug: '555-outback-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2000,
            gtmKg: 1750,
            tareKg: 1380,
            tbmKg: 250,
            axleConfiguration: 'SINGLE_AXLE',
            couplingToAxleMm: 4100,
            bodyLengthMm: 5100,
            overallLengthMm: 7100,
            freshWaterCapacityL: 95,
            greyWaterCapacityL: 60,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
      {
        name: 'Sportliner',
        slug: 'sportliner',
        bodyType: 'OFF_ROAD_CARAVAN',
        variants: [
          {
            name: '621 Off-Road',
            slug: '621-off-road-2021-2026',
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3000,
            gtmKg: 2700,
            tareKg: 2200,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 5100,
            axleSpacingMm: 1000,
            bodyLengthMm: 6200,
            overallLengthMm: 9000,
            freshWaterCapacityL: 200,
            greyWaterCapacityL: 120,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
    ],
  },
  {
    name: 'Lotus',
    slug: 'lotus',
    countryOfOrigin: 'Australia',
    models: [
      {
        name: 'Freelander',
        slug: 'freelander',
        bodyType: 'CARAVAN_FULL_HEIGHT',
        variants: [
          {
            name: 'Freelander 18',
            slug: 'freelander-18-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2800,
            gtmKg: 2500,
            tareKg: 2020,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 4900,
            axleSpacingMm: 1000,
            bodyLengthMm: 5600,
            overallLengthMm: 8400,
            freshWaterCapacityL: 110,
            greyWaterCapacityL: 80,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
      {
        name: 'Trooper',
        slug: 'trooper',
        bodyType: 'OFF_ROAD_CARAVAN',
        variants: [
          {
            name: 'Trooper 16 Off-Road',
            slug: 'trooper-16-off-road-2019-2026',
            yearFrom: 2019,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3200,
            gtmKg: 2900,
            tareKg: 2350,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 5000,
            axleSpacingMm: 1000,
            bodyLengthMm: 5400,
            overallLengthMm: 8200,
            freshWaterCapacityL: 220,
            greyWaterCapacityL: 140,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
    ],
  },
  {
    name: 'Kedron',
    slug: 'kedron',
    countryOfOrigin: 'Australia',
    models: [
      {
        name: 'JP Series',
        slug: 'jp-series',
        bodyType: 'OFF_ROAD_CARAVAN',
        variants: [
          {
            name: 'JP8',
            slug: 'jp8-2015-2020',
            yearFrom: 2015,
            yearTo: 2020,
            isCurrentProduction: false,
            atmKg: 4500,
            gtmKg: 4000,
            tareKg: 3200,
            tbmKg: 500,
            axleConfiguration: 'DUAL_AXLE_SPREAD',
            couplingToAxleMm: 4500,
            axleSpacingMm: 2200,
            bodyLengthMm: 5800,
            overallLengthMm: 8500,
            freshWaterCapacityL: 400,
            greyWaterCapacityL: 200,
            gasBottleConfig: '4x9kg',
          },
          {
            name: 'JP9',
            slug: 'jp9-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 4800,
            gtmKg: 4300,
            tareKg: 3450,
            tbmKg: 500,
            axleConfiguration: 'DUAL_AXLE_SPREAD',
            couplingToAxleMm: 4700,
            axleSpacingMm: 2200,
            bodyLengthMm: 6100,
            overallLengthMm: 8900,
            freshWaterCapacityL: 450,
            greyWaterCapacityL: 220,
            gasBottleConfig: '4x9kg',
          },
        ],
      },
    ],
  },
  {
    name: 'New Age',
    slug: 'new-age',
    countryOfOrigin: 'Australia',
    models: [
      {
        name: 'Manta Ray',
        slug: 'manta-ray',
        bodyType: 'OFF_ROAD_CARAVAN',
        variants: [
          {
            name: '176 Off-Road',
            slug: '176-off-road-2019-2026',
            yearFrom: 2019,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3000,
            gtmKg: 2700,
            tareKg: 2180,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 4900,
            axleSpacingMm: 1000,
            bodyLengthMm: 5500,
            overallLengthMm: 8300,
            freshWaterCapacityL: 230,
            greyWaterCapacityL: 130,
            gasBottleConfig: '2x9kg',
          },
          {
            name: '196 Off-Road',
            slug: '196-off-road-2021-2026',
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3500,
            gtmKg: 3200,
            tareKg: 2580,
            tbmKg: 300,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 5200,
            axleSpacingMm: 1000,
            bodyLengthMm: 6100,
            overallLengthMm: 9000,
            freshWaterCapacityL: 260,
            greyWaterCapacityL: 150,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
      {
        name: 'Oz Classic',
        slug: 'oz-classic',
        bodyType: 'CARAVAN_FULL_HEIGHT',
        variants: [
          {
            name: '171SR',
            slug: '171sr-2018-2026',
            yearFrom: 2018,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 1900,
            gtmKg: 1650,
            tareKg: 1330,
            tbmKg: 250,
            axleConfiguration: 'SINGLE_AXLE',
            couplingToAxleMm: 4000,
            bodyLengthMm: 5000,
            overallLengthMm: 6900,
            freshWaterCapacityL: 90,
            greyWaterCapacityL: 60,
            gasBottleConfig: '2x9kg',
          },
          {
            name: '201SR',
            slug: '201sr-2020-2026',
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2400,
            gtmKg: 2150,
            tareKg: 1780,
            tbmKg: 250,
            axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
            couplingToAxleMm: 4700,
            axleSpacingMm: 1000,
            bodyLengthMm: 5900,
            overallLengthMm: 8600,
            freshWaterCapacityL: 110,
            greyWaterCapacityL: 75,
            gasBottleConfig: '2x9kg',
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Accessory seed data
// ---------------------------------------------------------------------------

const accessoryBrandData = [
  { name: 'ARB', slug: 'arb', websiteUrl: 'https://www.arb.com.au' },
  {
    name: 'Rhino-Rack',
    slug: 'rhino-rack',
    websiteUrl: 'https://www.rhinorack.com.au',
  },
  {
    name: 'Engel',
    slug: 'engel',
    websiteUrl: 'https://www.engelcoolers.com.au',
  },
  {
    name: 'Dometic',
    slug: 'dometic',
    websiteUrl: 'https://www.dometic.com/en-au',
  },
  { name: 'Redarc', slug: 'redarc', websiteUrl: 'https://www.redarc.com.au' },
  { name: 'TJM', slug: 'tjm', websiteUrl: 'https://www.tjm.com.au' },
  {
    name: 'Ironman 4x4',
    slug: 'ironman-4x4',
    websiteUrl: 'https://www.ironman4x4.com',
  },
  { name: 'Kaymar', slug: 'kaymar', websiteUrl: 'https://www.kaymar.com.au' },
  { name: 'MSA 4x4', slug: 'msa-4x4', websiteUrl: 'https://www.msa4x4.com.au' },
  // Caravan-focused brands
  {
    name: 'Victron Energy',
    slug: 'victron-energy',
    websiteUrl: 'https://www.victronenergy.com',
  },
  {
    name: 'Carefree of Colorado',
    slug: 'carefree',
    websiteUrl: 'https://www.carefreeofcolorado.com',
  },
  {
    name: 'Henna Caravans',
    slug: 'henna',
    websiteUrl: 'https://www.hennacaravans.com.au',
  },
  { name: 'A.R.E.', slug: 'are', websiteUrl: 'https://www.4are.com' },
  {
    name: 'Thetford',
    slug: 'thetford',
    websiteUrl: 'https://www.thetford.com/en-au',
  },
];

const accessoryCategoryData = [
  {
    name: 'Bullbar',
    slug: 'bullbar',
    description: 'Front bull bars and bumper bars for 4WD vehicles',
    displayOrder: 1,
    iconName: 'shield',
  },
  {
    name: 'Winch',
    slug: 'winch',
    description: 'Electric recovery winches for off-road use',
    displayOrder: 2,
    iconName: 'anchor',
  },
  {
    name: 'Roof Rack / Platform',
    slug: 'roof-rack-platform',
    description: 'Roof racks, platforms and roof bars for load carrying',
    displayOrder: 3,
    iconName: 'grid',
  },
  {
    name: 'Rooftop Tent',
    slug: 'rooftop-tent',
    description: 'Rooftop tents for camping mounted on roof racks',
    displayOrder: 4,
    iconName: 'home',
  },
  {
    name: 'Drawer System / Fridge Slide',
    slug: 'drawer-system-fridge-slide',
    description:
      'In-tray drawer systems and fridge slides for load organisation',
    displayOrder: 5,
    iconName: 'layers',
  },
  {
    name: 'Portable Fridge / Freezer',
    slug: 'portable-fridge-freezer',
    description: 'Portable 12V/240V fridges and freezers for camping',
    displayOrder: 6,
    iconName: 'thermometer',
  },
  {
    name: 'Dual Battery System',
    slug: 'dual-battery-system',
    description: 'Dual battery systems, DC-DC chargers and battery management',
    displayOrder: 7,
    iconName: 'battery',
  },
  {
    name: 'Canopy / Tray',
    slug: 'canopy-tray',
    description: 'Ute canopies, steel trays and tray-top accessories',
    displayOrder: 8,
    iconName: 'box',
  },
  {
    name: 'Tow Bar',
    slug: 'tow-bar',
    description: 'Tow bars and towing hitches for towing caravans and trailers',
    displayOrder: 9,
    iconName: 'truck',
  },
  // Caravan-specific categories
  {
    name: 'Solar Panel',
    slug: 'solar-panel',
    description:
      'Rigid and flexible solar panels for caravan rooftop installation',
    displayOrder: 10,
    iconName: 'sun',
  },
  {
    name: 'Awning',
    slug: 'awning',
    description: 'Roll-out and retractable awnings for caravan side walls',
    displayOrder: 11,
    iconName: 'umbrella',
  },
  {
    name: 'Spare Wheel Carrier',
    slug: 'spare-wheel-carrier',
    description:
      'External spare tyre carriers for caravan drawbars and bumper bars',
    displayOrder: 12,
    iconName: 'circle',
  },
  {
    name: 'Water Tank',
    slug: 'water-tank',
    description: 'Additional fresh water tanks for extended touring',
    displayOrder: 13,
    iconName: 'droplet',
  },
];

// Fitment position helpers (coordinates: 0 = rear axle, positive = toward front)
// HiLux (wb=3085, frontOH=935, rearOH=1280): front bumper=+4020, rear bumper=-1280
// Ranger (wb=3270, frontOH=950, rearOH=1240): front bumper=+4220, rear bumper=-1240
// Patrol (wb=2950, frontOH=890, rearOH=1025): front bumper=+3840, rear bumper=-1025

type FitmentSeedData = {
  vehicleKey?: string; // "make-slug/model-slug/variant-slug"
  caravanKey?: string; // "make-slug/model-slug/variant-slug"
  installedWeightKg: number;
  positionType: string;
  cogXMm?: number;
  cogYMm?: number;
  startXMm?: number;
  endXMm?: number;
  mountingLocation: string;
  providesMountingLocations?: string[];
  confidence?: string;
  source?: string;
  notes?: string;
};

type AccessorySeedData = {
  brandSlug: string;
  categorySlug: string;
  name: string;
  slug: string;
  description?: string;
  priceMin?: number;
  priceMax?: number;
  fitments: FitmentSeedData[];
};

const accessoryData: AccessorySeedData[] = [
  // ---- BULLBARS ----
  {
    brandSlug: 'arb',
    categorySlug: 'bullbar',
    name: 'ARB Summit Bullbar – Toyota HiLux',
    slug: 'summit-bullbar-hilux',
    description:
      'Heavy-duty steel bull bar for Toyota HiLux featuring integrated winch cradle, dual recovery points, and provisions for driving lights and LED light bars.',
    priceMin: 1899,
    priceMax: 2299,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 42,
        positionType: 'FIXED',
        cogXMm: 3600,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 42,
        positionType: 'FIXED',
        cogXMm: 3600,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'arb',
    categorySlug: 'bullbar',
    name: 'ARB Summit Bullbar – Ford Ranger',
    slug: 'summit-bullbar-ranger',
    description:
      'Heavy-duty steel bull bar for Ford Ranger featuring integrated winch cradle, dual recovery points, and provisions for driving lights and LED light bars.',
    priceMin: 1999,
    priceMax: 2399,
    fitments: [
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2015-2022',
        installedWeightKg: 43,
        positionType: 'FIXED',
        cogXMm: 3680,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 43,
        positionType: 'FIXED',
        cogXMm: 3710,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'tjm',
    categorySlug: 'bullbar',
    name: 'TJM T13 Outback Bullbar – Toyota HiLux',
    slug: 't13-outback-bullbar-hilux',
    description:
      'One-piece steel bull bar with integrated winch mount, side protection rails, and high-lift jack points for Toyota HiLux.',
    priceMin: 1749,
    priceMax: 2099,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 38,
        positionType: 'FIXED',
        cogXMm: 3580,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 38,
        positionType: 'FIXED',
        cogXMm: 3580,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'tjm',
    categorySlug: 'bullbar',
    name: 'TJM T13 Outback Bullbar – Nissan Patrol',
    slug: 't13-outback-bullbar-patrol',
    description:
      'One-piece steel bull bar with integrated winch mount, side protection rails, and high-lift jack points for Nissan Patrol Y62.',
    priceMin: 1849,
    priceMax: 2199,
    fitments: [
      {
        vehicleKey: 'nissan/patrol/ti-diesel-4x4-2013-2025',
        installedWeightKg: 40,
        positionType: 'FIXED',
        cogXMm: 3350,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'nissan/patrol/ti-l-diesel-4x4-2013-2025',
        installedWeightKg: 40,
        positionType: 'FIXED',
        cogXMm: 3350,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'ironman-4x4',
    categorySlug: 'bullbar',
    name: 'Ironman 4x4 Predator Bullbar – Ford Ranger',
    slug: 'predator-bullbar-ranger',
    description:
      'Full-width steel bull bar with tube steel construction, integrated winch cradle, and factory fog light integration for Ford Ranger.',
    priceMin: 1599,
    priceMax: 1899,
    fitments: [
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2015-2022',
        installedWeightKg: 36,
        positionType: 'FIXED',
        cogXMm: 3660,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 36,
        positionType: 'FIXED',
        cogXMm: 3690,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_FRONT',
        providesMountingLocations: ['BULL_BAR'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },

  // ---- WINCHES ----
  {
    brandSlug: 'arb',
    categorySlug: 'winch',
    name: 'ARB 10000lb Winch',
    slug: '10000lb-winch',
    description:
      'Heavy-duty 10,000 lb electric winch with synthetic rope and wireless remote for 4WD self-recovery. IP68 rated motor and solenoid.',
    priceMin: 1299,
    priceMax: 1699,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 17,
        positionType: 'FIXED',
        cogXMm: 3740,
        cogYMm: 0,
        mountingLocation: 'BULL_BAR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes: 'Requires ARB Summit or compatible winch-rated bull bar.',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 17,
        positionType: 'FIXED',
        cogXMm: 3840,
        cogYMm: 0,
        mountingLocation: 'BULL_BAR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes: 'Requires ARB Summit or compatible winch-rated bull bar.',
      },
    ],
  },
  {
    brandSlug: 'tjm',
    categorySlug: 'winch',
    name: 'TJM Torq 9500lb Winch',
    slug: 'torq-9500-winch',
    description:
      '9,500 lb electric winch with steel cable and corded remote. Weatherproof construction rated to IP67 for all-conditions off-road recovery.',
    priceMin: 899,
    priceMax: 1199,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 15,
        positionType: 'FIXED',
        cogXMm: 3720,
        cogYMm: 0,
        mountingLocation: 'BULL_BAR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Requires winch-rated bull bar with standard Warn/Superwinch mount pattern.',
      },
      {
        vehicleKey: 'nissan/patrol/ti-diesel-4x4-2013-2025',
        installedWeightKg: 15,
        positionType: 'FIXED',
        cogXMm: 3470,
        cogYMm: 0,
        mountingLocation: 'BULL_BAR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Requires winch-rated bull bar with standard Warn/Superwinch mount pattern.',
      },
    ],
  },

  // ---- ROOF RACKS / PLATFORMS ----
  {
    brandSlug: 'rhino-rack',
    categorySlug: 'roof-rack-platform',
    name: 'Rhino-Rack Backbone Pioneer Platform – Toyota HiLux',
    slug: 'backbone-pioneer-platform-hilux',
    description:
      'Aluminium Pioneer Platform (1528mm × 1236mm) using the Backbone mounting system for Toyota HiLux dual cab. 100kg dynamic load rating.',
    priceMin: 1199,
    priceMax: 1499,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 18,
        positionType: 'FIXED',
        startXMm: 500,
        endXMm: 2650,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK', 'CABIN_ROOF'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 18,
        positionType: 'FIXED',
        startXMm: 500,
        endXMm: 2650,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK', 'CABIN_ROOF'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'rhino-rack',
    categorySlug: 'roof-rack-platform',
    name: 'Rhino-Rack Backbone Pioneer Platform – Ford Ranger',
    slug: 'backbone-pioneer-platform-ranger',
    description:
      'Aluminium Pioneer Platform (1528mm × 1236mm) using the Backbone mounting system for Ford Ranger dual cab. 100kg dynamic load rating.',
    priceMin: 1249,
    priceMax: 1549,
    fitments: [
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2015-2022',
        installedWeightKg: 18,
        positionType: 'FIXED',
        startXMm: 600,
        endXMm: 2850,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK', 'CABIN_ROOF'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 18,
        positionType: 'FIXED',
        startXMm: 600,
        endXMm: 2950,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK', 'CABIN_ROOF'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'arb',
    categorySlug: 'roof-rack-platform',
    name: 'ARB Flat Rack – Nissan Patrol',
    slug: 'flat-rack-patrol',
    description:
      'Heavy-duty steel flat roof rack for Nissan Patrol Y62 wagon with full-length roof coverage. 100kg dynamic load rating.',
    priceMin: 899,
    priceMax: 1199,
    fitments: [
      {
        vehicleKey: 'nissan/patrol/ti-diesel-4x4-2013-2025',
        installedWeightKg: 14,
        positionType: 'FIXED',
        startXMm: -550,
        endXMm: 2700,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'nissan/patrol/ti-l-diesel-4x4-2013-2025',
        installedWeightKg: 14,
        positionType: 'FIXED',
        startXMm: -550,
        endXMm: 2700,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'ironman-4x4',
    categorySlug: 'roof-rack-platform',
    name: 'Ironman 4x4 Roof Platform – Toyota HiLux',
    slug: 'roof-platform-hilux',
    description:
      'Heavy-duty steel roof platform for Toyota HiLux dual cab with integrated light bar mounts and side rails. 80kg dynamic load rating.',
    priceMin: 799,
    priceMax: 999,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 15,
        positionType: 'FIXED',
        startXMm: 450,
        endXMm: 2600,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK', 'CABIN_ROOF'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 15,
        positionType: 'FIXED',
        startXMm: 450,
        endXMm: 2600,
        mountingLocation: 'ROOF_RAILS',
        providesMountingLocations: ['ROOF_RACK', 'CABIN_ROOF'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },

  // ---- ROOFTOP TENTS ----
  {
    brandSlug: 'arb',
    categorySlug: 'rooftop-tent',
    name: 'ARB Simpson III Rooftop Tent',
    slug: 'simpson-iii-rooftop-tent',
    description:
      'Hard-shell rooftop tent with built-in 60mm foam mattress, LED lighting, and 360° zip-down canvas walls. Opens via gas struts in under 60 seconds. 1400mm × 2100mm sleeping area.',
    priceMin: 4499,
    priceMax: 5299,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 68,
        positionType: 'FIXED',
        startXMm: 550,
        endXMm: 2550,
        mountingLocation: 'ROOF_RACK',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Requires minimum 80kg dynamic load-rated roof rack. T-slot or cross-bar compatible.',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 68,
        positionType: 'FIXED',
        startXMm: 650,
        endXMm: 2750,
        mountingLocation: 'ROOF_RACK',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Requires minimum 80kg dynamic load-rated roof rack. T-slot or cross-bar compatible.',
      },
    ],
  },
  {
    brandSlug: 'ironman-4x4',
    categorySlug: 'rooftop-tent',
    name: 'Ironman 4x4 Rooftop Tent',
    slug: 'rooftop-tent',
    description:
      'Soft-shell rooftop tent with 60mm foam mattress, annexe extension, and LED lighting. Universal T-slot aluminium base for cross-bar mounting.',
    priceMin: 1899,
    priceMax: 2399,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 65,
        positionType: 'FIXED',
        startXMm: 500,
        endXMm: 2550,
        mountingLocation: 'ROOF_RACK',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes: 'Requires minimum 80kg dynamic load-rated roof rack.',
      },
      {
        vehicleKey: 'nissan/patrol/ti-diesel-4x4-2013-2025',
        installedWeightKg: 65,
        positionType: 'FIXED',
        startXMm: -400,
        endXMm: 2450,
        mountingLocation: 'ROOF_RACK',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes: 'Requires minimum 80kg dynamic load-rated roof rack.',
      },
    ],
  },

  // ---- DRAWER SYSTEMS / FRIDGE SLIDES ----
  {
    brandSlug: 'arb',
    categorySlug: 'drawer-system-fridge-slide',
    name: 'ARB Roller Drawer with Fridge Slide',
    slug: 'roller-drawer-with-slide',
    description:
      'Full-width dual-drawer system with integrated 200mm fridge slide for Toyota HiLux. Powder-coated steel construction with 300kg static load rating per drawer.',
    priceMin: 1499,
    priceMax: 1899,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 28,
        positionType: 'SLIDING',
        startXMm: -1100,
        endXMm: 280,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 28,
        positionType: 'SLIDING',
        startXMm: -1100,
        endXMm: 280,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'ironman-4x4',
    categorySlug: 'drawer-system-fridge-slide',
    name: 'Ironman 4x4 Drawer System – Ford Ranger',
    slug: 'drawer-system-ranger',
    description:
      'Dual-drawer system with fridge slide for Ford Ranger. Lockable drawers with slam-shut latches, integrated LED strip lighting, and 300mm slide extension.',
    priceMin: 1349,
    priceMax: 1749,
    fitments: [
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2015-2022',
        installedWeightKg: 25,
        positionType: 'SLIDING',
        startXMm: -1000,
        endXMm: 340,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 25,
        positionType: 'SLIDING',
        startXMm: -1000,
        endXMm: 380,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },

  // ---- PORTABLE FRIDGES / FREEZERS ----
  {
    brandSlug: 'engel',
    categorySlug: 'portable-fridge-freezer',
    name: 'Engel MT60-G 60L Fridge-Freezer',
    slug: 'mt60-g-60l-fridge-freezer',
    description:
      '60-litre 12/24V DC and 240V AC fridge-freezer with Sawafuji swing motor compressor. Temperature range -18°C to +10°C. Weight 28kg dry.',
    priceMin: 1199,
    priceMax: 1399,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 28,
        positionType: 'SLIDING',
        cogXMm: -600,
        cogYMm: 0,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes:
          'Typically paired with a fridge slide. Add ~24kg for fully loaded contents.',
      },
      {
        vehicleKey: 'nissan/patrol/ti-diesel-4x4-2013-2025',
        installedWeightKg: 28,
        positionType: 'SLIDING',
        cogXMm: -650,
        cogYMm: 0,
        mountingLocation: 'TUB_INTERIOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes:
          'Stored in rear cargo area on fridge slide. Use rear seat-delete kit for full floor access.',
      },
    ],
  },
  {
    brandSlug: 'dometic',
    categorySlug: 'portable-fridge-freezer',
    name: 'Dometic CFX3 55 Fridge-Freezer',
    slug: 'cfx3-55-fridge-freezer',
    description:
      '55-litre dual-zone fridge-freezer with VMSO3 variable speed compressor. WiFi and Bluetooth connectivity with app control. -22°C to +10°C. Weight 24kg dry.',
    priceMin: 1099,
    priceMax: 1299,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 24,
        positionType: 'SLIDING',
        cogXMm: -600,
        cogYMm: 0,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes: 'Dry weight 24kg. Use with a fridge slide for easy tray access.',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 24,
        positionType: 'SLIDING',
        cogXMm: -550,
        cogYMm: 0,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes: 'Dry weight 24kg. Use with a fridge slide for easy tray access.',
      },
    ],
  },
  {
    brandSlug: 'engel',
    categorySlug: 'portable-fridge-freezer',
    name: 'Engel MT45F 40L Fridge-Freezer',
    slug: 'mt45f-40l-fridge-freezer',
    description:
      '40-litre 12/24V DC and 240V AC fridge-freezer. Compact and lightweight for dual-cab or wagon use. -18°C to +10°C. Weight 19kg dry.',
    priceMin: 899,
    priceMax: 1099,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 19,
        positionType: 'SLIDING',
        cogXMm: -500,
        cogYMm: 0,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes:
          'Dry weight 19kg. Suitable for cabin-side or tray-side placement.',
      },
      {
        vehicleKey: 'nissan/patrol/ti-l-diesel-4x4-2013-2025',
        installedWeightKg: 19,
        positionType: 'SLIDING',
        cogXMm: -700,
        cogYMm: 0,
        mountingLocation: 'TUB_INTERIOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes: 'Fits in rear cargo area. Dry weight 19kg.',
      },
    ],
  },

  // ---- DUAL BATTERY SYSTEMS ----
  {
    brandSlug: 'redarc',
    categorySlug: 'dual-battery-system',
    name: 'Redarc BCDC1240D DC-DC Charger',
    slug: 'bcdc1240d-dc-dc-charger',
    description:
      '40A DC-DC battery charger with integrated MPPT solar regulator. Charges AGM, gel, calcium, and LiFePO4 batteries. Ignition-sense controlled.',
    priceMin: 499,
    priceMax: 649,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 1.5,
        positionType: 'FIXED',
        cogXMm: 2900,
        cogYMm: 0,
        mountingLocation: 'CABIN_INTERIOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes:
          'Typically installed in engine bay or under bonnet bracket near secondary battery.',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 1.5,
        positionType: 'FIXED',
        cogXMm: 3050,
        cogYMm: 0,
        mountingLocation: 'CABIN_INTERIOR',
        providesMountingLocations: [],
        confidence: 'COMMUNITY',
        source: 'USER_SUBMITTED',
        notes:
          'Typically installed in engine bay or under bonnet bracket near secondary battery.',
      },
    ],
  },
  {
    brandSlug: 'arb',
    categorySlug: 'dual-battery-system',
    name: 'ARB LINX Battery Management System',
    slug: 'linx-battery-management',
    description:
      'Smart dual-battery management system with 40A DC-DC charging, MPPT solar input up to 40A, and in-cab display for real-time battery status monitoring.',
    priceMin: 699,
    priceMax: 899,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 2.2,
        positionType: 'FIXED',
        cogXMm: 2900,
        cogYMm: 0,
        mountingLocation: 'CABIN_INTERIOR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Main unit installs in engine bay. In-cab display uses separate harness.',
      },
      {
        vehicleKey: 'nissan/patrol/ti-diesel-4x4-2013-2025',
        installedWeightKg: 2.2,
        positionType: 'FIXED',
        cogXMm: 2700,
        cogYMm: 0,
        mountingLocation: 'CABIN_INTERIOR',
        providesMountingLocations: [],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Main unit installs in engine bay. In-cab display uses separate harness.',
      },
    ],
  },

  // ---- CANOPY / TRAY ----
  {
    brandSlug: 'msa-4x4',
    categorySlug: 'canopy-tray',
    name: 'MSA 4x4 Aluminium Canopy – Toyota HiLux',
    slug: 'aluminium-canopy-hilux',
    description:
      'Full-height aluminium canopy for Toyota HiLux dual cab. Side-hinged rear door, dual gull-wing side doors with gas struts, and full weatherproof sealing.',
    priceMin: 4499,
    priceMax: 5999,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 90,
        positionType: 'FIXED',
        startXMm: -1150,
        endXMm: 280,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [
          'CANOPY_INTERIOR',
          'CANOPY_EXTERIOR',
          'CANOPY_ROOF',
        ],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Installs on OEM or aftermarket tray. Requires side-rail mounting kit.',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 90,
        positionType: 'FIXED',
        startXMm: -1150,
        endXMm: 280,
        mountingLocation: 'TRAY_FLOOR',
        providesMountingLocations: [
          'CANOPY_INTERIOR',
          'CANOPY_EXTERIOR',
          'CANOPY_ROOF',
        ],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Installs on OEM or aftermarket tray. Requires side-rail mounting kit.',
      },
    ],
  },
  {
    brandSlug: 'msa-4x4',
    categorySlug: 'canopy-tray',
    name: 'MSA 4x4 Steel Tray – Toyota HiLux',
    slug: 'steel-tray-hilux',
    description:
      '3mm steel replacement tray for Toyota HiLux dual cab with 100mm headboard, drop-side rails, and eight heavy-duty tie-down rings. 1780mm × 1520mm load area.',
    priceMin: 2499,
    priceMax: 3499,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 125,
        positionType: 'FIXED',
        startXMm: -1250,
        endXMm: 350,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: [
          'TRAY_FLOOR',
          'TRAY_SIDE_LEFT',
          'TRAY_SIDE_RIGHT',
          'TRAY_HEADBOARD',
        ],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Replaces factory plastic tub. Requires removal of OEM tub and cargo barrier.',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 125,
        positionType: 'FIXED',
        startXMm: -1250,
        endXMm: 350,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: [
          'TRAY_FLOOR',
          'TRAY_SIDE_LEFT',
          'TRAY_SIDE_RIGHT',
          'TRAY_HEADBOARD',
        ],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Replaces factory plastic tub. Requires removal of OEM tub and cargo barrier.',
      },
    ],
  },

  // ---- TOW BARS ----
  {
    brandSlug: 'arb',
    categorySlug: 'tow-bar',
    name: 'ARB Heavy Duty Tow Bar – Toyota HiLux',
    slug: 'heavy-duty-tow-bar-hilux',
    description:
      'Heavy-duty bolt-on tow bar for Toyota HiLux with 50mm square receiver hitch. 3500kg braked towing capacity, 350kg ball download. Includes 7-pin flat wiring harness.',
    priceMin: 799,
    priceMax: 999,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 14,
        positionType: 'FIXED',
        cogXMm: -1150,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: ['TOW_HITCH'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 14,
        positionType: 'FIXED',
        cogXMm: -1150,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: ['TOW_HITCH'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'tjm',
    categorySlug: 'tow-bar',
    name: 'TJM Tow Bar – Ford Ranger',
    slug: 'tow-bar-ranger',
    description:
      'Bolt-on tow bar for Ford Ranger with 50mm square receiver hitch. Includes standard ball mount and 7-pin wiring harness. 3500kg braked towing capacity.',
    priceMin: 699,
    priceMax: 899,
    fitments: [
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2015-2022',
        installedWeightKg: 13,
        positionType: 'FIXED',
        cogXMm: -1050,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: ['TOW_HITCH'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        vehicleKey: 'ford/ranger/xlt-4x4-auto-2023-2026',
        installedWeightKg: 13,
        positionType: 'FIXED',
        cogXMm: -1060,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: ['TOW_HITCH'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'kaymar',
    categorySlug: 'tow-bar',
    name: 'Kaymar Steel Rear Bar – Toyota HiLux',
    slug: 'steel-rear-bar-hilux',
    description:
      'Heavy-duty steel rear bar for Toyota HiLux featuring integrated 50mm receiver hitch, dual spare wheel carriers, and jerry can holder. Replaces factory rear bumper.',
    priceMin: 2299,
    priceMax: 2899,
    fitments: [
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2015-2022',
        installedWeightKg: 35,
        positionType: 'FIXED',
        cogXMm: -1200,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: ['REAR_BAR', 'TOW_HITCH'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Replaces factory rear bumper. Includes provision for 7-pin trailer plug.',
      },
      {
        vehicleKey: 'toyota/hilux/sr5-auto-4x4-2023-2026',
        installedWeightKg: 35,
        positionType: 'FIXED',
        cogXMm: -1200,
        cogYMm: 0,
        mountingLocation: 'CHASSIS_REAR',
        providesMountingLocations: ['REAR_BAR', 'TOW_HITCH'],
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
        notes:
          'Replaces factory rear bumper. Includes provision for 7-pin trailer plug.',
      },
    ],
  },

  // ---- CARAVAN ACCESSORIES ----

  // Solar panels
  {
    brandSlug: 'redarc',
    categorySlug: 'solar-panel',
    name: 'Redarc 200W Mono Solar Panel',
    slug: 'redarc-200w-mono-solar-panel',
    description:
      '200W monocrystalline solar panel with anodised aluminium frame and pre-drilled mounting holes. IP65 rated junction box. Suits most caravan rooftop installations.',
    priceMin: 499,
    priceMax: 649,
    fitments: [
      {
        caravanKey: 'jayco/silverline/21-65-3-2020-2026',
        installedWeightKg: 16,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_ROOF',
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'jayco/silverline/24-65-3-2022-2026',
        installedWeightKg: 16,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_ROOF',
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'jayco/journey/17-58-3-2018-2022',
        installedWeightKg: 16,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_ROOF',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'victron-energy',
    categorySlug: 'solar-panel',
    name: 'Victron 175W Mono Solar Panel',
    slug: 'victron-175w-mono-solar-panel',
    description:
      '175W monocrystalline solar panel from Victron Energy. Lightweight aluminium frame with 5 × 2 cell layout. Compatible with Victron MPPT charge controllers.',
    priceMin: 429,
    priceMax: 549,
    fitments: [
      {
        caravanKey: 'jayco/silverline/21-65-3-2020-2026',
        installedWeightKg: 12,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_ROOF',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'coromal/lifestyle/623s-2021-2026',
        installedWeightKg: 12,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_ROOF',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },

  // Awnings
  {
    brandSlug: 'carefree',
    categorySlug: 'awning',
    name: 'Carefree 2.5m Roll-Out Awning',
    slug: 'carefree-2-5m-awning',
    description:
      '2.5m electric roll-out awning with aluminium extrusion arm and UV-resistant acrylic fabric. Includes wind sensor and manual override.',
    priceMin: 1299,
    priceMax: 1699,
    fitments: [
      {
        caravanKey: 'jayco/silverline/21-65-3-2020-2026',
        installedWeightKg: 22,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_WALL_LEFT',
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'jayco/silverline/24-65-3-2022-2026',
        installedWeightKg: 22,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_WALL_LEFT',
        confidence: 'MANUFACTURER_SPEC',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },
  {
    brandSlug: 'dometic',
    categorySlug: 'awning',
    name: 'Dometic 3.0m Roll-Out Awning',
    slug: 'dometic-3-0m-awning',
    description:
      '3.0m manual or electric roll-out awning. Anodised aluminium housing and arms with Sunbrella®-grade fabric. Fits most full-height caravans.',
    priceMin: 1499,
    priceMax: 1999,
    fitments: [
      {
        caravanKey: 'jayco/silverline/21-65-3-2020-2026',
        installedWeightKg: 28,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_WALL_LEFT',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'jayco/silverline/24-65-3-2022-2026',
        installedWeightKg: 28,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_WALL_LEFT',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'coromal/lifestyle/623s-2021-2026',
        installedWeightKg: 28,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_WALL_LEFT',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },

  // Spare wheel carrier
  {
    brandSlug: 'are',
    categorySlug: 'spare-wheel-carrier',
    name: 'A.R.E. Swing-Away Spare Tyre Carrier',
    slug: 'are-swing-away-spare-carrier',
    description:
      'Heavy-duty swing-away spare tyre carrier for caravan A-frames and drawbars. Suits tyres up to 265/75R16. Hot-dip galvanised finish.',
    priceMin: 849,
    priceMax: 1199,
    fitments: [
      {
        caravanKey: 'jayco/silverline/21-65-3-2020-2026',
        installedWeightKg: 18,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_A_FRAME',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'jayco/silverline/24-65-3-2022-2026',
        installedWeightKg: 18,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_A_FRAME',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'jayco/journey/17-58-3-2018-2022',
        installedWeightKg: 16,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_A_FRAME',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
      {
        caravanKey: 'coromal/lifestyle/623s-2021-2026',
        installedWeightKg: 18,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_A_FRAME',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
      },
    ],
  },

  // Additional water tank
  {
    brandSlug: 'henna',
    categorySlug: 'water-tank',
    name: 'Henna 40L Underslung Water Tank',
    slug: 'henna-40l-underslung-tank',
    description:
      '40L polyethylene underslung water tank with brass fittings. Mounts to caravan chassis rails. Food-grade material rated for potable water storage.',
    priceMin: 349,
    priceMax: 499,
    fitments: [
      {
        caravanKey: 'jayco/silverline/21-65-3-2020-2026',
        installedWeightKg: 6,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_UNDERBODY',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
        notes: 'Full tank adds ~40 kg to payload.',
      },
      {
        caravanKey: 'jayco/silverline/24-65-3-2022-2026',
        installedWeightKg: 6,
        positionType: 'FIXED',
        mountingLocation: 'CARAVAN_UNDERBODY',
        confidence: 'ESTIMATED',
        source: 'AFTERMARKET_VERIFIED',
        notes: 'Full tank adds ~40 kg to payload.',
      },
    ],
  },
];

async function seedAccessories() {
  console.log('Seeding accessories...');

  // 1. Brands
  const brandMap = new Map<string, string>();
  for (const b of accessoryBrandData) {
    const brand = await prisma.accessoryBrand.upsert({
      where: { slug: b.slug },
      update: {},
      create: { name: b.name, slug: b.slug, websiteUrl: b.websiteUrl },
    });
    brandMap.set(b.slug, brand.id);
  }

  // 2. Categories
  const categoryMap = new Map<string, string>();
  for (const c of accessoryCategoryData) {
    const category = await prisma.accessoryCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        displayOrder: c.displayOrder,
        iconName: c.iconName,
      },
    });
    categoryMap.set(c.slug, category.id);
  }

  // 3. Build vehicle variant lookup map
  const variantRows = await prisma.vehicleVariant.findMany({
    select: {
      id: true,
      slug: true,
      model: {
        select: {
          slug: true,
          make: { select: { slug: true } },
        },
      },
    },
  });
  const variantMap = new Map<string, string>();
  for (const v of variantRows) {
    variantMap.set(`${v.model.make.slug}/${v.model.slug}/${v.slug}`, v.id);
  }

  // 3b. Build caravan variant lookup map
  const caravanVariantRows = await prisma.caravanVariant.findMany({
    select: {
      id: true,
      slug: true,
      model: {
        select: {
          slug: true,
          make: { select: { slug: true } },
        },
      },
    },
  });
  const caravanVariantMap = new Map<string, string>();
  for (const v of caravanVariantRows) {
    caravanVariantMap.set(
      `${v.model.make.slug}/${v.model.slug}/${v.slug}`,
      v.id,
    );
  }

  // 4. Accessories + fitments
  let accessoryCount = 0;
  let fitmentCount = 0;

  for (const acc of accessoryData) {
    const brandId = brandMap.get(acc.brandSlug);
    const categoryId = categoryMap.get(acc.categorySlug);
    if (!brandId || !categoryId) {
      console.warn(`  Skipping ${acc.name}: missing brand or category`);
      continue;
    }

    const accessory = await prisma.accessory.upsert({
      where: { brandId_slug: { brandId, slug: acc.slug } },
      update: {},
      create: {
        brandId,
        categoryId,
        name: acc.name,
        slug: acc.slug,
        description: acc.description,
        priceMin: acc.priceMin,
        priceMax: acc.priceMax,
        status: 'ACTIVE',
        market: 'AU',
      },
    });
    accessoryCount++;

    for (const f of acc.fitments) {
      const vehicleVariantId = f.vehicleKey
        ? variantMap.get(f.vehicleKey)
        : undefined;
      const caravanVariantId = f.caravanKey
        ? caravanVariantMap.get(f.caravanKey)
        : undefined;

      if (!vehicleVariantId && !caravanVariantId) {
        const key = f.vehicleKey ?? f.caravanKey ?? '(unknown)';
        console.warn(`  Skipping fitment: variant not found for key "${key}"`);
        continue;
      }

      const existing = await prisma.accessoryFitment.findFirst({
        where: {
          accessoryId: accessory.id,
          vehicleVariantId: vehicleVariantId ?? null,
          caravanVariantId: caravanVariantId ?? null,
          mountingLocation: f.mountingLocation as MountingLocation,
        },
      });

      if (!existing) {
        await prisma.accessoryFitment.create({
          data: {
            accessoryId: accessory.id,
            vehicleVariantId: vehicleVariantId ?? null,
            caravanVariantId: caravanVariantId ?? null,
            installedWeightKg: f.installedWeightKg,
            positionType: f.positionType as PositionType,
            cogXMm: f.cogXMm,
            cogYMm: f.cogYMm,
            startXMm: f.startXMm,
            endXMm: f.endXMm,
            mountingLocation: f.mountingLocation as MountingLocation,
            providesMountingLocations: (f.providesMountingLocations ??
              []) as MountingLocation[],
            confidence: (f.confidence ?? 'ESTIMATED') as FitmentConfidence,
            source: (f.source ?? 'USER_SUBMITTED') as FitmentSource,
            notes: f.notes,
          },
        });
        fitmentCount++;
      }
    }
  }

  const brandCount = await prisma.accessoryBrand.count();
  const categoryCount = await prisma.accessoryCategory.count();
  console.log(
    `  Accessories: ${brandCount} brands, ${categoryCount} categories, ${accessoryCount} accessories, ${fitmentCount} fitments`,
  );
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

async function seedVehicles() {
  console.log('Seeding vehicles...');

  for (const makeData of vehicleData) {
    const make = await prisma.vehicleMake.upsert({
      where: { slug: makeData.slug },
      update: {},
      create: {
        name: makeData.name,
        slug: makeData.slug,
        countryOfOrigin: makeData.countryOfOrigin,
      },
    });

    for (const modelData of makeData.models) {
      const model = await prisma.vehicleModel.upsert({
        where: { makeId_slug: { makeId: make.id, slug: modelData.slug } },
        update: {},
        create: {
          makeId: make.id,
          name: modelData.name,
          slug: modelData.slug,
          bodyType: modelData.bodyType,
        },
      });

      for (const variantData of modelData.variants) {
        await prisma.vehicleVariant.upsert({
          where: {
            modelId_slug: { modelId: model.id, slug: variantData.slug },
          },
          update: {},
          create: {
            modelId: model.id,
            name: variantData.name,
            slug: variantData.slug,
            yearFrom: variantData.yearFrom,
            yearTo: variantData.yearTo,
            isCurrentProduction: variantData.isCurrentProduction,
            gvmKg: variantData.gvmKg,
            gcmKg: variantData.gcmKg,
            kerbWeightKg: variantData.kerbWeightKg,
            maxTowingCapacityKg: variantData.maxTowingCapacityKg,
            frontAxleLimitKg: variantData.frontAxleLimitKg,
            rearAxleLimitKg: variantData.rearAxleLimitKg,
            wheelbaseMm: variantData.wheelbaseMm,
            frontOverhangMm: variantData.frontOverhangMm,
            rearOverhangMm: variantData.rearOverhangMm,
            totalLengthMm: variantData.totalLengthMm,
            maxTowBallDownloadKg: variantData.maxTowBallDownloadKg,
            fuelTankCapacityL: variantData.fuelTankCapacityL,
            fuelType: variantData.fuelType,
            market: 'AU',
          },
        });
      }
    }
  }

  const vMakeCount = await prisma.vehicleMake.count();
  const vModelCount = await prisma.vehicleModel.count();
  const vVariantCount = await prisma.vehicleVariant.count();
  console.log(
    `  Vehicles: ${vMakeCount} makes, ${vModelCount} models, ${vVariantCount} variants`,
  );
}

async function seedCaravans() {
  console.log('Seeding caravans...');

  for (const makeData of caravanData) {
    const make = await prisma.caravanMake.upsert({
      where: { slug: makeData.slug },
      update: {},
      create: {
        name: makeData.name,
        slug: makeData.slug,
        countryOfOrigin: makeData.countryOfOrigin,
      },
    });

    for (const modelData of makeData.models) {
      const model = await prisma.caravanModel.upsert({
        where: { makeId_slug: { makeId: make.id, slug: modelData.slug } },
        update: {},
        create: {
          makeId: make.id,
          name: modelData.name,
          slug: modelData.slug,
          bodyType: modelData.bodyType,
        },
      });

      for (const variantData of modelData.variants) {
        await prisma.caravanVariant.upsert({
          where: {
            modelId_slug: { modelId: model.id, slug: variantData.slug },
          },
          update: {},
          create: {
            modelId: model.id,
            name: variantData.name,
            slug: variantData.slug,
            yearFrom: variantData.yearFrom,
            yearTo: variantData.yearTo,
            isCurrentProduction: variantData.isCurrentProduction,
            atmKg: variantData.atmKg,
            gtmKg: variantData.gtmKg,
            tareKg: variantData.tareKg,
            tbmKg: variantData.tbmKg,
            axleConfiguration: variantData.axleConfiguration,
            couplingToAxleMm: variantData.couplingToAxleMm,
            axleSpacingMm: variantData.axleSpacingMm,
            bodyLengthMm: variantData.bodyLengthMm,
            overallLengthMm: variantData.overallLengthMm,
            freshWaterCapacityL: variantData.freshWaterCapacityL,
            greyWaterCapacityL: variantData.greyWaterCapacityL,
            gasBottleConfig: variantData.gasBottleConfig,
            market: 'AU',
          },
        });
      }
    }
  }

  const cMakeCount = await prisma.caravanMake.count();
  const cModelCount = await prisma.caravanModel.count();
  const cVariantCount = await prisma.caravanVariant.count();
  console.log(
    `  Caravans: ${cMakeCount} makes, ${cModelCount} models, ${cVariantCount} variants`,
  );
}

async function seedAdminUsers() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const hashedPw = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'changeme-admin',
      12,
    );
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'ADMIN', trustTier: 'TRUSTED' },
      create: {
        email: adminEmail,
        name: 'Admin',
        role: 'ADMIN',
        trustTier: 'TRUSTED',
        password: hashedPw,
      },
    });
    console.log(`Seeded admin user: ${adminEmail}`);
  }

  if (process.env.NODE_ENV === 'development') {
    const modPw = await bcrypt.hash('changeme-mod', 12);
    await prisma.user.upsert({
      where: { email: 'moderator@travellingbuddy.dev' },
      update: { role: 'MODERATOR', trustTier: 'TRUSTED' },
      create: {
        email: 'moderator@travellingbuddy.dev',
        name: 'Dev Moderator',
        role: 'MODERATOR',
        trustTier: 'TRUSTED',
        password: modPw,
      },
    });
    console.log('Seeded dev moderator user: moderator@travellingbuddy.dev');
  }
}

async function seedTrustTierConfig() {
  // Find any ADMIN user to associate config rows with
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  if (!adminUser) {
    console.log('No ADMIN user found — skipping trust tier config seed');
    return;
  }

  const defaults: { key: string; value: number }[] = [
    { key: 'contributorApprovedCount', value: 1 },
    { key: 'trustedApprovedCount', value: 5 },
    { key: 'trustedMinAccountAgeDays', value: 60 },
    { key: 'trustedRejectionWindowDays', value: 30 },
  ];

  for (const { key, value } of defaults) {
    await prisma.adminConfig.upsert({
      where: { key },
      update: {},
      create: { key, value, updatedById: adminUser.id },
    });
  }
  console.log('Seeded trust tier config defaults');
}

async function main() {
  console.log('Starting seed...');
  await seedAdminUsers();
  await seedTrustTierConfig();
  await seedVehicles();
  await seedCaravans();
  await seedAccessories();
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
