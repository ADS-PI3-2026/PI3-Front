"use client";

import { useId, useMemo, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import styles from "./searchable-select.module.css";

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export default function SearchableSelect({
  disabled = false,
  emptyMessage = "Nenhuma opção encontrada.",
  error,
  label,
  loading = false,
  onChange,
  options = [],
  placeholder = "Selecione uma opção",
  searchPlaceholder = "Buscar...",
  value,
}) {
  const errorId = useId();
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.code === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return options;

    return options.filter((option) => normalizeText(option.name).includes(normalizedQuery));
  }, [options, query]);

  const buttonText = selectedOption?.name ?? placeholder;
  const isDisabled = disabled || loading;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const openList = () => {
    if (isDisabled) return;
    setOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const selectOption = (option) => {
    onChange(option.code);
    close();
  };

  const handleBlur = (event) => {
    if (!containerRef.current?.contains(event.relatedTarget)) {
      close();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className={styles.field} onBlur={handleBlur} onKeyDown={handleKeyDown} ref={containerRef}>
      <span className={styles.label}>{label}</span>
      <button
        aria-describedby={error ? errorId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={styles.trigger}
        data-disabled={isDisabled}
        data-error={Boolean(error)}
        disabled={isDisabled}
        onClick={() => (open ? close() : openList())}
        type="button"
      >
        <span className={selectedOption ? styles.triggerValue : styles.placeholder}>{buttonText}</span>
        <CaretDown aria-hidden size={18} weight="bold" />
      </button>

      {error && <small className={styles.errorText} id={errorId}>{error}</small>}

      {open && (
        <div className={styles.dropdown}>
          <label className={styles.searchShell}>
            <MagnifyingGlass aria-hidden size={18} weight="bold" />
            <input
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              ref={searchInputRef}
              value={query}
            />
          </label>

          <div className={styles.options} role="listbox">
            {filteredOptions.map((option) => (
              <button
                aria-selected={option.code === value}
                className={option.code === value ? styles.optionSelected : styles.option}
                key={option.code}
                onClick={() => selectOption(option)}
                role="option"
                type="button"
              >
                {option.name}
              </button>
            ))}

            {filteredOptions.length === 0 && <p className={styles.emptyMessage}>{emptyMessage}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
