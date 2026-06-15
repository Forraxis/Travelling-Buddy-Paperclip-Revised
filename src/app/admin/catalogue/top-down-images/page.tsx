import { redirect } from 'next/navigation';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { prisma } from '@/lib/db';
import { TopDownImageView } from './_components/TopDownImageView';

export const metadata = { title: 'Top-down Images — Admin' };

export default async function TopDownImagesPage() {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const accessories = await prisma.accessory.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      placementScope: true,
      topDownImageUrl: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Top-down images</h1>
        <p className="mt-1 text-sm text-gray-500">
          Assign a real top-down image to an accessory to replace its category
          icon in the layout editor. Upload to R2 and paste the URL; clear it to
          fall back to the icon.
        </p>
      </div>
      <TopDownImageView
        items={accessories.map((a) => ({
          id: a.id,
          name: a.name,
          brand: a.brand.name,
          category: a.category.name,
          placementScope: a.placementScope,
          topDownImageUrl: a.topDownImageUrl,
        }))}
      />
    </div>
  );
}
