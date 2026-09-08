"use client";

import { useRef } from "react";
import { VERIFICATION_CODE_LENGTH } from "../lib/form-validation";
import styles from "./verification-code-fields.module.css";

export default function VerificationCodeFields({ code, error, onChange }) {
  const inputRefs = useRef([]);

  const updateCode = (index, rawValue) => {
    const digits = rawValue.replace(/\D/g, "");

    if (!digits) {
      onChange(code.map((digit, position) => position === index ? "" : digit));
      return;
    }

    const nextCode = [...code];
    digits.slice(0, VERIFICATION_CODE_LENGTH - index).split("").forEach((digit, offset) => {
      nextCode[index + offset] = digit;
    });
    onChange(nextCode);

    const focusIndex = Math.min(index + digits.length, VERIFICATION_CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend>Código de verificação</legend>
      <div className={styles.inputs}>
        {code.map((digit, index) => (
          <input
            aria-invalid={Boolean(error)}
            aria-label={`Dígito ${index + 1}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={index === 0}
            inputMode="numeric"
            key={index}
            maxLength={VERIFICATION_CODE_LENGTH}
            onChange={(event) => updateCode(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit && index > 0) {
                inputRefs.current[index - 1]?.focus();
              }
            }}
            ref={(element) => { inputRefs.current[index] = element; }}
            value={digit}
          />
        ))}
      </div>
    </fieldset>
  );
}
