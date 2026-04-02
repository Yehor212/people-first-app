import { useRef, useState, useEffect } from "react";
import { isNative } from "@/lib/platform";
import { Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { logger } from "@/lib/logger";

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
  useModalA11y(true, onClose);
  useScrollLock(true);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // capture="environment" only opens a real camera on native mobile (Android/iOS).
  // On desktop web it silently falls back to file picker — identical to gallery button.
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    if (isNative) {
      setHasCamera(true);
    }
  }, []);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(
        ts.journalPhotoInvalidType || "Unsupported file type. Please use JPEG, PNG, or WebP."
      );
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(ts.journalPhotoTooLarge || "Image too large (max 10 MB). Try a smaller image.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSelectFile(file);
      onClose();
    } catch (err) {
      logger.error("[JournalPhotoPicker] Photo upload failed:", err);
      setError(ts.journalPhotoError || "Failed to add photo. Try again.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const remaining = maxCount - currentCount;

  return (
    <>
      {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
      <div
        className="fixed inset-0 z-[64] bg-black/30 animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Photo picker"
        className={cn(
          "fixed bottom-0 inset-x-0 z-[65]",
          "bg-card/95 backdrop-blur-xl border-t border-border/40",
          "rounded-t-2xl shadow-lg animate-slide-up",
          "pb-[env(safe-area-inset-bottom)]"
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
              {ts.journalPhotoAdd || "Add Photo"} ({remaining} {ts.journalRemaining || "remaining"})
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={ts.close || "Close"}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {error && <p className="text-sm text-red-400 text-center py-2">{error}</p>}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
              <span className="ms-2 text-sm text-muted-foreground">
                {ts.journalCompressing || "Compressing..."}
              </span>
            </div>
          ) : (
            <div className="flex gap-3">
              {hasCamera && (
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={remaining <= 0}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-2 py-6 rounded-xl",
                    "bg-muted/50 border border-border/30",
                    "active:scale-95 transition-transform",
                    "disabled:opacity-40",
                    "min-h-[80px]"
                  )}
                >
                  <Camera className="w-6 h-6 text-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {ts.journalPhotoTake || "Take Photo"}
                  </span>
                </button>
              )}

              <button
                onClick={() => galleryRef.current?.click()}
                disabled={remaining <= 0}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 py-6 rounded-xl",
                  "bg-muted/50 border border-border/30",
                  "active:scale-95 transition-transform",
                  "disabled:opacity-40",
                  "min-h-[80px]"
                )}
              >
                <ImageIcon className="w-6 h-6 text-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {ts.journalPhotoChoose || "From Gallery"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </>
  );
}
