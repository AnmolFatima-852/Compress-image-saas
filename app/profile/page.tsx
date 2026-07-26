import { AuthGuard } from '@/components/auth-guard';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Profile</p>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-100">Manage your account</h1>
      </div>
      <form className="mt-8 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Full name
          <input type="text" defaultValue="Guest" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
          <input type="email" defaultValue="guest@example.com" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 md:col-span-2">
          Bio
          <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" defaultValue="Using the compression workflow without authentication." />
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 font-semibold text-white">
            Save profile
          </button>
        </div>
      </form>
      </div>
    </AuthGuard>
  );
}
