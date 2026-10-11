import type { Ref } from "react";
import { TextField } from "@mui/material";
import { muiFieldSx, muiFilterSx } from "./muiFieldSx";

interface AppTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** compact=true → size="small" (filters, topbar). Default → MUI normal size (forms). */
  compact?: boolean;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

export function AppTextField({
  id, label, value, onChange, placeholder, helper, error,
  required, disabled, readOnly, autoComplete, inputRef, onKeyDown, compact,
  maxLength, inputMode,
}: AppTextFieldProps) {
  return (
    <TextField
      id={id}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      helperText={error || helper}
      error={!!error}
      required={required}
      disabled={disabled}
      inputRef={inputRef}
      autoComplete={autoComplete ?? "off"}
      variant="outlined"
      size={compact ? "small" : undefined}
      fullWidth
      inputProps={{
        readOnly,
        maxLength,
        inputMode,
        "aria-required": required ? "true" : undefined,
        "aria-describedby": (error || helper) ? `${id}-helper` : undefined,
        "aria-invalid": !!error || undefined,
      }}
      FormHelperTextProps={{ id: `${id}-helper` }}
      sx={compact ? muiFilterSx : muiFieldSx}
    />
  );
}
