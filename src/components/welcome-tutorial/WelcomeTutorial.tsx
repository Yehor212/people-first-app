/**
 * Welcome Tutorial - Animated introduction explaining app purpose
 * Designed for both ADHD-aware and general users
 */

import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { cn } from "@/lib/utils";
import { getSlides, getSlideContent } from "./slides";

interface WelcomeTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function WelcomeTutorial({ onComplete, onSkip }: WelcomeTutorialProps) {
  const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  // Refs for swipe gesture tracking
  const startXRef = useRef(0);
  const isSwipingRef = useRef(false);

  // Refs for timeout cleanup and race condition prevention
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionLockRef = useRef(false);

  // Get slides array inside component to avoid TDZ issues
  const slides = getSlides();

  // Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const handleNext = () => {
    // Double protection with both state and ref to prevent race conditions
    if (isAnimating || transitionLockRef.current) return;
    if (currentSlide === slides.length - 1) {
      onComplete();
      return;
    }
    transitionLockRef.current = true;
    setDirection("next");
    setIsAnimating(true);

    // Clear previous timeout before setting new one
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = setTimeout(() => {
      setCurrentSlide((prev) => prev + 1);
      setIsAnimating(false);
      transitionLockRef.current = false;
    }, 300);
  };

  const handlePrev = () => {
    // Double protection with both state and ref
    if (isAnimating || transitionLockRef.current || currentSlide === 0) return;
    transitionLockRef.current = true;
    setDirection("prev");
    setIsAnimating(true);

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = setTimeout(() => {
      setCurrentSlide((prev) => prev - 1);
      setIsAnimating(false);
      transitionLockRef.current = false;
    }, 300);
  };

  // Android back button: first slide → skip, later slides → go back
  useBackHandler(currentSlide === 0, onSkip);
  useBackHandler(currentSlide > 0, handlePrev);

  const handleDotClick = (index: number) => {
    // Double protection with both state and ref
    if (isAnimating || transitionLockRef.current || index === currentSlide) return;
    transitionLockRef.current = true;
    setDirection(index > currentSlide ? "next" : "prev");
    setIsAnimating(true);

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = setTimeout(() => {
      setCurrentSlide(index);
      setIsAnimating(false);
      transitionLockRef.current = false;
    }, 300);
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startXRef.current) return;

    const currentX = e.touches[0].clientX;
    const diff = Math.abs(currentX - startXRef.current);

    // Detect horizontal swipe (threshold: 10px)
    if (diff > 10) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwipingRef.current || !startXRef.current || isAnimating) {
      startXRef.current = 0;
      isSwipingRef.current = false;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const diff = endX - startXRef.current;
    const threshold = window.innerWidth * 0.3; // 30% of screen width
    const MIN_DISTANCE = 50;

    if (Math.abs(diff) > MIN_DISTANCE && Math.abs(diff) > threshold) {
      if (diff > 0 && currentSlide > 0) {
        // Swipe right = previous slide
        handlePrev();
        navigator.vibrate?.(10); // Haptic feedback
      } else if (diff < 0 && currentSlide < slides.length - 1) {
        // Swipe left = next slide
        handleNext();
        navigator.vibrate?.(10);
      }
    }

    startXRef.current = 0;
    isSwipingRef.current = false;
  };

  const slide = slides[currentSlide];
  const content = getSlideContent(slide.id, t);
  const Icon = slide.icon;

  return (
    <div
      className="screen-overlay zen-gradient-hero overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      <div className="flex justify-end p-3 sm:p-4">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground motion-safe:transition-colors px-3 py-2 sm:px-4"
        >
          {t.skip || "Skip"}
        </button>
      </div>

      {/* Main content */}
      <div className="screen-centered px-4 sm:px-6 pb-4 sm:pb-8">
        {/* Animated icon - responsive sizes */}
        <div
          className={cn(
            "relative w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 md:mb-10 motion-safe:transition-all motion-safe:duration-500",
            `bg-gradient-to-br ${slide.gradient}`,
            isAnimating &&
              (direction === "next" ? "translate-x-10 opacity-0" : "-translate-x-10 opacity-0")
          )}
        >
          <Icon
            className={cn(
              "w-12 h-12 sm:w-14 sm:h-14 md:w-18 md:h-18 lg:w-22 lg:h-22 motion-safe:transition-all",
              slide.iconColor,
              slide.animation === "float" && "motion-safe:animate-float",
              slide.animation === "pulse" && "motion-safe:animate-pulse",
              slide.animation === "bounce" && "motion-safe:animate-bounce",
              slide.animation === "heartbeat" && "motion-safe:animate-heartbeat",
              slide.animation === "spin-slow" && "motion-safe:animate-spin-slow",
              slide.animation === "zap" && "motion-safe:animate-zap",
              slide.animation === "color-shift" && "motion-safe:animate-color-shift"
            )}
          />

          {/* Decorative circles - responsive */}
          <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-primary/20 animate-ping" />
          <div className="absolute -bottom-2 -left-2 sm:-bottom-3 sm:-left-3 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-accent/20 motion-safe:animate-pulse" />
        </div>

        {/* Text content - responsive */}
        <div
          className={cn(
            "text-center max-w-sm md:max-w-md lg:max-w-lg motion-safe:transition-all motion-safe:duration-300 px-2",
            isAnimating &&
              (direction === "next" ? "translate-x-10 opacity-0" : "-translate-x-10 opacity-0")
          )}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2 md:mb-3">
            {content.title}
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-primary font-medium mb-3 sm:mb-4 md:mb-5">
            {content.subtitle}
          </p>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed">
            {content.description}
          </p>

          {/* Features list for features slide */}
          {content.features && (
            <div className="mt-6 space-y-3 text-start">
              {content.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl motion-safe:animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation - responsive */}
      <div className="px-4 sm:px-6 pb-[calc(1rem+var(--safe-bottom))]">
        {/* Dots */}
        <div className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              aria-label={`${t.goToSlide || "Go to slide"} ${index + 1}`}
              aria-current={index === currentSlide ? "step" : undefined}
              className="flex items-center justify-center min-w-[44px] min-h-[44px]"
            >
              <span
                className={cn(
                  "h-1.5 sm:h-2 rounded-full motion-safe:transition-all motion-safe:duration-300",
                  index === currentSlide
                    ? "w-6 sm:w-8 bg-primary"
                    : "w-1.5 sm:w-2 bg-muted hover:bg-muted-foreground/50"
                )}
              />
            </button>
          ))}
        </div>

        {/* Buttons - responsive */}
        <div className="flex gap-2 sm:gap-3">
          {currentSlide > 0 && (
            <button
              onClick={handlePrev}
              aria-label={t.back || "Back"}
              className="p-3 sm:p-4 bg-secondary rounded-xl hover:bg-muted motion-safe:transition-colors"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 rtl:scale-x-[-1]" />
            </button>
          )}

          <button
            onClick={handleNext}
            className={cn(
              "flex-1 py-3 sm:py-4 rounded-xl font-semibold motion-safe:transition-all flex items-center justify-center gap-2 text-sm sm:text-base",
              currentSlide === slides.length - 1
                ? "zen-gradient text-primary-foreground hover:opacity-90"
                : "zen-gradient text-primary-foreground hover:opacity-90"
            )}
          >
            {currentSlide === slides.length - 1 ? t.tutorialStart || "Let's Go!" : t.next || "Next"}
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rtl:scale-x-[-1]" />
          </button>
        </div>
      </div>
    </div>
  );
}
