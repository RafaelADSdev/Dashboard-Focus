import { Eye, EyeOff, Mail } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import focusLogo from "@/assets/focus-branca.png";
import hubOnLogo from "@/assets/hub-on-branco.png";

type LoginScreenProps = {
  configured: boolean;
  onSignIn: (email: string, password: string) => Promise<{ error?: string }>;
};

type LoginErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export function LoginScreen({ configured, onSignIn }: LoginScreenProps) {
  const emailId = useId();
  const passwordId = useId();
  const formErrorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0 && !isSubmitting,
    [email, password, isSubmitting],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const nextErrors: LoginErrors = {};
    if (!email.trim()) nextErrors.email = "Informe seu e-mail.";
    if (!password) nextErrors.password = "Informe sua senha.";
    if (!configured) {
      nextErrors.form =
        "Autenticação não configurada. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.";
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    setErrors({});

    const result = await onSignIn(email.trim(), password);
    if (result.error) {
      setErrors({ form: result.error });
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="login-brand-lockup" aria-label="Focus e HubON">
            <img
              className="login-focus-logo"
              src={focusLogo}
              alt="Focus"
              width={108}
              height={25}
              decoding="async"
            />
            <span className="login-brand-divider" aria-hidden="true" />
            <img
              className="login-hubon-logo"
              src={hubOnLogo}
              alt="HubON"
              width={72}
              height={27}
              decoding="async"
            />
          </div>

          <div className="login-copy">
            <p className="login-eyebrow">Dashboard Comercial</p>
            <h1 id="login-title">Bem-vindo de volta</h1>
            <p>Acesse com suas credenciais para continuar.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {errors.form ? (
              <p className="login-field-error login-form-error" id={formErrorId} role="alert">
                {errors.form}
              </p>
            ) : null}

            <div className="login-field-group">
              <label htmlFor={emailId}>E-mail</label>
              <div className={errors.email ? "login-input-wrap is-invalid" : "login-input-wrap"}>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email || errors.form) {
                      setErrors((current) => ({
                        ...current,
                        email: undefined,
                        form: undefined,
                      }));
                    }
                  }}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email
                      ? `${emailId}-error`
                      : errors.form
                        ? formErrorId
                        : undefined
                  }
                />
                <Mail aria-hidden="true" />
              </div>
              {errors.email ? (
                <p className="login-field-error" id={`${emailId}-error`} role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="login-field-group">
              <label htmlFor={passwordId}>Senha</label>
              <div className={errors.password ? "login-input-wrap is-invalid" : "login-input-wrap"}>
                <input
                  id={passwordId}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errors.password || errors.form) {
                      setErrors((current) => ({
                        ...current,
                        password: undefined,
                        form: undefined,
                      }));
                    }
                  }}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? `${passwordId}-error` : undefined}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {errors.password ? (
                <p className="login-field-error" id={`${passwordId}-error`} role="alert">
                  {errors.password}
                </p>
              ) : null}
            </div>

            <button className="login-submit" type="submit" disabled={!canSubmit} aria-busy={isSubmitting}>
              <span>{isSubmitting ? "Entrando…" : "Entrar"}</span>
            </button>
          </form>

          <p className="login-footer">© 2026 HubON — Focus</p>
        </div>
      </section>

      <aside className="login-hero" aria-label="Dashboard Comercial Focus">
        <div className="login-hero-content">
          <p className="login-hero-kicker">Superintendência Focus</p>
          <h2>
            Dashboard
            <br />
            Comercial
          </h2>
        </div>
      </aside>
    </main>
  );
}
