/**
 * AI Coach Chat - Bottom sheet chat interface
 * Professional coaching style with typing indicator
 */

import { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, Bot, User, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAICoach, ChatMessage } from '@/contexts/AICoachContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

export function AICoachChat() {
  const { t } = useLanguage();
  const {
    isOpen,
    isLoading,
    messages,
    closeCoach,
    sendMessage,
    clearHistory,
  } = useAICoach();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    haptics.buttonTap();
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    haptics.buttonTap();
    clearHistory();
  };

  return (
    // P1 Fix: Prevent closing while message is being sent
    <Sheet open={isOpen} onOpenChange={(open) => !open && !isLoading && closeCoach()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-3xl flex flex-col p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {t.aiCoachTitle || 'AI Coach'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.aiCoachSubtitle || 'Your personal wellness guide'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground"
                aria-label={t.clearHistory || 'Clear history'}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={closeCoach}
              disabled={isLoading}
              className={cn(
                "p-2 rounded-full transition-colors",
                isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
              )}
              aria-label={t.close || 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm">
                {t.aiCoachWelcome || 'Hi! How can I help you today?'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <QuickAction
                  label={t.aiCoachQuick1 || "I'm feeling stressed"}
                  onClick={() => sendMessage(t.aiCoachQuick1 || "I'm feeling stressed")}
                  disabled={isLoading}
                />
                <QuickAction
                  label={t.aiCoachQuick2 || "Help me focus"}
                  onClick={() => sendMessage(t.aiCoachQuick2 || "Help me focus")}
                  disabled={isLoading}
                />
                <QuickAction
                  label={t.aiCoachQuick3 || "Motivation needed"}
                  onClick={() => sendMessage(t.aiCoachQuick3 || "Motivation needed")}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {isLoading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card pb-safe">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t.aiCoachPlaceholder || 'Type a message...'}
              className="flex-1 px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                "p-3 rounded-xl transition-all min-w-[48px] min-h-[48px] flex items-center justify-center",
                input.trim() && !isLoading
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-muted-foreground"
              )}
              aria-label={t.send || 'Send'}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Chat bubble component
function ChatBubble({ message }: { message: ChatMessage }) {
  const isCoach = message.role === 'coach';

  return (
    <div className={cn("flex gap-2 animate-fade-in", isCoach ? "justify-start" : "justify-end")}>
      {isCoach && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}

      <div className={cn(
        "max-w-[80%] px-4 py-3 rounded-2xl",
        isCoach
          ? "bg-secondary text-foreground rounded-tl-sm"
          : "bg-primary text-primary-foreground rounded-tr-sm"
      )}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>

      {!isCoach && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
      )}
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex gap-2 justify-start animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-secondary px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// Quick action button
function QuickAction({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3 py-2 rounded-full text-xs font-medium transition-colors",
        disabled
          ? "bg-secondary/50 text-muted-foreground/50 cursor-not-allowed"
          : "bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
