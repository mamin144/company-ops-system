import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password, rememberMe);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    }
    setBusy(false);
  };

  return (
    <div className="loginPage">
      <form className="loginCard" onSubmit={submit}>
        <div className="brand__logo loginLogo">CO</div>
        <h1>نظام إدارة الشركة</h1>
        <p className="muted">سجل الدخول للمتابعة</p>
        {error ? <div className="loginError">{error}</div> : null}
        <label className="field">
          <span className="field__label">اسم المستخدم</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label className="field">
          <span className="field__label">كلمة المرور</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="rememberRow">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          <span>تذكرني</span>
        </label>
        <button className="btn btn--primary" disabled={busy || !username || !password}>
          {busy ? 'جاري الدخول…' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  );
};
