import type { ReactNode } from "react";

type MarkdownBlock =
  | { type: "paragraph"; content: string }
  | { type: "heading"; level: 2 | 3 | 4; content: string }
  | { type: "code"; language: string; content: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; content: string };

export function MarkdownRenderer({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="max-w-none space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: "code", language, content: codeLines.join("\n") });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "heading", level: (heading[1].length + 1) as 2 | 3 | 4, content: heading[2] });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", content: quoteLines.join(" ") });
      continue;
    }

    const unordered = /^[-*]\s+/.test(trimmed);
    const ordered = /^\d+\.\s+/.test(trimmed);
    if (unordered || ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        if (ordered && /^\d+\.\s+/.test(itemLine)) {
          items.push(itemLine.replace(/^\d+\.\s+/, ""));
          index += 1;
          continue;
        }
        if (unordered && /^[-*]\s+/.test(itemLine)) {
          items.push(itemLine.replace(/^[-*]\s+/, ""));
          index += 1;
          continue;
        }
        break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      const nextStartsBlock =
        next.startsWith("```") ||
        /^(#{1,3})\s+/.test(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        /^>\s?/.test(next);
      if (!next || nextStartsBlock) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  if (block.type === "heading") {
    const className =
      block.level === 2
        ? "pt-2 text-lg font-semibold text-slate-950 dark:text-white"
        : "pt-1 font-semibold text-slate-950 dark:text-white";
    const children = renderInline(block.content, `h-${index}`);
    if (block.level === 2) {
      return (
        <h2 key={index} className={className}>
          {children}
        </h2>
      );
    }
    if (block.level === 3) {
      return (
        <h3 key={index} className={className}>
          {children}
        </h3>
      );
    }
    return (
      <h4 key={index} className={className}>
        {children}
      </h4>
    );
  }

  if (block.type === "code") {
    return (
      <div key={index} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-white/10">
        {block.language ? (
          <div className="border-b border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {block.language}
          </div>
        ) : null}
        <pre className="overflow-auto p-3 font-mono text-[13px] leading-5 text-slate-100">{block.content}</pre>
      </div>
    );
  }

  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    const listClass = block.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5";
    return (
      <Tag key={index} className={listClass}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item, `li-${index}-${itemIndex}`)}</li>
        ))}
      </Tag>
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote key={index} className="border-l-4 border-emerald-400 pl-3 text-slate-600 dark:text-slate-300">
        {renderInline(block.content, `q-${index}`)}
      </blockquote>
    );
  }

  return <p key={index}>{renderInline(block.content, `p-${index}`)}</p>;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith("`")) {
      result.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.92em] dark:bg-white/10">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      result.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      result.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        result.push(
          <a
            key={key}
            className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            href={safeHref(link[2])}
            rel="noreferrer"
            target="_blank"
          >
            {link[1]}
          </a>
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

function safeHref(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith("/")) {
    return value;
  }
  return "#";
}
