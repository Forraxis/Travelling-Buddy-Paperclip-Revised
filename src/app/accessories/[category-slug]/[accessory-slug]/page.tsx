import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { createAccessoryService } from "@/modules/catalogue/services/accessory.service";
import { createCategoryService } from "@/modules/catalogue/services/category.service";
import { Breadcrumbs } from "@/components/catalogue/Breadcrumbs";
import type { AccessoryDetailDto } from "@/modules/catalogue/types/accessory.types";

export const dynamic = "force-dynamic";

const accessoryService = createAccessoryService(prisma);
const categoryService = createCategoryService(prisma);

interface Props {
  params: Promise<{ "category-slug": string; "accessory-slug": string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "category-slug": categorySlug, "accessory-slug": accessorySlug } = await params;
  const accessory = await accessoryService.getDetailBySlug(accessorySlug, categorySlug);
  if (!accessory) return { title: "Accessory Not Found" };
  return {
    title: accessory.name,
    description: accessory.description ?? `${accessory.name} by ${accessory.brand.name}.`,
  };
}

function FitmentsList({ accessory }: { accessory: AccessoryDetailDto }) {
  const vehicleFitments = accessory.fitments.filter((f) => f.vehicleVariantId);
  const caravanFitments = accessory.fitments.filter((f) => f.caravanVariantId);

  if (accessory.fitments.length === 0) {
    return (
      <p className="text-sm text-gray-400">No fitment data available.</p>
    );
  }

  return (
    <div className="space-y-3">
      {vehicleFitments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Vehicle Fitments</h3>
          <ul className="mt-1 space-y-1">
            {vehicleFitments.map((f) => (
              <li key={f.id} className="text-sm text-gray-600">
                {f.mountingLocation} — {f.installedWeightKg} kg
                {f.confidence !== "VERIFIED" && (
                  <span className="ml-1 text-xs text-gray-400">({f.confidence})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {caravanFitments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Caravan Fitments</h3>
          <ul className="mt-1 space-y-1">
            {caravanFitments.map((f) => (
              <li key={f.id} className="text-sm text-gray-600">
                {f.mountingLocation} — {f.installedWeightKg} kg
                {f.confidence !== "VERIFIED" && (
                  <span className="ml-1 text-xs text-gray-400">({f.confidence})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function AccessoryDetailPage({ params }: Props) {
  const { "category-slug": categorySlug, "accessory-slug": accessorySlug } = await params;

  const [accessory, category] = await Promise.all([
    accessoryService.getDetailBySlug(accessorySlug, categorySlug),
    categoryService.getBySlug(categorySlug),
  ]);

  if (!accessory || !category) notFound();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { label: "Accessories", href: "/accessories" },
          { label: category.name, href: `/accessories/${categorySlug}` },
          { label: accessory.name },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-4">
          {accessory.imageUrls.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={accessory.imageUrls[0]}
              alt={accessory.name}
              className="w-full rounded-xl border border-tb-neutral-200 object-cover"
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-tb-neutral-200 bg-tb-neutral-50 text-gray-300">
              No image
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">
              <Link
                href={`/accessories`}
                className="hover:text-tb-primary hover:underline"
              >
                {accessory.brand.name}
              </Link>
              {" · "}
              <Link
                href={`/accessories/${categorySlug}`}
                className="hover:text-tb-primary hover:underline"
              >
                {accessory.category.name}
              </Link>
            </p>
            <h1 className="mt-1 text-2xl font-bold text-tb-primary">{accessory.name}</h1>
          </div>

          {(accessory.priceMin !== null || accessory.priceMax !== null) && (
            <div className="text-lg font-semibold text-gray-800">
              {accessory.priceMin !== null && accessory.priceMax !== null
                ? `${accessory.currencyCode} ${accessory.priceMin.toFixed(2)} – ${accessory.priceMax.toFixed(2)}`
                : accessory.priceMin !== null
                ? `From ${accessory.currencyCode} ${accessory.priceMin.toFixed(2)}`
                : `Up to ${accessory.currencyCode} ${accessory.priceMax!.toFixed(2)}`}
            </div>
          )}

          {accessory.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{accessory.description}</p>
          )}

          {accessory.affiliateUrl && (
            <a
              href={accessory.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-tb-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-tb-primary-light"
            >
              Buy Now
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-tb-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-tb-primary">Fitment Information</h2>
        <FitmentsList accessory={accessory} />
      </div>
    </div>
  );
}
