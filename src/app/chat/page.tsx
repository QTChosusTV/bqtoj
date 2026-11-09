'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import './chat.css';
import Image from 'next/image'
import { getEloClass } from '@/utils/eloDisplay'
import { useAuth } from '@/context/AuthContext'

interface Message {
  id: number;
  user: string;
  text: string;
  time: string;
  elo: number; // filled in by SQL, read-only here
}

const POLL_MS = 10_000;

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { username } = useAuth()

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('global-messages')
      .select('*')
      .order('time', { ascending: true });

    if (error) { console.error('Error loading messages:', error); return; }
    setMessages(data as Message[]);
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const sendMessage = async () => {
    if (!input.trim() || !username) return;

    // elo is NOT sent, SQL fills it in
    const { error } = await supabase.from('global-messages').insert({
      user: username,
      text: input.trim(),
    });

    if (error) {
      console.error('Failed to send message:', error);
      return;
    }

    setInput('');
    loadMessages();
  };

  return (
    <main>
      <div className="p-4 max-w-10xl mx-auto">

        <h1 className="text-2xl font-bold mb-4">Community Chat</h1>

        <div className="border p-3 rounded-md max-h-[60vh] overflow-y-auto bg-gray-900 text-white">
          {messages.map((msg, i) => {
            const rank = getEloClass(msg.elo ?? 0)
            return (
              <span
                key={msg.id}
                className={`flex items-start flex-wrap min-w-0 gap-x-1 mg-2 px-2 py-0.5 rounded ${
                  msg.user === username
                    ? i % 2 === 0 ? "bg-green-900/50" : "bg-green-900/55"
                    : i % 2 === 0 ? "bg-white/3" : "bg-transparent"
                }`}
              >
                <Image
                  src={`/assets/ranks/${rank}.png`}
                  alt={rank}
                  width={24}
                  height={24}
                  className="mr-1"
                />
                <strong className={rank}>{msg.user}{':'}</strong>
                <p className="ml-1 mr-1 break-words min-w-0 flex-1">{msg.text}</p>
                <span className="flex text-xs text-gray-400 ml-2 mt-1 font-bold">
                  {' '}({new Date(new Date(msg.time).getTime() + 7 * 60 * 60 * 1000).toLocaleString()})
                </span>
                <span className="flex text-xs text-gray-400 ml-2 mt-1">
                  {' (GMT +7, ICT)'}
                </span>
              </span>
            )
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded px-3 py-2 text-gray-400"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  )
}