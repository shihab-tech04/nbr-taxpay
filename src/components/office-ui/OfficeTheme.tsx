import React, { createContext, useContext, useMemo, useState } from 'react';
import { THEMES, THEME_ORDER, type ThemeId } from './themes';

export type OfficeFont = 'inter' | 'poppins' | 'noto-sans' | 'google-sans';
export type OfficeFontSize = 'compact' | 'standard' | 'large';
const FONT_FAMILY: Record<OfficeFont, string> = {
  inter: "Inter, 'Noto Sans Bengali', 'Noto Sans', sans-serif",
  poppins: "Poppins, 'Noto Sans Bengali', 'Noto Sans', sans-serif",
  'noto-sans': "'Noto Sans', 'Noto Sans Bengali', sans-serif",
  'google-sans': "'DM Sans', 'Noto Sans Bengali', sans-serif"
};
const SIZE_FACTOR: Record<OfficeFontSize, number> = { compact: 0.9, standard: 1, large: 1.1 };
const LS_KEY = 'taxpay-office-appearance';

type Appearance = { theme: ThemeId; font: OfficeFont; size: OfficeFontSize };
const DEFAULT: Appearance = {theme: 'indigo-blue', font: 'inter', size: 'standard'};
const allowed = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  typeof value === 'string' && options.includes(value as T) ? value as T : fallback;

function readAppearance(): Appearance {
  try {
    const value = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return {
      theme: allowed(value.theme, THEME_ORDER, DEFAULT.theme),
      font: allowed(value.font, Object.keys(FONT_FAMILY) as OfficeFont[], DEFAULT.font),
      size: allowed(value.size, Object.keys(SIZE_FACTOR) as OfficeFontSize[], DEFAULT.size)
    };
  } catch { return DEFAULT; }
}

type ThemeContextValue = Appearance & {
  setTheme: (id: ThemeId) => void;
  setFont: (font: OfficeFont) => void;
  setSize: (size: OfficeFontSize) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function useOfficeTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('Office design components must be inside OfficeThemeProvider');
  return context;
}

export function OfficeThemeProvider({children}: {children: React.ReactNode}) {
  const [appearance, update] = useState<Appearance>(readAppearance);
  function set(next: Partial<Appearance>) {
    update(current => {
      const updated = {...current, ...next};
      try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch { /* optional appearance preference */ }
      return updated;
    });
  }
  const palette = THEMES[appearance.theme];
  const vars = useMemo(() => ({
    '--om-primary': palette.primary,
    '--om-primary-dark': palette.primaryDark,
    '--om-primary-light': palette.primaryLight,
    '--om-secondary': palette.secondary,
    '--om-accent': palette.accent,
    '--om-background': palette.background,
    '--om-surface': palette.surface,
    '--om-border': palette.border,
    '--om-text': palette.textPrimary,
    '--om-text-muted': palette.textSecondary,
    '--om-success': palette.success,
    '--om-warning': palette.warning,
    '--om-error': palette.error,
    '--om-on-primary': appearance.theme === 'dark-mode' ? '#202124' : '#FFFFFF',
    '--om-font': FONT_FAMILY[appearance.font],
    '--om-font-scale': String(SIZE_FACTOR[appearance.size])
  }) as React.CSSProperties, [palette, appearance.font, appearance.size, appearance.theme]);
  return <ThemeContext.Provider value={{...appearance,setTheme: theme=>set({theme}),setFont:font=>set({font}),setSize:size=>set({size})}}>
    <div className="om-root" data-office-theme={appearance.theme} style={vars}>{children}</div>
  </ThemeContext.Provider>;
}

export const officeThemeIds = THEME_ORDER;
export const officeFonts = Object.keys(FONT_FAMILY) as OfficeFont[];
