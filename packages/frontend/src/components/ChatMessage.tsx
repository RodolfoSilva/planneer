import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === 'user';
  
  return (
    <div className={cn(
      "flex gap-3 chat-bubble",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-primary-100" 
          : "bg-gradient-to-br from-primary-500 to-accent-500"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-primary-700" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      
      {/* Message bubble */}
      <div className={cn(
        "flex flex-col max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "rounded-2xl px-4 py-2.5",
          isUser 
            ? "bg-primary-600 text-white rounded-tr-none" 
            : "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
        )}>
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
        {timestamp && (
          <span className="text-xs text-slate-400 mt-1 px-1">
            {new Date(timestamp).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
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



