import { AdminPageHeader } from "@/modules/admin/components";
import { SponsorForm } from "../_components/SponsorForm";

export const metadata = { title: "New Sponsor — Admin" };

export default function NewSponsorPage() {
  return (
    <div>
      <AdminPageHeader
        title="New Sponsor"
        description="Add a new sponsor to the platform."
      />
      <SponsorForm backHref="/admin/sponsorship" />
    </div>
  );
}
