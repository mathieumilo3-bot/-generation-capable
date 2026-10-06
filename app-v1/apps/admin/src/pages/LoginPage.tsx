import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../state/auth";
import { Button, Notice } from "../components/ui";
import { TextField } from "../components/Fields";
import { isUnknownUserOtpError, otpErrorMessage } from "../lib/errors";
import { isEmail, isValidOtp, normalizeOtp } from "../lib/validation";

const RESEND_SECONDS = 30;

export function LoginPage({ denied }: { denied: boolean }) {
  const { sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const send = async () => {
    if (lock.current) return;
    if (!isEmail(email)) {
      setError("Saisissez une adresse e-mail valide.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      // Adresse inconnue : on ne le révèle pas (même écran, aucun code ne sera reçu).
      if (isUnknownUserOtpError(e)) {
        setStep("code");
        setCooldown(RESEND_SECONDS);
      } else {
        setError(otpErrorMessage(e));
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const verify = async () => {
    if (lock.current) return;
    if (!isValidOtp(code)) {
      setError("Le code comporte exactement 6 chiffres.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, code);
    } catch (e) {
      setError(otpErrorMessage(e));
      setCode("");
      codeRef.current?.focus();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "email") void send();
    else void verify();
  };

  return (
    <div className="login">
      <main className="login__card" aria-labelledby="login-title">
        <div className="login__brand"><span className="sidebar__logo" aria-hidden="true" /> Back-office</div>
        <h1 id="login-title" className="login__title">Connexion</h1>
        <p className="login__sub">Espace réservé à l'équipe. Aucun mot de passe : un code à 6 chiffres vous est envoyé par e-mail.</p>

        {denied ? (
          <Notice tone="error" title="Accès réservé">
            Ce compte n'a pas de rôle autorisé sur le back-office. Vous avez été déconnecté.
          </Notice>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          {step === "email" ? (
            <>
              <TextField
                label="Adresse e-mail professionnelle"
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              {error ? <Notice tone="error">{error}</Notice> : null}
              <Button type="submit" variant="primary" busy={busy} className="btn--block">Recevoir un code</Button>
            </>
          ) : (
            <>
              <Notice tone="info">
                Si l'adresse <strong>{email}</strong> est autorisée, un code à 6 chiffres vient d'être envoyé. Il expire rapidement.
              </Notice>
              <div className="field">
                <label htmlFor="otp" className="field__label">Code à 6 chiffres</label>
                <input
                  id="otp"
                  ref={codeRef}
                  name="one-time-code"
                  className="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(e) => setCode(normalizeOtp(e.target.value))}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "otp-err" : undefined}
                />
              </div>
              {error ? <div id="otp-err"><Notice tone="error">{error}</Notice></div> : null}
              <Button type="submit" variant="primary" busy={busy} className="btn--block">Se connecter</Button>
              <div className="login__links">
                <Button variant="ghost" small disabled={busy || cooldown > 0} onClick={() => void send()}>
                  {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : "Renvoyer le code"}
                </Button>
                <Button variant="ghost" small disabled={busy} onClick={() => { setStep("email"); setCode(""); setError(null); }}>
                  Changer d'adresse
                </Button>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
