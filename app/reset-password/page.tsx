import { AuthForm } from '@/components/auth-form';
import { textBody, textEyebrow, textHeading } from '@/lib/ui-text';

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_80px_-20px_rgba(15,23,42,0.25)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Authentication</p>
        <h1 className={`mt-2 text-3xl font-semibold ${textHeading}`}>Reset your password</h1>
        <p className={`mt-2 text-sm ${textBody}`}>Enter your email and we will send reset instructions.</p>
        <AuthForm mode="reset" />
      </div>
    </main>
  );
}
