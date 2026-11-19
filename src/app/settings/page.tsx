'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabaseClient';
import MarkdownRenderer from '@/components/renderer/MarkdownRenderer';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Eye,
  Lock,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  codeforces_handle: string;
  desc: string;
  avatar_url: string;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function UserSettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(true);

  // Profile form state
  const [cfHandle, setCfHandle] = useState('');
  const [desc, setDesc] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bioTab, setBioTab] = useState<'write' | 'preview'>('write');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const hasEmailIdentity = user.identities?.some((id) => id.provider === 'email') ?? true;
      setHasPassword(hasEmailIdentity);

      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, codeforces_handle, desc, avatar_url')
        .eq('id', user.id)
        .single();

      if (!active) return;

      if (error || !data) {
        setProfileMessage({ type: 'error', text: 'Failed to load account settings.' });
        setLoading(false);
        return;
      }

      const loaded: UserProfile = {
        id: data.id,
        email: data.email ?? user.email ?? '',
        username: data.username ?? '',
        codeforces_handle: data.codeforces_handle ?? '',
        desc: data.desc ?? '',
        avatar_url: data.avatar_url ?? '',
      };

      setProfile(loaded);
      setCfHandle(loaded.codeforces_handle);
      setDesc(loaded.desc);
      setAvatarUrl(loaded.avatar_url);
      setLoading(false);
    }

    loadUser();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setAvatarMessage(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarMessage({ type: 'error', text: 'Use a PNG, JPG, or WEBP image.' });
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarMessage({ type: 'error', text: 'Image must be 2 MB or smaller.' });
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const filePath = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const cacheBustedUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: cacheBustedUrl })
        .eq('id', profile.id);

      if (dbError) throw dbError;

      setAvatarUrl(cacheBustedUrl);
      window.dispatchEvent(new Event('bqt-profile-updated'));
      setAvatarMessage({ type: 'success', text: 'Avatar updated.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setAvatarMessage({ type: 'error', text: msg });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    if (!profile || !avatarUrl) return;
    setUploadingAvatar(true);
    setAvatarMessage(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: '' })
        .eq('id', profile.id);

      const { error: delerror } = await supabase.storage
        .from('avatars')
        .remove([`${profile.id}/avatar.png`, `${profile.id}/avatar.jpg`, `${profile.id}/avatar.webp`])

      if (error) throw error;
      if (delerror) throw delerror;

      setAvatarUrl('');
      window.dispatchEvent(new Event('bqt-profile-updated'));
      setAvatarMessage({ type: 'success', text: 'Avatar removed.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not remove avatar.';
      setAvatarMessage({ type: 'error', text: msg });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setProfileMessage(null);

    const trimmedCf = cfHandle.trim();
    if (trimmedCf && !/^[a-zA-Z0-9_.-]{3,24}$/.test(trimmedCf)) {
      setProfileMessage({
        type: 'error',
        text: 'Codeforces handle must be 3–24 characters (letters, numbers, _, ., -).',
      });
      return;
    }

    if (desc.length > 4000) {
      setProfileMessage({ type: 'error', text: 'Bio must be 4,000 characters or fewer.' });
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          codeforces_handle: trimmedCf,
          desc,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setCfHandle(trimmedCf);
      setProfileMessage({ type: 'success', text: 'Profile changes saved.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      setProfileMessage({ type: 'error', text: msg });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setPasswordMessage(null);

    if (hasPassword && !currentPassword) {
        setPasswordMessage({ type: 'error', text: 'Enter your current password.' });
        return;
    }

    if (newPassword.length < 8) {
        setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
        return;
    }

    if (newPassword !== confirmPassword) {
        setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
        return;
    }

    if (hasPassword && currentPassword === newPassword) {
        setPasswordMessage({ type: 'error', text: 'New password must be different from your current password.' });
        return;
    }

    setSavingPassword(true);
    try {
        // Step 1: Verify old password
        if (hasPassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password: currentPassword,
        });

        if (verifyError) {
            setPasswordMessage({ type: 'error', text: 'Current password is incorrect.' });
            return;
        }
        }

        // Step 2: Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        });
        if (updateError) throw updateError;

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setHasPassword(true);
        setPasswordMessage({ type: 'success', text: 'Password updated.' });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update password.';
        setPasswordMessage({ type: 'error', text: msg });
    } finally {
        setSavingPassword(false);
    }
    }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-10 text-zinc-300">
        <p className="text-sm">Loading settings...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-10 text-zinc-200">
        <p className="text-sm text-red-400">Unable to load account profile.</p>
      </main>
    );
  }

  const initials = (profile.username || profile.email).slice(0, 2).toUpperCase();

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 text-zinc-100">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            Account Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-300">
            Manage profile details for <span className="font-semibold text-zinc-100">{profile.username}</span> ({profile.email})
          </p>
        </div>

        {profile.username && (
          <Link
            href={`/user/${encodeURIComponent(profile.username)}`}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-300 hover:text-zinc-50 underline underline-offset-4 transition-colors duration-150 motion-reduce:transition-none"
          >
            View public profile
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </header>

      <div className="divide-y divide-zinc-800">
        {/* Section 1: Avatar */}
        <section className="py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Avatar</h2>
            <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
              Shown on your profile and submissions. PNG, JPG, or WEBP up to 2 MB.
            </p>
          </div>

          <div className="bg-[#111111] border border-zinc-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center gap-5">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${profile.username} avatar`}
                  className="w-20 h-20 rounded-full object-cover border border-zinc-700 bg-zinc-900 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center text-lg font-semibold text-zinc-200 shrink-0">
                  {initials}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload-input"
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingAvatar ? 'Uploading...' : 'Upload image'}
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-zinc-700 text-zinc-300 hover:text-red-400 hover:border-red-900 disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                )}
              </div>
            </div>

            {avatarMessage && (
              <div
                role="status"
                className={`mt-4 flex items-center gap-2 text-sm ${
                  avatarMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {avatarMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                <span>{avatarMessage.text}</span>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Public Profile */}
        <section className="py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Public Profile</h2>
            <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
              Link your Codeforces handle and write a bio using Markdown or LaTeX.
            </p>
          </div>

          <form
            onSubmit={handleSaveProfile}
            className="bg-[#111111] border border-zinc-800 rounded-lg p-5 space-y-5"
          >
            <div>
              <label
                htmlFor="cf-handle"
                className="block text-sm font-medium text-zinc-200 mb-1.5"
              >
                Codeforces Handle
              </label>
              <input
                id="cf-handle"
                type="text"
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                placeholder="e.g. tourist"
                autoComplete="off"
                className="w-full max-w-sm px-3 py-2 text-sm rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="bio-desc" className="block text-sm font-medium text-zinc-200">
                  Bio (Markdown &amp; KaTeX supported)
                </label>

                <div className="inline-flex rounded-md border border-zinc-700 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setBioTab('write')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                      bioTab === 'write'
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setBioTab('preview')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 border-l border-zinc-700 transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                      bioTab === 'preview'
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                </div>
              </div>

              {bioTab === 'write' ? (
                <textarea
                  id="bio-desc"
                  rows={6}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  maxLength={4000}
                  placeholder="Write about yourself, favorite topics, or tag friends with [user:username]..."
                  className="w-full px-3 py-2 text-sm rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 font-mono"
                />
              ) : (
                <div className="min-h-[146px] p-3 rounded-md bg-zinc-950 border border-zinc-800 text-sm">
                  {desc.trim() ? (
                    <MarkdownRenderer content={desc} />
                  ) : (
                    <p className="text-zinc-500">Nothing to preview yet.</p>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-zinc-400 text-right tabular-nums">
                {desc.length} / 4000
              </p>
            </div>

            {profileMessage && (
              <div
                role="status"
                className={`flex items-center gap-2 text-sm ${
                  profileMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {profileMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>

        {/* Section 3: Password */}
        <section className="py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Password</h2>
            <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
              Set a new password of at least 8 characters for email sign-in.
            </p>
          </div>

          <form
            onSubmit={handleChangePassword}
            className="bg-[#111111] border border-zinc-800 rounded-lg p-5 space-y-4"
          >

            {hasPassword && (
                <div>
                    <label
                    htmlFor="current-password"
                    className="block text-sm font-medium text-zinc-200 mb-1.5"
                    >
                    Current Password
                    </label>
                    <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full max-w-sm px-3 py-2 text-sm rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-zinc-400"
                    />
                </div>
            )}
            
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-zinc-200 mb-1.5"
              >
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="w-full max-w-sm px-3 py-2 text-sm rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-zinc-200 mb-1.5"
              >
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="w-full max-w-sm px-3 py-2 text-sm rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            {passwordMessage && (
              <div
                role="status"
                className={`flex items-center gap-2 text-sm ${
                  passwordMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {passwordMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {savingPassword ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}