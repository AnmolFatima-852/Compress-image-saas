import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_80px_-20px_rgba(15,23,42,0.25)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Authentication</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-100">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Sign in to continue managing your compressions.</p>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
