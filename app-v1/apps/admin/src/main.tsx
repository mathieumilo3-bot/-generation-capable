import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { cssVariables } from "@app/ui/src/tokens";
import { App } from "./App";
import { loadEnv } from "./env";
import { createBackend } from "./data/client";
import { BackendProvider } from "./state/backend";
import { AuthProvider } from "./state/auth";
import "./styles.css";

// Même palette que l'app client : les jetons de packages/ui deviennent des variables CSS.
const tokens = document.createElement("style");
tokens.textContent = `:root{${cssVariables()}}`;
document.head.prepend(tokens);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Élément #root introuvable");
const root = createRoot(rootEl);

const loaded = loadEnv(import.meta.env);
if (!loaded.ok) {
  root.render(
    <StrictMode>
      <div className="fullscreen">
        <main className="login__card" role="alert">
          <h1 className="login__title">Configuration manquante</h1>
          <p className="login__sub">
            Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (voir apps/admin/.env.example), puis relancez l'application.
          </p>
          <p className="muted small">{loaded.error}</p>
        </main>
      </div>
    </StrictMode>,
  );
} else {
  const backend = createBackend(loaded.env);
  root.render(
    <StrictMode>
      <BackendProvider value={{ ...backend, env: loaded.env }}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </BackendProvider>
    </StrictMode>,
  );
}
