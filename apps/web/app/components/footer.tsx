const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Contact", href: "#contact" },
] as const;

const CONTACT_EMAIL = "hello@numeraph.com";

export function Footer() {
  return (
    <footer className="w-full bg-slate-900 text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        {/* Desktop: 3 columns — Brand / Links / Contact */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Brand column */}
          <div className="flex flex-col gap-3">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-teal-400">N</span>
              <span className="text-white">umera</span>
            </span>
            <p className="text-sm text-slate-400">
              AI-powered accuracy. One accountant. The throughput of five.
            </p>
          </div>

          {/* Navigation links column */}
          <nav aria-label="Footer navigation">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Navigation
            </p>
            <ul className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-300 transition-all duration-200 hover:text-white hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact column */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Contact
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-slate-300 transition-all duration-200 hover:text-white hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-6 sm:flex-row">
          <p className="text-sm text-slate-400">
            © 2026 Numera. All rights reserved.
          </p>
          <a
            href="/privacy"
            className="text-sm text-slate-400 transition-all duration-200 hover:text-white hover:underline"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
