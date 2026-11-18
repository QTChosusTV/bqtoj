"use client";

import { useAuth } from '@/context/AuthContext'
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { getDisplayedElo } from "@/utils/eloAccumulation"
import MarkdownRenderer from "@/components/renderer/MarkdownRenderer";
import { getEloClass, getEloColor } from "@/utils/eloDisplay"
import "@/components/renderer/MarkdownRenderer.css";

import "highlight.js/styles/github-dark.css"; // or any theme you like
import "katex/dist/katex.min.css";
import Link from "next/link";
import Image from "next/image"

interface Post {
  id: number;
  title: string;
  content: string;
  tags: string[];
  username: string;
  created_at: string;
}

interface EloHistoryEntry {
  elo: number
  created_at?: string
  contest_id?: number
}

export default function BlogPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [elo, setElo] = useState<number | null>(null);
  const { username } = useAuth();

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", id)
        .single();

      if (error) console.error(error);
      setPost(data);
      setLoading(false);
    };
    fetchPost();
  }, [id]);

  useEffect(() => {
    if (!post) return;
    const fetchUser = async () => {

      const { data: eloData } = await supabase
        .from('leaderboard')
        .select('elo, history')
        .eq('username', post?.username)
        .single();

      // console.log(eloData);

      if (eloData?.history?.length) {
        const history = (eloData.history as EloHistoryEntry[]).map((h, idx) => ({
          ...h,
          elo: getDisplayedElo(h.elo, idx + 1),
        }))


        setElo(history.at(-1)?.elo ?? 0)
      } else if (eloData) {
        setElo(eloData.elo ?? 0)
      }


    };
    fetchUser();
  }, [post]);


  if (!id) return <p className="mt-3 ml-3">❌ Thiếu id bài viết.</p>;
  if (loading) return <p className="mt-3 ml-3">⏳ Đang tải...</p>;
  if (!post) return <p className="mt-3 ml-3">😵 Không tìm thấy bài viết.</p>;

  // console.log("RAW MARKDOWN:", JSON.stringify(post?.content?.slice(0, 2000)));

  return (
    <div className="max-w-7xl mx-auto p-6">

        <Link href="/blogs" className="text-blue-600 hover:underline" style={{textAlign: "left"}}>← Back to blog list</Link>

        <h1 className="text-3xl font-bold mb-2 mt-5">{post.title}</h1>

        <div className="text-md text-gray-500 mb-6 flex">
            Đăng bởi
            <Image 
              src={`/assets/ranks/${getEloClass(elo ?? 0)}.png`}
              alt={`${getEloClass(elo ?? 0)}`}
              width={20}
              height={20}
              className="ml-1"
            ></Image>
            <a
              href={`/user/${post.username}`}
              className={getEloClass(elo ?? 0) + " mr-1"}
            >
              <strong>{post.username}</strong>
            </a>{" "}
            vào {new Date(post.created_at).toLocaleString("vi-VN")}
        </div>

        
        <MarkdownRenderer content={post.content} />

        {post.tags && post.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
            {post.tags.map((t) => (
                <a
                key={t}
                href={`/blogs?tag=${t}`}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-600"
                >
                #{t}
                </a>
            ))}
            </div>
        )}
    </div>
  );
}