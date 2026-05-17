"use client";

import { useEffect, useState } from "react";

export function useActiveToc(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0] ?? "");

  useEffect(() => {
    if (ids.length === 0) {
      setActiveId("");
      return;
    }

    let observer: IntersectionObserver | null = null;
    let timeout: number | null = null;
    const bindObserver = () => {
      const headings = ids
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element !== null);
      if (headings.length === 0) {
        timeout = window.setTimeout(bindObserver, 100);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
          if (visible[0]?.target.id) {
            setActiveId(visible[0].target.id);
          }
        },
        {
          rootMargin: "-18% 0px -68% 0px",
          threshold: [0, 1]
        }
      );
      headings.forEach((heading) => observer?.observe(heading));
    };
    const frame = window.requestAnimationFrame(bindObserver);

    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      observer?.disconnect();
    };
  }, [ids]);

  return activeId;
}
