import { useState } from "react";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import { Eye, EyeOff } from "lucide-react";
import { muiFieldSx } from "./muiFieldSx";

interface AppPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function AppPasswordField({
  id, label, value, onChange, placeholder, helper, error,
  required, disabled, autoComplete, onKeyDown,
}: AppPasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <TextField
      id={id}
      type={show ? "text" : "password"}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      helperText={error || helper}
      error={!!error}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete ?? "current-password"}
      variant="outlined"
      fullWidth
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              onClick={() => setShow(s => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              edge="end"
              size="small"
              tabIndex={-1}
              sx={{ color: "var(--color-text-secondary)" }}
            >
              {show ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      inputProps={{
        "aria-required": required ? "true" : undefined,
        "aria-describedby": (error || helper) ? `${id}-helper` : undefined,
        "aria-invalid": !!error || undefined,
      }}
      FormHelperTextProps={{ id: `${id}-helper` }}
      sx={muiFieldSx}
    />
  );
}
