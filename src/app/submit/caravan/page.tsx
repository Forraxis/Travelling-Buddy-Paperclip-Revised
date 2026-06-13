import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CaravanSubmitForm } from './_components/CaravanSubmitForm';

export const metadata = {
  title: 'Submit a Caravan — TravellingBuddy',
  description: 'Submit a caravan variant not yet in our catalogue.',
};

export default async function SubmitCaravanPage({
  searchParams,
}: {
  searchParams: Promise<{ resubmit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signup?callbackUrl=/submit/caravan&reason=submit');
  }

  const { resubmit } = await searchParams;

  let initialValues: Partial<Record<string, string>> | undefined;

  if (resubmit) {
    const sub = await prisma.caravanSubmission.findFirst({
      where: { id: resubmit, submitterId: session.user.id, status: 'REJECTED' },
      select: { submittedData: true },
    });
    if (sub) {
      const d = sub.submittedData as Record<string, unknown>;
      initialValues = {
        newMakeName: (d.newMakeName as string) ?? '',
        newModelName: (d.newModelName as string) ?? '',
        year: d.year ? String(d.year) : '',
        variantName: (d.variantName as string) ?? '',
        bodyType: (d.bodyType as string) ?? '',
        axleConfiguration: (d.axleConfiguration as string) ?? '',
        atmKg: d.atmKg ? String(d.atmKg) : '',
        gtmKg: d.gtmKg ? String(d.gtmKg) : '',
        tareKg: d.tareKg ? String(d.tareKg) : '',
        tbmKg: d.tbmKg ? String(d.tbmKg) : '',
        couplingToAxleMm: d.couplingToAxleMm ? String(d.couplingToAxleMm) : '',
        axleSpacingMm: d.axleSpacingMm ? String(d.axleSpacingMm) : '',
        bodyLengthMm: d.bodyLengthMm ? String(d.bodyLengthMm) : '',
        overallLengthMm: d.overallLengthMm ? String(d.overallLengthMm) : '',
        freshWaterLitres: d.freshWaterLitres ? String(d.freshWaterLitres) : '',
        greyWaterLitres: d.greyWaterLitres ? String(d.greyWaterLitres) : '',
        gasBottleConfig: (d.gasBottleConfig as string) ?? '',
        notes: (d.notes as string) ?? '',
      };
    }
  }

  return (
    <div className="bg-tb-neutral-50 min-h-screen">
      <header className="border-tb-neutral-200 border-b bg-white px-4 py-3">
        <Link
          href="/"
          className="text-tb-primary text-sm font-semibold hover:underline"
        >
          TravellingBuddy
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {initialValues ? 'Edit and resubmit caravan' : 'Submit a caravan'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {initialValues
              ? 'Update the details below and resubmit for review.'
              : "Help build the catalogue for the Australian touring community. Compliance plate photos help but aren't required — caravan plates vary widely in format."}
          </p>
        </div>
        <CaravanSubmitForm
          isAuthenticated={!!session?.user?.id}
          initialValues={initialValues}
        />
      </main>
    </div>
  );
}
