/**
 * AI Coach Chat - Bottom sheet chat interface
 * Professional coaching style with typing indicator
 */

import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { Send, X, Sparkles, Bot, User, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAICoachConversation, ChatMessage } from "@/contexts/AICoachContext";
// Sheet replaced with custom bottom-sheet modal
import { cn } from "@/lib/utils";
import { zenTap } from "@/lib/animationUtils";
import { haptics } from "@/lib/haptics";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";

export function AICoachChat() {
  const { t } = useLanguage();
  const { isOpen, isLoading, messages, closeCoach, sendMessage, clearHistory } =
    useAICoachConversation();

  const { modalRef, handleKeyDown } = useModalA11y(isOpen, () => {
    if (!isLoading) closeCoach();
  });
  useScrollLock(isOpen);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened (minimal delay for DOM update)
  useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame for reliable focus after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    void haptics.buttonTap();
    const message = input;
    setInput("");
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleClear = () => {
    void haptics.buttonTap();
    clearHistory();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* A11Y-OK: backdrop is decorative overlay dismissed by click — keyboard users dismiss via Escape in the dialog */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm motion-safe:animate-fade-in"
        onClick={() => {
          if (!isLoading) closeCoach();
        }}
        role="presentation"
      />
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 inset-x-0 z-[60] rounded-t-[2rem] bg-background max-h-[85dvh] overflow-y-auto overscroll-contain motion-safe:animate-slide-up flex flex-col pb-safe lg:max-w-3xl lg:mx-auto"
      >
        <h2 className="sr-only">{t.aiCoachTitle || "AI Coach"}</h2>
        {/* Header - Premium */}
        <div className="flex items-center justify-between p-4 border-b border-border relative">
          {/* Subtle glow */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="flex items-center gap-3 relative z-10">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/50 to-primary/40 shadow-zen-md animate-zen-loop-scale"
              style={{ '--zen-loop-duration': '2s' } as CSSProperties}
            >
              <Sparkles className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t.aiCoachTitle || "AI Coach"}</h2>
              <p className="text-xs text-muted-foreground">
                {t.aiCoachSubtitle || "Your personal wellness guide"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            {messages.length > 0 && (
              <motion.button
                onClick={handleClear}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground hover:bg-secondary hover:text-foreground motion-safe:transition-colors"
                aria-label={t.clearHistory || "Clear history"}
                whileHover={{ scale: 1.05 }}
                whileTap={zenTap.button}
              >
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </motion.button>
            )}
            <button
              onClick={() => {
                if (!isLoading) closeCoach();
              }}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-muted motion-safe:transition-colors"
              aria-label={t.close || "Close"}
            >
              <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Messages - Premium with cosmic background */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.05)_0%,transparent_50%)]">
          {messages.length === 0 && (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 shadow-zen-md">
                <Bot className="w-10 h-10 text-violet-400" aria-hidden="true" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">
                {t.aiCoachWelcome || "Hi! How can I help you today?"}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
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
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg, index) => (
              <ChatBubble key={msg.id} message={msg} index={index} />
            ))}
          </AnimatePresence>

          {isLoading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - Premium */}
        <div className="p-4 border-t border-border pb-safe relative">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(0deg,hsl(var(--cosmic-nebula-purple)/0.05)_0%,transparent_100%)]" />
          <div className="flex items-center gap-3 relative z-10">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={t.aiCoachPlaceholder || "Type a message..."}
              className={cn(
                "flex-1 px-4 py-3.5 rounded-xl motion-safe:transition-all",
                "bg-secondary backdrop-blur-sm border border-border",
                "text-foreground placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus:border-violet-500/30"
              )}
              disabled={isLoading}
            />
            <motion.button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                "p-3.5 rounded-xl min-w-[52px] min-h-[52px] flex items-center justify-center motion-safe:transition-all",
                input.trim() && !isLoading
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                  : "bg-secondary text-muted-foreground"
              )}
              style={
                input.trim() && !isLoading
                  ? {
                      boxShadow: "0 0 16px hsl(var(--cosmic-nebula-purple) / 0.4)",
                    }
                  : undefined
              }
              whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
              whileTap={input.trim() && !isLoading ? zenTap.button : {}}
              aria-label={t.send || "Send"}
            >
              <Send className="w-5 h-5" aria-hidden="true" />
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );
}

// Chat bubble component - Premium
function ChatBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isCoach = message.role === "coach";

  return (
    <motion.div
      className={cn("flex gap-3", isCoach ? "justify-start" : "justify-end")}
      initial={{ opacity: 0, y: 10, x: isCoach ? -10 : 10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      {isCoach && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[linear-gradient(135deg,hsl(var(--cosmic-nebula-purple)/0.3)_0%,hsl(var(--cosmic-nebula-purple)/0.2)_100%)]">
          <Bot className="w-5 h-5 text-violet-400" aria-hidden="true" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl",
          isCoach
            ? "rounded-ss-sm bg-secondary backdrop-blur-[8px] border border-border"
            : "rounded-se-sm bg-[linear-gradient(135deg,hsl(var(--cosmic-nebula-purple)/0.8)_0%,hsl(var(--cosmic-nebula-purple)/0.7)_100%)] shadow-[0_4px_12px_hsl(var(--cosmic-nebula-purple)/0.3)]"
        )}
      >
        <p
          className={cn("text-sm whitespace-pre-wrap", isCoach ? "text-foreground" : "text-white")}
        >
          {message.content}
        </p>
      </div>

      {!isCoach && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[linear-gradient(135deg,hsl(var(--cosmic-nebula-purple)/0.2)_0%,hsl(var(--cosmic-nebula-purple)/0.15)_100%)]">
          <User className="w-5 h-5 text-violet-400" aria-hidden="true" />
        </div>
      )}
    </motion.div>
  );
}

// Typing indicator - Premium
function TypingIndicator() {
  return (
    <motion.div
      className="flex gap-3 justify-start"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg,hsl(var(--cosmic-nebula-purple)/0.3)_0%,hsl(var(--cosmic-nebula-purple)/0.2)_100%)]">
        <Bot className="w-5 h-5 text-violet-400" aria-hidden="true" />
      </div>
      <div className="px-5 py-4 rounded-2xl rounded-ss-sm bg-secondary backdrop-blur-[8px] border border-border">
        <div className="flex gap-1.5">
          <span
            className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-zen-loop-bounce-dot"
            style={{ '--zen-loop-duration': '0.6s' } as CSSProperties}
          />
          <span
            className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-zen-loop-bounce-dot"
            style={{ '--zen-loop-duration': '0.6s', '--zen-loop-delay': '0.15s' } as CSSProperties}
          />
          <span
            className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-zen-loop-bounce-dot"
            style={{ '--zen-loop-duration': '0.6s', '--zen-loop-delay': '0.3s' } as CSSProperties}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Quick action button - Premium
function QuickAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-4 py-2.5 min-h-[44px] rounded-full text-xs font-medium motion-safe:transition-all",
        disabled
          ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
          : "bg-muted border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? zenTap.card : {}}
    >
      {label}
    </motion.button>
  );
}
