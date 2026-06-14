import { useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../sync/supabaseClient';
import { loadConfig } from '../sync/supabaseSync';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = !!loadConfig();

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    const client = getSupabaseClient();
    if (!client) { setLoading(false); return; }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [configured]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase nicht konfiguriert');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase nicht konfiguriert');
    const { error } = await client.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseClient()?.auth.signOut();
  }, []);

  return {
    session,
    user: session?.user as User | null,
    loading,
    configured,
    signIn,
    signUp,
    signOut,
  };
}
