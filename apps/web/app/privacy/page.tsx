import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Numera",
  description:
    "How Numera collects, uses, and protects your personal information under the Philippine Data Privacy Act of 2012.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-[720px] px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Effective date: April 17, 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-slate-700">
        {/* ── 1. Who We Are ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            1. Who We Are
          </h2>
          <p className="mt-2">
            Numera (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides
            bookkeeping, tax compliance, and financial reporting services to
            Philippine businesses. This Privacy Policy explains how we collect,
            use, store, and protect your personal information in compliance with
            Republic Act No. 10173, the{" "}
            <strong>Data Privacy Act of 2012</strong>, and its Implementing Rules
            and Regulations.
          </p>
        </section>

        {/* ── 2. Information We Collect ──────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            2. Information We Collect
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Contact information</strong> — name, email address, phone
              number, and business name submitted through our contact form or
              booking page.
            </li>
            <li>
              <strong>Business information</strong> — TIN, BIR registration
              type, registered address, industry, and revenue bracket provided
              during client onboarding.
            </li>
            <li>
              <strong>Financial records</strong> — invoices, receipts,
              transaction data, and tax filings shared with us as part of our
              bookkeeping and compliance services.
            </li>
            <li>
              <strong>Usage data</strong> — pages visited, browser type, and
              referring URL collected automatically when you browse our website.
            </li>
          </ul>
        </section>

        {/* ── 3. How We Use Your Information ─────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            3. How We Use Your Information
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>To provide and improve our bookkeeping, tax, and reporting services.</li>
            <li>To respond to inquiries submitted through our contact form.</li>
            <li>To schedule consultations via our booking system.</li>
            <li>To comply with BIR filing and reporting obligations on your behalf.</li>
            <li>To send service-related communications (not marketing) relevant to your engagement.</li>
          </ul>
        </section>

        {/* ── 4. Legal Basis ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            4. Legal Basis for Processing
          </h2>
          <p className="mt-2">
            We process your personal information based on one or more of the
            following grounds under the Data Privacy Act:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Consent</strong> — when you voluntarily submit information
              through our forms.
            </li>
            <li>
              <strong>Contractual necessity</strong> — to fulfill our
              obligations under a service agreement.
            </li>
            <li>
              <strong>Legitimate interest</strong> — to improve our services and
              ensure website security.
            </li>
            <li>
              <strong>Legal obligation</strong> — to comply with Philippine tax
              and regulatory requirements.
            </li>
          </ul>
        </section>

        {/* ── 5. Data Sharing ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            5. Data Sharing
          </h2>
          <p className="mt-2">
            We do not sell your personal information. We may share data with:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Government agencies</strong> — such as the BIR, as
              required by law for tax filings.
            </li>
            <li>
              <strong>Service providers</strong> — cloud hosting and software
              tools that help us deliver our services, bound by data processing
              agreements.
            </li>
          </ul>
        </section>

        {/* ── 6. Data Retention ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            6. Data Retention
          </h2>
          <p className="mt-2">
            We retain your personal and financial data for the duration of our
            engagement plus the period required by Philippine tax law (generally
            ten years for tax-related records). Contact form submissions are
            retained for up to one year if no engagement follows.
          </p>
        </section>

        {/* ── 7. Security ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            7. Data Security
          </h2>
          <p className="mt-2">
            We implement reasonable organizational and technical safeguards to
            protect your information, including encrypted storage, access
            controls, and regular review of our security practices.
          </p>
        </section>

        {/* ── 8. Your Rights ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            8. Your Rights
          </h2>
          <p className="mt-2">
            Under the Data Privacy Act, you have the right to:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Be informed about how your data is collected and used.</li>
            <li>Access your personal information held by us.</li>
            <li>Correct inaccurate or incomplete data.</li>
            <li>Object to or suspend the processing of your data.</li>
            <li>Request erasure or blocking of your data, subject to legal retention requirements.</li>
            <li>Lodge a complaint with the National Privacy Commission.</li>
          </ul>
        </section>

        {/* ── 9. Contact ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            9. Contact Us
          </h2>
          <p className="mt-2">
            If you have questions about this policy or wish to exercise your
            data privacy rights, contact us at{" "}
            <a
              href="mailto:hello@numeraph.com"
              className="text-teal-600 hover:text-teal-700 hover:underline"
            >
              hello@numeraph.com
            </a>
            .
          </p>
        </section>

        {/* ── 10. Changes ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            10. Changes to This Policy
          </h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with an updated effective date.
          </p>
        </section>
      </div>
    </main>
  );
}
