import { BookOpen, FileText, BarChart3 } from "lucide-react";

const SERVICES = [
  {
    icon: BookOpen,
    name: "Bookkeeping",
    description:
      "We record every transaction accurately and reconcile your accounts each month so your books are always clean. Get a clear picture of your cash flow without lifting a finger.",
    frequency: "Monthly",
  },
  {
    icon: FileText,
    name: "Tax Compliance / BIR",
    description:
      "We prepare and file all required BIR returns on time, including quarterly income tax, VAT, and annual ITR. Stay compliant and avoid penalties with zero effort on your part.",
    frequency: "Quarterly + Annual",
  },
  {
    icon: BarChart3,
    name: "Financial Reporting",
    description:
      "We deliver income statements, balance sheets, and cash flow summaries on a schedule that fits your business. Make informed decisions backed by accurate, timely reports.",
    frequency: "Monthly / Quarterly / Annual",
  },
] as const;

export function ServicesSection() {
  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="bg-slate-50 py-20"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <h2
          id="services-heading"
          className="mb-12 text-center text-3xl font-semibold text-slate-900"
        >
          What We Handle For You
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.name}
                className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-xs transition-shadow duration-200 hover:shadow-sm"
              >
                <Icon
                  size={24}
                  className="text-teal-600"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {service.name}
                  </h3>
                  <p className="text-base font-normal text-slate-600">
                    {service.description}
                  </p>
                </div>
                <span className="mt-auto inline-flex w-fit items-center rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
                  {service.frequency}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
