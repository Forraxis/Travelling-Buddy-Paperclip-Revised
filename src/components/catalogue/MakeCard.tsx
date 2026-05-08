import Link from "next/link";
import type { VehicleMakeDto } from "@/modules/catalogue/types/vehicle.types";
import type { CaravanMakeDto } from "@/modules/catalogue/types/caravan.types";

type MakeDto = VehicleMakeDto | CaravanMakeDto;

interface Props {
  make: MakeDto;
  href: string;
  modelCount?: number;
}

export function MakeCard({ make, href, modelCount }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-xl border border-tb-neutral-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-tb-primary group-hover:text-tb-primary-light">
          {make.name}
        </span>
        {make.countryOfOrigin && (
          <span className="text-xs text-gray-400">{make.countryOfOrigin}</span>
        )}
      </div>
      {modelCount !== undefined && (
        <span className="text-xs text-gray-500">
          {modelCount} {modelCount === 1 ? "model" : "models"}
        </span>
      )}
    </Link>
  );
}
