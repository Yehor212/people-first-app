import { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface JournalLockScreenProps {
  mode: 'setup' | 'unlock';
  cooldownRemaining: number;
  failedAttempts: number;
  onUnlock: (password: string) => Promise<boolean>;
  onSetPassword: (password: string) => Promise<void>;
  onForgotPassword?: () => void;
}

export function JournalLockScreen({
  mode,
  cooldownRemaining,
  failedAttempts,
  onUnlock,
  onSetPassword,
  onForgotPassword,
}: JournalLockScreenProps) {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [wrongGlow, setWrongGlow] = useState(false);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const inputRef = useRef<HTMLInputElement>(null);

  // Cooldown timer display
  const [countdown, setCountdown] = useState(cooldownRemaining);
  useEffect(() => {
    setCountdown(cooldownRemaining);
    if (cooldownRemaining <= 0) return;
    const iv = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, [cooldownRemaining]);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  const triggerShake = () => {
    setShake(true);
    setWrongGlow(true);
    setTimeout(() => setShake(false), 500);
    setTimeout(() => setWrongGlow(false), 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countdown > 0) return;

    if (mode === 'setup') {
      if (step === 'enter') {
        if (password.length < 4) {
          setError((t as unknown as Record<string, string>).journalPasswordTooShort || 'Minimum 4 characters');
          triggerShake();
          return;
        }
        setStep('confirm');
        setError('');
        return;
      }
      if (password !== confirm) {
        setError((t as unknown as Record<string, string>).journalPasswordMismatch || 'Passwords do not match');
        setConfirm('');
        triggerShake();
        return;
      }
      await onSetPassword(password);
    } else {
      const ok = await onUnlock(password);
      if (!ok) {
        setError((t as unknown as Record<string, string>).journalPasswordWrong || 'Wrong password');
        setPassword('');
        triggerShake();
      }
    }
  };

  const ts = t as unknown as Record<string, string>;

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/3 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={cn(
          'w-full max-w-[340px] rounded-2xl p-6 relative z-10',
          'bg-card/60 backdrop-blur-2xl',
          'border border-white/10 dark:border-white/5',
          'shadow-[0_8px_40px_rgba(0,0,0,0.08)]',
          shake && 'animate-[shake_0.5s_ease-in-out]',
        )}
      >
        {/* Lock icon with sway animation */}
        <div className="flex justify-center mb-4">
          <motion.div
            animate={{ rotate: [0, -3, 3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
          >
            <Lock className="w-8 h-8 text-primary" />
          </motion.div>
        </div>

        <h2 className="text-lg font-bold text-center text-foreground mb-1">
          {mode === 'setup'
            ? (ts.journalPasswordSetup || 'Set Journal Password')
            : (ts.journalLocked || 'Journal Locked')}
        </h2>

        {mode === 'setup' && step === 'enter' && (
          <p className="text-xs text-muted-foreground text-center mb-4 px-2">
            {ts.journalPasswordHint || 'This password protects only your journal. There is no recovery \u2014 remember it well.'}
          </p>
        )}

        {mode === 'setup' && step === 'confirm' && (
          <p className="text-xs text-muted-foreground text-center mb-4">
            {ts.journalPasswordConfirm || 'Confirm your password'}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={step === 'confirm' ? confirm : password}
              onChange={e => step === 'confirm' ? setConfirm(e.target.value) : setPassword(e.target.value)}
              placeholder={mode === 'setup' && step === 'confirm'
                ? (ts.journalPasswordConfirm || 'Confirm password')
                : (ts.journalPasswordEnter || 'Enter password')}
              className={cn(
                'w-full px-4 py-3 pe-14 rounded-xl text-sm',
                'bg-background/80 border border-border/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/40',
                'focus:shadow-[0_0_20px_rgba(var(--primary-rgb,99,102,241),0.15)]',
                'placeholder:text-muted-foreground/50',
                'transition-shadow duration-300',
                wrongGlow && 'ring-2 ring-destructive/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]',
              )}
              disabled={countdown > 0}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-1 top-1/2 -translate-y-1/2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground rounded-lg hover:bg-muted/50"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-destructive text-center flex items-center justify-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" /> {error}
            </motion.p>
          )}

          {countdown > 0 && (
            <p className="text-xs text-orange-500 text-center">
              {ts.journalPasswordCooldown || 'Too many attempts. Wait'} {countdown}s
            </p>
          )}

          <button
            type="submit"
            disabled={countdown > 0 || (step === 'confirm' ? !confirm : !password)}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-semibold',
              'bg-gradient-to-r from-primary to-primary/90',
              'text-primary-foreground',
              'shadow-[0_2px_15px_rgba(var(--primary-rgb,99,102,241),0.25)]',
              'disabled:opacity-40 disabled:shadow-none',
              'active:scale-[0.98] transition-all duration-150',
            )}
          >
            {mode === 'setup'
              ? (step === 'enter' ? (ts.journalNext || 'Next') : (ts.journalSave || 'Save'))
              : (ts.journalUnlock || 'Unlock')}
          </button>
        </form>

        {mode === 'unlock' && onForgotPassword && (
          <button
            onClick={onForgotPassword}
            className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center min-h-[44px]"
          >
            {ts.journalPasswordForgot || 'Forgot password?'}
          </button>
        )}

        {mode === 'setup' && step === 'confirm' && (
          <button
            onClick={() => { setStep('enter'); setConfirm(''); setError(''); }}
            className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center min-h-[44px]"
          >
            {ts.journalBack || 'Back'}
          </button>
        )}
      </motion.div>
    </div>
  );
}
