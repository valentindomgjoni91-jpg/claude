# Handwerker Rapport — Projekt Memory

## App-URL
https://spontaneous-dodol-8cc083.netlify.app

## Repo & Branch
- Repo: `valentindomgjoni91-jpg/claude`
- Branch: `claude/craftsman-reporting-app-4o7zjm`
- Netlify Auto-Deploy via GitHub (installation_id: 140280619)
- Site ID: `6318a763-de13-4553-b7d9-660992f627f8`

## Tech Stack
- React 18 + TypeScript + Vite PWA
- Dexie.js v4 (IndexedDB, offline-first, kein Backend nötig)
- Tailwind CSS (`darkMode: 'class'`)
- react-router-dom, lucide-react, jsPDF

## Was bisher gebaut wurde

### Features
1. **Tagesrapporte** — mit Tabs: Info, Zeiten, Material, Maschinen, Fremdleistungen, Leistungen, Fotos, Unterschrift
2. **Regierapporte** — mit Positionen (Arbeit/Material/Maschinen/Zusatz), Fotos, Abschluss/Unterschrift
3. **Tagesrapport → Regierapport übernehmen** — Button "Tagesrapport übernehmen" im Positionen-Tab
4. **Leistungen-Tab** (Tagesrapport) — Leistungsarten: Regiearbeit, Wandbeläge, Bodenbeläge, Fugenarbeiten etc.
5. **Projekte** — anlegen, bearbeiten, archivieren
6. **Stammdaten** — Mitarbeiter, Maschinen, Material, Firmendaten, Sync
7. **Archiv** — alle Rapporte durchsuchen/filtern
8. **Zeiterfassung** — Übersicht aller Zeiteinträge
9. **PDF-Export** — Tages- und Regierapport als PDF, Rechnungs-PDF
10. **Swipe-to-Delete** — in Stammdaten (Mitarbeiter, Maschinen, Material)
11. **Demo-Daten Cleanup** — Muster-Mitarbeiter werden beim Start automatisch gelöscht

### Admin/Mitarbeiter-System
- **Schloss-Icon** im App-Header (oben rechts)
  - Grau = Mitarbeiter-Modus
  - Grün = Admin-Modus aktiv
- **Kein PIN gesetzt** → Schloss tippen → sofort entsperrt (kein Dialog)
- **PIN setzen** → Stammdaten → Firmendaten → Admin-PIN → speichern
- **Mitarbeiter sieht**: Dashboard, Projekte (nur lesen), Archiv, Rapporte erstellen, Unterschrift einholen
- **Mitarbeiter sieht NICHT**: Stammdaten, Zeiterfassung, Preise im Regierapport, "Projekt anlegen"
- **Admin sieht**: alles
- Session: Admin-Modus bleibt bis Browser-Tab geschlossen (sessionStorage)

### UI-Entscheidungen
- Kein separater PageHeader auf Hauptseiten (Bottom-Nav identifiziert die Seite)
- Form-Seiten (Tages-/Regierapport) haben einen einzigen sticky Header-Block: Zurück-Pfeil + Titel + Speichern + Tabs
- Dark Mode vollständig unterstützt (alle Texte, Borders, Backgrounds)
- Wetter-Feld im Tagesrapport wurde entfernt
- Tabs scrollen horizontal wenn zu viele (shrink-0, kein flex-1)

## DB-Schema (Dexie v2)
```
projects: id, status, createdAt
dailyReports: id, projectId, date, status, createdAt
regiReports: id, projectId, date, status, createdAt
timeEntries: id, reportId, reportType, employeeId, date
materialEntries: id, reportId, reportType
machineEntries: id, reportId, reportType
subcontractorEntries: id, reportId
photos: id, reportId, reportType, timestamp
regiPositions: id, regiReportId, type, sortOrder
employees: id, lastName, active
machines: id, name, active
materials: id, name, active
company: id (singleton)
syncQueue: id, tableName, createdAt, synced
leistungEntries: id, reportId, createdAt  ← v2 neu
```

## Wichtige Dateien
| Datei | Zweck |
|---|---|
| `src/context/AdminContext.tsx` | Admin/Mitarbeiter PIN-System |
| `src/components/layout/AppLayout.tsx` | Header + Bottom-Nav + PIN-Modal |
| `src/pages/DailyReportForm.tsx` | Tagesrapport-Formular (grosse Datei) |
| `src/pages/RegiReportForm.tsx` | Regierapport-Formular |
| `src/pages/MasterData.tsx` | Stammdaten (Mitarbeiter, Maschinen, Material, Firma) |
| `src/hooks/useLeistungEntries.ts` | Leistungen-Hook |
| `src/components/ui/SwipeToDelete.tsx` | Swipe-to-Delete Komponente |
| `src/db/index.ts` | Dexie DB-Definition + seedDefaultData + cleanupDemoData |

## Multi-Gerät / Sync
- Aktuell: Daten nur lokal auf dem Gerät (IndexedDB)
- Supabase-Sync bereits eingebaut (Stammdaten → Sync-Tab)
- Für Mitarbeiter-Zugriff auf Admin-Daten: Supabase einrichten (kostenlos, ~10 Min)
- User möchte das **später** entscheiden

## Offene Punkte / Ideen
- Supabase Cloud-Sync einrichten wenn User bereit ist
- Evtl. Rapporte-Status-Flow verfeinern (Entwurf → Abgeschlossen → Verrechnet)
