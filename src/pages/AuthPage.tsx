import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <main className="shell">
      <header><h1>Spec Writer</h1><p>Sign in to manage reusable clauses and structured documents.</p></header>
      <form
        className="panel auth-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!supabase) return;
          setLoading(true);
          setAuthError('');
          const form = new FormData(event.currentTarget);
          const email = String(form.get('email') || '');
          const password = String(form.get('password') || '');
          const result = authMode === 'signin'
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });
          if (result.error) setAuthError(result.error.message);
          setLoading(false);
        }}
      >
        <h2>{authMode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <label>Email</label><input name="email" type="email" required />
        <label>Password</label><input name="password" type="password" minLength={6} required />
        {authError && <p className="error">{authError}</p>}
        <div className="row">
          <button type="submit" disabled={loading}>{loading ? 'Working…' : authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="ghost" onClick={() => setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'))}>
            {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </form>
    </main>
  );
}
