import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownBubble({ text, invert }: { text: string; invert?: boolean }) {
  return (
    <div
      className={[
        // keep it simple; no typography plugin required
        "max-w-none text-[15px] leading-relaxed",
        invert ? "" : "",
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inlineCode, className, children, ...props }) {
            const content = String(children).replace(/\n$/, "");
            if (inlineCode) {
              return (
                <code
                  className="px-1 py-0.5 rounded font-mono text-[0.9em] bg-black/10"
                  {...props}
                >
                  {content}
                </code>
              );
            }
            // fenced block
            return (
              <pre className="my-2 rounded-lg border border-black/10 bg-black/5 overflow-x-auto">
                <code className="block p-3 font-mono text-[0.9em]">
                  {content}
                </code>
              </pre>
            );
          },
          a({ children, ...props }) {
            return (
              <a
                className="underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          // keep lists/tables tidy inside bubbles
          ul({ children, ...props }) {
            return (
              <ul className="list-disc pl-5 space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="list-decimal pl-5 space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          pre({ children }) {
            // ensure scroll if nested pre slips through
            return <pre className="overflow-x-auto">{children}</pre>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownBubble;
