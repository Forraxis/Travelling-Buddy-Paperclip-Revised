import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import { getBrandByIdAction } from "@/modules/catalogue/actions/accessory-admin.actions";
import { BrandForm } from "../BrandForm";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrandByIdAction(brandId);
  if (!brand) notFound();

  return (
    <div>
      <AdminPageHeader
        title={brand.name}
        description={`Edit brand details for ${brand.name}.`}
      />
      <BrandForm brand={brand} backHref="/admin/catalogue/brands" />
    </div>
  );
}
