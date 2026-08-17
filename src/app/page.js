"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { submitAuthRequest } from "./auth-api";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value) {
  return EMAIL_PATTERN.test(value.trim());
}

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
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.1 2.8M6.7 6.7C3.6 8.5 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 3.9-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" />
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
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
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

function Field({
  autoComplete,
  error,
  icon,
  label,
  maxLength,
  minLength,
  name,
  onChange,
  placeholder,
  required = true,
  toggleLabel,
  type = "text",
  value,
  onToggle,
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={`${styles.inputShell} ${error ? styles.inputError : ""}`}>
        <span className={styles.inputIcon}><Icon name={icon} /></span>
        <input
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          name={name}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          type={type}
          value={value}
        />
        {onToggle && (
          <button
            aria-label={toggleLabel}
            className={styles.visibilityButton}
            onClick={onToggle}
            type="button"
          >
            <Icon name={type === "password" ? "eye" : "eyeOff"} />
          </button>
        )}
      </span>
      {error && <span className={styles.fieldError}>{error}</span>}
    </label>
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
      <button className={styles.primaryButton} onClick={onClose} type="button">Entendi</button>
    </Dialog>
  );
}

function RecoveryDialog({ onClose }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const codeRefs = useRef([]);

  useEffect(() => {
    if (step !== "code" || timeLeft <= 0) return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, timeLeft]);

  const seconds = String(timeLeft % 60).padStart(2, "0");
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");

  const updateCode = (index, rawValue) => {
    const digits = rawValue.replace(/\D/g, "");
    setMessage("");
    if (!digits) {
      setCode((current) => current.map((digit, position) => position === index ? "" : digit));
      return;
    }

    const next = [...code];
    digits.slice(0, 6 - index).split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setCode(next);
    const focusIndex = Math.min(index + digits.length, 5);
    codeRefs.current[focusIndex]?.focus();
  };

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
      setTimeLeft(120);
    } catch {
      setMessage("Não foi possível solicitar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const submitCode = async (event) => {
    event.preventDefault();
    if (code.join("").length !== 6) {
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
    if (password.length < 8) {
      nextErrors.password = "A senha precisa ter pelo menos 8 caracteres.";
    }
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
      setCode(["", "", "", "", "", ""]);
      setTimeLeft(120);
      codeRefs.current[0]?.focus();
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
          <Field
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
          <button className={styles.primaryButton} disabled={pending} type="submit">
            {pending ? "Enviando..." : "Enviar código"}
          </button>
          <button className={styles.secondaryButton} onClick={onClose} type="button">Voltar para o login</button>
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
          <fieldset className={styles.codeFieldset}>
            <legend>Código de verificação</legend>
            <div className={styles.codeInputs}>
              {code.map((digit, index) => (
                <input
                  aria-invalid={Boolean(message)}
                  aria-label={`Dígito ${index + 1}`}
                  autoFocus={index === 0}
                  inputMode="numeric"
                  key={index}
                  maxLength={6}
                  onChange={(event) => updateCode(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !digit && index > 0) {
                      codeRefs.current[index - 1]?.focus();
                    }
                  }}
                  ref={(element) => { codeRefs.current[index] = element; }}
                  value={digit}
                />
              ))}
            </div>
          </fieldset>
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
          <button className={styles.primaryButton} disabled={pending} type="submit">
            {pending ? "Validando..." : "Validar código"}
          </button>
          <button className={styles.secondaryButton} onClick={() => setStep("email")} type="button">Alterar e-mail</button>
        </form>
      )}

      {step === "password" && (
        <form className={styles.dialogForm} noValidate onSubmit={submitPassword}>
          <div className={styles.dialogIntro}>
            <span className={styles.dialogIcon}><Icon name="shield" size={24} /></span>
            <p className={styles.eyebrow}>Última etapa</p>
            <h2>Crie uma nova senha</h2>
            <p>Use pelo menos 8 caracteres e não repita uma senha antiga.</p>
            {/* TODO: Junto com o backend, conferir se a senha inserida não é idêntica à antiga. */}
          </div>
          <Field
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
            placeholder="Mínimo de 8 caracteres"
            toggleLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <Field
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
          <button className={styles.primaryButton} disabled={pending} type="submit">
            {pending ? "Salvando..." : "Redefinir senha"}
          </button>
        </form>
      )}

      {step === "success" && (
        <div className={styles.successState}>
          <span className={styles.successIcon}><Icon name="check" size={34} /></span>
          <p className={styles.eyebrow}>Tudo certo</p>
          <h2>Senha redefinida!</h2>
          <p>Sua nova senha foi salva. Você já pode acessar o Legado Car.</p>
          <button className={styles.primaryButton} onClick={onClose} type="button">Voltar para o login</button>
        </div>
      )}
    </Dialog>
  );
}

function LoginScreen({ onRegister, onRecovery }) {
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
      await submitAuthRequest("login", {
        email: normalizedEmail,
        password,
      });
      setEmail(normalizedEmail);
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
            <Field
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
            <Field
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
            <button className={styles.primaryButton} disabled={pending} type="submit">
              {pending ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
        <p className={styles.authSwitch}>Não tem uma conta? <button onClick={onRegister} type="button">Cadastre-se</button></p>
      </div>
      <p className={styles.copyright}>© 2026 Legado Car</p>
    </main>
  );
}

function RegisterScreen({ onLogin, onLegal }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const normalizedName = form.name.trim().replace(/\s+/g, " ");
    const normalizedEmail = form.email.trim().toLowerCase();
    const nextErrors = {};

    if (!normalizedName) {
      nextErrors.name = "Informe seu nome completo.";
    } else if (normalizedName.length < 3) {
      nextErrors.name = "O nome precisa ter pelo menos 3 caracteres.";
    }
    if (!normalizedEmail) {
      nextErrors.email = "Informe seu e-mail.";
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = "Digite um endereço de e-mail válido.";
    }
    if (!form.password) {
      nextErrors.password = "Crie uma senha.";
    } else if (form.password.length < 8) {
      nextErrors.password = "A senha precisa ter pelo menos 8 caracteres.";
    }
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

    setErrors({});
    setMessage("");
    setPending(true);
    try {
      await submitAuthRequest("register", {
        fullName: normalizedName,
        email: normalizedEmail,
        password: form.password,
        passwordConfirmation: form.confirm,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      });
      setMessage("");
      setSuccess(true);
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
          <p className={styles.eyebrow}>Comece sua jornada</p>
          <h1>Criar conta</h1>
          <p>Preencha seus dados para começar a preservar a história dos seus veículos.</p>
        </div>
        <form className={styles.authForm} noValidate onSubmit={submit}>
          <Field
            autoComplete="name"
            error={errors.name}
            icon="user"
            label="Nome completo"
            maxLength={100}
            name="name"
            onChange={update("name")}
            placeholder="Seu nome completo"
            value={form.name}
          />
          <Field
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
          <Field
            autoComplete="new-password"
            error={errors.password}
            icon="lock"
            label="Senha"
            maxLength={72}
            minLength={8}
            name="register-password"
            onChange={update("password")}
            onToggle={() => setShowPassword((current) => !current)}
            placeholder="Mínimo de 8 caracteres"
            toggleLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
            type={showPassword ? "text" : "password"}
            value={form.password}
          />
          <Field
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
          <button className={styles.primaryButton} disabled={pending} type="submit">
            {pending ? "Criando conta..." : "Criar minha conta"}
          </button>
        </form>
        <p className={styles.authSwitch}>Já tem uma conta? <button onClick={onLogin} type="button">Fazer login</button></p>
      </div>

      {success && (
        <Dialog label="Conta criada" onClose={() => setSuccess(false)}>
          <div className={styles.successState}>
            <span className={styles.successIcon}><Icon name="check" size={34} /></span>
            <p className={styles.eyebrow}>Cadastro concluído</p>
            <h2>Conta criada!</h2>
            <button className={styles.primaryButton} onClick={onLogin} type="button">Ir para o login</button>
          </div>
        </Dialog>
      )}
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState("login");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null);

  return (
    <div className={styles.page}>
      {screen === "login" ? (
        <LoginScreen onRecovery={() => setRecoveryOpen(true)} onRegister={() => setScreen("register")} />
      ) : (
        <RegisterScreen onLegal={setLegalOpen} onLogin={() => setScreen("login")} />
      )}
      {recoveryOpen && <RecoveryDialog onClose={() => setRecoveryOpen(false)} />}
      {legalOpen && <LegalDialog onClose={() => setLegalOpen(null)} type={legalOpen} />}
    </div>
  );
}
