import type { SxProps, Theme } from "@mui/material";

// ─────────────────────────────────────────────────────────────────────────────
// These sx objects handle ONLY colors, borders, and focus rings.
// Height and label positioning are owned entirely by MUI via size="small".
// Do NOT add height, padding, or transform overrides here — MUI handles those
// correctly for size="small" so the label floats in/out automatically.
// ─────────────────────────────────────────────────────────────────────────────

const sharedRoot: SxProps<Theme> = {
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
  transition: "box-shadow 150ms var(--ease-standard)",

  "& fieldset": {
    borderColor: "var(--color-border)",
    transition: "border-color 150ms var(--ease-standard), border-width 150ms var(--ease-standard)",
  },

  "&:hover:not(.Mui-focused):not(.Mui-disabled) fieldset": {
    borderColor: "var(--color-text-secondary)",
  },

  "&.Mui-focused fieldset": {
    borderColor: "var(--color-primary) !important",
    borderWidth: "2px !important",
  },

  "&.Mui-focused": {
    boxShadow: "0 0 0 3px var(--color-primary-alpha-10)",
  },

  "&.Mui-error fieldset": {
    borderColor: "var(--color-error) !important",
    borderWidth: "2px !important",
  },

  "&.Mui-error.Mui-focused": {
    boxShadow: "0 0 0 3px var(--color-error-alpha-10)",
  },

  "&.Mui-disabled": {
    backgroundColor: "var(--color-background-subtle)",
    "& fieldset": { borderColor: "var(--color-border) !important" },
  },

  "& .MuiInputBase-input": {
    color: "var(--color-text-primary)",
    backgroundColor: "transparent",
    "&::placeholder": { color: "var(--color-text-secondary)", opacity: 0.6 },
    "&[type='date']::-webkit-calendar-picker-indicator": {
      opacity: 0.7,
      cursor: "pointer",
      filter: "invert(40%) sepia(15%) saturate(300%) hue-rotate(130deg)",
    },
  },

  "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active, & textarea:-webkit-autofill, & textarea:-webkit-autofill:hover, & textarea:-webkit-autofill:focus, & textarea:-webkit-autofill:active": {
    WebkitBoxShadow: "0 0 0 1000px var(--color-surface) inset !important",
    WebkitTextFillColor: "var(--color-text-primary) !important",
    caretColor: "var(--color-text-primary)",
    transition: "background-color 5000s ease-in-out 0s",
  },

  "& .MuiInputAdornment-root": { color: "var(--color-text-secondary)" },
  "& .MuiSelect-icon": { color: "var(--color-text-secondary)" },
};

const sharedLabel: SxProps<Theme> = {
  color: "var(--color-text-secondary)",
  "&.Mui-focused": { color: "var(--color-primary)" },
  "&.Mui-error": { color: "var(--color-error)" },
  "&.Mui-disabled": { opacity: 0.5 },
};

const sharedHelper: SxProps<Theme> = {
  marginLeft: 0,
  marginTop: "4px",
  "&.Mui-error": { color: "var(--color-error)" },
};

// Standard form fields — use with size="small" on the TextField component
export const muiFieldSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": sharedRoot,
  "& .MuiInputLabel-root": sharedLabel,
  "& .MuiFormHelperText-root": sharedHelper,
};

// Compact filter/search fields — identical styling, slightly smaller font via size="small"
export const muiFilterSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": sharedRoot,
  "& .MuiInputLabel-root": { ...sharedLabel, fontSize: "13px" },
  "& .MuiFormHelperText-root": { ...sharedHelper, fontSize: "11px" },
};
