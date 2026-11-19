'use client';

import { useState } from 'react';

interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export default function UserAvatar({
  username,
  avatarUrl,
  size = 36,
  className = '',
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = (username || '?').slice(0, 2).toUpperCase();
  const showImage = Boolean(avatarUrl) && !imgError;

  if (showImage) {
    return (
      <img
        src={avatarUrl!}
        alt={`${username} avatar`}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover border border-zinc-700 bg-zinc-900 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={`${username} avatar`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      className={`rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200 font-semibold flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {initials}
    </div>
  );
}