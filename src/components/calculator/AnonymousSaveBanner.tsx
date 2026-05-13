"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { listLocalSetups } from "@/lib/local-setups";

export function AnonymousSaveBanner() {
  const { data: session, status } = useSession();
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    setLocalCount(listLocalSetups().length);
  }, []);

  if (status === "loading" || session?.user) return null;

  return (
    <div className="rounded-lg border border-tb-primary/20 bg-tb-primary/5 px-4 py-3">
      <p className="text-sm text-tb-neutral-700">
        Your setups are saved on this device only.{" "}
        {localCount > 0 && (
          <>
            <Link
              href="/account/local-setups"
              className="font-medium text-tb-primary underline-offset-2 hover:underline"
            >
              View saved setups ({localCount})
            </Link>
            {" · "}
          </>
        )}
        <Link
          href="/auth/signup"
          className="font-medium text-tb-primary underline-offset-2 hover:underline"
        >
          Create an account
        </Link>{" "}
        to sync across devices.
      </p>
    </div>
  );
}
