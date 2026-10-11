/* Adapted from Office Management verified source 8a9523277e99f01a8af31294119d8e337f2edf74 (src/app/data/themes.ts). */
export type ThemeId = "indigo-blue" | "gov-blue" | "slate-purple" | "plum-executive" | "fresh-teal" | "dark-mode";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "indigo-blue": {
    id: "indigo-blue",
    name: "Indigo Blue",
    primary: "#4B5694",
    primaryDark: "#343D73",
    primaryLight: "#EEF0FA",
    secondary: "#7C8BD6",
    accent: "#F2B880",
    background: "#F7F8FC",
    surface: "#FFFFFF",
    border: "#E2E5F0",
    textPrimary: "#202338",
    textSecondary: "#626981",
    success: "#2E7D32",
    warning: "#EF8F22",
    error: "#C62828",
  },
  "gov-blue": {
    id: "gov-blue",
    name: "Government Blue",
    primary: "#2C5EAD",
    primaryDark: "#1E4484",
    primaryLight: "#EAF2FF",
    secondary: "#5CA8D8",
    accent: "#F4C95D",
    background: "#F6F9FE",
    surface: "#FFFFFF",
    border: "#DDE7F5",
    textPrimary: "#172033",
    textSecondary: "#5F6B7A",
    success: "#238636",
    warning: "#D97706",
    error: "#C62828",
  },
  "slate-purple": {
    id: "slate-purple",
    name: "Slate Purple",
    primary: "#4A4466",
    primaryDark: "#332F4A",
    primaryLight: "#F0EEF7",
    secondary: "#7E78A6",
    accent: "#D9A76C",
    background: "#F8F7FB",
    surface: "#FFFFFF",
    border: "#E3E0EC",
    textPrimary: "#221F2F",
    textSecondary: "#686174",
    success: "#2F7D46",
    warning: "#C98122",
    error: "#B3261E",
  },
  "plum-executive": {
    id: "plum-executive",
    name: "Plum Executive",
    primary: "#744577",
    primaryDark: "#57305A",
    primaryLight: "#F5EAF6",
    secondary: "#B06AB3",
    accent: "#F2A65A",
    background: "#FBF7FC",
    surface: "#FFFFFF",
    border: "#EBDDEC",
    textPrimary: "#2F2133",
    textSecondary: "#725F76",
    success: "#2F7D46",
    warning: "#D97706",
    error: "#B3261E",
  },
  "fresh-teal": {
    id: "fresh-teal",
    name: "Fresh Teal",
    primary: "#3F7F85",
    primaryDark: "#2D666B",
    primaryLight: "#EFF6F7",
    secondary: "#7FAEB2",
    accent: "#A8D2D5",
    background: "#F8FAFB",
    surface: "#FFFFFF",
    border: "#DEE7E9",
    textPrimary: "#243438",
    textSecondary: "#68777B",
    success: "#2F7D46",
    warning: "#D97706",
    error: "#C62828",
  },
  "dark-mode": {
    id: "dark-mode",
    name: "Dark Mode",
    primary: "#8AB4F8",
    primaryDark: "#669DF6",
    primaryLight: "rgba(138,180,248,0.12)",
    secondary: "#AECBFA",
    accent: "#FDD663",
    background: "#202124",
    surface: "#2B2C2F",
    border: "#3C4043",
    textPrimary: "#E8EAED",
    textSecondary: "#BDC1C6",
    success: "#81C995",
    warning: "#FDD663",
    error: "#F28B82",
  },
};

export const THEME_ORDER: ThemeId[] = [
  "indigo-blue",
  "gov-blue",
  "slate-purple",
  "plum-executive",
  "fresh-teal",
  "dark-mode",
];
