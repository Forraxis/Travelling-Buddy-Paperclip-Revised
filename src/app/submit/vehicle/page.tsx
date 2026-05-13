import { auth } from "@/lib/auth";
import { VehicleSubmitForm } from "./_components/VehicleSubmitForm";

export const metadata = {
  title: "Submit a Vehicle — TravellingBuddy",
  description: "Submit a vehicle variant not yet in our catalogue.",
};

export default async function SubmitVehiclePage() {
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  return (
    <div className="min-h-screen bg-tb-neutral-50">
      <header className="border-b border-tb-neutral-200 bg-white px-4 py-3">
        <a href="/" className="text-sm font-semibold text-tb-primary hover:underline">
          TravellingBuddy
        </a>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Submit a vehicle</h1>
          <p className="mt-1 text-sm text-gray-500">
            Help build the catalogue for the Australian touring community. Submissions with a compliance plate photo are prioritised for review.
          </p>
        </div>
        <VehicleSubmitForm isAuthenticated={isAuthenticated} />
      </main>
    </div>
  );
}
