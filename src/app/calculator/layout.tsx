import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rig Weight & Compliance Calculator | TravellingBuddy',
  description:
    'Check your GVM, GCM, axle loads, and tow ball mass. The most comprehensive rig compliance calculator for Australian road travellers.',
};

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen flex-col bg-tb-neutral-50">
      {/* Top app bar — ~56pt, scrolls with content on mobile per spec 7.7 */}
      <header className="h-14 border-b border-tb-neutral-200 bg-white px-4 flex items-center justify-between">
        <h1 className="text-base font-semibold text-tb-primary">Calculator</h1>
        {/* Icon placeholder — save/account area */}
        <div className="h-8 w-8 rounded-full bg-tb-neutral-200" aria-label="Account" />
      </header>

      {children}
    </div>
  );
}
