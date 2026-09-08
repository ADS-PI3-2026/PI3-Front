"use client";

import styles from "./action-button.module.css";

export default function ActionButton({
  children,
  className = "",
  variant = "primary",
  ...buttonProps
}) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className}`.trim()}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
