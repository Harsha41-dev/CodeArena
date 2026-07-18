// super basic markdown-ish renderer — just splits on blank lines for now
export function MarkdownRenderer({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/);

  return (
    <div className="prose prose-sm max-w-none text-slate-700 dark:prose-invert dark:text-slate-300">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mb-3 leading-6">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
