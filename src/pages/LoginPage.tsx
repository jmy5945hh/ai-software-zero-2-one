import { useState, type FormEvent } from "react";
import { Sparkles, UserCircle, ArrowRight } from "lucide-react";
import { useUser } from "../contexts/UserContext";

export function LoginPage() {
  const { login } = useUser();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) {
      setError("请输入用户名");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            <Sparkles size={24} />
          </div>
          <strong>DevAgent Cloud</strong>
        </div>
        <h1 className="login-title">欢迎使用</h1>
        <p className="login-subtitle">请输入用户名开始使用</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-wrap">
            <UserCircle size={18} className="login-input-icon" />
            <input
              className="login-input"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>
          <p className="login-hint">行内用户ID，如 80xxxxxx</p>
          {error && <p className="login-error">{error}</p>}
          <button
            className="login-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? "登录中..." : "登 录"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </main>
  );
}
