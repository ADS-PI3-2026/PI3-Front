"use client";

import { useState } from "react";
import ActionButton from "../../components/action-button";
import {
  formatCpf,
  getDocumentValidationError,
  getEmailValidationError,
  getPasswordValidationError,
  getRegistrationNameValidationError,
} from "../../lib/form-validation";
import {
  getAdminErrorMessage,
  getAdminFieldErrors,
  saveInternalUser,
} from "../admin-api";
import { Feedback, Field, Modal } from "./admin-ui";
import styles from "../admin.module.css";

export default function UserEditor({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    document: "",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = {
      name: getRegistrationNameValidationError(form.name),
      email: getEmailValidationError(form.email),
    };
    if (!user)
      nextErrors.document = getDocumentValidationError(form.document, "person");
    if (!user || form.password || form.password_confirmation) {
      nextErrors.password = getPasswordValidationError(form.password);
      if (form.password !== form.password_confirmation)
        nextErrors.password_confirmation = "As senhas precisam ser iguais.";
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true);
    setMessage("");
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
    };
    if (!user) payload.document = form.document.replace(/\D/g, "");
    if (!user || form.password) {
      payload.password = form.password;
      payload.password_confirmation = form.password_confirmation;
    }
    try {
      await saveInternalUser(user?.id, payload);
      onSaved(
        user ? "Usuário interno atualizado." : "Usuário interno cadastrado.",
      );
    } catch (error) {
      setErrors(getAdminFieldErrors(error));
      setMessage(getAdminErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      busy={busy}
      onClose={onClose}
      title={user ? "Editar usuário interno" : "Novo usuário interno"}
    >
      <form className={styles.form} noValidate onSubmit={submit}>
        <p className={styles.description}>
          Esta conta terá acesso ao painel administrativo.
        </p>
        <Field
          autoComplete="name"
          disabled={busy}
          error={errors.name}
          label="Nome completo"
          maxLength={255}
          name="name"
          onChange={change}
          required
          value={form.name}
        />
        <Field
          autoComplete="email"
          disabled={busy}
          error={errors.email}
          label="E-mail"
          maxLength={255}
          name="email"
          onChange={change}
          required
          type="email"
          value={form.email}
        />
        {!user && (
          <Field
            disabled={busy}
            error={errors.document}
            inputMode="numeric"
            label="CPF"
            maxLength={14}
            name="document"
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                document: formatCpf(event.target.value),
              }))
            }
            required
            value={form.document}
          />
        )}
        {user && (
          <p className={styles.hint}>
            CPF cadastrado · {formatCpf(user.document ?? "")}
          </p>
        )}
        <Field
          autoComplete="new-password"
          disabled={busy}
          error={errors.password}
          hint={
            user
              ? "Preencha para alterar a senha desta conta."
              : "Pelo menos 8 caracteres, com letra, número e símbolo."
          }
          label={user ? "Nova senha (opcional)" : "Senha"}
          name="password"
          onChange={change}
          required={!user}
          type="password"
          value={form.password}
        />
        <Field
          autoComplete="new-password"
          disabled={busy}
          error={errors.password_confirmation}
          label="Confirmar senha"
          name="password_confirmation"
          onChange={change}
          required={!user || Boolean(form.password)}
          type="password"
          value={form.password_confirmation}
        />
        <Feedback error message={message} />
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <ActionButton
            className={styles.compactButton}
            disabled={busy}
            type="submit"
          >
            {busy
              ? "Salvando…"
              : user
                ? "Salvar alterações"
                : "Cadastrar usuário"}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
