'use server';

import { createClient } from '../../../../../lib/supabase/server';
import type { BIRRegistrationType } from '@numera/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientOption {
  id: string;
  businessName: string;
  gmailAddress: string;
  birRegistrationType: BIRRegistrationType;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: string;
  displayOrder: number;
}

export interface SaveInvoiceDraftParams {
  clientId: string;
  invoiceNumber: string;
  lineItems: LineItemInput[];
  subtotal: string;
  vatAmount: string | null;
  totalAmount: string;
  issueDate: string;
  dueDate: string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function fetchClientsForDropdownAction(): Promise<ClientOption[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('clients')
    .select('id, business_name, gmail_address, bir_registration_type')
    .eq('status', 'active')
    .order('business_name', { ascending: true });

  if (error) throw new Error(error.message);

  const rawClients = (data ?? []) as Array<{
    id: string;
    business_name: string;
    gmail_address: string;
    bir_registration_type: string;
  }>;

  return rawClients.map((c) => ({
    id: c.id,
    businessName: c.business_name,
    gmailAddress: c.gmail_address,
    birRegistrationType: c.bir_registration_type as BIRRegistrationType,
  }));
}

/**
 * Returns the next available invoice number in `INV-YYYY-####` format.
 * Reads the highest existing sequence for the current year and increments it.
 */
export async function generateInvoiceNumberAction(): Promise<string> {
  const supabase = createClient();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .ilike('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length > 0) {
    const last = data[0].invoice_number as string;
    const seq = parseInt(last.replace(prefix, ''), 10);
    if (!isNaN(seq)) nextSeq = seq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Inserts a new draft invoice with its line items.
 * Returns the created invoice's id and invoice_number.
 */
export async function saveInvoiceDraftAction(
  params: SaveInvoiceDraftParams,
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: params.invoiceNumber,
      client_id: params.clientId,
      subtotal: params.subtotal,
      vat_amount: params.vatAmount,
      total_amount: params.totalAmount,
      issue_date: params.issueDate,
      due_date: params.dueDate,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? 'Failed to create invoice');
  }

  const { error: lineItemsError } = await supabase
    .from('invoice_line_items')
    .insert(
      params.lineItems.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        display_order: item.displayOrder,
      })),
    );

  if (lineItemsError) throw new Error(lineItemsError.message);

  return { invoiceId: invoice.id, invoiceNumber: params.invoiceNumber };
}
