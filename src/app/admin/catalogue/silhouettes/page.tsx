import { redirect } from 'next/navigation';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { SilhouetteGallery } from './_components/SilhouetteGallery';

export const metadata = { title: 'Accessory Silhouettes — Admin' };

export default async function SilhouetteGalleryPage() {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');
  return <SilhouetteGallery />;
}
