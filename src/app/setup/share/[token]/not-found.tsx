import Link from 'next/link';

export default function SharedSetupNotFound() {
  return (
    <div className="bg-tb-neutral-50 flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-tb-neutral-900 text-2xl font-bold">
        This setup is no longer shared.
      </h1>
      <p className="text-tb-neutral-600 mt-2">
        The owner may have revoked the share link or deleted this setup.
      </p>
      <Link
        href="/calculator"
        className="bg-tb-primary hover:bg-tb-primary/90 mt-6 rounded-lg px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors"
      >
        Open Calculator
      </Link>
    </div>
  );
}
