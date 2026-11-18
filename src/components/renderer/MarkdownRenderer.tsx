"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { supabase } from "@/utils/supabaseClient";
import { getEloClass, getEloColor } from "@/utils/eloDisplay";
import { getDisplayedElo } from "@/utils/eloAccumulation";
import Image from "next/image";
import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Text, Parent } from "mdast";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import "./MarkdownRenderer.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
} 

// ─── Remark plugin: replaces [user:username] with a custom node ───
const remarkUserTag: Plugin<[], Root> = () => (tree) => {
  visit(tree, "text", (node: Text, index, parent: Parent | null) => {
    if (!parent || index === undefined) return;

    const regex = /\[user:([^\]]+)\]/g;
    const parts: any[] = [];
    let last = 0;
    let match;

    while ((match = regex.exec(node.value)) !== null) {
      if (match.index > last) {
        parts.push({ type: "text", value: node.value.slice(last, match.index) });
      }
      parts.push({
        type: "userTag",
        data: {
          hName: "usertag",
          hProperties: { username: match[1].trim() },
        },
      });
      last = match.index + match[0].length;
    }

    if (parts.length === 0) return;
    if (last < node.value.length) {
      parts.push({ type: "text", value: node.value.slice(last) });
    }

    parent.children.splice(index, 1, ...parts);
  });
};

// ─── UserMention: fetches elo and renders badge ───
function UserMention({ username }: { username: string }) {
  const [elo, setElo] = useState<number | null>(null);
  const [hl, setHL] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("leaderboard")
      .select("elo, history")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setElo(0); return; }
        const contestCount = data.history?.length ?? 0;
        setElo(getDisplayedElo(data.elo ?? 0, contestCount));
      });
  }, [username]);

  if (elo === null) return <strong>{username}</strong>; 

  const eloClass = getEloClass(elo);

  return (
    <Link
      href={`/user/${username}`}
      className="inline-flex items-center gap-1 hover:underline mb-0.5"
      style={{ color: getEloColor(elo), verticalAlign: "middle" }}
    >
      <img
        src={`/assets/ranks/${eloClass}.png`}
        alt={eloClass}
        width={16}
        height={16}
        style={{ display: "inline" }}
        className="no-md-style"
      />
      <strong style={{ color: getEloColor(elo) }}>{username}</strong>
    </Link>
  );
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const remarkPlugins = useMemo(
    () => [remarkUserTag, remarkGfm, remarkMath, remarkBreaks],
    []
  );

  const rehypePlugins = useMemo(
    () => [
      rehypeKatex,
      rehypeSlug,
      [rehypeAutolinkHeadings, { behaviour: "append", properties: { className: ["heading-anchor"] } }],
      rehypeHighlight,
    ] as any,
    []
  );

  const components = useMemo(
    () => ({
      usertag({ node, ...props }: any) {
        return <UserMention username={props.username} />;
      },
    }) as any,
    []
  );

  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}