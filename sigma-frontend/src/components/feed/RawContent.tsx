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
      className="prose prose-sm max-w-none text-foreground prose-p:text-muted-foreground prose-a:text-primary"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
