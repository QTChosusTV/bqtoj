'use client';

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";

export default function ExplanationRenderer({ content }: { content: string }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold">Explanation</h2>

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          p: ({ children }) => (
            <p className="whitespace-pre-wrap my-2">{children}</p>
          ),
          code: ({ children }) => {

            return (
              <pre className="p-3 rounded bg-gray-900 text-gray-100 overflow-x-auto">
                <code>{children}</code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </section>
  );
}
