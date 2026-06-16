import { useRef, useState, useEffect } from "react";
import { isNative } from "@/lib/platform";
import { Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { logger } from "@/lib/logger";
import { formatLocalizedCount } from "./journalWordCount";

interface JournalPhotoPickerProps {
  onSelectFile: (file: File) => Promise<void>;
  onClose: () => void;
  currentCount: number;
  maxCount: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

export function isSupportedJournalPhotoFile(file: Pick<File, "name" | "type">): boolean {
  const type = file.type.toLowerCase();
  if (type) return ALLOWED_MIME_TYPES.includes(type);

  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function JournalPhotoPicker({
  onSelectFile,
  onClose,
  currentCount,
  maxCount,
}: JournalPhotoPickerProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const { modalRef, handleKeyDown } = useModalA11y(true, onClose);
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedJournalPhotoFile(file)) {
      setError(
        ts.journalPhotoInvalidType || "Unsupported file type. Please use JPEG, PNG, WebP, or HEIC."
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
  const remainingLabel = formatLocalizedCount(
    remaining,
    language,
    ts,
    "journalPhotoRemainingCount",
    ts.journalRemaining || "remaining"
  );

  return (
    <>
      {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
      <div
        className="fixed inset-0 z-[64] bg-black/30 motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t.ariaPhotoPicker}
        className={cn(
          "fixed bottom-0 inset-x-0 z-[65] pb-safe lg:max-w-4xl lg:mx-auto",
          "bg-card backdrop-blur-xl border-t border-border/40",
          "rounded-t-2xl shadow-lg motion-safe:animate-slide-up",
          "pb-safe"
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+0.75rem)] pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-foreground">
              {ts.journalPhotoAdd || "Add Photo"} ({remainingLabel})
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
                    "active:scale-95 motion-safe:transition-transform",
                    "disabled:opacity-40",
                    "min-h-[80px]"
                  )}
                >
                  <Camera className="w-6 h-6 text-foreground" aria-hidden="true" />
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
                  "active:scale-95 motion-safe:transition-transform",
                  "disabled:opacity-40",
                  "min-h-[80px]"
                )}
              >
                <ImageIcon className="w-6 h-6 text-foreground" aria-hidden="true" />
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
