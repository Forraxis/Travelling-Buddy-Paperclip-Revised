import type { Metadata } from 'next';
import { CalculatorShell } from './CalculatorShell';
import { CalculatorHeader } from './_components/CalculatorHeader';

export const metadata: Metadata = {
  title: 'Rig Weight & Compliance Calculator | TravellingBuddy',
  description:
    'Check your GVM, GCM, axle loads, and tow ball mass. The most comprehensive rig compliance calculator for Australian road travellers.',
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-tb-neutral-50 flex h-full min-h-screen flex-col">
      <CalculatorShell>
        <CalculatorHeader />
        {children}
      </CalculatorShell>
    </div>
  );
}
