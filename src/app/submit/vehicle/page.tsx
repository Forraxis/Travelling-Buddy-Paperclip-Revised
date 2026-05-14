import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { VehicleSubmitForm } from "./_components/VehicleSubmitForm";

export const metadata = {
  title: "Submit a Vehicle — TravellingBuddy",
  description: "Submit a vehicle variant not yet in our catalogue.",
};

export default async function SubmitVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ resubmit?: string }>;
}) {
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;
  const { resubmit } = await searchParams;

  let initialValues: Partial<{
    makeId: string;
    newMakeName: string;
    modelId: string;
    newModelName: string;
    year: string;
    variantName: string;
    bodyType: string;
    drivetrain: string;
    transmission: string;
    fuelType: string;
    gvmKg: string;
    gcmKg: string;
    wheelbaseMm: string;
    totalLengthMm: string;
    fuelTankLitres: string;
    notes: string;
  }> | undefined;

  if (resubmit && session?.user?.id) {
    const sub = await prisma.vehicleSubmission.findFirst({
      where: { id: resubmit, submitterId: session.user.id, status: "REJECTED" },
      select: { submittedData: true },
    });
    if (sub) {
      const d = sub.submittedData as Record<string, unknown>;
      initialValues = {
        newMakeName: (d.newMakeName as string) ?? "",
        newModelName: (d.newModelName as string) ?? "",
        year: d.year ? String(d.year) : "",
        variantName: (d.variantName as string) ?? "",
        bodyType: (d.bodyType as string) ?? "",
        drivetrain: (d.drivetrain as string) ?? "",
        transmission: (d.transmission as string) ?? "",
        fuelType: (d.fuelType as string) ?? "",
        gvmKg: d.gvmKg ? String(d.gvmKg) : "",
        gcmKg: d.gcmKg ? String(d.gcmKg) : "",
        wheelbaseMm: d.wheelbaseMm ? String(d.wheelbaseMm) : "",
        totalLengthMm: d.totalLengthMm ? String(d.totalLengthMm) : "",
        fuelTankLitres: d.fuelTankLitres ? String(d.fuelTankLitres) : "",
        notes: (d.notes as string) ?? "",
      };
    }
  }

  return (
    <div className="min-h-screen bg-tb-neutral-50">
      <header className="border-b border-tb-neutral-200 bg-white px-4 py-3">
        <a href="/" className="text-sm font-semibold text-tb-primary hover:underline">
          TravellingBuddy
        </a>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {initialValues ? "Edit and resubmit vehicle" : "Submit a vehicle"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {initialValues
              ? "Update the details below and resubmit for review."
              : "Help build the catalogue for the Australian touring community. Submissions with a compliance plate photo are prioritised for review."}
          </p>
        </div>
        <VehicleSubmitForm isAuthenticated={isAuthenticated} initialValues={initialValues} />
      </main>
    </div>
  );
}
