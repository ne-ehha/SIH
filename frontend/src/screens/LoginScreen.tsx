import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticate } from '@/state/session';
import { OceanScopeLogo, OceanTideDots } from '@/components/common/OceanScopeBrand';

type ScreenPhase = 'form' | 'logging-in' | 'welcome';

export function LoginScreen() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<'invalid' | 'unavailable' | null>(null);
  const [phase, setPhase] = useState<ScreenPhase>('form');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const timerIds = useRef<number[]>([]);
  const isReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  useEffect(() => () => timerIds.current.forEach((timerId) => window.clearTimeout(timerId)), []);

  const wait = (duration: number) => new Promise<void>((resolve) => {
    const timerId = window.setTimeout(resolve, duration);
    timerIds.current.push(timerId);
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identifier.trim() || !password) return;
    setError(null);
    setIsAuthenticating(true);
    const result = await authenticate(identifier.trim(), password);
    if (result !== 'success') {
      setIsAuthenticating(false);
      setError(result);
      return;
    }

    setPhase('logging-in');
    await wait(isReducedMotion ? 0 : 2700);
    setPhase('welcome');
    await wait(isReducedMotion ? 0 : 1200);
    navigate('/', { replace: true });
  };

  if (phase !== 'form') {
    return <OceanTransition phase={phase} />;
  }

  return (
    <div className="login-page min-h-screen px-5 py-10 text-slate-100 sm:flex sm:items-center sm:justify-center">
      <div className="login-depth-flow" aria-hidden="true" />
      <div className="login-wave login-wave-one" />
      <div className="login-wave login-wave-two" />
      <div className="login-current login-current-one" aria-hidden="true" />
      <div className="login-current login-current-two" aria-hidden="true" />
      <div className="login-current login-current-three" aria-hidden="true" />
      <div className="login-light-rays" aria-hidden="true"><span /><span /><span /></div>
      <div className="login-composition relative z-10 mx-auto w-full max-w-md">
        <header className="login-brand">
          <OceanScopeLogo variant="login" className="h-auto w-[17.5rem] max-w-full" />
        </header>
        <main className="login-surface w-full rounded-2xl border px-6 py-8 sm:px-9 sm:py-10">
          <h1 className="mb-8 text-2xl font-semibold tracking-tight text-white">Sign in to your workspace</h1>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Username / Email</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
              className="login-input"
              placeholder="Enter your username or email"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="login-input"
            />
          </label>
          {error && (
            <p className="rounded-lg border border-rose-300/15 bg-rose-400/5 px-3 py-2 text-sm text-rose-200" role="alert">
              <span className="block font-medium">{error === 'invalid' ? 'Unable to sign in' : 'Unable to reach OceanScope'}</span>
              {error === 'invalid' ? 'Check your username and password and try again.' : 'Please try again in a moment.'}
            </p>
          )}
          <button type="submit" className="login-submit" disabled={isAuthenticating || !identifier.trim() || !password}>
            <span>{isAuthenticating ? 'Signing you in…' : 'Log in'}</span>
          </button>
          </form>
        </main>
      </div>
      <ProductFooter />
    </div>
  );
}

function OceanTransition({ phase }: { phase: Exclude<ScreenPhase, 'form'> }) {
  const welcome = phase === 'welcome';
  return (
    <main className="login-transition min-h-screen" aria-live="polite">
      <div className="login-transition-wave login-transition-wave-a" />
      <div className="login-transition-wave login-transition-wave-b" />
      <div className="login-transition-light" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 text-center">
        {welcome ? (
          <div className="login-welcome login-transition-content">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome to OceanScope</h1>
            <p className="mt-3 text-lg text-cyan-100">Chaos to Clarity</p>
            <p className="mt-5 text-sm text-slate-300">Your workspace is ready.</p>
          </div>
        ) : (
          <div className="login-transition-content">
            <OceanScopeLogo variant="full" className="mx-auto h-12 w-auto" />
            <p className="mt-4 text-base font-medium text-slate-100">Logging you in</p>
            <OceanTideDots label="Signing in" />
            <p className="mt-5 text-sm text-cyan-100">Chaos to Clarity</p>
          </div>
        )}
      </div>
      <ProductFooter />
    </main>
  );
}

function ProductFooter() {
  return <footer className="login-footer">© 2026 OceanScope · Ocean Model Validation</footer>;
}
