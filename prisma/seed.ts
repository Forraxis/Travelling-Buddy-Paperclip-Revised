import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Vehicle seed data
// ---------------------------------------------------------------------------

const vehicleMakes = [
  { name: "Toyota", slug: "toyota", countryOfOrigin: "Japan" },
  { name: "Ford", slug: "ford", countryOfOrigin: "USA" },
  { name: "Nissan", slug: "nissan", countryOfOrigin: "Japan" },
  { name: "Mitsubishi", slug: "mitsubishi", countryOfOrigin: "Japan" },
  { name: "Isuzu", slug: "isuzu", countryOfOrigin: "Japan" },
  { name: "Mazda", slug: "mazda", countryOfOrigin: "Japan" },
  { name: "Land Rover", slug: "land-rover", countryOfOrigin: "UK" },
  { name: "Jeep", slug: "jeep", countryOfOrigin: "USA" },
] as const;

type VehicleBodyType =
  | "DUAL_CAB_UTE"
  | "SINGLE_CAB_UTE"
  | "EXTRA_CAB_UTE"
  | "WAGON"
  | "SUV"
  | "VAN"
  | "TROOPCARRIER"
  | "OTHER";

type FuelType = "DIESEL" | "PETROL" | "HYBRID" | "ELECTRIC";

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
    name: "Toyota",
    slug: "toyota",
    countryOfOrigin: "Japan",
    models: [
      {
        name: "HiLux",
        slug: "hilux",
        bodyType: "DUAL_CAB_UTE",
        variants: [
          {
            name: "SR5 Auto 4x4",
            slug: "sr5-auto-4x4-2015-2022",
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
            fuelType: "DIESEL",
          },
          {
            name: "SR5 Auto 4x4",
            slug: "sr5-auto-4x4-2023-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "WorkMate 4x2",
            slug: "workmate-4x2-2020-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "LandCruiser 200 Series",
        slug: "landcruiser-200-series",
        bodyType: "WAGON",
        variants: [
          {
            name: "GXL Diesel",
            slug: "gxl-diesel-2012-2021",
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
            fuelType: "DIESEL",
          },
          {
            name: "Sahara Diesel",
            slug: "sahara-diesel-2012-2021",
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
            fuelType: "DIESEL",
          },
          {
            name: "VX Diesel",
            slug: "vx-diesel-2015-2021",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "LandCruiser 300 Series",
        slug: "landcruiser-300-series",
        bodyType: "WAGON",
        variants: [
          {
            name: "GXL Diesel",
            slug: "gxl-diesel-2022-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "VX Diesel",
            slug: "vx-diesel-2022-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "Fortuner",
        slug: "fortuner",
        bodyType: "SUV",
        variants: [
          {
            name: "GXL Diesel",
            slug: "gxl-diesel-2016-2022",
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
            fuelType: "DIESEL",
          },
          {
            name: "GXL Diesel",
            slug: "gxl-diesel-2023-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "GR Sport Diesel",
            slug: "gr-sport-diesel-2022-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "Prado",
        slug: "prado",
        bodyType: "SUV",
        variants: [
          {
            name: "GXL Diesel",
            slug: "gxl-diesel-2010-2024",
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
            fuelType: "DIESEL",
          },
          {
            name: "VX Diesel",
            slug: "vx-diesel-2010-2024",
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
            fuelType: "DIESEL",
          },
        ],
      },
    ],
  },
  {
    name: "Ford",
    slug: "ford",
    countryOfOrigin: "USA",
    models: [
      {
        name: "Ranger",
        slug: "ranger",
        bodyType: "DUAL_CAB_UTE",
        variants: [
          {
            name: "XLT 4x4 Auto",
            slug: "xlt-4x4-auto-2015-2022",
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
            fuelType: "DIESEL",
          },
          {
            name: "XLT 4x4 Auto",
            slug: "xlt-4x4-auto-2023-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "Raptor V6",
            slug: "raptor-v6-2022-2026",
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
            fuelType: "PETROL",
          },
          {
            name: "Wildtrak 4x4 Auto",
            slug: "wildtrak-4x4-auto-2023-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "Everest",
        slug: "everest",
        bodyType: "SUV",
        variants: [
          {
            name: "Trend 4x4 Auto",
            slug: "trend-4x4-auto-2022-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "Titanium+ 4x4 Auto",
            slug: "titanium-plus-4x4-auto-2022-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
    ],
  },
  {
    name: "Nissan",
    slug: "nissan",
    countryOfOrigin: "Japan",
    models: [
      {
        name: "Navara",
        slug: "navara",
        bodyType: "DUAL_CAB_UTE",
        variants: [
          {
            name: "ST-X 4x4 Auto",
            slug: "st-x-4x4-auto-2015-2020",
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
            fuelType: "DIESEL",
          },
          {
            name: "Pro-4X 4x4 Auto",
            slug: "pro-4x-4x4-auto-2021-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "Patrol",
        slug: "patrol",
        bodyType: "WAGON",
        variants: [
          {
            name: "Ti Diesel 4x4",
            slug: "ti-diesel-4x4-2013-2025",
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
            fuelType: "DIESEL",
          },
          {
            name: "Ti-L Diesel 4x4",
            slug: "ti-l-diesel-4x4-2013-2025",
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
            fuelType: "DIESEL",
          },
        ],
      },
    ],
  },
  {
    name: "Mitsubishi",
    slug: "mitsubishi",
    countryOfOrigin: "Japan",
    models: [
      {
        name: "Triton",
        slug: "triton",
        bodyType: "DUAL_CAB_UTE",
        variants: [
          {
            name: "GLS Premium 4x4 Auto",
            slug: "gls-premium-4x4-auto-2015-2023",
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
            fuelType: "DIESEL",
          },
          {
            name: "GLS Premium 4x4 Auto",
            slug: "gls-premium-4x4-auto-2024-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "GSR 4x4 Auto",
            slug: "gsr-4x4-auto-2019-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "Pajero Sport",
        slug: "pajero-sport",
        bodyType: "SUV",
        variants: [
          {
            name: "GLS 4x4 Auto",
            slug: "gls-4x4-auto-2016-2022",
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
            fuelType: "DIESEL",
          },
          {
            name: "Exceed 4x4 Auto",
            slug: "exceed-4x4-auto-2020-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
    ],
  },
  {
    name: "Isuzu",
    slug: "isuzu",
    countryOfOrigin: "Japan",
    models: [
      {
        name: "D-Max",
        slug: "d-max",
        bodyType: "DUAL_CAB_UTE",
        variants: [
          {
            name: "X-Terrain 4x4 Auto",
            slug: "x-terrain-4x4-auto-2020-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "LS-T 4x4 Auto",
            slug: "ls-t-4x4-auto-2020-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
      {
        name: "MU-X",
        slug: "mu-x",
        bodyType: "SUV",
        variants: [
          {
            name: "LS-T 4x4 Auto",
            slug: "ls-t-4x4-auto-2022-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
    ],
  },
  {
    name: "Mazda",
    slug: "mazda",
    countryOfOrigin: "Japan",
    models: [
      {
        name: "BT-50",
        slug: "bt-50",
        bodyType: "DUAL_CAB_UTE",
        variants: [
          {
            name: "Thunder 4x4 Auto",
            slug: "thunder-4x4-auto-2020-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "SP 4x4 Auto",
            slug: "sp-4x4-auto-2021-2026",
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
            fuelType: "DIESEL",
          },
        ],
      },
    ],
  },
  {
    name: "Land Rover",
    slug: "land-rover",
    countryOfOrigin: "UK",
    models: [
      {
        name: "Defender",
        slug: "defender",
        bodyType: "WAGON",
        variants: [
          {
            name: "110 D300 SE",
            slug: "110-d300-se-2020-2026",
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
            fuelType: "DIESEL",
          },
          {
            name: "110 V8 Carpathian",
            slug: "110-v8-carpathian-2021-2026",
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
            fuelType: "PETROL",
          },
        ],
      },
    ],
  },
  {
    name: "Jeep",
    slug: "jeep",
    countryOfOrigin: "USA",
    models: [
      {
        name: "Wrangler",
        slug: "wrangler",
        bodyType: "SUV",
        variants: [
          {
            name: "Rubicon 4xe PHEV",
            slug: "rubicon-4xe-phev-2022-2026",
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
            fuelType: "HYBRID",
          },
          {
            name: "Sahara Diesel 4x4",
            slug: "sahara-diesel-4x4-2017-2023",
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
            fuelType: "DIESEL",
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
  | "CARAVAN_POP_TOP"
  | "CARAVAN_FULL_HEIGHT"
  | "OFF_ROAD_CARAVAN"
  | "CAMPER_TRAILER"
  | "HYBRID"
  | "FIFTH_WHEELER"
  | "OTHER";

type AxleConfiguration =
  | "SINGLE_AXLE"
  | "DUAL_AXLE_CLOSE_COUPLED"
  | "DUAL_AXLE_SPREAD"
  | "TRIPLE_AXLE";

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
    name: "Jayco",
    slug: "jayco",
    countryOfOrigin: "Australia",
    models: [
      {
        name: "Silverline",
        slug: "silverline",
        bodyType: "CARAVAN_FULL_HEIGHT",
        variants: [
          {
            name: "21.65-3",
            slug: "21-65-3-2020-2026",
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3300,
            gtmKg: 3000,
            tareKg: 2460,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 5200,
            axleSpacingMm: 1000,
            bodyLengthMm: 6600,
            overallLengthMm: 9400,
            freshWaterCapacityL: 120,
            greyWaterCapacityL: 90,
            gasBottleConfig: "2x9kg",
          },
          {
            name: "24.65-3",
            slug: "24-65-3-2022-2026",
            yearFrom: 2022,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3500,
            gtmKg: 3200,
            tareKg: 2650,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 5600,
            axleSpacingMm: 1000,
            bodyLengthMm: 7300,
            overallLengthMm: 10100,
            freshWaterCapacityL: 135,
            greyWaterCapacityL: 110,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
      {
        name: "Journey",
        slug: "journey",
        bodyType: "CARAVAN_POP_TOP",
        variants: [
          {
            name: "17.58-3",
            slug: "17-58-3-2018-2022",
            yearFrom: 2018,
            yearTo: 2022,
            isCurrentProduction: false,
            atmKg: 2200,
            gtmKg: 1900,
            tareKg: 1560,
            tbmKg: 300,
            axleConfiguration: "SINGLE_AXLE",
            couplingToAxleMm: 4200,
            bodyLengthMm: 5200,
            overallLengthMm: 7400,
            freshWaterCapacityL: 95,
            greyWaterCapacityL: 60,
            gasBottleConfig: "2x9kg",
          },
          {
            name: "17.58-3",
            slug: "17-58-3-2023-2026",
            yearFrom: 2023,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2200,
            gtmKg: 1900,
            tareKg: 1580,
            tbmKg: 300,
            axleConfiguration: "SINGLE_AXLE",
            couplingToAxleMm: 4200,
            bodyLengthMm: 5200,
            overallLengthMm: 7400,
            freshWaterCapacityL: 100,
            greyWaterCapacityL: 60,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
      {
        name: "Expanda",
        slug: "expanda",
        bodyType: "CARAVAN_POP_TOP",
        variants: [
          {
            name: "17.56-2OB",
            slug: "17-56-2ob-2019-2026",
            yearFrom: 2019,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2000,
            gtmKg: 1700,
            tareKg: 1380,
            tbmKg: 300,
            axleConfiguration: "SINGLE_AXLE",
            couplingToAxleMm: 4000,
            bodyLengthMm: 4980,
            overallLengthMm: 7000,
            freshWaterCapacityL: 80,
            greyWaterCapacityL: 55,
            gasBottleConfig: "1x9kg",
          },
        ],
      },
      {
        name: "Starcraft",
        slug: "starcraft",
        bodyType: "CARAVAN_FULL_HEIGHT",
        variants: [
          {
            name: "19.53-3",
            slug: "19-53-3-2020-2026",
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2800,
            gtmKg: 2500,
            tareKg: 2060,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 4800,
            axleSpacingMm: 1000,
            bodyLengthMm: 5960,
            overallLengthMm: 8700,
            freshWaterCapacityL: 100,
            greyWaterCapacityL: 80,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
    ],
  },
  {
    name: "Coromal",
    slug: "coromal",
    countryOfOrigin: "Australia",
    models: [
      {
        name: "Lifestyle",
        slug: "lifestyle",
        bodyType: "CARAVAN_FULL_HEIGHT",
        variants: [
          {
            name: "563S",
            slug: "563s-2019-2025",
            yearFrom: 2019,
            yearTo: 2025,
            isCurrentProduction: false,
            atmKg: 2900,
            gtmKg: 2600,
            tareKg: 2150,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 4900,
            axleSpacingMm: 1000,
            bodyLengthMm: 5900,
            overallLengthMm: 8700,
            freshWaterCapacityL: 115,
            greyWaterCapacityL: 85,
            gasBottleConfig: "2x9kg",
          },
          {
            name: "623S",
            slug: "623s-2021-2026",
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3100,
            gtmKg: 2800,
            tareKg: 2320,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 5300,
            axleSpacingMm: 1000,
            bodyLengthMm: 6400,
            overallLengthMm: 9200,
            freshWaterCapacityL: 130,
            greyWaterCapacityL: 95,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
      {
        name: "Element",
        slug: "element",
        bodyType: "CARAVAN_FULL_HEIGHT",
        variants: [
          {
            name: "560S",
            slug: "560s-2020-2026",
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2100,
            gtmKg: 1800,
            tareKg: 1480,
            tbmKg: 300,
            axleConfiguration: "SINGLE_AXLE",
            couplingToAxleMm: 4350,
            bodyLengthMm: 5200,
            overallLengthMm: 7300,
            freshWaterCapacityL: 90,
            greyWaterCapacityL: 65,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
    ],
  },
  {
    name: "Avan",
    slug: "avan",
    countryOfOrigin: "Australia",
    models: [
      {
        name: "Aspire",
        slug: "aspire",
        bodyType: "CARAVAN_FULL_HEIGHT",
        variants: [
          {
            name: "499 Ensuite",
            slug: "499-ensuite-2017-2022",
            yearFrom: 2017,
            yearTo: 2022,
            isCurrentProduction: false,
            atmKg: 1750,
            gtmKg: 1500,
            tareKg: 1180,
            tbmKg: 250,
            axleConfiguration: "SINGLE_AXLE",
            couplingToAxleMm: 3800,
            bodyLengthMm: 4700,
            overallLengthMm: 6600,
            freshWaterCapacityL: 80,
            greyWaterCapacityL: 50,
            gasBottleConfig: "1x9kg",
          },
          {
            name: "555 Outback",
            slug: "555-outback-2020-2026",
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2000,
            gtmKg: 1750,
            tareKg: 1380,
            tbmKg: 250,
            axleConfiguration: "SINGLE_AXLE",
            couplingToAxleMm: 4100,
            bodyLengthMm: 5100,
            overallLengthMm: 7100,
            freshWaterCapacityL: 95,
            greyWaterCapacityL: 60,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
      {
        name: "Sportliner",
        slug: "sportliner",
        bodyType: "OFF_ROAD_CARAVAN",
        variants: [
          {
            name: "621 Off-Road",
            slug: "621-off-road-2021-2026",
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3000,
            gtmKg: 2700,
            tareKg: 2200,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 5100,
            axleSpacingMm: 1000,
            bodyLengthMm: 6200,
            overallLengthMm: 9000,
            freshWaterCapacityL: 200,
            greyWaterCapacityL: 120,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
    ],
  },
  {
    name: "Lotus",
    slug: "lotus",
    countryOfOrigin: "Australia",
    models: [
      {
        name: "Freelander",
        slug: "freelander",
        bodyType: "CARAVAN_FULL_HEIGHT",
        variants: [
          {
            name: "Freelander 18",
            slug: "freelander-18-2020-2026",
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2800,
            gtmKg: 2500,
            tareKg: 2020,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 4900,
            axleSpacingMm: 1000,
            bodyLengthMm: 5600,
            overallLengthMm: 8400,
            freshWaterCapacityL: 110,
            greyWaterCapacityL: 80,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
      {
        name: "Trooper",
        slug: "trooper",
        bodyType: "OFF_ROAD_CARAVAN",
        variants: [
          {
            name: "Trooper 16 Off-Road",
            slug: "trooper-16-off-road-2019-2026",
            yearFrom: 2019,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3200,
            gtmKg: 2900,
            tareKg: 2350,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 5000,
            axleSpacingMm: 1000,
            bodyLengthMm: 5400,
            overallLengthMm: 8200,
            freshWaterCapacityL: 220,
            greyWaterCapacityL: 140,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
    ],
  },
  {
    name: "Kedron",
    slug: "kedron",
    countryOfOrigin: "Australia",
    models: [
      {
        name: "JP Series",
        slug: "jp-series",
        bodyType: "OFF_ROAD_CARAVAN",
        variants: [
          {
            name: "JP8",
            slug: "jp8-2015-2020",
            yearFrom: 2015,
            yearTo: 2020,
            isCurrentProduction: false,
            atmKg: 4500,
            gtmKg: 4000,
            tareKg: 3200,
            tbmKg: 500,
            axleConfiguration: "DUAL_AXLE_SPREAD",
            couplingToAxleMm: 4500,
            axleSpacingMm: 2200,
            bodyLengthMm: 5800,
            overallLengthMm: 8500,
            freshWaterCapacityL: 400,
            greyWaterCapacityL: 200,
            gasBottleConfig: "4x9kg",
          },
          {
            name: "JP9",
            slug: "jp9-2020-2026",
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 4800,
            gtmKg: 4300,
            tareKg: 3450,
            tbmKg: 500,
            axleConfiguration: "DUAL_AXLE_SPREAD",
            couplingToAxleMm: 4700,
            axleSpacingMm: 2200,
            bodyLengthMm: 6100,
            overallLengthMm: 8900,
            freshWaterCapacityL: 450,
            greyWaterCapacityL: 220,
            gasBottleConfig: "4x9kg",
          },
        ],
      },
    ],
  },
  {
    name: "New Age",
    slug: "new-age",
    countryOfOrigin: "Australia",
    models: [
      {
        name: "Manta Ray",
        slug: "manta-ray",
        bodyType: "OFF_ROAD_CARAVAN",
        variants: [
          {
            name: "176 Off-Road",
            slug: "176-off-road-2019-2026",
            yearFrom: 2019,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3000,
            gtmKg: 2700,
            tareKg: 2180,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 4900,
            axleSpacingMm: 1000,
            bodyLengthMm: 5500,
            overallLengthMm: 8300,
            freshWaterCapacityL: 230,
            greyWaterCapacityL: 130,
            gasBottleConfig: "2x9kg",
          },
          {
            name: "196 Off-Road",
            slug: "196-off-road-2021-2026",
            yearFrom: 2021,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 3500,
            gtmKg: 3200,
            tareKg: 2580,
            tbmKg: 300,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 5200,
            axleSpacingMm: 1000,
            bodyLengthMm: 6100,
            overallLengthMm: 9000,
            freshWaterCapacityL: 260,
            greyWaterCapacityL: 150,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
      {
        name: "Oz Classic",
        slug: "oz-classic",
        bodyType: "CARAVAN_FULL_HEIGHT",
        variants: [
          {
            name: "171SR",
            slug: "171sr-2018-2026",
            yearFrom: 2018,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 1900,
            gtmKg: 1650,
            tareKg: 1330,
            tbmKg: 250,
            axleConfiguration: "SINGLE_AXLE",
            couplingToAxleMm: 4000,
            bodyLengthMm: 5000,
            overallLengthMm: 6900,
            freshWaterCapacityL: 90,
            greyWaterCapacityL: 60,
            gasBottleConfig: "2x9kg",
          },
          {
            name: "201SR",
            slug: "201sr-2020-2026",
            yearFrom: 2020,
            yearTo: 2026,
            isCurrentProduction: true,
            atmKg: 2400,
            gtmKg: 2150,
            tareKg: 1780,
            tbmKg: 250,
            axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
            couplingToAxleMm: 4700,
            axleSpacingMm: 1000,
            bodyLengthMm: 5900,
            overallLengthMm: 8600,
            freshWaterCapacityL: 110,
            greyWaterCapacityL: 75,
            gasBottleConfig: "2x9kg",
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

async function seedVehicles() {
  console.log("Seeding vehicles...");

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
          where: { modelId_slug: { modelId: model.id, slug: variantData.slug } },
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
            market: "AU",
          },
        });
      }
    }
  }

  const vMakeCount = await prisma.vehicleMake.count();
  const vModelCount = await prisma.vehicleModel.count();
  const vVariantCount = await prisma.vehicleVariant.count();
  console.log(
    `  Vehicles: ${vMakeCount} makes, ${vModelCount} models, ${vVariantCount} variants`
  );
}

async function seedCaravans() {
  console.log("Seeding caravans...");

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
          where: { modelId_slug: { modelId: model.id, slug: variantData.slug } },
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
            market: "AU",
          },
        });
      }
    }
  }

  const cMakeCount = await prisma.caravanMake.count();
  const cModelCount = await prisma.caravanModel.count();
  const cVariantCount = await prisma.caravanVariant.count();
  console.log(
    `  Caravans: ${cMakeCount} makes, ${cModelCount} models, ${cVariantCount} variants`
  );
}

async function main() {
  console.log("Starting seed...");
  await seedVehicles();
  await seedCaravans();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
