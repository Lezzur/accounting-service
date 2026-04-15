'use server';

import { createClient } from '@numera/db';
import type { BusinessType, BIRRegistrationType } from '@numera/db';

export type SortColumn =
  | 'businessName'
  | 'businessType'
  | 'birRegistrationType'
  | 'nextDeadline'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface ClientRow {
  id: string;
  businessName: string;
  businessType: BusinessType;
  birRegistrationType: BIRRegistrationType;
  status: 'active' | 'inactive';
  nextDeadline: string | null;
}

export interface FetchClientsParams {
  search: string;
  businessType: BusinessType | '';
  birType: BIRRegistrationType | '';
  sortColumn: SortColumn;
  sortDir: SortDirection;
  page: number;
}

export const PAGE_SIZE = 50;

const DB_SORT_COLUMNS: Record<Exclude<SortColumn, 'nextDeadline'>, string> = {
  businessName: 'business_name',
  businessType: 'business_type',
  birRegistrationType: 'bir_registration_type',
  status: 'status',
};

export async function fetchClientsAction(
  params: FetchClientsParams,
): Promise<{ clients: ClientRow[]; totalCount: number }> {
  const { search, businessType, birType, sortColumn, sortDir, page } = params;
  const supabase = createClient();

  // eslint-disable-next-line prefer-const
  let query = supabase
    .from('clients')
    .select('id, business_name, business_type, bir_registration_type, status', {
      count: 'exact',
    });

  if (search) {
    // @ts-expect-error — Supabase filter builder type is reassignable
    query = query.ilike('business_name', `%${search}%`);
  }
  if (businessType) {
    // @ts-expect-error — Supabase filter builder type is reassignable
    query = query.eq('business_type', businessType);
  }
  if (birType) {
    // @ts-expect-error — Supabase filter builder type is reassignable
    query = query.eq('bir_registration_type', birType);
  }

  if (sortColumn !== 'nextDeadline') {
    // @ts-expect-error — Supabase filter builder type is reassignable
    query = query.order(DB_SORT_COLUMNS[sortColumn], { ascending: sortDir === 'asc' });
  } else {
    // @ts-expect-error — Supabase filter builder type is reassignable
    query = query.order('business_name', { ascending: true });
  }

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  // @ts-expect-error — Supabase filter builder type is reassignable
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const rawClients = (data ?? []) as Array<{
    id: string;
    business_name: string;
    business_type: BusinessType;
    bir_registration_type: BIRRegistrationType;
    status: 'active' | 'inactive';
  }>;
  const totalCount = count ?? 0;

  if (rawClients.length === 0) {
    return { clients: [], totalCount };
  }

  // Fetch the nearest upcoming deadline for each client on this page
  const clientIds = rawClients.map((c) => c.id);
  const { data: deadlines } = await supabase
    .from('deadlines')
    .select('client_id, due_date')
    .in('client_id', clientIds)
    .eq('status', 'upcoming')
    .order('due_date', { ascending: true });

  // First occurrence per client_id = earliest upcoming deadline
  const nextDeadlineMap: Record<string, string> = {};
  for (const d of (deadlines ?? []) as Array<{ client_id: string; due_date: string }>) {
    if (!nextDeadlineMap[d.client_id]) {
      nextDeadlineMap[d.client_id] = d.due_date;
    }
  }

  let clients: ClientRow[] = rawClients.map((c) => ({
    id: c.id,
    businessName: c.business_name,
    businessType: c.business_type,
    birRegistrationType: c.bir_registration_type,
    status: c.status,
    nextDeadline: nextDeadlineMap[c.id] ?? null,
  }));

  // Sort by nextDeadline client-side (computed column — no DB column to order by)
  if (sortColumn === 'nextDeadline') {
    clients.sort((a, b) => {
      if (!a.nextDeadline && !b.nextDeadline) return 0;
      if (!a.nextDeadline) return 1;
      if (!b.nextDeadline) return -1;
      const cmp = a.nextDeadline.localeCompare(b.nextDeadline);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return { clients, totalCount };
}
