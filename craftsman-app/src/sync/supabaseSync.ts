import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db';
import { nowISO } from '../utils';
import type {
  Project, DailyReport, TimeEntry, MaterialEntry, MachineEntry,
  SubcontractorEntry, RegiReport, RegiPosition, Employee, Machine, Material, Company,
} from '../types';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

const CONFIG_KEY = 'craftsman_supabase_config';
const LAST_PULL_KEY = 'craftsman_last_pull';

export function loadConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SupabaseConfig) : null;
  } catch {
    return null;
  }
}

export function saveConfig(config: SupabaseConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(LAST_PULL_KEY);
}

export function getLastPull(): string | null {
  return localStorage.getItem(LAST_PULL_KEY);
}

function setLastPull(): void {
  localStorage.setItem(LAST_PULL_KEY, nowISO());
}

// ─── Test connection ──────────────────────────────────────────────────────────

export type ConnTestResult =
  | { ok: true; migrated: boolean }
  | { ok: false; message: string };

export async function testConnection(config: SupabaseConfig): Promise<ConnTestResult> {
  try {
    const client = createClient(config.url, config.anonKey);
    const { error } = await client.from('sync_records').select('id').limit(1);
    if (!error) return { ok: true, migrated: true };
    // Table does not exist yet → connection works, SQL migration not run yet
    if (error.code === '42P01') return { ok: true, migrated: false };
    return { ok: false, message: error.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Netzwerkfehler' };
  }
}

// ─── Table registry ───────────────────────────────────────────────────────────

type AnyRecord = { id: string; updatedAt?: string };

interface SyncEntry {
  key: string;
  getAll: () => Promise<AnyRecord[]>;
  putMany: (rows: AnyRecord[]) => Promise<void>;
}

const SYNC_TABLES: SyncEntry[] = [
  { key: 'projects',            getAll: () => db.projects.toArray() as Promise<AnyRecord[]>,            putMany: (r) => db.projects.bulkPut(r as Project[]).then() },
  { key: 'dailyReports',        getAll: () => db.dailyReports.toArray() as Promise<AnyRecord[]>,        putMany: (r) => db.dailyReports.bulkPut(r as DailyReport[]).then() },
  { key: 'timeEntries',         getAll: () => db.timeEntries.toArray() as Promise<AnyRecord[]>,         putMany: (r) => db.timeEntries.bulkPut(r as TimeEntry[]).then() },
  { key: 'materialEntries',     getAll: () => db.materialEntries.toArray() as Promise<AnyRecord[]>,     putMany: (r) => db.materialEntries.bulkPut(r as MaterialEntry[]).then() },
  { key: 'machineEntries',      getAll: () => db.machineEntries.toArray() as Promise<AnyRecord[]>,      putMany: (r) => db.machineEntries.bulkPut(r as MachineEntry[]).then() },
  { key: 'subcontractorEntries',getAll: () => db.subcontractorEntries.toArray() as Promise<AnyRecord[]>,putMany: (r) => db.subcontractorEntries.bulkPut(r as SubcontractorEntry[]).then() },
  { key: 'regiReports',         getAll: () => db.regiReports.toArray() as Promise<AnyRecord[]>,         putMany: (r) => db.regiReports.bulkPut(r as RegiReport[]).then() },
  { key: 'regiPositions',       getAll: () => db.regiPositions.toArray() as Promise<AnyRecord[]>,       putMany: (r) => db.regiPositions.bulkPut(r as RegiPosition[]).then() },
  { key: 'employees',           getAll: () => db.employees.toArray() as Promise<AnyRecord[]>,           putMany: (r) => db.employees.bulkPut(r as Employee[]).then() },
  { key: 'machines',            getAll: () => db.machines.toArray() as Promise<AnyRecord[]>,            putMany: (r) => db.machines.bulkPut(r as Machine[]).then() },
  { key: 'materials',           getAll: () => db.materials.toArray() as Promise<AnyRecord[]>,           putMany: (r) => db.materials.bulkPut(r as Material[]).then() },
  { key: 'company',             getAll: () => db.company.toArray() as Promise<AnyRecord[]>,             putMany: (r) => db.company.bulkPut(r as Company[]).then() },
];

// ─── Push one table ───────────────────────────────────────────────────────────

async function pushTable(client: SupabaseClient, entry: SyncEntry): Promise<number> {
  const local = await entry.getAll();
  if (local.length === 0) return 0;

  const rows = local.map(r => ({
    id: `${entry.key}:${r.id}`,
    table_name: entry.key,
    record_id: r.id,
    data: r,
    data_updated_at: r.updatedAt ?? null,
    synced_at: nowISO(),
  }));

  const { error } = await client.from('sync_records').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Push ${entry.key}: ${error.message}`);
  return local.length;
}

// ─── Pull one table (incremental + last-write-wins) ───────────────────────────

async function pullTable(
  client: SupabaseClient,
  entry: SyncEntry,
  since: string | null,
): Promise<number> {
  let query = client
    .from('sync_records')
    .select('record_id, data, data_updated_at')
    .eq('table_name', entry.key);

  // Incremental: only fetch records pushed after our last pull
  if (since) query = query.gt('synced_at', since);

  const { data, error } = await query;
  if (error) throw new Error(`Pull ${entry.key}: ${error.message}`);
  if (!data?.length) return 0;

  // Last-write-wins: only overwrite local if remote is newer (or we don't have it)
  const localRecords = await entry.getAll();
  const localMap = new Map(localRecords.map(r => [r.id, r]));

  const toMerge: AnyRecord[] = [];
  for (const row of data) {
    const remote = row.data as AnyRecord;
    const local = localMap.get(row.record_id);

    if (!local) {
      toMerge.push(remote);
    } else {
      const remoteUpdated = remote.updatedAt ?? row.data_updated_at;
      const localUpdated = local.updatedAt;
      // Take remote only if it is demonstrably newer
      if (remoteUpdated && localUpdated && remoteUpdated > localUpdated) {
        toMerge.push(remote);
      } else if (!localUpdated && !remoteUpdated) {
        // Neither has a timestamp — keep local (already pushed our version)
      }
      // else local is same/newer — skip
    }
  }

  if (toMerge.length > 0) await entry.putMany(toMerge);
  return toMerge.length;
}

// ─── Public sync API ──────────────────────────────────────────────────────────

export type SyncProgress = (msg: string) => void;

export async function syncNow(
  config: SupabaseConfig,
  onProgress?: SyncProgress,
): Promise<SyncResult> {
  const client = createClient(config.url, config.anonKey);
  const since = getLastPull();
  const errors: string[] = [];
  let pushed = 0;
  let pulled = 0;
  const pullSince = since; // snapshot before push updates synced_at

  // Push phase
  for (const entry of SYNC_TABLES) {
    try {
      onProgress?.(`Hochladen: ${entry.key}…`);
      pushed += await pushTable(client, entry);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Pull phase (incremental from before our push to catch other-device changes)
  for (const entry of SYNC_TABLES) {
    try {
      onProgress?.(`Herunterladen: ${entry.key}…`);
      pulled += await pullTable(client, entry, pullSince);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (errors.length < SYNC_TABLES.length) {
    // Partial success is still worth recording pull time
    setLastPull();
  }

  onProgress?.('');
  return { pushed, pulled, errors };
}

// ─── SQL migration ────────────────────────────────────────────────────────────

export const SUPABASE_SQL = `-- Einmalig im Supabase SQL-Editor ausführen
-- Dashboard → SQL Editor → New Query → Einfügen → Run

create table if not exists public.sync_records (
  id               text primary key,
  table_name       text not null,
  record_id        text not null,
  data             jsonb not null,
  data_updated_at  timestamptz,
  synced_at        timestamptz default now()
);

-- Zugriff ohne Login erlauben (Single-User-App mit Anon Key)
alter table public.sync_records disable row level security;

-- Index für schnelle inkrementelle Abfragen
create index if not exists sync_records_table_synced_idx
  on public.sync_records (table_name, synced_at desc);`;
