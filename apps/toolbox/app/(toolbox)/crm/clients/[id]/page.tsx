'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input, Card, CardHeader, CardTitle, CardContent, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, cn } from '@numera/ui';
import { ArrowLeft, Pencil, Save, X, RefreshCw, ExternalLink } from 'lucide-react';
import type { Database, BusinessType, BIRRegistrationType, RevenueBracket, ClientStatus } from '@numera/db';
import { createClient } from '../../../../../lib/supabase/client';

// ─── Constants ───────────────────────────────────────────────────────────────

type ClientRow = Database['public']['Tables']['clients']['Row'];

interface ActivityLogRow {
  id: string;
  client_id: string;
  action: string;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  created_at: string;
}

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  sole_prop: 'Sole Prop',
  opc: 'OPC',
  corporation: 'Corporation',
};

const BIR_LABELS: Record<BIRRegistrationType, string> = {
  vat: 'VAT',
  non_vat: 'Non-VAT',
};

const REVENUE_LABELS: Record<RevenueBracket, string> = {
  below_250k: 'Below 250K',
  '250k_500k': '250K - 500K',
  '500k_1m': '500K - 1M',
  '1m_3m': '1M - 3M',
  above_3m: 'Above 3M',
};

const MONTH_LABELS: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

const TIN_REGEX = /^\d{3}-\d{3}-\d{3}(-\d{3})?$/;

const REQUIRED_FIELDS: (keyof ClientRow)[] = [
  'business_name',
  'business_type',
  'tin',
  'registered_address',
  'industry',
  'bir_registration_type',
  'fiscal_year_start_month',
  'gmail_address',
  'monthly_revenue_bracket',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-slate-100 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 p-5 space-y-4">
            <div className="h-5 w-32 rounded bg-slate-100 animate-pulse" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 p-5 space-y-4">
            <div className="h-5 w-32 rounded bg-slate-100 animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Activity log skeleton */}
        <div className="rounded-lg border border-slate-200 p-5 space-y-4">
          <div className="h-5 w-32 rounded bg-slate-100 animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-2 w-2 rounded-full bg-slate-200 mt-1.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-3 w-3/4 rounded bg-slate-100 animate-pulse" />
                <div className="h-2.5 w-1/3 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Field display / edit helpers ────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-slate-500 mb-1">{children}</p>;
}

function FieldValue({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-900">{children}</p>;
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-red-500 mt-0.5">{children}</p>;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Data state
  const [client, setClient] = useState<ClientRow | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ClientRow>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ClientRow, string>>>({});
  const [saving, setSaving] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadClient = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', params.id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Client not found');

      setClient(data);

      // Load activity log
      const { data: logs } = await supabase
        .from('client_activity_log')
        .select('*')
        .eq('client_id', params.id)
        .order('created_at', { ascending: false });

      setActivityLog((logs ?? []) as ActivityLogRow[]);
    } catch {
      setError('Failed to load client profile.');
    } finally {
      setLoading(false);
    }
  }, [supabase, params.id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  // ── Edit handlers ──────────────────────────────────────────────────────────

  function startEditing() {
    if (!client) return;
    setForm({ ...client });
    setFieldErrors({});
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setForm({});
    setFieldErrors({});
  }

  function updateField<K extends keyof ClientRow>(key: K, value: ClientRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field on change
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateTin(value: string): boolean {
    return TIN_REGEX.test(value);
  }

  function handleTinBlur() {
    const tin = (form.tin ?? '').trim();
    if (tin && !validateTin(tin)) {
      setFieldErrors((prev) => ({
        ...prev,
        tin: 'TIN must be in format ###-###-### or ###-###-###-###',
      }));
    }
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof ClientRow, string>> = {};

    for (const field of REQUIRED_FIELDS) {
      const value = form[field];
      if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
        const label = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        errors[field] = `${label} is required`;
      }
    }

    // TIN format
    const tin = (form.tin ?? '').trim();
    if (tin && !validateTin(tin)) {
      errors.tin = 'TIN must be in format ###-###-### or ###-###-###-###';
    }

    // Gmail format (basic)
    const gmail = (form.gmail_address ?? '').trim();
    if (gmail && !gmail.includes('@')) {
      errors.gmail_address = 'Enter a valid email address';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate() || !client) return;

    setSaving(true);
    try {
      const update: Database['public']['Tables']['clients']['Update'] = {
        business_name: (form.business_name ?? '').trim(),
        business_type: form.business_type as BusinessType,
        tin: (form.tin ?? '').trim(),
        registered_address: (form.registered_address ?? '').trim(),
        industry: (form.industry ?? '').trim(),
        bir_registration_type: form.bir_registration_type as BIRRegistrationType,
        fiscal_year_start_month: form.fiscal_year_start_month as number,
        gmail_address: (form.gmail_address ?? '').trim(),
        monthly_revenue_bracket: form.monthly_revenue_bracket as RevenueBracket,
        google_sheet_folder_url: (form.google_sheet_folder_url ?? '').trim() || null,
        status: form.status as ClientStatus,
        contact_name: (form.contact_name ?? '').trim() || null,
        contact_phone: (form.contact_phone ?? '').trim() || null,
        business_phone: (form.business_phone ?? '').trim() || null,
      };

      const { data, error: updateError } = await supabase
        .from('clients')
        .update(update)
        .eq('id', client.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setClient(data);
      setEditing(false);
      setForm({});
      setFieldErrors({});

      // Reload activity log to pick up any triggers
      const { data: logs } = await supabase
        .from('client_activity_log')
        .select('*')
        .eq('client_id', params.id)
        .order('created_at', { ascending: false });

      setActivityLog((logs ?? []) as ActivityLogRow[]);
    } catch {
      setFieldErrors((prev) => ({
        ...prev,
        business_name: 'Failed to save. Please try again.',
      }));
    } finally {
      setSaving(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) return <ProfileSkeleton />;

  // ── Error state ────────────────────────────────────────────────────────────

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
        <p className="text-sm text-slate-500">{error ?? 'Client not found.'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/crm/clients')} className="gap-1.5 h-8 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Clients
          </Button>
          <Button variant="outline" onClick={loadClient} className="gap-1.5 h-8 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isInactive = client.status === 'inactive';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Inactive banner ───────────────────────────────────────────────── */}
      {isInactive && (
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 shrink-0">
          <p className="text-sm text-slate-600">This client is inactive.</p>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              onClick={() => router.push('/crm/clients')}
              className="h-8 w-8 p-0 shrink-0"
              aria-label="Back to clients"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900 truncate">
                  {client.business_name}
                </h1>
                <Badge status={client.status === 'active' ? 'approved' : 'in-review'}>
                  {client.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Client since {formatDate(client.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  onClick={cancelEditing}
                  className="h-8 gap-1.5 text-xs"
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="h-8 gap-1.5 text-xs"
                  disabled={saving}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={startEditing}
                className="h-8 gap-1.5 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0 p-6 space-y-6">

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Identity ──────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Business Name */}
              <div>
                <FieldLabel>Business Name</FieldLabel>
                {editing ? (
                  <>
                    <Input
                      value={form.business_name ?? ''}
                      onChange={(e) => updateField('business_name', e.target.value)}
                      className={cn('h-8 text-sm', fieldErrors.business_name && 'border-red-500')}
                    />
                    {fieldErrors.business_name && <FieldError>{fieldErrors.business_name}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{client.business_name}</FieldValue>
                )}
              </div>

              {/* Contact Name */}
              <div>
                <FieldLabel>Contact Person</FieldLabel>
                {editing ? (
                  <Input
                    value={form.contact_name ?? ''}
                    onChange={(e) => updateField('contact_name', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Contact person name"
                  />
                ) : (
                  <FieldValue>{client.contact_name || 'Not set'}</FieldValue>
                )}
              </div>

              {/* Contact Phone */}
              <div>
                <FieldLabel>Contact Phone</FieldLabel>
                {editing ? (
                  <Input
                    type="tel"
                    value={form.contact_phone ?? ''}
                    onChange={(e) => updateField('contact_phone', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="09XX XXX XXXX"
                  />
                ) : (
                  <FieldValue>{client.contact_phone || 'Not set'}</FieldValue>
                )}
              </div>

              {/* Business Phone */}
              <div>
                <FieldLabel>Business Phone</FieldLabel>
                {editing ? (
                  <Input
                    type="tel"
                    value={form.business_phone ?? ''}
                    onChange={(e) => updateField('business_phone', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="(02) XXXX-XXXX"
                  />
                ) : (
                  <FieldValue>{client.business_phone || 'Not set'}</FieldValue>
                )}
              </div>

              {/* Business Type */}
              <div>
                <FieldLabel>Business Type</FieldLabel>
                {editing ? (
                  <>
                    <Select
                      value={form.business_type ?? ''}
                      onValueChange={(v) => updateField('business_type', v as BusinessType)}
                    >
                      <SelectTrigger className={cn('h-8 text-sm', fieldErrors.business_type && 'border-red-500')}>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sole_prop">Sole Prop</SelectItem>
                        <SelectItem value="opc">OPC</SelectItem>
                        <SelectItem value="corporation">Corporation</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.business_type && <FieldError>{fieldErrors.business_type}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{BUSINESS_TYPE_LABELS[client.business_type]}</FieldValue>
                )}
              </div>

              {/* TIN */}
              <div>
                <FieldLabel>TIN</FieldLabel>
                {editing ? (
                  <>
                    <Input
                      value={form.tin ?? ''}
                      onChange={(e) => updateField('tin', e.target.value)}
                      onBlur={handleTinBlur}
                      placeholder="###-###-### or ###-###-###-###"
                      className={cn('h-8 text-sm', fieldErrors.tin && 'border-red-500')}
                    />
                    {fieldErrors.tin && <FieldError>{fieldErrors.tin}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{client.tin}</FieldValue>
                )}
              </div>

              {/* Registered Address */}
              <div>
                <FieldLabel>Registered Address</FieldLabel>
                {editing ? (
                  <>
                    <textarea
                      value={form.registered_address ?? ''}
                      onChange={(e) => updateField('registered_address', e.target.value)}
                      rows={2}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-sm text-slate-900',
                        'placeholder:text-slate-400 resize-none',
                        'focus:outline-none focus:border-2 focus:border-teal-600',
                        'transition-[border-color,border-width] duration-100',
                        fieldErrors.registered_address ? 'border-red-500' : 'border-slate-200',
                      )}
                    />
                    {fieldErrors.registered_address && <FieldError>{fieldErrors.registered_address}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{client.registered_address}</FieldValue>
                )}
              </div>

              {/* Industry */}
              <div>
                <FieldLabel>Industry</FieldLabel>
                {editing ? (
                  <>
                    <Input
                      value={form.industry ?? ''}
                      onChange={(e) => updateField('industry', e.target.value)}
                      className={cn('h-8 text-sm', fieldErrors.industry && 'border-red-500')}
                    />
                    {fieldErrors.industry && <FieldError>{fieldErrors.industry}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{client.industry}</FieldValue>
                )}
              </div>

              {/* BIR Registration Type */}
              <div>
                <FieldLabel>BIR Registration Type</FieldLabel>
                {editing ? (
                  <>
                    <Select
                      value={form.bir_registration_type ?? ''}
                      onValueChange={(v) => updateField('bir_registration_type', v as BIRRegistrationType)}
                    >
                      <SelectTrigger className={cn('h-8 text-sm', fieldErrors.bir_registration_type && 'border-red-500')}>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vat">VAT</SelectItem>
                        <SelectItem value="non_vat">Non-VAT</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.bir_registration_type && <FieldError>{fieldErrors.bir_registration_type}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{BIR_LABELS[client.bir_registration_type]}</FieldValue>
                )}
              </div>

              {/* Fiscal Year Start Month */}
              <div>
                <FieldLabel>Fiscal Year Start Month</FieldLabel>
                {editing ? (
                  <>
                    <Select
                      value={String(form.fiscal_year_start_month ?? '')}
                      onValueChange={(v) => updateField('fiscal_year_start_month', Number(v))}
                    >
                      <SelectTrigger className={cn('h-8 text-sm', fieldErrors.fiscal_year_start_month && 'border-red-500')}>
                        <SelectValue placeholder="Select month..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>{MONTH_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.fiscal_year_start_month && <FieldError>{fieldErrors.fiscal_year_start_month}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{MONTH_LABELS[client.fiscal_year_start_month]}</FieldValue>
                )}
              </div>

              {/* Status (edit mode only) */}
              {editing && (
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    value={form.status ?? ''}
                    onValueChange={(v) => updateField('status', v as ClientStatus)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Right: Operational ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Operational</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Gmail Address */}
              <div>
                <FieldLabel>Gmail Address</FieldLabel>
                {editing ? (
                  <>
                    <Input
                      type="email"
                      value={form.gmail_address ?? ''}
                      onChange={(e) => updateField('gmail_address', e.target.value)}
                      className={cn('h-8 text-sm', fieldErrors.gmail_address && 'border-red-500')}
                    />
                    {fieldErrors.gmail_address && <FieldError>{fieldErrors.gmail_address}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{client.gmail_address}</FieldValue>
                )}
              </div>

              {/* Monthly Revenue Bracket */}
              <div>
                <FieldLabel>Monthly Revenue Bracket</FieldLabel>
                {editing ? (
                  <>
                    <Select
                      value={form.monthly_revenue_bracket ?? ''}
                      onValueChange={(v) => updateField('monthly_revenue_bracket', v as RevenueBracket)}
                    >
                      <SelectTrigger className={cn('h-8 text-sm', fieldErrors.monthly_revenue_bracket && 'border-red-500')}>
                        <SelectValue placeholder="Select bracket..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below_250k">Below 250K</SelectItem>
                        <SelectItem value="250k_500k">250K - 500K</SelectItem>
                        <SelectItem value="500k_1m">500K - 1M</SelectItem>
                        <SelectItem value="1m_3m">1M - 3M</SelectItem>
                        <SelectItem value="above_3m">Above 3M</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.monthly_revenue_bracket && <FieldError>{fieldErrors.monthly_revenue_bracket}</FieldError>}
                  </>
                ) : (
                  <FieldValue>{REVENUE_LABELS[client.monthly_revenue_bracket]}</FieldValue>
                )}
              </div>

              {/* Google Sheet Folder URL */}
              <div>
                <FieldLabel>Google Sheet Folder URL</FieldLabel>
                {editing ? (
                  <Input
                    type="url"
                    value={form.google_sheet_folder_url ?? ''}
                    onChange={(e) => updateField('google_sheet_folder_url', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="h-8 text-sm"
                  />
                ) : client.google_sheet_folder_url ? (
                  <a
                    href={client.google_sheet_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Open folder
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">Not set</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Activity Log ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No activity recorded yet.</p>
            ) : (
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" />

                {activityLog.map((entry) => (
                  <div key={entry.id} className="relative flex gap-3 py-2.5">
                    {/* Timeline dot */}
                    <div className="relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full bg-teal-500 border-2 border-white shrink-0" />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900">{entry.action}</p>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {Object.entries(entry.details)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDateTime(entry.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
