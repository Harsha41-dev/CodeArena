import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button } from "../components/Button";
import { authApi } from "../services/api";
import { useAuthStore } from "../stores/authStore";

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    // quick client-side check — server still validates properly
    if (!email || !username || !displayName || !password) {
      setError("Please fill all fields.");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.register({
        email,
        username,
        displayName,
        password
      });
      setAuth(result);
      navigate("/problems");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not register this account.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-md ca-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Register</h1>
        <p className="mt-2 text-sm text-slate-500">Make an account to save submissions and stats</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Email</span>
          <input className="ca-input" type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Username</span>
          <input className="ca-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Display name</span>
          <input
            className="ca-input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Password</span>
          <input className="ca-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error ? <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

        <Button className="w-full mt-2" type="submit" disabled={loading}>
          <UserPlus className="h-4 w-4" /> {loading ? "Creating..." : "Register"}
        </Button>
      </form>
    </div>
  );
}
