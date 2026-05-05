import { FormEvent, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isInitializing } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname || "/";
  }, [location.state]);

  if (!isInitializing && isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Informe e-mail e senha.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectPath, { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Falha no login.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background p-6">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/4dimageback1.png')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/94 via-blue-50/88 to-orange-50/82" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(37,99,235,0.18),transparent_40%),radial-gradient(circle_at_100%_0%,rgba(249,115,22,0.14),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.10),transparent_45%)]" />

      <div className="relative z-10 flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-blue-200/70 bg-white/95 shadow-[0_20px_65px_-22px_rgba(37,99,235,0.38)] backdrop-blur-sm">
          <div className="relative h-40 overflow-hidden border-b border-blue-100">
            <img
              src="/4d.jpg"
              alt="Tecnologia 4D"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/52 via-blue-700/34 to-orange-500/24" />
            <div className="absolute bottom-3 left-4 rounded-full border border-white/35 bg-white/18 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white backdrop-blur-sm">
              PAPEL-OFABRICA
            </div>
          </div>

          <div className="px-6 py-5 border-b border-blue-100/90 bg-gradient-to-r from-white to-blue-50/60">
            <h1 className="text-lg font-bold text-slate-900">Entrar no Sistema</h1>
            <p className="text-sm text-slate-600 mt-1">Use seu e-mail e senha para acessar.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-blue-700/85 font-semibold">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com"
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/55 focus:border-blue-400 transition-colors"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-blue-700/85 font-semibold">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/55 focus:border-blue-400 transition-colors"
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 text-sm rounded bg-gradient-to-r from-blue-600 to-orange-500 text-white font-semibold hover:brightness-105 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
