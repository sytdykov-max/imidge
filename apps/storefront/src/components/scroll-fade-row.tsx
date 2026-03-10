"use client";

import { useEffect, useRef, useState } from "react";
import type { HTMLAttributes } from "react";

type ScrollFadeRowProps = HTMLAttributes<HTMLDivElement>;

export function ScrollFadeRow({ className, children, ...rest }: ScrollFadeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edgeState, setEdgeState] = useState({ atStart: true, atEnd: true });

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;

    const updateEdgeState = () => {
      const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      const atStart = element.scrollLeft <= 2;
      const atEnd = maxScrollLeft - element.scrollLeft <= 2;
      setEdgeState({ atStart, atEnd });
    };

    updateEdgeState();
    element.addEventListener("scroll", updateEdgeState, { passive: true });
    window.addEventListener("resize", updateEdgeState);

    return () => {
      element.removeEventListener("scroll", updateEdgeState);
      window.removeEventListener("resize", updateEdgeState);
    };
  }, []);

  const classes = [
    className,
    "fade-scroll-row",
    edgeState.atStart ? "is-start" : "",
    edgeState.atEnd ? "is-end" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rowRef} className={classes} {...rest}>
      {children}
    </div>
  );
}
