import { Phone, ClipboardList, Calculator, FileBarChart } from "lucide-react";

const STEPS = [
  {
    number: 1,
    icon: Phone,
    title: "Book a Call",
    description: "Schedule a free discovery call so we can understand your business and its accounting needs.",
  },
  {
    number: 2,
    icon: ClipboardList,
    title: "We Onboard Your Business",
    description: "We gather your records, set up your chart of accounts, and get everything in order.",
  },
  {
    number: 3,
    icon: Calculator,
    title: "We Handle Books and Taxes",
    description: "We manage your bookkeeping and BIR filings each period — you stay compliant automatically.",
  },
  {
    number: 4,
    icon: FileBarChart,
    title: "You Receive Monthly Reports",
    description: "Get clear financial reports delivered to you every month so you always know where you stand.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="bg-white py-20"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <h2
          id="how-it-works-heading"
          className="mb-14 text-center text-3xl font-semibold text-slate-900"
        >
          How It Works
        </h2>

        {/* Desktop: horizontal row with connecting line */}
        <div className="hidden lg:block">
          <div className="relative flex items-start justify-between gap-4">
            {/* Connecting line */}
            <div
              className="absolute left-0 right-0 top-7 h-px bg-teal-200"
              aria-hidden="true"
              style={{ left: "calc(10% + 1.75rem)", right: "calc(10% + 1.75rem)" }}
            />

            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="relative flex flex-1 flex-col items-center gap-4 text-center"
                >
                  {/* Number circle */}
                  <div className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white shadow-sm">
                    {step.number}
                  </div>
                  <Icon size={24} className="text-teal-600" aria-hidden="true" />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-base text-slate-600">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: vertical stack with left-side number indicator */}
        <ol className="flex flex-col gap-0 lg:hidden">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === STEPS.length - 1;
            return (
              <li key={step.number} className="relative flex gap-5">
                {/* Left column: number circle + vertical line */}
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
                    {step.number}
                  </div>
                  {!isLast && (
                    <div className="mt-1 w-px flex-1 bg-teal-200" aria-hidden="true" />
                  )}
                </div>

                {/* Right column: icon + content */}
                <div className={`flex flex-col gap-2 pb-8 ${isLast ? "pb-0" : ""}`}>
                  <Icon size={22} className="mt-2 text-teal-600" aria-hidden="true" />
                  <p className="text-lg font-semibold text-slate-900">{step.title}</p>
                  <p className="text-base text-slate-600">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
