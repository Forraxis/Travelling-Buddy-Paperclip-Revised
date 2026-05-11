"use client";

import { useState } from "react";

interface NotificationBannerProps {
  message: string;
  type?: "info" | "warning" | "success";
  dismissible?: boolean;
}

export function NotificationBanner({
  message,
  type = "info",
  dismissible = true,
}: NotificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const colorMap = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    success: "bg-green-50 text-green-800 border-green-200",
  };

  return (
    <div
      role="status"
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${colorMap[type]}`}
    >
      <span>{message}</span>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-4 shrink-0 text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      )}
    </div>
  );
}
