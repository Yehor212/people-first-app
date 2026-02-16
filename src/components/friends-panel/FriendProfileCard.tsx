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

export function FriendProfileCard({
  myProfile, copied, isSharing, showSettings,
  onCopy, onShare, onPrivacyChange, t,
}: FriendProfileCardProps) {
  return (
    <>
      {/* My Profile Card */}
      <div className="p-4 border-b bg-card/50">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
            {myProfile.avatarEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {myProfile.displayName}
            </p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
          <div className="flex-1 bg-background rounded-xl px-3 py-2 font-mono text-sm text-center">
            {myProfile.friendCode}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onCopy}
            className="h-10 w-10 shrink-0"
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
            className="h-10 w-10 shrink-0"
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
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t.shareStreak || 'Share streak'}</span>
                  <Switch
                    checked={myProfile.shareStreak}
                    onCheckedChange={(v) => onPrivacyChange('shareStreak', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t.shareLevel || 'Share level'}</span>
                  <Switch
                    checked={myProfile.shareLevel}
                    onCheckedChange={(v) => onPrivacyChange('shareLevel', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t.shareActivity || 'Share activity'}</span>
                  <Switch
                    checked={myProfile.shareActivity}
                    onCheckedChange={(v) => onPrivacyChange('shareActivity', v)}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
