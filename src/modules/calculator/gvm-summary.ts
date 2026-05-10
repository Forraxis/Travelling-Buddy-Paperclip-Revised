export type FuelType = "DIESEL" | "PETROL" | "HYBRID" | "ELECTRIC";

const FUEL_DENSITY_KG_PER_L: Record<FuelType, number> = {
  DIESEL: 0.84,
  PETROL: 0.73,
  HYBRID: 0.73,
  ELECTRIC: 0,
};

export interface GvmSummaryInputs {
  kerbWeightKg: number;
  gvmRatingKg: number;

  fuelTankCapacityL: number;
  fuelType: FuelType;
  fuelPercent: number; // 0–100

  // Vehicle onboard tanks (0 if none)
  freshWaterCapacityL: number;
  freshWaterPercent: number; // 0–100
  greyWaterCapacityL: number;
  greyWaterPercent: number; // 0–100

  passengers: number;
  passengerWeightKg: number;
  cargoKg: number;

  accessoriesMassKg: number;

  towBallLoadKg: number;
}

export interface GvmSummaryResult {
  kerbWeightKg: number;
  fuelMassKg: number;
  freshWaterMassKg: number;
  greyWaterMassKg: number;
  passengerMassKg: number;
  cargoKg: number;
  accessoriesMassKg: number;
  towBallLoadKg: number;

  totalGvmKg: number;
  gvmRatingKg: number;
  payloadRemainingKg: number;
}

export function calculateGvmSummary(inputs: GvmSummaryInputs): GvmSummaryResult {
  const fuelMassKg =
    (Math.max(0, inputs.fuelPercent) / 100) *
    Math.max(0, inputs.fuelTankCapacityL) *
    FUEL_DENSITY_KG_PER_L[inputs.fuelType];

  const freshWaterMassKg =
    (Math.max(0, inputs.freshWaterPercent) / 100) * Math.max(0, inputs.freshWaterCapacityL);

  const greyWaterMassKg =
    (Math.max(0, inputs.greyWaterPercent) / 100) * Math.max(0, inputs.greyWaterCapacityL);

  const passengerMassKg = Math.max(0, inputs.passengers) * Math.max(0, inputs.passengerWeightKg);

  const cargoKg = Math.max(0, inputs.cargoKg);
  const accessoriesMassKg = Math.max(0, inputs.accessoriesMassKg);
  const towBallLoadKg = Math.max(0, inputs.towBallLoadKg);

  const totalGvmKg =
    inputs.kerbWeightKg +
    fuelMassKg +
    freshWaterMassKg +
    greyWaterMassKg +
    passengerMassKg +
    cargoKg +
    accessoriesMassKg +
    towBallLoadKg;

  return {
    kerbWeightKg: inputs.kerbWeightKg,
    fuelMassKg,
    freshWaterMassKg,
    greyWaterMassKg,
    passengerMassKg,
    cargoKg,
    accessoriesMassKg,
    towBallLoadKg,
    totalGvmKg,
    gvmRatingKg: inputs.gvmRatingKg,
    payloadRemainingKg: inputs.gvmRatingKg - totalGvmKg,
  };
}

export function sumAccessoriesMass(accessories: { massKg: number }[]): number {
  return accessories.reduce((sum, a) => sum + (a.massKg ?? 0), 0);
}
