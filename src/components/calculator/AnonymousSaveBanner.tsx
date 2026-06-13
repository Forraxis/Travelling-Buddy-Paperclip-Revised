'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { listLocalSetups } from '@/lib/local-setups';

export function AnonymousSaveBanner() {
  const { data: session, status } = useSession();
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    setLocalCount(listLocalSetups().length);
  }, []);

  if (status === 'loading' || session?.user) return null;

  return (
    <div className="border-tb-primary/20 bg-tb-primary/5 rounded-lg border px-4 py-3">
      <p className="text-tb-neutral-700 text-sm">
        Your setups are saved on this device only.{' '}
        {localCount > 0 && (
          <>
            <Link
              href="/account/local-setups"
              className="text-tb-primary font-medium underline-offset-2 hover:underline"
            >
              View saved setups ({localCount})
            </Link>
            {' · '}
          </>
        )}
        <Link
          href="/auth/signup"
          className="text-tb-primary font-medium underline-offset-2 hover:underline"
        >
          Create an account
        </Link>{' '}
        to sync across devices.
      </p>
    </div>
  );
}
