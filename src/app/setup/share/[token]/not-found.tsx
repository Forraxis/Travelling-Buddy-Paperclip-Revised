import Link from "next/link";

export default function SharedSetupNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-tb-neutral-50 px-4 text-center">
      <h1 className="text-2xl font-bold text-tb-neutral-900">
        This setup is no longer shared.
      </h1>
      <p className="mt-2 text-tb-neutral-600">
        The owner may have revoked the share link or deleted this setup.
      </p>
      <Link
        href="/calculator"
        className="mt-6 rounded-lg bg-tb-primary px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-tb-primary/90"
      >
        Open Calculator
      </Link>
    </div>
  );
}
