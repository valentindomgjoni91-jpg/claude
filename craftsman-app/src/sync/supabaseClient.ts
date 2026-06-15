import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from './supabaseSync';

let _client: SupabaseClient | null = null;
let _configUrl: string | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = loadConfig();
  if (!cfg) { _client = null; _configUrl = null; return null; }
  if (!_client || _configUrl !== cfg.url) {
    _client = createClient(cfg.url, cfg.anonKey);
    _configUrl = cfg.url;
  }
  return _client;
}

export function resetSupabaseClient(): void {
  _client = null;
  _configUrl = null;
}
