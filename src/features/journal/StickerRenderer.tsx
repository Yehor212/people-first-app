import { useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { emojiToFluentUrl } from './stickerUtils';

type StickerSize = 'xs' | 'sm' | 'md' | 'lg';

interface StickerProps {
  emoji: string;
  size?: StickerSize;
  className?: string;
}

const IMG_SIZE: Record<StickerSize, string> = {
  xs: 'w-3.5 h-3.5',    // 14px — card preview
  sm: 'w-5 h-5',         // 20px — viewer inline
  md: 'w-7 h-7',         // 28px — editor inline
  lg: 'w-9 h-9',         // 36px — picker grid
};

const TEXT_SIZE: Record<StickerSize, string> = {
  xs: 'text-xs',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
};

export const StickerRenderer = memo(function StickerRenderer({
  emoji,
  size = 'sm',
  className,
}: StickerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = emojiToFluentUrl(emoji);

  if (imgFailed) {
    return <span className={cn(TEXT_SIZE[size], 'leading-none', className)}>{emoji}</span>;
  }

  return (
    <img
      src={url}
      alt={emoji}
      loading="lazy"
      className={cn(IMG_SIZE[size], 'object-contain inline-block', className)}
      onError={() => setImgFailed(true)}
    />
  );
});
