import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Trophy, Copy, Check, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { MyProfile } from './types';

interface FriendProfileCardProps {
  myProfile: MyProfile;
  copied: boolean;
  isSharing: boolean;
  showSettings: boolean;
  onCopy: () => void;
  onShare: () => void;
  onPrivacyChange: (key: keyof MyProfile, value: boolean) => void;
  t: Record<string, string>;
}

export const FriendProfileCard = memo(function FriendProfileCard({
  myProfile, copied, isSharing, showSettings,
  onCopy, onShare, onPrivacyChange, t,
}: FriendProfileCardProps) {
  return (
    <>
      {/* My Profile Card */}
      <div className="p-4 border-b bg-card/50">
        <div className="mb-3 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
            {myProfile.avatarEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground [overflow-wrap:anywhere]">
              {myProfile.displayName}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Flame className="w-4 h-4 text-orange-500" />
                {myProfile.currentStreak}
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-yellow-500" />
                {t.level || 'Lvl'} {myProfile.level}
              </span>
            </div>
          </div>
        </div>

        {/* Friend Code */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={myProfile.friendCode}
            className="min-w-0 flex-1 select-all overflow-x-auto overscroll-x-contain rounded-xl border-0 bg-background px-3 py-2 text-center font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={t.friendCode || 'Friend code'}
            tabIndex={0}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={onCopy}
            className="h-11 w-11 shrink-0"
            aria-label={copied ? (t.codeCopied || 'Copied') : (t.copyCode || 'Copy code')}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="gradient"
            size="icon"
            onClick={onShare}
            disabled={isSharing}
            className="h-11 w-11 shrink-0"
            aria-label={t.shareButton || 'Share'}
          >
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Share2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Privacy Settings (collapsible) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                {t.privacySettings || 'Privacy Settings'}
              </p>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-sm">
                    {t.shareStreak || 'Share streak'}
                  </span>
                  <Switch
                    checked={myProfile.shareStreak}
                    onCheckedChange={(v) => onPrivacyChange('shareStreak', v)}
                    className="shrink-0"
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-sm">
                    {t.shareLevel || 'Share level'}
                  </span>
                  <Switch
                    checked={myProfile.shareLevel}
                    onCheckedChange={(v) => onPrivacyChange('shareLevel', v)}
                    className="shrink-0"
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-sm">
                    {t.shareActivity || 'Share activity'}
                  </span>
                  <Switch
                    checked={myProfile.shareActivity}
                    onCheckedChange={(v) => onPrivacyChange('shareActivity', v)}
                    className="shrink-0"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
