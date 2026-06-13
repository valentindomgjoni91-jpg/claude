import { createClient } from '@supabase/supabase-js';
import { db } from '../db';
import { nowISO } from '../utils';
import type {
  Project, DailyReport, TimeEntry, MaterialEntry, MachineEntry,
  SubcontractorEntry, RegiReport, RegiPosition, Employee, Machine, Material, Company,
} from '../types';

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
const LAST_SYNC_KEY = 'craftsman_last_sync';

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
}

export function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

function setLastSync(): void {
  localStorage.setItem(LAST_SYNC_KEY, nowISO());
}

type AnyRecord = { id: string };

interface SyncEntry {
  key: string;
  push: () => Promise<AnyRecord[]>;
  merge: (rows: AnyRecord[]) => Promise<void>;
}

const SYNC_TABLES: SyncEntry[] = [
  {
    key: 'projects',
    push: () => db.projects.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.projects.bulkPut(rows as Project[]).then(),
  },
  {
    key: 'dailyReports',
    push: () => db.dailyReports.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.dailyReports.bulkPut(rows as DailyReport[]).then(),
  },
  {
    key: 'timeEntries',
    push: () => db.timeEntries.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.timeEntries.bulkPut(rows as TimeEntry[]).then(),
  },
  {
    key: 'materialEntries',
    push: () => db.materialEntries.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.materialEntries.bulkPut(rows as MaterialEntry[]).then(),
  },
  {
    key: 'machineEntries',
    push: () => db.machineEntries.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.machineEntries.bulkPut(rows as MachineEntry[]).then(),
  },
  {
    key: 'subcontractorEntries',
    push: () => db.subcontractorEntries.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.subcontractorEntries.bulkPut(rows as SubcontractorEntry[]).then(),
  },
  {
    key: 'regiReports',
    push: () => db.regiReports.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.regiReports.bulkPut(rows as RegiReport[]).then(),
  },
  {
    key: 'regiPositions',
    push: () => db.regiPositions.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.regiPositions.bulkPut(rows as RegiPosition[]).then(),
  },
  {
    key: 'employees',
    push: () => db.employees.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.employees.bulkPut(rows as Employee[]).then(),
  },
  {
    key: 'machines',
    push: () => db.machines.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.machines.bulkPut(rows as Machine[]).then(),
  },
  {
    key: 'materials',
    push: () => db.materials.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.materials.bulkPut(rows as Material[]).then(),
  },
  {
    key: 'company',
    push: () => db.company.toArray() as Promise<AnyRecord[]>,
    merge: (rows) => db.company.bulkPut(rows as Company[]).then(),
  },
];

export async function syncNow(config: SupabaseConfig): Promise<SyncResult> {
  const client = createClient(config.url, config.anonKey);
  const errors: string[] = [];
  let pushed = 0;
  let pulled = 0;

  for (const entry of SYNC_TABLES) {
    try {
      // Push local → Supabase
      const localRecords = await entry.push();
      if (localRecords.length > 0) {
        const rows = localRecords.map(r => ({
          id: `${entry.key}:${r.id}`,
          table_name: entry.key,
          record_id: r.id,
          data: r,
          synced_at: nowISO(),
        }));
        const { error } = await client.from('sync_records').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`Push ${entry.key}: ${error.message}`);
        pushed += localRecords.length;
      }

      // Pull Supabase → local (merge, remote fills in records missing locally)
      const { data, error: pullError } = await client
        .from('sync_records')
        .select('data')
        .eq('table_name', entry.key);
      if (pullError) throw new Error(`Pull ${entry.key}: ${pullError.message}`);
      if (data && data.length > 0) {
        await entry.merge(data.map(row => row.data as AnyRecord));
        pulled += data.length;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (errors.length === 0) setLastSync();
  return { pushed, pulled, errors };
}

export const SUPABASE_SQL = `-- Einmalig im Supabase SQL-Editor ausführen
-- Dashboard → SQL Editor → New Query → Einfügen → Run

create table if not exists public.sync_records (
  id text primary key,
  table_name text not null,
  record_id text not null,
  data jsonb not null,
  synced_at timestamptz default now()
);

-- Zugriff ohne Login erlauben (Single-User-App mit Anon Key)
alter table public.sync_records disable row level security;

create index if not exists sync_records_table_idx
  on public.sync_records (table_name);`;
