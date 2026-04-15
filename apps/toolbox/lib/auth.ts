import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/server';
import type { UserRole } from '@numera/db';

export async function getUserRole(user: User): Promise<UserRole | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  return (data?.role as UserRole) ?? null;
}

export async function isAdmin(user: User): Promise<boolean> {
  const role = await getUserRole(user);
  return role === 'admin';
}
