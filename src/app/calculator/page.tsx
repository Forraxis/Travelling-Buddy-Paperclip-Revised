export default function CalculatorPage() {
  return (
    /*
     * Desktop (≥1024px): two-column — left 60% config, right 40% results, sticky.
     * Tablet (768–1023px): same pattern, 55%/45%.
     * Mobile (<768px): single column; right column hidden, results via sticky bar (future).
     * Spec ref: §7.1, §7.7
     */
    <div className="flex flex-1 overflow-hidden">
      {/* Left config column */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:w-[55%] md:flex-none lg:w-[60%]">
        {/* Vehicle panel placeholder */}
        <section className="mb-4 rounded-lg border border-tb-neutral-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Vehicle panel</p>
          <div className="mt-4 rounded-md border-2 border-dashed border-tb-neutral-200 p-8 text-center text-sm text-gray-400">
            Select your vehicle
          </div>
        </section>

        {/* Caravan panel placeholder */}
        <section className="rounded-lg border border-tb-neutral-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Caravan panel</p>
          <div className="mt-4 rounded-md border-2 border-dashed border-tb-neutral-200 p-8 text-center text-sm text-gray-400">
            + Add caravan or trailer
          </div>
        </section>

        {/* Bottom spacing so last element clears sticky results bar on mobile */}
        <div className="h-22 md:hidden" />
      </div>

      {/* Right results column — hidden on mobile per spec §7.7 */}
      <div className="hidden md:flex md:w-[45%] lg:w-[40%] md:flex-none md:flex-col md:border-l md:border-tb-neutral-200 md:bg-white">
        {/* Sticky inner wrapper */}
        <div className="sticky top-0 flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto px-4 py-6">
          {/* Verdict banner placeholder */}
          <div className="mb-4 rounded-md bg-tb-neutral-200 px-4 py-3 text-sm text-gray-500">
            Verdict — configure a vehicle to see results
          </div>

          {/* Schematic placeholder */}
          <div className="mb-4 rounded-lg border border-tb-neutral-200 bg-tb-neutral-50 flex items-center justify-center h-40 text-sm text-gray-400">
            Schematic
          </div>

          {/* Metric grid placeholder */}
          <div className="mb-4 rounded-lg border border-tb-neutral-200 bg-tb-neutral-50 p-4 text-sm text-gray-400">
            Metric grid
          </div>

          {/* Recommendations placeholder */}
          <div className="mb-4 rounded-lg border border-tb-neutral-200 bg-tb-neutral-50 p-4 text-sm text-gray-400">
            Recommendations
          </div>

          {/* Action bar placeholder */}
          <div className="mt-auto rounded-lg border border-tb-neutral-200 bg-tb-neutral-50 p-4 text-sm text-gray-400">
            Save · Share · Download PDF
          </div>
        </div>
      </div>
    </div>
  );
}
