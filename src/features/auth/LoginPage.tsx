import { useEffect, useState, type FormEvent } from 'react';
import { useData } from '../../store/DataContext';
import { Button, Input, applyTheme } from '../../ui';

const NAME_KEY = 'pv-last-name';

function readName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

export function LoginPage() {
  const { login } = useData();
  const [name, setName] = useState(readName);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { applyTheme(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!pin) { setError('Enter your PIN'); return; }
    setError('');
    setLoading(true);
    try {
      await login(name.trim(), pin);
      try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not sign in. Check your name and PIN.');
      setPin('');
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-brand">
          <div className="logo">R</div>
          <div><div className="bn">Radhe General</div><div className="bs">Pricelist Vault</div></div>
        </div>
        <h1>Sign in</h1>
        <p className="lead">Use the name and PIN the owner gave you.</p>
        <Input
          label="Name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          autoComplete="username"
          autoCapitalize="words"
          autoCorrect="off"
          autoFocus={!name}
          placeholder="Your name"
        />
        <Input
          label="PIN"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          autoFocus={!!name}
          placeholder="PIN"
          error={error}
        />
        <Button type="submit" variant="primary" block loading={loading}>Sign in</Button>
        <p className="help foot">Works offline after first sign in</p>
      </form>
    </main>
  );
}
