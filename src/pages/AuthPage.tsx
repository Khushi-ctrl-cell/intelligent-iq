import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage("Check your email for a confirmation link.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center border-b border-border pb-4">
          <h1 className="text-xl font-bold tracking-tighter text-foreground">
            AI_QUIZ_ENGINE<span className="text-primary">_V1.0</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isLogin ? "SIGN_IN" : "CREATE_ACCOUNT"}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="panel space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-secondary text-foreground text-sm px-3 py-2 border border-border
                focus:border-primary focus:outline-none"
              placeholder="student@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-secondary text-foreground text-sm px-3 py-2 border border-border
                focus:border-primary focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">ERROR: {error}</p>
          )}
          {message && (
            <p className="text-xs text-primary">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-xs font-semibold bg-foreground text-background
              hover:bg-primary disabled:opacity-50 transition-colors"
          >
            {loading ? "[PROCESSING...]" : isLogin ? "SIGN_IN()" : "CREATE_ACCOUNT()"}
          </button>

          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
            className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
