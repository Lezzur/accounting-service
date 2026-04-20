import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/response.ts';

// ─── Constants ──────────────────────────────────────────────────────────────

const SUPPORTED_FORMS = [
  '2551Q', '2550M', '2550Q', '1701', '1701Q', '1702', '1702Q',
  '1601-C', '1601-EQ', '0619-E', '0619-F',
] as const;

const QUARTERLY_RE = /^Q([1-4])-(\d{4})$/;
const MONTHLY_RE = /^(\d{4})-(\d{2})$/;
const ANNUAL_RE = /^(\d{4})$/;

// ─── Validation ─────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  clientId: z.string().uuid(),
  formNumber: z.enum(SUPPORTED_FORMS),
  filingPeriod: z.string().regex(
    /^(Q[1-4]-\d{4}|\d{4}-\d{2}|\d{4})$/,
    'Must be Q{1-4}-YYYY, YYYY-MM, or YYYY',
  ),
  priorYear: z.boolean().optional(),
});

// ─── Filing period resolution ───────────────────────────────────────────────

function resolveFilingPeriod(
  filingPeriod: string,
  fiscalYearStartMonth: number,
): { periodStart: string; periodEnd: string } {
  const qMatch = filingPeriod.match(QUARTERLY_RE);
  if (qMatch) {
    const quarter = parseInt(qMatch[1]);
    const year = parseInt(qMatch[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      periodStart: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      periodEnd: lastDayOfMonth(year, endMonth),
    };
  }

  const mMatch = filingPeriod.match(MONTHLY_RE);
  if (mMatch) {
    const year = parseInt(mMatch[1]);
    const month = parseInt(mMatch[2]);
    return {
      periodStart: `${year}-${String(month).padStart(2, '0')}-01`,
      periodEnd: lastDayOfMonth(year, month),
    };
  }

  const aMatch = filingPeriod.match(ANNUAL_RE);
  if (aMatch) {
    const year = parseInt(aMatch[1]);
    const startMonth = fiscalYearStartMonth;
    const startYear = startMonth === 1 ? year : year;
    const endMonth = startMonth === 1 ? 12 : startMonth - 1;
    const endYear = startMonth === 1 ? year : year + 1;
    return {
      periodStart: `${startYear}-${String(startMonth).padStart(2, '0')}-01`,
      periodEnd: lastDayOfMonth(endYear, endMonth),
    };
  }

  throw new Error(`Invalid filing period format: ${filingPeriod}`);
}

function shiftPeriodBackOneYear(filingPeriod: string): { shifted: string; label: string } {
  const qMatch = filingPeriod.match(QUARTERLY_RE);
  if (qMatch) {
    const shifted = `Q${qMatch[1]}-${parseInt(qMatch[2]) - 1}`;
    return { shifted, label: `Q${qMatch[1]} ${parseInt(qMatch[2]) - 1}` };
  }

  const mMatch = filingPeriod.match(MONTHLY_RE);
  if (mMatch) {
    const shifted = `${parseInt(mMatch[1]) - 1}-${mMatch[2]}`;
    return { shifted, label: `${mMatch[2]}/${parseInt(mMatch[1]) - 1}` };
  }

  const aMatch = filingPeriod.match(ANNUAL_RE);
  if (aMatch) {
    const shifted = `${parseInt(aMatch[1]) - 1}`;
    return { shifted, label: `${parseInt(aMatch[1]) - 1}` };
  }

  return { shifted: filingPeriod, label: filingPeriod };
}

function lastDayOfMonth(year: number, month: number): string {
  // Day 0 of next month = last day of current month
  const d = new Date(year, month, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Mapping types ──────────────────────────────────────────────────────────

interface FieldMapping {
  id: string;
  field_code: string;
  field_label: string;
  mapping_type: string;
  mapping_expression: Record<string, unknown>;
  is_required: boolean;
  is_editable: boolean;
  display_order: number;
  section: string | null;
}

interface EvaluatedField {
  fieldCode: string;
  label: string;
  value: string | null;
  isEditable: boolean;
  isRequired: boolean;
  mappingType: string;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

async function evaluateSumCategory(
  serviceClient: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string,
  expr: Record<string, unknown>,
  warnings: string[],
  fieldLabel: string,
): Promise<string> {
  const categoryCodes = expr.category_codes as string[] | undefined;
  const transactionType = expr.transaction_type as string | undefined;

  if (!categoryCodes || categoryCodes.length === 0) {
    warnings.push(`No category codes configured for field '${fieldLabel}'`);
    return '0.00';
  }

  let query = serviceClient
    .from('transactions')
    .select('amount')
    .eq('client_id', clientId)
    .eq('status', 'approved')
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .in('category_code', categoryCodes);

  if (transactionType) {
    query = query.eq('type', transactionType);
  }

  const { data, error } = await query;
  if (error) {
    warnings.push(`Query failed for field '${fieldLabel}': ${error.message}`);
    return '0.00';
  }

  if (!data || data.length === 0) {
    warnings.push(
      `No transactions found for category codes ${categoryCodes.join(', ')} (${fieldLabel}) — verify if applicable`,
    );
    return '0.00';
  }

  const total = (data as Array<{ amount: number }>).reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );
  return total.toFixed(2);
}

async function evaluateSumAccountType(
  serviceClient: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string,
  expr: Record<string, unknown>,
  warnings: string[],
  fieldLabel: string,
): Promise<string> {
  const accountType = expr.account_type as string | undefined;
  const transactionType = expr.transaction_type as string | undefined;

  if (!accountType) {
    warnings.push(`No account_type configured for field '${fieldLabel}'`);
    return '0.00';
  }

  // Get all chart_of_accounts codes for this account type
  const { data: coaCodes, error: coaError } = await serviceClient
    .from('chart_of_accounts')
    .select('code')
    .eq('account_type', accountType)
    .eq('is_active', true);

  if (coaError || !coaCodes || coaCodes.length === 0) {
    warnings.push(`No chart of accounts entries found for account type '${accountType}' (${fieldLabel})`);
    return '0.00';
  }

  const codes = (coaCodes as Array<{ code: string }>).map((c) => c.code);

  let query = serviceClient
    .from('transactions')
    .select('amount')
    .eq('client_id', clientId)
    .eq('status', 'approved')
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .in('category_code', codes);

  if (transactionType) {
    query = query.eq('type', transactionType);
  }

  const { data, error } = await query;
  if (error) {
    warnings.push(`Query failed for field '${fieldLabel}': ${error.message}`);
    return '0.00';
  }

  if (!data || data.length === 0) {
    warnings.push(
      `No transactions found for account type '${accountType}' (${fieldLabel}) — verify if applicable`,
    );
    return '0.00';
  }

  const total = (data as Array<{ amount: number }>).reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );
  return total.toFixed(2);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function evaluatePeriodPart(
  effectivePeriod: string,
  fiscalYearStartMonth: number,
  expr: Record<string, unknown>,
  warnings: string[],
  fieldLabel: string,
): string | null {
  const part = expr.part as string | undefined;
  if (!part) {
    warnings.push(`No 'part' configured for period_part mapping '${fieldLabel}'`);
    return null;
  }

  const qMatch = effectivePeriod.match(QUARTERLY_RE);
  const mMatch = effectivePeriod.match(MONTHLY_RE);
  const aMatch = effectivePeriod.match(ANNUAL_RE);

  switch (part) {
    case 'year': {
      if (qMatch) return qMatch[2];
      if (mMatch) return mMatch[1];
      if (aMatch) return aMatch[1];
      return null;
    }
    case 'quarter': {
      if (qMatch) return qMatch[1];
      return null;
    }
    case 'month': {
      if (mMatch) {
        const idx = parseInt(mMatch[2]) - 1;
        return MONTH_NAMES[idx] ?? null;
      }
      return null;
    }
    case 'fiscal_year_end': {
      // fiscal_year_start_month=1 → ends December 31; start=4 → ends March 31
      const endMonthIdx = (fiscalYearStartMonth + 10) % 12; // start-1 then wrapped: Jan(1) => Dec(11)
      const endMonthName = MONTH_NAMES[endMonthIdx];
      const endDay = new Date(2001, endMonthIdx + 1, 0).getDate();
      return `${endMonthName} ${endDay}`;
    }
    default:
      warnings.push(`Unknown period_part '${part}' for field '${fieldLabel}'`);
      return null;
  }
}

async function evaluateClientField(
  serviceClient: SupabaseClient,
  clientId: string,
  expr: Record<string, unknown>,
  warnings: string[],
  fieldLabel: string,
): Promise<string | null> {
  const fieldName = expr.field as string | undefined;
  if (!fieldName) {
    warnings.push(`No field name configured for client_field mapping '${fieldLabel}'`);
    return null;
  }

  const { data, error } = await serviceClient
    .from('clients')
    .select(fieldName)
    .eq('id', clientId)
    .single();

  if (error || !data) {
    warnings.push(`Could not load client field '${fieldName}' for '${fieldLabel}'`);
    return null;
  }

  const value = (data as Record<string, unknown>)[fieldName];
  return value != null ? String(value) : null;
}

// ─── Computed field evaluation ──────────────────────────────────────────────

/**
 * Topological sort of field mappings. Computed fields that reference other
 * fields via "field:xxx" are sorted after their dependencies.
 * Returns sorted mappings or throws on circular dependency.
 */
function topologicalSort(mappings: FieldMapping[]): FieldMapping[] {
  const byCode = new Map<string, FieldMapping>();
  for (const m of mappings) {
    byCode.set(m.field_code, m);
  }

  // Build adjacency: computed fields depend on fields referenced in their formula
  const deps = new Map<string, string[]>();
  for (const m of mappings) {
    if (m.mapping_type === 'computed') {
      const formula = (m.mapping_expression as { formula?: string }).formula ?? '';
      const refs: string[] = [];
      const re = /field:(\w+)/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(formula)) !== null) {
        refs.push(match[1]);
      }
      deps.set(m.field_code, refs);
    } else {
      deps.set(m.field_code, []);
    }
  }

  // Kahn's algorithm
  // inDeg[x] = number of unresolved dependencies of x
  // dependents[x] = fields that depend on x
  const inDeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const code of byCode.keys()) {
    inDeg.set(code, 0);
    dependents.set(code, []);
  }
  for (const [code, fieldDeps] of deps) {
    // Filter to only known fields
    const known = fieldDeps.filter((d) => byCode.has(d));
    inDeg.set(code, known.length);
    for (const dep of known) {
      dependents.get(dep)!.push(code);
    }
  }

  const queue: string[] = [];
  for (const [code, deg] of inDeg) {
    if (deg === 0) queue.push(code);
  }

  const sorted: FieldMapping[] = [];
  while (queue.length > 0) {
    const code = queue.shift()!;
    sorted.push(byCode.get(code)!);
    for (const dependent of dependents.get(code) ?? []) {
      const newDeg = (inDeg.get(dependent) ?? 1) - 1;
      inDeg.set(dependent, newDeg);
      if (newDeg === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== mappings.length) {
    const unsorted = mappings
      .filter((m) => !sorted.includes(m))
      .map((m) => m.field_code);
    throw new Error(
      `Circular dependency detected in computed fields: ${unsorted.join(', ')}`,
    );
  }

  return sorted;
}

function evaluateFormula(
  formula: string,
  resolvedValues: Map<string, string>,
): string {
  // Replace "field:xxx" references with their numeric values
  const expression = formula.replace(/field:(\w+)/g, (_match, code: string) => {
    const val = resolvedValues.get(code);
    return val != null ? val : '0';
  });

  // Safe numeric evaluation: allow digits, operators, parens, Math.max/min, commas, ternary
  if (!/^[\d.+\-*/() ,?:]+$/.test(expression.replace(/Math\.(max|min|abs|round|floor|ceil)/g, ''))) {
    throw new Error(`Unsafe formula expression: ${expression}`);
  }

  // Evaluate using Function constructor (safe given the character whitelist above)
  const result = new Function(`return (${expression})`)() as number;

  if (!isFinite(result)) {
    return '0.00';
  }

  return result.toFixed(2);
}

// ─── Edge Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'UNAUTHORIZED', 'Missing authorization header', requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }

    // --- Parse & validate body ---
    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId);
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        issue: i.message,
      }));
      return errorResponse(400, 'VALIDATION_FAILED', 'Request validation failed', requestId, details);
    }

    const { clientId, formNumber, filingPeriod, priorYear } = parsed.data;

    // --- Service client for DB queries ---
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // --- Load client (needed for client_field mappings and fiscal year) ---
    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(404, 'NOT_FOUND', 'Client not found', requestId);
    }

    // --- Load current template for the form ---
    const { data: template, error: templateError } = await serviceClient
      .from('bir_form_templates')
      .select('*')
      .eq('form_number', formNumber)
      .eq('is_current', true)
      .single();

    if (templateError || !template) {
      return errorResponse(
        404,
        'NOT_FOUND',
        `No current template found for form ${formNumber}`,
        requestId,
      );
    }

    // --- Load field mappings ---
    const { data: mappings, error: mappingsError } = await serviceClient
      .from('bir_form_field_mappings')
      .select('*')
      .eq('template_id', template.id)
      .order('display_order', { ascending: true });

    if (mappingsError) {
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to load field mappings', requestId);
    }

    if (!mappings || mappings.length === 0) {
      return errorResponse(
        404,
        'NOT_FOUND',
        `No field mappings configured for form ${formNumber}`,
        requestId,
      );
    }

    // --- Resolve filing period to date range ---
    const effectivePeriod = priorYear
      ? shiftPeriodBackOneYear(filingPeriod).shifted
      : filingPeriod;
    const priorYearLabel = priorYear
      ? shiftPeriodBackOneYear(filingPeriod).label
      : '';

    const { periodStart, periodEnd } = resolveFilingPeriod(
      effectivePeriod,
      client.fiscal_year_start_month,
    );

    // --- Topological sort (detect circular deps) ---
    let sortedMappings: FieldMapping[];
    try {
      sortedMappings = topologicalSort(mappings as FieldMapping[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown dependency error';
      return errorResponse(500, 'INTERNAL_ERROR', msg, requestId);
    }

    // --- Evaluate each field mapping ---
    const warnings: string[] = [];
    const resolvedValues = new Map<string, string>();
    const evaluatedFields = new Map<string, EvaluatedField>();

    for (const mapping of sortedMappings) {
      const m = mapping as FieldMapping;
      const expr = m.mapping_expression;
      let value: string | null = null;

      switch (m.mapping_type) {
        case 'sum_category':
          value = await evaluateSumCategory(
            serviceClient, clientId, periodStart, periodEnd,
            expr, warnings, m.field_label,
          );
          break;

        case 'sum_account_type':
          value = await evaluateSumAccountType(
            serviceClient, clientId, periodStart, periodEnd,
            expr, warnings, m.field_label,
          );
          break;

        case 'client_field':
          value = await evaluateClientField(
            serviceClient, clientId, expr, warnings, m.field_label,
          );
          break;

        case 'period_part':
          value = evaluatePeriodPart(
            effectivePeriod, client.fiscal_year_start_month,
            expr, warnings, m.field_label,
          );
          break;

        case 'static':
          value = expr.value != null ? String(expr.value) : null;
          break;

        case 'computed': {
          const formula = (expr as { formula?: string }).formula;
          if (!formula) {
            warnings.push(`No formula configured for computed field '${m.field_label}'`);
            value = '0.00';
          } else {
            try {
              value = evaluateFormula(formula, resolvedValues);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Formula evaluation failed';
              warnings.push(`Formula error for '${m.field_label}': ${msg}`);
              value = '0.00';
            }
          }
          break;
        }

        default:
          warnings.push(`Unknown mapping type '${m.mapping_type}' for field '${m.field_label}'`);
      }

      if (value != null) {
        resolvedValues.set(m.field_code, value);
      }

      evaluatedFields.set(m.field_code, {
        fieldCode: m.field_code,
        label: m.field_label,
        value,
        isEditable: m.is_editable,
        isRequired: m.is_required,
        mappingType: m.mapping_type,
      });
    }

    // --- Build prefill_data JSON ---
    const prefillData: Record<string, string> = {};
    for (const [code, val] of resolvedValues) {
      prefillData[code] = val;
    }
    for (const [code, field] of evaluatedFields) {
      if (field.value != null && !(code in prefillData)) {
        prefillData[code] = field.value;
      }
    }

    // --- Prior-year mode: return data only, skip upsert ---
    if (priorYear) {
      return new Response(
        JSON.stringify({ prefillData, periodLabel: priorYearLabel }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // --- UPSERT bir_tax_form_records ---
    const { data: existingRecord } = await serviceClient
      .from('bir_tax_form_records')
      .select('id')
      .eq('client_id', clientId)
      .eq('form_number', formNumber)
      .eq('filing_period', filingPeriod)
      .maybeSingle();

    let recordId: string;

    if (existingRecord) {
      const { error: updateError } = await serviceClient
        .from('bir_tax_form_records')
        .update({
          template_id: template.id,
          prefill_data: prefillData,
          status: 'prefill_complete',
        })
        .eq('id', existingRecord.id);

      if (updateError) {
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to update form record', requestId);
      }
      recordId = existingRecord.id;
    } else {
      const { data: newRecord, error: insertError } = await serviceClient
        .from('bir_tax_form_records')
        .insert({
          client_id: clientId,
          template_id: template.id,
          form_number: formNumber,
          filing_period: filingPeriod,
          prefill_data: prefillData,
          status: 'prefill_complete',
        })
        .select('id')
        .single();

      if (insertError || !newRecord) {
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to create form record', requestId);
      }
      recordId = newRecord.id;
    }

    // --- Return flat response matching frontend PrefillResponse type ---
    return new Response(
      JSON.stringify({
        recordId,
        formNumber,
        clientTin: client.tin ?? '',
        filingPeriod,
        prefillData,
        warnings: warnings.length > 0 ? warnings : undefined,
        templateStale: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('Unhandled error:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
