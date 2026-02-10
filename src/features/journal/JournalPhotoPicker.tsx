import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';

interface JournalPhotoPickerProps {
  onSelectFile: (file: File) => Promise<void>;
  onClose: () => void;
  currentCount: number;
  maxCount: number;
}

export function JournalPhotoPicker({
  onSelectFile,
  onClose,
  currentCount,
  maxCount,
}: JournalPhotoPickerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  useBackHandler(true, onClose);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await onSelectFile(file);
      onClose();
    } catch {
      // stay open on error
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const remaining = maxCount - currentCount;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[64] bg-black/30 animate-fade-in" onClick={onClose} />

      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[65]',
          'bg-card/95 backdrop-blur-xl border-t border-border/40',
          'rounded-t-2xl shadow-lg animate-slide-up',
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="p-4 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-foreground">
              {ts.journalPhotoAdd || 'Add Photo'} ({remaining} {ts.journalRemaining || 'remaining'})
            </span>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ms-2 text-sm text-muted-foreground">{ts.journalCompressing || 'Compressing...'}</span>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={remaining <= 0}
                className={cn(
                  'flex-1 flex flex-col items-center gap-2 py-6 rounded-xl',
                  'bg-muted/50 border border-border/30',
                  'active:scale-95 transition-transform',
                  'disabled:opacity-40',
                  'min-h-[80px]',
                )}
              >
                <Camera className="w-6 h-6 text-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {ts.journalPhotoTake || 'Take Photo'}
                </span>
              </button>

              <button
                onClick={() => galleryRef.current?.click()}
                disabled={remaining <= 0}
                className={cn(
                  'flex-1 flex flex-col items-center gap-2 py-6 rounded-xl',
                  'bg-muted/50 border border-border/30',
                  'active:scale-95 transition-transform',
                  'disabled:opacity-40',
                  'min-h-[80px]',
                )}
              >
                <ImageIcon className="w-6 h-6 text-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {ts.journalPhotoChoose || 'From Gallery'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </>
  );
}
