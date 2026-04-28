export const translations = {
  en: {
    dashboard: "Dashboard",
    projectMenu: "Project",
    projects: "Projects",
    reports: "Reports",
    adsIntelligence: "Ads Intelligence",
    alerts: "Alerts",
    adminUsers: "Users",
    adminIntegrations: "Integrations",
    adminAlerts: "Notifications",
    adminSettings: "Settings",
    adminLogs: "Logs",
    merchant: "Merchant",
    changePassword: "Change password",
    signOut: "Sign out",
    language: "Language",
    english: "English",
    german: "German",
    themeLight: "Light",
    themeDark: "Dark",
    workspace: "Workspace von List&Sell India",
    appTitle: "Marketing Data Hub"
  },
  de: {
    projectMenu: "Projekt",
    dashboard: "Übersicht",
    projects: "Projekte",
    reports: "Berichte",
    adsIntelligence: "Ads Intelligence",
    alerts: "Alarme",
    adminUsers: "Benutzer",
    adminIntegrations: "Integrationen",
    adminAlerts: "Benachrichtigungen",
    adminSettings: "Einstellungen",
    adminLogs: "Protokolle",
    merchant: "Merchant",
    changePassword: "Passwort ändern",
    signOut: "Abmelden",
    language: "Sprache",
    english: "Englisch",
    german: "Deutsch",
    themeLight: "Hell",
    themeDark: "Dunkel",
    workspace: "Workspace von List&Sell India",
    appTitle: "Marketing Data Hub"
  }
} as const;

export type LocaleKey = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export function t(locale: string | undefined, key: TranslationKey) {
  const lang = (locale ?? "en") as LocaleKey;
  const table = translations[lang] ?? translations.en;
  return table[key] ?? translations.en[key];
}
