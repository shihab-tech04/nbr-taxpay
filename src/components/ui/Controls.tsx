import React from 'react';

/** Shared TaxPay controls. Mobile-first, accessible, semantic palette; no hardcoded CSS colors. */
const controlClass =
  'min-h-11 w-full rounded-lg border border-taxpay-border bg-taxpay-surface px-3 py-2.5 text-base text-taxpay-text ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

type ButtonVariant = 'primary' | 'outline' | 'quiet';
type UiButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-taxpay-primary text-white hover:bg-taxpay-dark',
  outline: 'border border-taxpay-border bg-taxpay-surface text-taxpay-primary hover:bg-taxpay-light',
  quiet: 'bg-transparent text-taxpay-primary hover:bg-taxpay-light'
};
export const UiButton = React.forwardRef<HTMLButtonElement, UiButtonProps>(
  ({ variant = 'primary', type = 'button', className = '', ...props }, ref) =>
    <button ref={ref} type={type}
      className={'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-base font-semibold ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary ' +
        'disabled:cursor-not-allowed disabled:opacity-50 ' + buttonVariants[variant] + ' ' + className}
      {...props} />
);
UiButton.displayName = 'UiButton';

export const UiInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) =>
    <input ref={ref} className={controlClass + ' ' + className} {...props} />
);
UiInput.displayName = 'UiInput';

export const UiSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...props }, ref) =>
    <select ref={ref} className={controlClass + ' ' + className} {...props} />
);
UiSelect.displayName = 'UiSelect';

export const UiTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) =>
    <textarea ref={ref} className={controlClass + ' resize-y ' + className} {...props} />
);
UiTextarea.displayName = 'UiTextarea';
