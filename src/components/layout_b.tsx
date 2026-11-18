'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/context/AuthContext'
import "@/components/renderer/MarkdownRenderer.css";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AuthButtons() {
  const { username, loading } = useAuth()
  const router = useRouter(); 

  const handleProfileClick = () => {
    router.push(`/user/${username}`);
  };


  const logout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <span className="auth-button" style={{ opacity: 0.4 }}>...</span>
    </div>
  )

  if (!username) {
    return (
      <>
        <Link href="/login" className="auth-button">Login</Link>
        <Link href="/register" className="auth-button">Register</Link>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={handleProfileClick} className="auth-button">Profile</button>
      <button onClick={logout} className="auth-button">Logout</button>
    </div>
  );
}


const links = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/chat',        label: 'Chat' },
  { href: '/problemset',  label: 'Problemset' },
  { href: '/about',       label: 'About' },
  { href: '/ide',         label: 'Live IDE' },
  { href: '/submissions', label: 'Submissions' },
  { href: '/blogs',       label: 'Blogs' },
];
