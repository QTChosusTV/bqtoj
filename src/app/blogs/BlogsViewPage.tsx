'use client'

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getDisplayedElo } from "@/utils/eloAccumulation";
import { getEloClass } from "@/utils/eloDisplay";
import GradientText from "@/components/reactbits/GradientText/GradientText";

interface Post {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  content: string;
  tags: string[] | null;
  username: string;
  created_at: string;
}

interface LatestPost {
  id: string;
  title: string;
  slug: string | null;
}

function LatestPostsList({ onOpen }: { onOpen: (slug: string) => void }) {
  const [latest, setLatest] = useState<LatestPost[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id,title,slug')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) return console.error(error);
      if (mounted) setLatest(data || []);
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <ul className="space-y-2 mt-2">
      {latest.map(p => (
        <li key={p.id}>
          <button
            onClick={() => onOpen(p.slug ?? p.id)}
            className="text-sm text-left hover:underline"
          >
            {p.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function OJBlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [eloMap, setEloMap] = useState<Record<string, number>>({});

  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  useEffect(() => {
    fetchPosts();
  }, [page, search, activeTag]);

  async function fetchPosts() {
    setLoading(true);
    try {
      let query = supabase
        .from("posts")
        .select("id,title,slug,summary,content,tags,username,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (search) {
        query = query.or(
          `title.ilike.%${search}%,summary.ilike.%${search}%,content.ilike.%${search}%`
        );
      }

      if (activeTag) {
        query = query.contains('tags', [activeTag]);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setPosts(data || []);
      setTotal(count || 0);

      if (data && data.length > 0) {
        const usernames = Array.from(new Set(data.map(p => p.username)));
        const { data: eloData, error: eloErr } = await supabase
          .from('leaderboard')
          .select('username, elo, history')
          .in('username', usernames);

        if (!eloErr && eloData) {
          const map: Record<string, number> = {};
          eloData.forEach(e => {
            const contestCount = e.history?.length ?? 0;
            map[e.username] = getDisplayedElo(e.elo ?? 0, contestCount);
          });
          setEloMap(map);
        }
      }
    } catch (err) {
      console.error("Fetch posts error:", err);
    } finally {
      setLoading(false);
    }
  }

  function renderExcerpt(md: string) {
    const stripped = md
      .replace(/`[^`]*`/g, "")
      .replace(/\!\[[^\]]*\]\([^\)]+\)/g, "")
      .replace(/\[(.*?)\]\([^\)]+\)/g, "$1")
      .replace(/[#>*_\-~\\]/g, "")
      .trim();

    const firstLine = stripped.split('\n')[0];
    return firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine;
  }

  return (
    <div className="max-w-10xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6" style={{ marginTop: 7 }}>
        <div className="text-4xl font-extrabold" style={{ lineHeight: '1.4' }}>
          <GradientText
            colors={["#b300ffff", "#ff9effff", "#b300ffff", "#ff9effff", "#b300ffff"]}
            animationSpeed={4}
            showBorder={false}
          >
            <strong>BQTOJ Blog</strong>
          </GradientText>
        </div>
        <div className="flex gap-2 items-center">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm kiếm bài viết, ví dụ: toán, DP, thủ thuật..."
            className="border rounded px-3 py-2 text-sm w-64"
          />
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2">
          {loading ? (
            <div className="p-6 text-center">Đang tải...</div>
          ) : posts.length === 0 ? (
            <div className="p-6 text-center">Không có bài viết khớp.</div>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="mb-6 p-4 border rounded-lg shadow-sm hover:shadow-md transition">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    {/* Updated to dynamic route /blog/[id] */}
                    <Link
                      href={`/blog/${post.slug ?? post.id}`}
                      className="text-xl font-semibold hover:underline"
                    >
                      {post.title}
                    </Link>
                    <p className="text-sm text-gray-300 mt-1">
                      {new Date(post.created_at).toLocaleDateString('vi-VN')}
                    </p>
                    <p className="mt-3 text-sm text-gray-100">
                      {post.summary ?? renderExcerpt(post.content)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(post.tags || []).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setPage(1); router.push(`/blogs?tag=${encodeURIComponent(t)}`); }}
                          className={`text-xs px-2 py-1 border rounded ${activeTag === t ? "bg-blue-600 text-white" : ""}`}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-auto text-right flex items-center">
                    <Image
                      src={`/assets/ranks/${getEloClass(eloMap[post.username] ?? 0)}.png`}
                      alt={`${getEloClass(eloMap[post.username] ?? 0)}`}
                      width={20}
                      height={20}
                      className="mr-1"
                    />
                    {/* Updated to dynamic route /user/[username] */}
                    <Link href={`/user/${post.username}`} className="text-sm">
                      <strong className={getEloClass(eloMap[post.username] ?? 0)}>
                        {post.username}
                      </strong>
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">{`Trang ${page} — ${total} kết quả`}</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Trước
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="p-4 border rounded">
            <h3 className="font-semibold">Bộ lọc</h3>
            <div className="mt-2">
              <button
                onClick={() => { setPage(1); router.push("/blogs"); }}
                className="text-sm px-2 py-1 border rounded"
              >
                Tất cả
              </button>
            </div>
          </div>

          <div className="p-4 border rounded">
            <h3 className="font-semibold">Bài viết mới nhất</h3>
            <LatestPostsList onOpen={(slug) => router.push(`/blog/${slug}`)} />
          </div>
        </aside>
      </main>
    </div>
  );
}