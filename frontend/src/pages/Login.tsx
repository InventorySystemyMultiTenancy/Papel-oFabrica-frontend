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
    <div className="relative min-h-screen overflow-hidden">
      {/* Imagem de fundo */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/loginimage.jpg')" }}
      />
      {/* Degradê por cima deixando opaca */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/80 via-blue-100/72 to-orange-50/70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(37,99,235,0.22),transparent_42%),radial-gradient(circle_at_100%_100%,rgba(249,115,22,0.18),transparent_40%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-blue-200/60 bg-white/90 shadow-[0_24px_70px_-18px_rgba(37,99,235,0.42)] backdrop-blur-md">

          {/* Logo redonda + título */}
          <div className="flex flex-col items-center px-6 pt-8 pb-5 border-b border-blue-100/80 bg-gradient-to-b from-blue-50/60 to-white/0">
            <div className="relative mb-4">
              <img
                src="/4d.jpg"
                alt="Logo 4D"
                className="h-20 w-20 rounded-full object-cover ring-4 ring-blue-500/30 ring-offset-2 ring-offset-white shadow-lg"
              />
              <div className="absolute inset-0 rounded-full ring-2 ring-orange-400/40" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Entrar no Sistema</h1>
            <p className="text-sm text-slate-500 mt-0.5">Use seu e-mail e senha para acessar.</p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-blue-700/85 font-semibold">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com"
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/55 focus:border-blue-400 transition-colors"
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
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/55 focus:border-blue-400 transition-colors"
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-orange-500 text-white font-semibold shadow hover:brightness-105 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
