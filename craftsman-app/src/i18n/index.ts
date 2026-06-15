import { createContext, useContext, useState, type ReactNode } from 'react';
import React from 'react';

export type Lang = 'de' | 'fr' | 'it';

export const LANGUAGE_NAMES: Record<Lang, string> = {
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
};

const LANG_KEY = 'craftsman_language';

const translations: Record<Lang, Record<string, string>> = {
  de: {
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projekte',
    'nav.time': 'Zeiten',
    'nav.archive': 'Archiv',
    'nav.masterdata': 'Stammdaten',
    'action.save': 'Speichern',
    'action.cancel': 'Abbrechen',
    'action.add': 'Hinzufügen',
    'action.delete': 'Löschen',
    'action.edit': 'Bearbeiten',
    'action.download': 'Herunterladen',
    'action.new': 'Neu',
    'action.close': 'Schliessen',
    'action.sync': 'Synchronisieren',
    'action.export': 'Exportieren',
    'action.import': 'Importieren',
    'status.draft': 'Entwurf',
    'status.completed': 'Abgeschlossen',
    'status.active': 'Aktiv',
    'status.archived': 'Archiviert',
    'status.signed': 'Signiert',
    'status.invoiced': 'Verrechnet',
    'status.inactive': 'Inaktiv',
    'tab.info': 'Info',
    'tab.time': 'Zeiten',
    'tab.material': 'Material',
    'tab.machine': 'Maschinen',
    'tab.subcontractor': 'Fremd',
    'tab.photos': 'Fotos',
    'tab.signature': 'Unterschrift',
    'tab.positions': 'Positionen',
    'tab.summary': 'Abschluss',
    'tab.timesheet': 'Stundenzettel',
    'tab.company': 'Firma',
    'tab.employees': 'Mitarbeiter',
    'tab.machines': 'Maschinen',
    'tab.materials': 'Material',
    'tab.sync': 'Sync',
    'page.projects': 'Projekte',
    'page.daily_reports': 'Tagesrapporte',
    'page.regi_reports': 'Regierapporte',
    'page.time_tracking': 'Zeiterfassung',
    'page.master_data': 'Stammdaten',
    'page.archive': 'Archiv',
    'section.language': 'Sprache / Langue / Lingua',
    'language.select': 'App-Sprache',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.projects': 'Projets',
    'nav.time': 'Temps',
    'nav.archive': 'Archives',
    'nav.masterdata': 'Données de base',
    'action.save': 'Enregistrer',
    'action.cancel': 'Annuler',
    'action.add': 'Ajouter',
    'action.delete': 'Supprimer',
    'action.edit': 'Modifier',
    'action.download': 'Télécharger',
    'action.new': 'Nouveau',
    'action.close': 'Fermer',
    'action.sync': 'Synchroniser',
    'action.export': 'Exporter',
    'action.import': 'Importer',
    'status.draft': 'Brouillon',
    'status.completed': 'Terminé',
    'status.active': 'Actif',
    'status.archived': 'Archivé',
    'status.signed': 'Signé',
    'status.invoiced': 'Facturé',
    'status.inactive': 'Inactif',
    'tab.info': 'Info',
    'tab.time': 'Temps',
    'tab.material': 'Matériaux',
    'tab.machine': 'Machines',
    'tab.subcontractor': 'Sous-trait.',
    'tab.photos': 'Photos',
    'tab.signature': 'Signature',
    'tab.positions': 'Positions',
    'tab.summary': 'Clôture',
    'tab.timesheet': 'Feuille horaire',
    'tab.company': 'Entreprise',
    'tab.employees': 'Employés',
    'tab.machines': 'Machines',
    'tab.materials': 'Matériaux',
    'tab.sync': 'Sync',
    'page.projects': 'Projets',
    'page.daily_reports': 'Rapports journaliers',
    'page.regi_reports': 'Rapports en régie',
    'page.time_tracking': 'Saisie du temps',
    'page.master_data': 'Données de base',
    'page.archive': 'Archives',
    'section.language': 'Sprache / Langue / Lingua',
    'language.select': "Langue de l'application",
  },
  it: {
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Progetti',
    'nav.time': 'Tempi',
    'nav.archive': 'Archivio',
    'nav.masterdata': 'Dati base',
    'action.save': 'Salvare',
    'action.cancel': 'Annullare',
    'action.add': 'Aggiungere',
    'action.delete': 'Eliminare',
    'action.edit': 'Modificare',
    'action.download': 'Scaricare',
    'action.new': 'Nuovo',
    'action.close': 'Chiudere',
    'action.sync': 'Sincronizzare',
    'action.export': 'Esportare',
    'action.import': 'Importare',
    'status.draft': 'Bozza',
    'status.completed': 'Completato',
    'status.active': 'Attivo',
    'status.archived': 'Archiviato',
    'status.signed': 'Firmato',
    'status.invoiced': 'Fatturato',
    'status.inactive': 'Inattivo',
    'tab.info': 'Info',
    'tab.time': 'Tempi',
    'tab.material': 'Materiali',
    'tab.machine': 'Macchine',
    'tab.subcontractor': 'Sub.',
    'tab.photos': 'Foto',
    'tab.signature': 'Firma',
    'tab.positions': 'Posizioni',
    'tab.summary': 'Chiusura',
    'tab.timesheet': 'Foglio ore',
    'tab.company': 'Azienda',
    'tab.employees': 'Dipendenti',
    'tab.machines': 'Macchine',
    'tab.materials': 'Materiali',
    'tab.sync': 'Sync',
    'page.projects': 'Progetti',
    'page.daily_reports': 'Rapporti giornalieri',
    'page.regi_reports': 'Rapporti in regia',
    'page.time_tracking': 'Rilevazione tempi',
    'page.master_data': 'Dati base',
    'page.archive': 'Archivio',
    'section.language': 'Sprache / Langue / Lingua',
    'language.select': 'Lingua applicazione',
  },
};

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, fallback?: string) => string;
}

const LangContext = createContext<LangContextType>({
  lang: 'de',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem(LANG_KEY) as Lang) || 'de';
  });

  const setLang = (newLang: Lang) => {
    localStorage.setItem(LANG_KEY, newLang);
    setLangState(newLang);
  };

  const t = (key: string, fallback?: string): string => {
    return translations[lang]?.[key] ?? translations.de?.[key] ?? fallback ?? key;
  };

  return React.createElement(LangContext.Provider, { value: { lang, setLang, t } }, children);
}

export function useLanguage() {
  return useContext(LangContext);
}
