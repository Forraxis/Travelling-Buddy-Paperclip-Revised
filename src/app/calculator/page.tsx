import RightColumn from './_components/RightColumn';
import { CalculatorConfig } from './_components/CalculatorConfig';
import { MobileResultsBarWrapper } from './_components/MobileResultsBarWrapper';

export default function CalculatorPage() {
  return (
    /*
     * Desktop (≥1024px): two-column — left 60% config, right 40% results, sticky.
     * Tablet (768–1023px): same pattern, 55%/45%.
     * Mobile (<768px): single column; right column hidden, results via sticky bar (§7.7).
     * Spec ref: §7.1, §7.7
     */
    <div className="flex flex-1 overflow-hidden">
      <CalculatorConfig />
      {/* Right results column — hidden on mobile per spec §7.7 */}
      <RightColumn vehicleSelected={false} />
      {/* Mobile sticky bar + sheet — rendered outside the scroll container */}
      <MobileResultsBarWrapper />
    </div>
  );
}
