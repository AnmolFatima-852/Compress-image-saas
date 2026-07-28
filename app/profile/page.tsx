import { AuthGuard } from '@/components/auth-guard';
import { ProfileForm } from '@/components/profile-form';
import { textEyebrow, textHeading } from '@/lib/ui-text';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div>
          <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Profile</p>
          <h1 className={`text-3xl font-semibold ${textHeading}`}>Manage your account</h1>
        </div>        <ProfileForm />
      </div>
    </AuthGuard>
  );
}
