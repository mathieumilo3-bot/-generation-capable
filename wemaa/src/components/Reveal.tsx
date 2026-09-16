import type { ReactNode, Ref } from "react";
import { useReveal } from "../hooks/useReveal";

type RevealTag = "div" | "section" | "article" | "figure";

type RevealProps = {
  children: ReactNode;
  as?: RevealTag;
  delay?: number;
  className?: string;
};

export function Reveal({ children, as: Tag = "div", delay = 0, className = "" }: RevealProps) {
  const ref = useReveal<HTMLElement>();

  return (
    <Tag
      ref={ref as Ref<HTMLDivElement & HTMLElement>}
      className={`reveal ${className}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </Tag>
  );
}
