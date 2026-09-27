"use client";

import styles from "./segmented-control.module.css";

export default function SegmentedControl({
  ariaLabel,
  disabled = false,
  onChange,
  options,
  value,
}) {
  return (
    <div aria-label={ariaLabel} className={styles.control} role="group">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            aria-pressed={isActive}
            className={isActive ? styles.active : styles.button}
            disabled={disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
