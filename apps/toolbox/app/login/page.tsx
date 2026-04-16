'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@numera/ui';
import { createClient } from '../../lib/supabase/client';

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5000;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const failCount = useRef(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || loading) return;

    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      failCount.current += 1;

      if (failCount.current >= MAX_ATTEMPTS) {
        setLocked(true);
        setTimeout(() => {
          setLocked(false);
          failCount.current = 0;
        }, LOCKOUT_MS);
      }

      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    failCount.current = 0;
    router.push('/crm/pipeline');
    router.refresh();
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Numera Toolbox</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!error}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!error}
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--destructive)]" role="alert">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || locked}
            >
              {locked
                ? 'Too many attempts — wait 5s'
                : loading
                  ? 'Signing in…'
                  : 'Sign In'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
