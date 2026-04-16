import type { Metadata } from "next";
import { Hero } from "./components/hero";
import { ServicesSection } from "./components/services-section";
import { HowItWorks } from "./components/how-it-works";

import { ContactForm } from "./components/contact-form";
import { CalcomEmbed } from "./components/calcom-embed";

export const metadata: Metadata = {
  title: "Numera — Expert Bookkeeping and Tax Compliance for Philippine Businesses",
  description:
    "AI-powered accuracy. One accountant. The throughput of five. Expert bookkeeping and BIR tax compliance for Philippine SMBs.",
  openGraph: {
    title: "Numera — Expert Bookkeeping and Tax Compliance for Philippine Businesses",
    description:
      "AI-powered accuracy. One accountant. The throughput of five.",
    type: "website",
    locale: "en_PH",
  },
};

export default function HomePage() {
  return (
    <main id="main-content">
      <Hero />
      <ServicesSection />
      <HowItWorks />
      <ContactForm />
      <CalcomEmbed />
    </main>
  );
}
