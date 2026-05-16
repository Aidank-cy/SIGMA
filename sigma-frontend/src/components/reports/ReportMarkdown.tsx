"use client";

import ReactMarkdown from "react-markdown";

interface ReportMarkdownProps {
  content: string;
  slugify: (value: string) => string;
}

export default function ReportMarkdown({ content, slugify }: ReportMarkdownProps) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => {
          const text = String(children);
          return <h2 id={slugify(text)}>{children}</h2>;
        },
        h3: ({ children }) => {
          const text = String(children);
          return <h3 id={slugify(text)}>{children}</h3>;
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
