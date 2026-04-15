import { Button } from "@numera/ui";

export function Hero() {
  return (
    <section
      aria-label="Hero"
      className="flex min-h-screen items-center bg-white"
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-12 px-4 py-20 sm:px-6 lg:flex-row lg:py-0">
        {/* Text column */}
        <div className="flex flex-1 flex-col gap-6 motion-safe:animate-none">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 lg:text-5xl">
            Expert Bookkeeping and Tax Compliance for Philippine Businesses
          </h1>
          <p className="text-xl font-normal text-slate-700">
            AI-powered accuracy. One accountant. The throughput of five.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href="#booking">Book a Discovery Call</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full border-teal-600 text-teal-600 hover:bg-teal-50 sm:w-auto"
              asChild
            >
              <a href="#contact">Send Us a Message</a>
            </Button>
          </div>
        </div>

        {/* Illustration column — hidden on mobile */}
        <div
          className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center"
          aria-hidden="true"
        >
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}

function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 480 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full max-w-md"
      aria-hidden="true"
    >
      {/* Background card */}
      <rect x="40" y="40" width="400" height="320" rx="20" fill="#f0fdfa" />

      {/* Top bar — ledger header */}
      <rect x="60" y="70" width="360" height="48" rx="10" fill="#0d9488" />
      <rect x="80" y="85" width="120" height="8" rx="4" fill="white" fillOpacity="0.8" />
      <rect x="80" y="99" width="80" height="6" rx="3" fill="white" fillOpacity="0.5" />

      {/* Chart bars */}
      <rect x="80" y="180" width="40" height="100" rx="6" fill="#0d9488" fillOpacity="0.25" />
      <rect x="140" y="150" width="40" height="130" rx="6" fill="#0d9488" fillOpacity="0.45" />
      <rect x="200" y="120" width="40" height="160" rx="6" fill="#0d9488" fillOpacity="0.65" />
      <rect x="260" y="160" width="40" height="120" rx="6" fill="#0d9488" fillOpacity="0.45" />
      <rect x="320" y="140" width="40" height="140" rx="6" fill="#0d9488" />

      {/* Trend line */}
      <polyline
        points="100,230 160,200 220,170 280,190 340,160"
        stroke="#0f172a"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Data point dots */}
      {[
        [100, 230],
        [160, 200],
        [220, 170],
        [280, 190],
        [340, 160],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="5" fill="white" stroke="#0d9488" strokeWidth="2.5" />
      ))}

      {/* Bottom row — stat pills */}
      <rect x="80" y="305" width="90" height="28" rx="8" fill="#ccfbf1" />
      <rect x="185" y="305" width="90" height="28" rx="8" fill="#ccfbf1" />
      <rect x="290" y="305" width="90" height="28" rx="8" fill="#ccfbf1" />

      <rect x="92" y="315" width="66" height="8" rx="4" fill="#0d9488" fillOpacity="0.7" />
      <rect x="197" y="315" width="66" height="8" rx="4" fill="#0d9488" fillOpacity="0.7" />
      <rect x="302" y="315" width="66" height="8" rx="4" fill="#0d9488" fillOpacity="0.7" />
    </svg>
  );
}
