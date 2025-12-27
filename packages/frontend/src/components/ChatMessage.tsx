import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 chat-bubble",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary-100"
            : "bg-gradient-to-br from-primary-500 to-accent-500"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-700" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "flex flex-col max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-primary-600 text-white rounded-tr-none"
              : "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
          )}
        >
          <div
            className={cn(
              "text-sm prose prose-sm max-w-none",
              isUser
                ? "prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-code:text-white prose-pre:bg-primary-700 prose-pre:text-white prose-a:text-primary-200"
                : "prose-slate prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-slate-900 prose-pre:bg-slate-100 prose-pre:text-slate-900 prose-a:text-primary-600"
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={
                {
                  p: ({ children }: { children?: ReactNode }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }: { children?: ReactNode }) => (
                    <ul className="mb-2 last:mb-0 ml-4 list-disc">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }: { children?: ReactNode }) => (
                    <ol className="mb-2 last:mb-0 ml-4 list-decimal">
                      {children}
                    </ol>
                  ),
                  li: ({ children }: { children?: ReactNode }) => (
                    <li className="mb-1">{children}</li>
                  ),
                  h1: ({ children }: { children?: ReactNode }) => (
                    <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }: { children?: ReactNode }) => (
                    <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }: { children?: ReactNode }) => (
                    <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0">
                      {children}
                    </h3>
                  ),
                  code: ({
                    className,
                    children,
                    ...props
                  }: {
                    className?: string;
                    children?: ReactNode;
                    [key: string]: any;
                  }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded bg-opacity-20 bg-current text-sm font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }: { children?: ReactNode }) => (
                    <pre className="p-3 rounded-lg overflow-x-auto mb-2 last:mb-0">
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }: { children?: ReactNode }) => (
                    <blockquote className="border-l-4 pl-3 italic my-2 opacity-80">
                      {children}
                    </blockquote>
                  ),
                  a: ({
                    children,
                    href,
                  }: {
                    children?: ReactNode;
                    href?: string;
                  }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:opacity-80"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }: { children?: ReactNode }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }: { children?: ReactNode }) => (
                    <th className="border px-2 py-1 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }: { children?: ReactNode }) => (
                    <td className="border px-2 py-1">{children}</td>
                  ),
                } as Components
              }
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
        {timestamp && (
          <span className="text-xs text-slate-400 mt-1 px-1">
            {new Date(timestamp).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}
