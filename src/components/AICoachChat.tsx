/**
 * AI Coach Chat - Bottom sheet chat interface
 * Professional coaching style with typing indicator
 */

import { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, Bot, User, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAICoach, ChatMessage } from '@/contexts/AICoachContext';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useBackHandler } from '@/hooks/useBackHandler';

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

  useBackHandler(isOpen, () => { if (!isLoading) closeCoach(); });

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        <SheetTitle className="sr-only">{t.aiCoachTitle || 'AI Coach'}</SheetTitle>
        {/* Header - Premium */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 relative">
          {/* Subtle glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)'
            }}
          />
          <div className="flex items-center gap-3 relative z-10">
            <motion.div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(168, 85, 247, 0.4) 100%)',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
              }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h2 className="font-semibold text-white">
                {t.aiCoachTitle || 'AI Coach'}
              </h2>
              <p className="text-xs text-white/60">
                {t.aiCoachSubtitle || 'Your personal wellness guide'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            {messages.length > 0 && (
              <motion.button
                onClick={handleClear}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                aria-label={t.clearHistory || 'Clear history'}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trash2 className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Messages - Premium with cosmic background */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{
            background: `radial-gradient(ellipse at bottom, rgba(139, 92, 246, 0.05) 0%, transparent 50%)`
          }}
        >
          {messages.length === 0 && (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div
                className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%)',
                  boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)'
                }}
              >
                <Bot className="w-10 h-10 text-violet-400" />
              </div>
              <p className="text-white/60 text-sm mb-1">
                {t.aiCoachWelcome || 'Hi! How can I help you today?'}
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
        <div className="p-4 border-t border-white/10 pb-safe relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(0deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)'
            }}
          />
          <div className="flex items-center gap-3 relative z-10">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t.aiCoachPlaceholder || 'Type a message...'}
              className={cn(
                "flex-1 px-4 py-3.5 rounded-xl transition-all",
                "bg-white/10 backdrop-blur-sm border border-white/10",
                "text-white placeholder:text-white/40",
                "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/30"
              )}
              disabled={isLoading}
            />
            <motion.button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                "p-3.5 rounded-xl min-w-[52px] min-h-[52px] flex items-center justify-center transition-all",
                input.trim() && !isLoading
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                  : "bg-white/10 text-white/40"
              )}
              style={input.trim() && !isLoading ? {
                boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
              } : undefined}
              whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
              whileTap={input.trim() && !isLoading ? { scale: 0.95 } : {}}
              aria-label={t.send || 'Send'}
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Chat bubble component - Premium
function ChatBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isCoach = message.role === 'coach';

  return (
    <motion.div
      className={cn("flex gap-3", isCoach ? "justify-start" : "justify-end")}
      initial={{ opacity: 0, y: 10, x: isCoach ? -10 : 10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      {isCoach && (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(168, 85, 247, 0.2) 100%)',
          }}
        >
          <Bot className="w-5 h-5 text-violet-400" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl",
          isCoach ? "rounded-tl-sm" : "rounded-tr-sm"
        )}
        style={isCoach ? {
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        } : {
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.8) 0%, rgba(168, 85, 247, 0.7) 100%)',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
        }}
      >
        <p className={cn("text-sm whitespace-pre-wrap", isCoach ? "text-white/90" : "text-white")}>
          {message.content}
        </p>
      </div>

      {!isCoach && (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)',
          }}
        >
          <User className="w-5 h-5 text-violet-400" />
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
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(168, 85, 247, 0.2) 100%)',
        }}
      >
        <Bot className="w-5 h-5 text-violet-400" />
      </div>
      <div
        className="px-5 py-4 rounded-2xl rounded-tl-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex gap-1.5">
          <motion.span
            className="w-2.5 h-2.5 bg-violet-400 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="w-2.5 h-2.5 bg-violet-400 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
          />
          <motion.span
            className="w-2.5 h-2.5 bg-violet-400 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Quick action button - Premium
function QuickAction({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-4 py-2.5 rounded-full text-xs font-medium transition-all",
        disabled
          ? "bg-white/5 text-white/30 cursor-not-allowed"
          : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
      )}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      {label}
    </motion.button>
  );
}
