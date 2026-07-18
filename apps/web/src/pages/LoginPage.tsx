import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { authApi } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/Button";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  // prefilled with a seed account so local demos are easier
  const [email, setEmail] = useState("demo@codearena.dev");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authApi.login(email, password);
      setAuth(result);
      navigate("/problems");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid credentials or API is unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-md ca-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Login</h1>
        <p className="mt-2 text-sm text-slate-500">Use a seeded demo account or your own register</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Email</span>
          <input className="ca-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Password</span>
          <input
            className="ca-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

        <Button className="w-full mt-2" type="submit" disabled={loading}>
          <LogIn className="h-4 w-4" /> {loading ? "Logging in..." : "Login"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        No account?{" "}
        <Link
          className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          to="/register"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
