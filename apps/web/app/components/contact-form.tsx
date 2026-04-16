"use client";

import { useState, useRef } from "react";
import { Button, Input } from "@numera/ui";
import { CheckCircle } from "lucide-react";

interface FormData {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  message: string;
}

interface FieldError {
  name?: string;
  email?: string;
  message?: string;
}

const CONTACT_EMAIL = "hello@numeraph.com";
const MESSAGE_MAX = 1000;
const MESSAGE_WARN = 800;

function validate(data: FormData): FieldError {
  const errors: FieldError = {};
  if (!data.name.trim()) errors.name = "Name is required.";
  if (!data.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!data.message.trim()) {
    errors.message = "Message is required.";
  } else if (data.message.trim().length < 10) {
    errors.message = "Message must be at least 10 characters.";
  }
  return errors;
}

export function ContactForm() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    message: "",
  });
  const [errors, setErrors] = useState<FieldError>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const honeypotRef = useRef<HTMLInputElement>(null);

  const messageLen = form.message.length;
  const hasErrors = Object.keys(validate(form)).length > 0;

  function handleChange(field: keyof FormData, value: string) {
    if (field === "message" && value.length > MESSAGE_MAX) return;
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error as user corrects the field
    if (errors[field as keyof FieldError]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleBlur(field: keyof FieldError) {
    const fieldErrors = validate(form);
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handle-contact-form`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            business_name: form.businessName.trim() || undefined,
            message: form.message.trim(),
            website: honeypotRef.current?.value || undefined,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.error("Contact form error:", res.status, body);
        throw new Error("Request failed");
      }
      setStatus("success");
    } catch (err) {
      console.error("Contact form exception:", err);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <section id="contact" aria-labelledby="contact-heading" className="bg-white py-20">
        <div className="mx-auto max-w-[640px] px-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-lg bg-teal-100 p-6">
            <CheckCircle size={24} className="flex-shrink-0 text-teal-700" />
            <p className="text-base font-medium text-teal-700">
              Your message was sent. We&apos;ll be in touch within one business day.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" aria-labelledby="contact-heading" className="bg-white py-20">
      <div className="mx-auto max-w-[640px] px-4 sm:px-6">
        <h2
          id="contact-heading"
          className="mb-10 text-center text-3xl font-semibold text-slate-900"
        >
          Send Us a Message
        </h2>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {/* Honeypot */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              ref={honeypotRef}
            />
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-name" className="text-sm font-medium text-slate-900">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="contact-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              error={!!errors.name}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
            />
            {errors.name && (
              <p id="contact-name-error" className="text-sm text-red-700">
                {errors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-email" className="text-sm font-medium text-slate-900">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              id="contact-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              error={!!errors.email}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
            />
            {errors.email && (
              <p id="contact-email-error" className="text-sm text-red-700">
                {errors.email}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-phone" className="text-sm font-medium text-slate-900">
              Phone
            </label>
            <Input
              id="contact-phone"
              type="tel"
              maxLength={20}
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          {/* Business Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-business" className="text-sm font-medium text-slate-900">
              Business Name
            </label>
            <Input
              id="contact-business"
              type="text"
              value={form.businessName}
              onChange={(e) => handleChange("businessName", e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-message" className="text-sm font-medium text-slate-900">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="contact-message"
              required
              rows={5}
              value={form.message}
              onChange={(e) => handleChange("message", e.target.value)}
              onBlur={() => handleBlur("message")}
              aria-describedby={
                [errors.message ? "contact-message-error" : "", "contact-message-counter"]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className={`flex w-full rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 bg-white border transition-[border-color,border-width] duration-[100ms] focus:outline-none focus:border-teal-600 focus:border-2 resize-y ${
                errors.message
                  ? "border-2 border-red-500 focus:border-red-500"
                  : "border-slate-200"
              }`}
            />
            <div className="flex items-center justify-between">
              {errors.message ? (
                <p id="contact-message-error" className="text-sm text-red-700">
                  {errors.message}
                </p>
              ) : (
                <span />
              )}
              {messageLen >= MESSAGE_WARN && (
                <p
                  id="contact-message-counter"
                  className={`text-sm ${
                    messageLen >= MESSAGE_MAX ? "text-red-500" : "text-slate-500"
                  }`}
                >
                  {messageLen}/{MESSAGE_MAX}
                </p>
              )}
            </div>
          </div>

          {/* API Error banner */}
          {status === "error" && (
            <div className="rounded-md bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">
                Something went wrong. Please try again or email us directly at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            disabled={status === "submitting" || hasErrors}
            className="w-full sm:w-auto"
          >
            {status === "submitting" ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin text-teal-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Sending…
              </span>
            ) : (
              "Send Message"
            )}
          </Button>
        </form>
      </div>
    </section>
  );
}
