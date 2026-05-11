"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function AccountDeletedBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("account_deleted") === "1") {
      setVisible(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("account_deleted");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center text-sm text-amber-800">
      Your account has been deleted. Your data will be permanently removed
      within 30 days.
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="ml-3 text-amber-600 underline hover:text-amber-700"
      >
        Dismiss
      </button>
    </div>
  );
}
