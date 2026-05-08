import { AdminPageHeader } from "@/modules/admin/components";
import { BrandForm } from "../BrandForm";

export default function NewBrandPage() {
  return (
    <div>
      <AdminPageHeader
        title="New Brand"
        description="Add a new accessory brand to the catalogue."
      />
      <BrandForm backHref="/admin/catalogue/brands" />
    </div>
  );
}
