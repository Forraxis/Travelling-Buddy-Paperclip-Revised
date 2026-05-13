import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CaravanSubmitForm } from "./_components/CaravanSubmitForm";

export const metadata = {
  title: "Submit a Caravan — TravellingBuddy",
  description: "Submit a caravan variant not yet in our catalogue.",
};

export default async function SubmitCaravanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signup?callbackUrl=/submit/caravan&reason=submit");
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
          <h1 className="text-xl font-bold text-gray-900">Submit a caravan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Help build the catalogue for the Australian touring community. Compliance plate photos help but aren&apos;t required — caravan plates vary widely in format.
          </p>
        </div>
        <CaravanSubmitForm />
      </main>
    </div>
  );
}
