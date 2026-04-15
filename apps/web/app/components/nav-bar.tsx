"use client";

import { useState, useEffect } from "react";
import { Button, cn } from "@numera/ui";

const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Contact", href: "#contact" },
] as const;

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Set initial state
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-200",
        scrolled ? "bg-white shadow-xs" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        {/* Wordmark */}
        <a
          href="/"
          className="flex-shrink-0 text-xl font-bold tracking-tight"
          aria-label="Numera — home"
        >
          <span className="text-teal-600">N</span>
          <span className="text-slate-900">umera</span>
        </a>

        {/* Desktop nav links + CTA */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-base font-medium text-slate-700 transition-colors duration-200 hover:text-teal-600"
            >
              {link.label}
            </a>
          ))}
          <Button size="lg" asChild>
            <a href="#booking">Book a Call</a>
          </Button>
        </div>

        {/* Mobile: hamburger / close toggle */}
        <button
          type="button"
          className="flex items-center justify-center p-2 text-slate-700 md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          {menuOpen ? (
            // × close icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Hamburger icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        // Overlay — tap outside to close
        <div
          id="mobile-nav"
          className="fixed inset-0 top-16 z-30 bg-white md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeMenu();
          }}
        >
          <div className="flex flex-col gap-1 p-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-base font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-teal-600"
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4">
              <Button size="lg" className="w-full" asChild>
                <a href="#booking" onClick={closeMenu}>
                  Book a Call
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
