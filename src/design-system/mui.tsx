import type { PropsWithChildren } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import MuiButton from '@mui/material/Button';
import MuiIconButton from '@mui/material/IconButton';
import MuiInputBase from '@mui/material/InputBase';
import MuiNativeSelect from '@mui/material/NativeSelect';

/** MUI v4 migration boundary: import only from explicitly eligible route modules.
 * No CssBaseline, GlobalStyles, root provider, or changes to native legacy controls.
 * Preserve the approved citizen palette, bilingual font stack and 4px spacing grid. */
export const citizenMuiTheme = createTheme({
  palette: {
    primary: { main: '#2C5EAD', dark: '#1E4484', light: '#EAF2FF', contrastText: '#FFFFFF' },
    background: { default: '#F0F2F5', paper: '#FFFFFF' },
    text: { primary: '#172033', secondary: '#5F6B7A' },
    divider: '#E1E6EE',
    success: { main: '#238636' }, warning: { main: '#D97706' }, error: { main: '#C62828' },
  },
  typography: {
    fontFamily: "var(--font-text, 'Poppins', 'Noto Sans Bengali', system-ui, sans-serif)",
    fontSize: 16,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  spacing: 4,
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true, disableRipple: true },
      styleOverrides: { root: { minHeight: 44, textTransform: 'none',
        '&.Mui-focusVisible': { outline: '2px solid #2C5EAD', outlineOffset: 2 } } } },
    MuiIconButton: { defaultProps: { disableRipple: true },
      styleOverrides: { root: { minHeight: 44, minWidth: 44,
        '&.Mui-focusVisible': { outline: '2px solid #2C5EAD', outlineOffset: 2 } } } },
    MuiInputBase: { defaultProps: { disableInjectingGlobalStyles: true } },
  },
});

export function CitizenMuiScope({children}:PropsWithChildren) {
  return <ThemeProvider theme={citizenMuiTheme}>{children}</ThemeProvider>;
}
export { MuiButton, MuiIconButton, MuiInputBase, MuiNativeSelect };
