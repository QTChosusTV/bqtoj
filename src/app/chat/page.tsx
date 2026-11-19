'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { getEloClass } from '@/utils/eloDisplay';
import { useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import './chat.css';

interface Message {
  id: number;
  user: string;
  text: string;
  time: string;
  elo: number;
}

const POLL_MS = 10_000;
const MAX_MSG_LENGTH = 500;

function formatICT(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour12: false,
  });
}

export default function ChatPage() {
  const { username } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchedAvatarsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const loadMessages = useCallback(async (forceScroll = false) => {
    const el = scrollRef.current;
    const wasNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight < 90
      : true;

    const { data, error } = await supabase
      .from('global-messages')
      .select('*')
      .order('time', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      setErrorMsg('Failed to load messages.');
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Message[];
    setMessages(list);
    setLoading(false);

    // Fetch avatars only for usernames not yet queried
    const missing = Array.from(
      new Set(list.map((m) => m.user).filter((u) => u && !fetchedAvatarsRef.current.has(u)))
    );

    if (missing.length > 0) {
      missing.forEach((u) => fetchedAvatarsRef.current.add(u));
      const { data: usersData } = await supabase
        .from('public_users')
        .select('username, avatar_url')
        .in('username', missing);

      if (usersData && usersData.length > 0) {
        setAvatarMap((prev) => {
          const next = { ...prev };
          usersData.forEach((u) => {
            if (u.username) next[u.username] = u.avatar_url ?? '';
          });
          return next;
        });
      }
    }

    if (!initialScrollDone.current || forceScroll || wasNearBottom) {
      initialScrollDone.current = true;
      requestAnimationFrame(scrollToBottom);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => loadMessages(false), POLL_MS);
    return () => clearInterval(interval);
  }, [loadMessages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !username || sending) return;

    setErrorMsg(null);
    setSending(true);

    const { error } = await supabase.from('global-messages').insert({
      user: username,
      text: trimmed,
    });

    if (error) {
      console.error('Failed to send message:', error);
      setErrorMsg('Could not send message. Try again.');
      setSending(false);
      return;
    }

    setInput('');
    setSending(false);
    await loadMessages(true);
  }

  return (
    <main className="max-w-5xl mx-auto px-5 py-6 text-zinc-100">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            Community Chat
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Global room · timestamps in ICT (GMT+7) · refreshes every 10s
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadMessages(false)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </header>

      {/* Chat Panel */}
      <section className="bg-[#111111] border border-zinc-800 rounded-lg flex flex-col overflow-hidden h-[calc(100vh-170px)] min-h-[420px]">
        {/* Message Feed */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5"
        >
          {loading ? (
            <p className="text-sm text-zinc-400 py-8 text-center">
              Loading messages...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">
              No messages yet. Start the conversation below.
            </p>
          ) : (
            messages.map((msg) => {
              const rank = getEloClass(msg.elo ?? 0);
              const isMe = Boolean(username && msg.user === username);

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 px-3 py-2 rounded-md transition-colors duration-150 motion-reduce:transition-none ${ isMe ? 'bg-emerald-950/35 border border-emerald-900/40' : 'hover:bg-zinc-900/60 border border-transparent' }`} > <Link href={`/user/${encodeURIComponent(msg.user)}`}
                    prefetch={false}
                    className="shrink-0 mt-0.5"
                  >
                    <UserAvatar
                      username={msg.user}
                      avatarUrl={avatarMap[msg.user]}
                      size={32}
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Image
                          src={`/assets/ranks/${rank}.png`} alt={rank} width={18} height={18} className="shrink-0" /> <Link href={`/user/${encodeURIComponent(msg.user)}`}
                          prefetch={false}
                          className={`text-sm font-semibold hover:underline truncate ${rank}`}
                        >
                          {msg.user}
                        </Link>
                      </div>

                      <time
                        dateTime={msg.time}
                        className="text-xs text-zinc-400 tabular-nums shrink-0"
                      >
                        {formatICT(msg.time)}
                      </time>
                    </div>

                    <p className="mt-0.5 text-sm text-zinc-200 leading-relaxed break-words whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div
            role="status"
            className="px-4 py-2 border-t border-zinc-800 bg-red-950/30 text-red-400 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Composer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/80">
          {username ? (
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={MAX_MSG_LENGTH}
                placeholder={`Message as ${username}...`}
                aria-label="Chat message"
                className="flex-1 px-3 py-2 text-sm rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 transition-colors duration-150 motion-reduce:transition-none cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-sm text-zinc-400 px-1 py-0.5">
              <span>Sign in to participate in the community chat.</span>
              <Link
                href="/login"
                className="font-medium text-zinc-100 underline underline-offset-4 hover:text-zinc-300"
              >
                Log in
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}