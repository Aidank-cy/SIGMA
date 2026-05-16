"use client";

import DOMPurify from "dompurify";
import { useMemo } from "react";

interface RawContentProps {
  content: string;
}

export function RawContent({ content }: RawContentProps) {
  const sanitized = useMemo(() => DOMPurify.sanitize(content), [content]);

  return (
    <div
      className="prose prose-sm max-w-none text-sigma-text prose-p:text-sigma-muted prose-a:text-sigma-accent"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
