"use client";

import { forwardRef, useRef, type ComponentProps } from "react";
import type { Severity } from "@/db/schema";
import { cn } from "@/lib/utils";

export type Mark = { id: string; start: number; end: number; severity: Severity };

const MARK_STYLES: Record<Severity, string> = {
  high: "bg-red-200/80 shadow-[inset_0_-2px_0_var(--color-red-500)]",
  medium: "bg-amber-200/80 shadow-[inset_0_-2px_0_var(--color-amber-500)]",
  low: "bg-sky-200/80 shadow-[inset_0_-2px_0_var(--color-sky-500)]",
};

// Shared box metrics: the backdrop must line up with the textarea character for character.
const BOX = "w-full rounded-lg border px-2.5 py-2 text-base leading-6 md:text-sm md:leading-6 whitespace-pre-wrap break-words";

type Props = Omit<ComponentProps<"textarea">, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  marks: Mark[];
  activeMark?: string;
  singleLine?: boolean;
  // Called with the caret position when someone clicks or moves within the text.
  onCaret?: (position: number) => void;
};

// A textarea with flagged text highlighted behind it. The text itself stays a normal,
// editable textarea; a mirrored layer underneath draws the highlights.
export const HighlightTextarea = forwardRef<HTMLTextAreaElement, Props>(function HighlightTextarea(
  { value, onChange, marks, activeMark, singleLine, onCaret, className, ...props },
  ref,
) {
  const backdrop = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div
        ref={backdrop}
        aria-hidden
        className={cn(BOX, "pointer-events-none absolute inset-0 overflow-hidden border-transparent text-transparent")}
      >
        {renderMarks(value, marks, activeMark)}
      </div>
      <textarea
        ref={ref}
        {...props}
        value={value}
        rows={singleLine ? 1 : props.rows}
        onChange={(event) => onChange(singleLine ? event.target.value.replace(/\n/g, " ") : event.target.value)}
        onKeyDown={(event) => {
          if (singleLine && event.key === "Enter") event.preventDefault();
          props.onKeyDown?.(event);
        }}
        onClick={(event) => onCaret?.(event.currentTarget.selectionStart)}
        onKeyUp={(event) => onCaret?.(event.currentTarget.selectionStart)}
        onScroll={(event) => {
          if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop;
        }}
        className={cn(
          BOX,
          "relative field-sizing-content resize-none border-input bg-transparent outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          singleLine ? "min-h-9 overflow-hidden" : "min-h-24",
          className,
        )}
      />
    </div>
  );
});

function renderMarks(text: string, marks: Mark[], activeMark?: string) {
  const visible = marks.filter((mark) => mark.end > mark.start).sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const mark of visible) {
    if (mark.start < cursor) continue; // overlapping flags: the first one wins the highlight
    parts.push(text.slice(cursor, mark.start));
    parts.push(
      <mark
        key={mark.id}
        className={cn(
          "rounded-sm text-transparent [box-decoration-break:clone]",
          MARK_STYLES[mark.severity],
          activeMark === mark.id && "outline-2 outline-offset-1 outline-foreground/60",
        )}
      >
        {text.slice(mark.start, mark.end)}
      </mark>,
    );
    cursor = mark.end;
  }
  parts.push(text.slice(cursor));
  // A trailing newline needs a character after it or the backdrop ends one line short.
  if (text.endsWith("\n")) parts.push(" ");
  return parts;
}
