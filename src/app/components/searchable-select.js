"use client";

import { useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import styles from "./searchable-select.module.css";

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function OptionImage({ src }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return null;
  }

  return (
    <Image
      alt=""
      aria-hidden
      className={styles.optionImage}
      height={28}
      onError={() => setHasError(true)}
      src={src}
      width={28}
    />
  );
}

export default function SearchableSelect({
  disabled = false,
  emptyMessage = "Nenhuma opção encontrada.",
  error,
  getOptionImage,
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

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      normalizeText(option.name).includes(normalizedQuery),
    );
  }, [options, query]);

  const buttonText = selectedOption?.name ?? placeholder;
  const isDisabled = disabled || loading;

  const selectedImage =
    selectedOption && getOptionImage
      ? getOptionImage(selectedOption)
      : null;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const revealOnMobile = (behavior = "smooth") => {
    const isMobile = window.matchMedia(
      "(max-width: 759px), (pointer: coarse)",
    ).matches;

    if (!isMobile) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    containerRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : behavior,
      block: "start",
      inline: "nearest",
    });
  };

  const openList = () => {
    if (isDisabled) {
      return;
    }

    setOpen(true);

    window.requestAnimationFrame(() => {
      revealOnMobile();
      searchInputRef.current?.focus({ preventScroll: true });

      window.setTimeout(() => {
        revealOnMobile("auto");
      }, 350);
    });
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
    <div
      className={`app-field app-field--uppercase ${styles.field}`}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={containerRef}
    >
      <span>{label}</span>

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
        <span className={styles.triggerContent}>
          {selectedImage && (
            <OptionImage src={selectedImage} />
          )}

          <span
            className={
              selectedOption
                ? styles.triggerValue
                : styles.placeholder
            }
          >
            {buttonText}
          </span>
        </span>

        <CaretDown aria-hidden size={18} weight="bold" />
      </button>

      {error && (
        <small className="app-error-text" id={errorId}>
          {error}
        </small>
      )}

      {open && (
        <div className={styles.dropdown}>
          <label className={styles.searchShell}>
            <MagnifyingGlass
              aria-hidden
              size={18}
              weight="bold"
            />

            <input
              autoComplete="off"
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder={searchPlaceholder}
              ref={searchInputRef}
              value={query}
            />
          </label>

          <div
            className={styles.options}
            role="listbox"
          >
            {filteredOptions.map((option) => {
              const imageSrc = getOptionImage
                ? getOptionImage(option)
                : null;

              return (
                <button
                  aria-selected={option.code === value}
                  className={
                    option.code === value
                      ? styles.optionSelected
                      : styles.option
                  }
                  key={option.code}
                  onClick={() => selectOption(option)}
                  role="option"
                  type="button"
                >
                  <span className={styles.optionContent}>
                    {imageSrc && (
                      <OptionImage src={imageSrc} />
                    )}

                    <span>{option.name}</span>
                  </span>
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <p className={styles.emptyMessage}>
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
