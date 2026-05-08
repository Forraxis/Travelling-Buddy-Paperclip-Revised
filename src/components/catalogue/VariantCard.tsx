import Link from "next/link";
import type { VehicleVariantDto } from "@/modules/catalogue/types/vehicle.types";
import type { CaravanVariantDto } from "@/modules/catalogue/types/caravan.types";

type VariantDto = VehicleVariantDto | CaravanVariantDto;

function yearRange(v: VariantDto): string {
  if ("isCurrentProduction" in v && v.isCurrentProduction) {
    return `${v.yearFrom}–present`;
  }
  return v.yearFrom === v.yearTo ? `${v.yearFrom}` : `${v.yearFrom}–${v.yearTo}`;
}

function isVehicleVariant(v: VariantDto): v is VehicleVariantDto {
  return "gvmKg" in v;
}

interface Props {
  variant: VariantDto;
  href?: string;
}

export function VariantCard({ variant, href }: Props) {
  const content = (
    <div className="flex flex-col gap-2 rounded-xl border border-tb-neutral-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-tb-primary">{variant.name}</span>
        <span className="shrink-0 text-xs text-gray-400">{yearRange(variant)}</span>
      </div>
      {isVehicleVariant(variant) ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-3">
          <div>
            <span className="text-gray-400">GVM</span>{" "}
            <span className="font-medium">{variant.gvmKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">GCM</span>{" "}
            <span className="font-medium">{variant.gcmKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">Tow cap.</span>{" "}
            <span className="font-medium">{variant.maxTowingCapacityKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">Kerb</span>{" "}
            <span className="font-medium">{variant.kerbWeightKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">TBM</span>{" "}
            <span className="font-medium">{variant.maxTowBallDownloadKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">Fuel</span>{" "}
            <span className="font-medium">{variant.fuelType}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-3">
          <div>
            <span className="text-gray-400">ATM</span>{" "}
            <span className="font-medium">{(variant as CaravanVariantDto).atmKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">GTM</span>{" "}
            <span className="font-medium">{(variant as CaravanVariantDto).gtmKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">Tare</span>{" "}
            <span className="font-medium">{(variant as CaravanVariantDto).tareKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">TBM</span>{" "}
            <span className="font-medium">{(variant as CaravanVariantDto).tbmKg.toLocaleString()} kg</span>
          </div>
          <div>
            <span className="text-gray-400">Body</span>{" "}
            <span className="font-medium">{Math.round((variant as CaravanVariantDto).bodyLengthMm / 1000 * 10) / 10} m</span>
          </div>
          <div>
            <span className="text-gray-400">Axle</span>{" "}
            <span className="font-medium capitalize">{(variant as CaravanVariantDto).axleConfiguration.replace(/_/g, " ").toLowerCase()}</span>
          </div>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}
