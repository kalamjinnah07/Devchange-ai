"use client";

/**
 * components/ProjectForm.tsx
 *
 * Client component — Create Project form.
 * Implements the hybrid two-zone input design:
 *   Zone 1 (required): name + description
 *   Zone 2 (optional, collapsible): modules, dbTables, apiEndpoints, techStack
 *
 * Submits to POST /api/projects and redirects to the new project on success.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Field helpers ─────────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function Textarea({
  id,
  label,
  required,
  hint,
  placeholder,
  rows = 3,
  value,
  onChange,
  error,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden>*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1.5">{hint}</p>}
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={required}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
          error
            ? "border-red-400 bg-red-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function TextInput({
  id,
  label,
  required,
  hint,
  placeholder,
  value,
  onChange,
  error,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden>*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1.5">{hint}</p>}
      <input
        type="text"
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={required}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error
            ? "border-red-400 bg-red-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  modules: string;
  dbTables: string;
  apiEndpoints: string;
  techStack: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  form?: string;
}

export function ProjectForm() {
  const router = useRouter();

  const [fields, setFields] = useState<FormState>({
    name: "",
    description: "",
    modules: "",
    dbTables: "",
    apiEndpoints: "",
    techStack: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function set(field: keyof FormState) {
    return (value: string) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      // Clear field-level error on change
      if (field === "name" || field === "description") {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!fields.name.trim()) next.name = "Project name is required.";
    if (!fields.description.trim())
      next.description = "Project description is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name.trim(),
          description: fields.description.trim(),
          modules: fields.modules.trim() || undefined,
          dbTables: fields.dbTables.trim() || undefined,
          apiEndpoints: fields.apiEndpoints.trim() || undefined,
          techStack: fields.techStack.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrors({
          form: data.error ?? `Server error (${res.status}). Please try again.`,
        });
        return;
      }

      const data = (await res.json()) as { project: { id: string } };
      router.push(`/projects/${data.project.id}`);
    } catch {
      setErrors({ form: "Network error. Please check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* ── Zone 1: Required fields ── */}
      <div className="space-y-5">
        <TextInput
          id="name"
          label="Project Name"
          required
          placeholder="e.g. Invoice Management System"
          value={fields.name}
          onChange={set("name")}
          error={errors.name}
        />

        <Textarea
          id="description"
          label="System Description"
          required
          hint="Describe your system in plain language — what it does, who uses it, and how it works."
          placeholder="e.g. A web application for creating and managing invoices for small businesses. Built with Node.js and React, backed by PostgreSQL."
          rows={4}
          value={fields.description}
          onChange={set("description")}
          error={errors.description}
        />
      </div>

      {/* ── Zone 2: Optional structured details ── */}
      <div className="rounded-lg border border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span>Add structured details <span className="font-normal text-gray-400">(optional — improves analysis quality)</span></span>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {detailsOpen && (
          <div className="border-t border-gray-200 px-4 pb-4 pt-4 space-y-4">
            <Textarea
              id="modules"
              label="Modules"
              placeholder="e.g. InvoiceModule, PaymentModule, CustomerModule, ProductModule"
              hint="List the main modules or features in your system."
              rows={2}
              value={fields.modules}
              onChange={set("modules")}
            />
            <Textarea
              id="dbTables"
              label="Database Tables"
              placeholder="e.g. invoices, invoice_items, customers, products, payments"
              hint="List the key database tables or collections."
              rows={2}
              value={fields.dbTables}
              onChange={set("dbTables")}
            />
            <Textarea
              id="apiEndpoints"
              label="API Endpoints"
              placeholder="e.g. GET /api/invoices, POST /api/invoices, POST /api/invoices/:id/pay"
              hint="List the key REST or GraphQL endpoints."
              rows={2}
              value={fields.apiEndpoints}
              onChange={set("apiEndpoints")}
            />
            <Textarea
              id="techStack"
              label="Technology Stack"
              placeholder="e.g. Node.js, Express, React, PostgreSQL, Redis"
              hint="List the main languages, frameworks, and infrastructure."
              rows={2}
              value={fields.techStack}
              onChange={set("techStack")}
            />
          </div>
        )}
      </div>

      {/* ── Form-level error ── */}
      {errors.form && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errors.form}
        </div>
      )}

      {/* ── Submit ── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Creating…
            </>
          ) : (
            "Create Project"
          )}
        </button>
        <a
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
