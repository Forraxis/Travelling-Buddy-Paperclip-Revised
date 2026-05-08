import Link from "next/link";
import type { VehicleModelDto } from "@/modules/catalogue/types/vehicle.types";
import type { CaravanModelDto } from "@/modules/catalogue/types/caravan.types";

type ModelDto = VehicleModelDto | CaravanModelDto;

function formatBodyType(bodyType: string): string {
  return bodyType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  model: ModelDto;
  href: string;
  variantCount?: number;
}

export function ModelCard({ model, href, variantCount }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-xl border border-tb-neutral-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <span className="text-base font-semibold text-tb-primary group-hover:text-tb-primary-light">
        {model.name}
      </span>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-tb-primary-lighter px-2 py-0.5 text-xs font-medium text-tb-primary">
          {formatBodyType(model.bodyType)}
        </span>
        {variantCount !== undefined && (
          <span className="text-xs text-gray-500">
            {variantCount} {variantCount === 1 ? "variant" : "variants"}
          </span>
        )}
      </div>
    </Link>
  );
}
