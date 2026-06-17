import React from 'react';

// Toggle switch แบบ reusable
const Toggle = ({ checked, onChange, disabled = false, activeColor = 'bg-amber-400', ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
    } ${checked ? activeColor : 'bg-line'}`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

export default Toggle;
