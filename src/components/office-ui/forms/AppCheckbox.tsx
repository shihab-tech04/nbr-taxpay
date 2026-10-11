import { useEffect, useRef, type Ref, type RefObject, type MouseEvent } from "react";
import { Checkbox, FormControlLabel } from "@mui/material";

interface AppCheckboxProps {
  id?: string;
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
  size?: "small" | "medium";
  onClick?: (e: MouseEvent) => void;
}

const checkboxSx = {
  color: "var(--color-border)",
  padding: "4px",
  "& .MuiSvgIcon-root": { fontSize: 18 },
  "&.Mui-checked": { color: "var(--color-primary)" },
  "&.MuiCheckbox-indeterminate": { color: "var(--color-primary)" },
  "&:hover": { backgroundColor: "var(--color-primary-alpha-8)" },
  "&.Mui-disabled": { color: "var(--color-border)", opacity: 0.5 },
  "&.Mui-focusVisible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
    borderRadius: "4px",
  },
};

export function AppCheckbox({
  id,
  label,
  checked,
  onChange,
  indeterminate = false,
  disabled,
  ariaLabel,
  inputRef: externalRef,
  size = "small",
  onClick,
}: AppCheckboxProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = (externalRef ?? internalRef) as RefObject<HTMLInputElement>;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate, ref]);

  const checkbox = (
    <Checkbox
      id={id}
      checked={checked}
      indeterminate={indeterminate}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      size={size}
      inputRef={ref}
      inputProps={{ "aria-label": !label ? ariaLabel : undefined }}
      onClick={onClick}
      sx={checkboxSx}
    />
  );

  if (!label) return checkbox;

  return (
    <FormControlLabel
      control={checkbox}
      label={label}
      sx={{
        margin: 0,
        gap: "6px",
        "& .MuiFormControlLabel-label": {
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.4,
          userSelect: "none",
        },
        "&.Mui-disabled .MuiFormControlLabel-label": { opacity: 0.5 },
      }}
    />
  );
}
