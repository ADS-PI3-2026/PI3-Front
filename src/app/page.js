"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAuthRequest } from "./auth-api";
import { getAuthSession, saveAuthSession } from "./auth-session";
import ActionButton from "./components/action-button";
import FormField from "./components/form-field";
import VerificationCodeFields from "./components/verification-code-fields";
import {
  CODE_RESEND_WAIT_SECONDS,
  VERIFICATION_CODE_LENGTH,
  createEmptyCode,
  formatCnpj,
  formatCpf,
  getAccountNameValidationError,
  getDocumentValidationError,
  getPasswordValidationError,
  getPersonNameValidationError,
  isValidEmail,
  onlyDigits,
} from "./lib/form-validation";
import styles from "./page.module.css";

const legalContent = {
  terms: {
    eyebrow: "Documento legal",
    title: "Termos de Uso",
    intro: "Estes termos apresentam as condições gerais para utilizar o Legado Car.",
  },
  privacy: {
    eyebrow: "Seus dados",
    title: "Política de Privacidade",
    intro: "Esta política explica como o Legado Car tratará os dados fornecidos por você.",
  },
};

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: <path d="m15 18-6-6 6-6M9 12h12" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    envelope: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.7 2.9 8.1 7 10 4.1-1.9 7-5.3 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
        {paths[name]}
      </g>
    </svg>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}>
      <Image
        alt="Símbolo do Legado Car"
        className={styles.brandMark}
        height={compact ? 48 : 66}
        preload
        src="/legado-car-mark.svg"
        unoptimized
        width={compact ? 48 : 66}
      />
      <div>
        <p className={styles.brandName}>Legado Car</p>
        {!compact && <p className={styles.brandTagline}>Seu carro. Sua história.</p>}
      </div>
    </div>
  );
}

function Dialog({ children, label, onClose, wide = false }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      aria-label={label}
      aria-modal="true"
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <section className={`${styles.dialog} ${wide ? styles.dialogWide : ""}`}>
        <button aria-label="Fechar" className={styles.closeButton} onClick={onClose} type="button">
          <Icon name="close" />
        </button>
        {children}
      </section>
    </div>
  );
}

function LegalDialog({ type, onClose }) {
  const content = legalContent[type];

  return (
    <Dialog label={content.title} onClose={onClose} wide>
      <div className={styles.dialogHeader}>
        <span className={styles.dialogIcon}><Icon name="shield" size={24} /></span>
        <div>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h2>{content.title}</h2>
        </div>
      </div>
      <div className={styles.legalCopy}>
        <p>{content.intro}</p>
        <h3>1. Informações gerais</h3>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris consequat,
          mauris at tincidunt commodo, justo purus tristique lectus, vitae luctus
          magna urna a lectus. Integer vitae pretium risus.
        </p>
        <h3>2. Uso da plataforma</h3>
        <p>
          Sed posuere, neque at tincidunt commodo, nunc enim commodo tortor, nec
          ullamcorper sapien turpis vel ligula. Praesent vitae sem a sapien posuere
          elementum. Donec accumsan mi vel sem feugiat, id posuere massa suscipit.
        </p>
        <h3>3. Responsabilidades</h3>
        <p>
          Pellentesque habitant morbi tristique senectus et netus et malesuada fames
          ac turpis egestas. Duis id justo ut lorem tincidunt bibendum. Nulla facilisi.
        </p>
        <p className={styles.legalUpdated}>Última atualização: agosto de 2026.</p>
      </div>
      <ActionButton onClick={onClose} type="button">Entendi</ActionButton>
    </Dialog>
  );
}

function RecoveryDialog({ onClose }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(createEmptyCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(CODE_RESEND_WAIT_SECONDS);

  useEffect(() => {
    if (step !== "code" || timeLeft <= 0) return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, timeLeft]);

  const seconds = String(timeLeft % 60).padStart(2, "0");
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");

  const submitEmail = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrors({ email: "Informe o e-mail da sua conta." });
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setErrors({ email: "Digite um endereço de e-mail válido." });
      return;
    }

    setErrors({});
    setMessage("");
    setPending(true);
    try {
      await submitAuthRequest("requestPasswordReset", {
        email: normalizedEmail,
      });
      setEmail(normalizedEmail);
      setStep("code");
      setTimeLeft(CODE_RESEND_WAIT_SECONDS);
    } catch {
      setMessage("Não foi possível solicitar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const submitCode = async (event) => {
    event.preventDefault();
    if (code.join("").length !== VERIFICATION_CODE_LENGTH) {
      setMessage("Digite os seis números enviados para o seu e-mail.");
      return;
    }
    setPending(true);
    try {
      await submitAuthRequest("verifyPasswordCode", {
        email,
        code: code.join(""),
      });
      setMessage("");
      setStep("password");
    } catch {
      setMessage("O código não pôde ser validado. Confira e tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const passwordError = getPasswordValidationError(password);
    if (passwordError) nextErrors.password = passwordError;
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Repita a nova senha.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "As senhas não coincidem.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setMessage("");
    setPending(true);
    try {
      await submitAuthRequest("resetPassword", {
        email,
        code: code.join(""),
        password,
        passwordConfirmation: confirmPassword,
      });
      setMessage("");
      setStep("success");
    } catch {
      setMessage("Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const resendCode = async () => {
    setMessage("");
    setPending(true);
    try {
      await submitAuthRequest("requestPasswordReset", { email });
      setCode(createEmptyCode());
      setTimeLeft(CODE_RESEND_WAIT_SECONDS);
    } catch {
      setMessage("Não foi possível reenviar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const stepIndex = { email: 1, code: 2, password: 3, success: 3 }[step];

  return (
    <Dialog label="Recuperação de senha" onClose={onClose}>
      {step !== "success" && (
        <div className={styles.progress} aria-label={`Etapa ${stepIndex} de 3`}>
          {[1, 2, 3].map((item) => (
            <span className={item <= stepIndex ? styles.progressActive : ""} key={item} />
          ))}
        </div>
      )}

      {step === "email" && (
        <form className={styles.dialogForm} noValidate onSubmit={submitEmail}>
          <div className={styles.dialogIntro}>
            <span className={styles.dialogIcon}><Icon name="envelope" size={24} /></span>
            <p className={styles.eyebrow}>Recuperação de acesso</p>
            <h2>Esqueceu sua senha?</h2>
            <p>Informe o e-mail da sua conta. Enviaremos um código para confirmar sua identidade.</p>
          </div>
          <FormField
            autoComplete="email"
            icon="envelope"
            label="E-mail"
            error={errors.email}
            maxLength={254}
            name="recovery-email"
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors({});
            }}
            placeholder="seu@email.com"
            type="email"
            value={email}
          />
          {message && <p className={styles.formMessageError}>{message}</p>}
          <ActionButton disabled={pending} type="submit">
            {pending ? "Enviando..." : "Enviar código"}
          </ActionButton>
          <ActionButton onClick={onClose} type="button" variant="secondary">Voltar para o login</ActionButton>
        </form>
      )}

      {step === "code" && (
        <form className={styles.dialogForm} noValidate onSubmit={submitCode}>
          <div className={styles.dialogIntro}>
            <span className={styles.dialogIcon}><Icon name="lock" size={24} /></span>
            <p className={styles.eyebrow}>Verifique seu e-mail</p>
            <h2>Digite o código</h2>
            <p>Enviamos um código de 6 dígitos para <strong>{email}</strong>.</p>
          </div>
          <VerificationCodeFields
            code={code}
            error={message}
            onChange={(nextCode) => {
              setCode(nextCode);
              setMessage("");
            }}
          />
          {message && <p className={styles.formMessageError}>{message}</p>}
          <div className={styles.resendRow}>
            <span>Seu e-mail não chegou?</span>
            {timeLeft > 0 ? (
              <span>Reenvie em {minutes}:{seconds}</span>
            ) : (
              <button
                disabled={pending}
                onClick={resendCode}
                type="button"
              >
                Reenviar código
              </button>
            )}
          </div>
          <ActionButton disabled={pending} type="submit">
            {pending ? "Validando..." : "Validar código"}
          </ActionButton>
          <ActionButton onClick={() => setStep("email")} type="button" variant="secondary">Alterar e-mail</ActionButton>
        </form>
      )}

      {step === "password" && (
        <form className={styles.dialogForm} noValidate onSubmit={submitPassword}>
          <div className={styles.dialogIntro}>
            <span className={styles.dialogIcon}><Icon name="shield" size={24} /></span>
            <p className={styles.eyebrow}>Última etapa</p>
            <h2>Crie uma nova senha</h2>
            <p>Use pelo menos 8 caracteres, incluindo um número e um caractere especial.</p>
            {/* TODO: Junto com o backend, conferir se a senha inserida não é idêntica à antiga. */}
          </div>
          <FormField
            autoComplete="new-password"
            icon="lock"
            label="Nova senha"
            error={errors.password}
            maxLength={72}
            minLength={8}
            name="new-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: "" }));
            }}
            onToggle={() => setShowPassword((current) => !current)}
            placeholder="8+ caracteres, número e símbolo"
            toggleLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <FormField
            autoComplete="new-password"
            icon="lock"
            label="Confirmar nova senha"
            error={errors.confirmPassword}
            maxLength={72}
            minLength={8}
            name="confirm-new-password"
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setErrors((current) => ({ ...current, confirmPassword: "" }));
            }}
            placeholder="Digite a senha novamente"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
          />
          {message && <p className={styles.formMessageError}>{message}</p>}
          <ActionButton disabled={pending} type="submit">
            {pending ? "Salvando..." : "Redefinir senha"}
          </ActionButton>
        </form>
      )}

      {step === "success" && (
        <div className={styles.successState}>
          <span className={styles.successIcon}><Icon name="check" size={34} /></span>
          <p className={styles.eyebrow}>Tudo certo</p>
          <h2>Senha redefinida!</h2>
          <p>Sua nova senha foi salva. Você já pode acessar o Legado Car.</p>
          <ActionButton className={styles.successAction} onClick={onClose} type="button">Voltar para o login</ActionButton>
        </div>
      )}
    </Dialog>
  );
}

function EmailConfirmationDialog({ email, onClose, onConfirmed }) {
  const [step, setStep] = useState("code");
  const [code, setCode] = useState(createEmptyCode);
  const [verificationResult, setVerificationResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [pending, setPending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(CODE_RESEND_WAIT_SECONDS);

  useEffect(() => {
    if (step !== "code" || timeLeft <= 0) return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, timeLeft]);

  const seconds = String(timeLeft % 60).padStart(2, "0");
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");

  const submitCode = async (event) => {
    event.preventDefault();
    const verificationCode = code.join("");

    if (verificationCode.length !== VERIFICATION_CODE_LENGTH) {
      setFeedback({ type: "error", text: "Digite os seis números enviados para o seu e-mail." });
      return;
    }

    setFeedback(null);
    setPending(true);
    try {
      const result = await submitAuthRequest("verifyEmail", {
        email,
        code: verificationCode,
      });
      setVerificationResult(result);
      setStep("success");
    } catch {
      setFeedback({ type: "error", text: "O código não pôde ser validado. Confira e tente novamente." });
    } finally {
      setPending(false);
    }
  };

  const resendCode = async () => {
    if (timeLeft > 0) return;

    setFeedback(null);
    setPending(true);
    try {
      await submitAuthRequest("requestEmailVerification", { email });
      setCode(createEmptyCode());
      setTimeLeft(CODE_RESEND_WAIT_SECONDS);
      setFeedback({ type: "success", text: "Um novo código foi enviado para o seu e-mail." });
    } catch {
      setFeedback({ type: "error", text: "Não foi possível reenviar o código. Tente novamente." });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog label="Confirmação de e-mail" onClose={onClose}>
      {step === "code" && (
        <form className={styles.dialogForm} noValidate onSubmit={submitCode}>
          <div className={styles.dialogIntro}>
            <span className={styles.dialogIcon}><Icon name="envelope" size={24} /></span>
            <p className={styles.eyebrow}>Confirme seu cadastro</p>
            <h2>Verifique seu e-mail</h2>
            <p>Enviamos um código de 6 dígitos para <strong>{email}</strong>.</p>
          </div>
          <VerificationCodeFields
            code={code}
            error={feedback?.type === "error"}
            onChange={(nextCode) => {
              setCode(nextCode);
              setFeedback(null);
            }}
          />
          {feedback && (
            <p
              aria-live="polite"
              className={feedback.type === "success" ? styles.formMessageSuccess : styles.formMessageError}
            >
              {feedback.text}
            </p>
          )}
          <div className={styles.resendRow}>
            <span>Seu código não chegou?</span>
            {timeLeft > 0 ? (
              <span>Reenvie em {minutes}:{seconds}</span>
            ) : (
              <button disabled={pending} onClick={resendCode} type="button">
                {pending ? "Reenviando..." : "Reenviar código"}
              </button>
            )}
          </div>
          <ActionButton disabled={pending} type="submit">
            {pending ? "Validando..." : "Confirmar e-mail"}
          </ActionButton>
          <ActionButton onClick={onClose} type="button" variant="secondary">Voltar ao cadastro</ActionButton>
        </form>
      )}

      {step === "success" && (
        <div className={styles.successState}>
          <span className={styles.successIcon}><Icon name="check" size={34} /></span>
          <p className={styles.eyebrow}>Identidade confirmada</p>
          <h2>E-mail confirmado!</h2>
          <p>Agora você pode completar os dados necessários para criar sua conta.</p>
          <ActionButton className={styles.successAction} onClick={() => onConfirmed(verificationResult)} type="button">Continuar cadastro</ActionButton>
        </div>
      )}
    </Dialog>
  );
}

function LoginScreen({ onRegister, onRecovery }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors = {};

    if (!normalizedEmail) {
      nextErrors.email = "Informe seu e-mail.";
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = "Digite um endereço de e-mail válido.";
    }
    if (!password) {
      nextErrors.password = "Informe sua senha.";
    } else if (password.length < 8) {
      nextErrors.password = "A senha precisa ter pelo menos 8 caracteres.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setMessage("");
    setPending(true);
    try {
      const authResult = await submitAuthRequest("login", {
        email: normalizedEmail,
        password,
      });
      saveAuthSession({ authResult, email: normalizedEmail });
      setEmail(normalizedEmail);
      router.push("/garagem");
    } catch {
      setMessage("Não foi possível entrar. Confira os dados e tente novamente.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={styles.authScreen}>
      <div className={styles.loginContent}>
        <Brand />
        <section className={styles.authCard}>
          <div className={styles.cardHeading}>
            <p className={styles.eyebrow}>Bem-vindo de volta</p>
            <h1>Acesse sua conta</h1>
            <p>Entre para cuidar dos registros e histórias dos seus veículos.</p>
          </div>
          <form
            className={styles.authForm}
            noValidate
            onSubmit={submit}
          >
            <FormField
              autoComplete="email"
              error={errors.email}
              icon="envelope"
              label="E-mail"
              maxLength={254}
              name="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: "" }));
              }}
              placeholder="seu@email.com"
              type="email"
              value={email}
            />
            <FormField
              autoComplete="current-password"
              error={errors.password}
              icon="lock"
              label="Senha"
              maxLength={72}
              minLength={8}
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: "" }));
              }}
              onToggle={() => setShowPassword((current) => !current)}
              placeholder="Digite sua senha"
              toggleLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button className={styles.forgotButton} onClick={onRecovery} type="button">Esqueci minha senha</button>
            {message && <p className={styles.formMessageError}>{message}</p>}
            <ActionButton disabled={pending} type="submit">
              {pending ? "Entrando..." : "Entrar"}
            </ActionButton>
          </form>
        </section>
        <p className={styles.authSwitch}>Não tem uma conta? <button onClick={onRegister} type="button">Cadastre-se</button></p>
      </div>
      <p className={styles.copyright}>© 2026 Legado Car</p>
    </main>
  );
}

function RegisterScreen({ onLogin, onLegal }) {
  const router = useRouter();
  const [step, setStep] = useState("identity");
  const [accountType, setAccountType] = useState("person");
  const [form, setForm] = useState({ name: "", document: "", email: "", password: "", confirm: "" });
  const [emailVerificationToken, setEmailVerificationToken] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const changeAccountType = (nextAccountType) => {
    if (nextAccountType === accountType) return;
    setAccountType(nextAccountType);
    setForm((current) => ({ ...current, document: "" }));
    setErrors((current) => ({ ...current, document: "" }));
    setMessage("");
  };

  const updateDocument = (event) => {
    const formattedDocument = accountType === "business"
      ? formatCnpj(event.target.value)
      : formatCpf(event.target.value);
    setForm((current) => ({ ...current, document: formattedDocument }));
    setErrors((current) => ({ ...current, document: "" }));
  };

  const submitIdentity = async (event) => {
    event.preventDefault();
    const normalizedName = form.name.trim().replace(/\s+/g, " ");
    const normalizedEmail = form.email.trim().toLowerCase();
    const nextErrors = {};

    const nameError = getAccountNameValidationError(normalizedName);
    if (nameError) nextErrors.name = nameError;
    if (!normalizedEmail) {
      nextErrors.email = "Informe seu e-mail.";
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = "Digite um endereço de e-mail válido.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage("");
      return;
    }

    setErrors({});
    setMessage("");

    if (normalizedEmail === verifiedEmail) {
      setForm((current) => ({ ...current, name: normalizedName, email: normalizedEmail }));
      setStep("details");
      return;
    }

    setPending(true);
    try {
      await submitAuthRequest("requestEmailVerification", { email: normalizedEmail });
      setForm((current) => ({ ...current, name: normalizedName, email: normalizedEmail }));
      setConfirmationEmail(normalizedEmail);
    } catch {
      setMessage("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const submitRegistration = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const nameError = accountType === "person"
      ? getPersonNameValidationError(form.name)
      : getAccountNameValidationError(form.name);

    if (nameError) {
      setErrors({ name: nameError });
      setMessage("");
      setStep("identity");
      return;
    }

    const documentError = getDocumentValidationError(form.document, accountType);
    if (documentError) nextErrors.document = documentError;
    const passwordError = getPasswordValidationError(form.password);
    if (passwordError) nextErrors.password = passwordError;
    if (!form.confirm) {
      nextErrors.confirm = "Repita sua senha.";
    } else if (form.password !== form.confirm) {
      nextErrors.confirm = "As senhas não coincidem.";
    }
    if (!accepted) {
      nextErrors.terms = "Leia e aceite os Termos de Uso e a Política de Privacidade.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage("");
      return;
    }

    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      password_confirmation: form.confirm,
      document_type: accountType === "business" ? "CNPJ" : "CPF",
      document: onlyDigits(form.document),
      terms_accepted: true,
      ...(emailVerificationToken ? { email_verification_token: emailVerificationToken } : {}),
    };

    setErrors({});
    setMessage("");
    setPending(true);
    try {
      const authResult = await submitAuthRequest("register", payload);
      saveAuthSession({ authResult, email: form.email });
      router.replace("/garagem");
    } catch {
      setMessage("Não foi possível criar a conta. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={`${styles.authScreen} ${styles.registerScreen}`}>
      <header className={styles.mobileHeader}>
        <button aria-label="Voltar para o login" onClick={onLogin} type="button"><Icon name="arrow" size={24} /></button>
        <Brand compact />
        <span aria-hidden="true" />
      </header>
      <div className={styles.registerContent}>
        <div className={styles.cardHeading}>
          <p className={styles.eyebrow}>Etapa {step === "identity" ? "1" : "2"} de 2</p>
          <h1>{step === "identity" ? "Comece seu cadastro" : "Complete seu cadastro"}</h1>
          <p>{step === "identity"
            ? "Primeiro, informe seu nome e confirme o endereço de e-mail."
            : "Escolha o tipo de conta e informe os dados restantes."}</p>
        </div>
        {step === "identity" ? (
          <form className={styles.authForm} noValidate onSubmit={submitIdentity}>
            <FormField
              autoComplete="name"
              error={errors.name}
              icon="user"
              label="Nome"
              maxLength={100}
              name="name"
              onChange={update("name")}
              placeholder="Seu nome ou nome fantasia"
              value={form.name}
            />
            <FormField
              autoComplete="email"
              error={errors.email}
              icon="envelope"
              label="E-mail"
              maxLength={254}
              name="register-email"
              onChange={update("email")}
              placeholder="seu@email.com"
              type="email"
              value={form.email}
            />
            {message && <p className={styles.formMessageError}>{message}</p>}
            <ActionButton disabled={pending} type="submit">
              {pending
                ? "Enviando código..."
                : form.email.trim().toLowerCase() === verifiedEmail
                  ? "Salvar e continuar"
                  : "Confirmar e avançar"}
            </ActionButton>
          </form>
        ) : (
          <form className={styles.authForm} noValidate onSubmit={submitRegistration}>
            <div className={styles.verifiedIdentity}>
              <div>
                <span>E-mail confirmado</span>
                <strong>{form.name}</strong>
                <small>{form.email}</small>
              </div>
              <button onClick={() => setStep("identity")} type="button">Alterar</button>
            </div>
            <div className={styles.accountTypeField}>
              <span className={styles.fieldLabel}>Tipo de cadastro</span>
              <div aria-label="Tipo de cadastro" className={styles.accountTypeToggle} role="group">
                <button
                  aria-pressed={accountType === "person"}
                  className={accountType === "person" ? styles.accountTypeActive : ""}
                  onClick={() => changeAccountType("person")}
                  type="button"
                >
                  Pessoa física
                </button>
                <button
                  aria-pressed={accountType === "business"}
                  className={accountType === "business" ? styles.accountTypeActive : ""}
                  onClick={() => changeAccountType("business")}
                  type="button"
                >
                  Pessoa jurídica
                </button>
              </div>
            </div>
            <FormField
              autoComplete="off"
              error={errors.document}
              icon="idCard"
              inputMode="numeric"
              label={accountType === "business" ? "CNPJ" : "CPF"}
              maxLength={accountType === "business" ? 18 : 14}
              name={accountType === "business" ? "cnpj" : "cpf"}
              onChange={updateDocument}
              placeholder={accountType === "business" ? "00.000.000/0000-00" : "000.000.000-00"}
              value={form.document}
            />
            <FormField
              autoComplete="new-password"
              error={errors.password}
              icon="lock"
              label="Senha"
              maxLength={72}
              minLength={8}
              name="register-password"
              onChange={update("password")}
              onToggle={() => setShowPassword((current) => !current)}
              placeholder="8+ caracteres, número e símbolo"
              toggleLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
              type={showPassword ? "text" : "password"}
              value={form.password}
            />
            <FormField
              autoComplete="new-password"
              error={errors.confirm}
              icon="lock"
              label="Confirmar senha"
              maxLength={72}
              minLength={8}
              name="register-confirm"
              onChange={update("confirm")}
              placeholder="Repita sua senha"
              type={showPassword ? "text" : "password"}
              value={form.confirm}
            />
            <label className={styles.consentBox}>
              <input
                aria-required="true"
                checked={accepted}
                onChange={(event) => {
                  setAccepted(event.target.checked);
                  if (event.target.checked) {
                    setErrors((current) => ({ ...current, terms: "" }));
                  }
                }}
                required
                type="checkbox"
              />
              <span className={styles.customCheckbox}><Icon name="check" size={16} /></span>
              <span>
                Li e concordo com os{" "}
                <button onClick={(event) => { event.preventDefault(); onLegal("terms"); }} type="button">Termos de Uso</button>
                {" "}e a{" "}
                <button onClick={(event) => { event.preventDefault(); onLegal("privacy"); }} type="button">Política de Privacidade</button>
                <span aria-hidden="true" className={styles.requiredMark}> *</span>
                <span className={styles.srOnly}> Campo obrigatório.</span>
              </span>
            </label>
            {errors.terms && <p className={styles.formMessageError}>{errors.terms}</p>}
            {message && <p className={styles.formMessageError}>{message}</p>}
            <ActionButton disabled={pending} type="submit">
              {pending ? "Criando conta..." : "Criar conta e entrar"}
            </ActionButton>
          </form>
        )}
        <p className={styles.authSwitch}>Já tem uma conta? <button onClick={onLogin} type="button">Fazer login</button></p>
      </div>

      {confirmationEmail && (
        <EmailConfirmationDialog
          email={confirmationEmail}
          onClose={() => setConfirmationEmail("")}
          onConfirmed={(verificationResult) => {
            setVerifiedEmail(confirmationEmail);
            setConfirmationEmail("");
            setEmailVerificationToken(
              verificationResult?.data?.verification_token
              ?? verificationResult?.data?.token
              ?? "",
            );
            setStep("details");
          }}
        />
      )}
    </main>
  );
}

function AuthHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [screen, setScreen] = useState("login");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null);
  const requestedLegalType = searchParams.get("legal");
  const legalReturnPath = searchParams.get("returnTo") === "/perfil" ? "/perfil" : "/";
  const legalType = legalOpen
    ?? (["terms", "privacy"].includes(requestedLegalType) ? requestedLegalType : null);

  useEffect(() => {
    if (!requestedLegalType && getAuthSession()) {
      router.replace("/garagem");
    }
  }, [requestedLegalType, router]);

  return (
    <div className={styles.page}>
      {screen === "login" ? (
        <LoginScreen onRecovery={() => setRecoveryOpen(true)} onRegister={() => setScreen("register")} />
      ) : (
        <RegisterScreen onLegal={setLegalOpen} onLogin={() => setScreen("login")} />
      )}
      {recoveryOpen && <RecoveryDialog onClose={() => setRecoveryOpen(false)} />}
      {legalType && (
        <LegalDialog
          onClose={() => {
            setLegalOpen(null);
            if (requestedLegalType) router.replace(legalReturnPath);
          }}
          type={legalType}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <AuthHome />
    </Suspense>
  );
}
