'use client';

import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getProfileData, updateProfileAvatar, updateProfileFullName, type ProfileData } from '@/services/profile-service';
import { alertError, alertSuccess, textBody, textLabel } from '@/lib/ui-text';

export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getProfileData()
      .then((data) => {
        if (!active || !data) return;
        setProfile(data);
        setFullName(data.fullName);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleFullNameChange = (value: string) => {
    setFullName(value);
    if (saved) {
      setSaved(false);
    }
  };

  const handleSaveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaved(false);
    setSaving(true);

    const result = await updateProfileFullName(fullName);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage('Profile updated successfully.');
    setProfile((current) => (current ? { ...current, fullName: fullName.trim() } : current));
    setSaved(true);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);
    setUploading(true);

    const formData = new FormData();
    formData.set('avatar', file);

    const result = await updateProfileAvatar(formData);
    setUploading(false);
    event.target.value = '';

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage('Avatar updated successfully.');
    setProfile((current) => (current ? { ...current, avatarUrl: result.avatarUrl } : current));
  };

  if (loading) {
    return (
      <div className={`mt-8 flex items-center gap-2 text-sm ${textBody}`}>
        <Loader2 size={18} className="animate-spin" />
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`mt-8 ${alertError}`}>
        Unable to load your profile. Try signing in again.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {error ? <div className={alertError}>{error}</div> : null}
      {message ? <div className={alertSuccess}>{message}</div> : null}

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
          {profile.avatarUrl ? (
            <Image src={profile.avatarUrl} alt="" fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-violet-600 dark:text-violet-400">
              {(profile.fullName || profile.email).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <label className={`text-sm font-medium ${textLabel}`}>
          Change avatar
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={handleAvatarChange}
            className={`mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white ${textBody}`}
          />
        </label>
      </div>

      <form onSubmit={handleSaveName} className="grid gap-4 md:grid-cols-2">
        <label className={`text-sm font-medium ${textLabel}`}>
          Full name
          <input
            type="text"
            value={fullName}
            onChange={(event) => handleFullNameChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
          />
        </label>
        <label className={`text-sm font-medium ${textLabel}`}>
          Email
          <input
            type="email"
            value={profile.email}
            readOnly
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 outline-none dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving || saved}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {saved ? '✔ Saved' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
