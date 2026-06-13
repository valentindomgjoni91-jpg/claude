# Craftsman App – Session Memory

## Stand: 2026-06-13

### Projekt
- Repo: `valentindomgjoni91-jpg/claude`
- Branch: `claude/craftsman-reporting-app-4o7zjm`
- App-Pfad: `/home/user/claude/craftsman-app`
- Stack: React 18 + TypeScript + Vite PWA, Dexie.js v4 (IndexedDB), jsPDF, Supabase

---

## Was fertig ist (Phase 6, komplett)

### 6.1 PDF-Verbesserungen
- Logo in Header (base64, aus Firmenprofil)
- IBAN in Footer
- Telefon in Firmeninfos
- Gilt für `dailyReportPdf.ts` und `regiReportPdf.ts`

### 6.2 Supabase Cloud-Sync
- `src/sync/supabaseSync.ts` – vollständige Sync-Logik
  - `testConnection()` – erkennt ob Migration gelaufen (42P01)
  - `syncNow()` – Push + Pull, incremental, last-write-wins
  - `loadConfig()` – fällt zurück auf `VITE_SUPABASE_*` Env-Vars
- `src/sync/useSyncStatus.ts` – Auto-Sync alle 5 min im Hintergrund
- Supabase-Projekt: **"Craftsman App"** (`zaefuuwlifxedimuiuhh`), Region `eu-central-1`
- SQL-Migration bereits ausgeführt (`sync_records` Tabelle live)
- Credentials in `craftsman-app/.env` (gitignored):
  - `VITE_SUPABASE_URL=https://zaefuuwlifxedimuiuhh.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=eyJhbGci...` (JWT anon key)

### 6.3 Zeiterfassung – Projekte-Tab
- `src/pages/TimeTracking.tsx` – 3. Tab "Projekte" mit `Briefcase`-Icon
- Zeigt Stunden pro Projekt, Progress-Bars, "Ohne Projekt"-Bucket

### 6.4 Stammdaten – Inline-Editing
- Alle drei Tabs (Mitarbeiter, Maschinen, Material) haben Bleistift-Icon + Edit-Formular
- Firmenprofil: Logo-Upload (base64) + IBAN-Feld

### 6.5 Sync-Tab in Stammdaten
- 5. Tab mit Cloud-Icon
- Verbindungstest, Sync-Button, Fortschrittsanzeige, SQL-Anleitung

---

## Offene Punkte / Mögliche nächste Schritte

- [ ] **Phase 7 planen** – noch nicht besprochen, mögliche Themen:
  - Export/Import (JSON-Backup)
  - Mehrbenutzer-Unterstützung (Auth)
  - Push-Notifications (PWA)
  - Dashboard/Auswertungen
  - Druckansicht optimieren
- [ ] App testen auf echtem Gerät (iOS/Android als PWA installieren)
- [ ] Supabase-Projekt ggf. mit Auth absichern (derzeit RLS deaktiviert)

---

## Wichtige Dateien

| Datei | Inhalt |
|-------|--------|
| `src/sync/supabaseSync.ts` | Sync-Logik, Config, SQL-Migration |
| `src/sync/useSyncStatus.ts` | Auto-Sync Hook |
| `src/pages/MasterData.tsx` | Stammdaten inkl. Sync-Tab |
| `src/pages/TimeTracking.tsx` | Zeiterfassung inkl. Projekte-Tab |
| `src/pdf/dailyReportPdf.ts` | PDF Tagesbericht |
| `src/pdf/regiReportPdf.ts` | PDF Regieberichte |
| `craftsman-app/.env` | Supabase Credentials (nicht in Git!) |

---

## Kontext für nächste Session

- Alle Phase-6-Features committed und gepusht
- Build läuft sauber durch (nur Chunk-Size-Warnings, kein Fehler)
- MCP Supabase-Tools jetzt genehmigt (Permission-Modus auf "Nicht fragen" gestellt)
- Supabase-DB ist live und bereit
