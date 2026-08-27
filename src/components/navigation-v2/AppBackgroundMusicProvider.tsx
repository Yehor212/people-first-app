import { createContext, useContext, useRef, type ReactNode } from "react";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import {
  useAppBackgroundMusic,
  type AppBackgroundMusicControl,
} from "@/hooks/useAppBackgroundMusic";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";

const AppBackgroundMusicContext = createContext<AppBackgroundMusicControl | null>(null);

export function AppBackgroundMusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSettings = useAppAudioSettings();
  const comfort = useAudioComfortSettings();
  const control = useAppBackgroundMusic({
    audioRef,
    canPlay:
      !audioSettings.muted &&
      audioSettings.volume > 0 &&
      comfort.canPlayAmbientAsset("cloudlight-evening-loop"),
    volume: audioSettings.volume * 0.18,
  });

  return (
    <AppBackgroundMusicContext.Provider value={control}>
      {children}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        data-testid="app-background-music-audio"
        src={getAppAudioAssetSrc("cloudlight-evening-loop")}
        preload="none"
        loop
        playsInline
        hidden
        aria-hidden="true"
        crossOrigin="anonymous"
        onError={control.handleMediaError}
      />
    </AppBackgroundMusicContext.Provider>
  );
}

export function useAppBackgroundMusicControl(): AppBackgroundMusicControl {
  const control = useContext(AppBackgroundMusicContext);
  if (!control) {
    throw new Error("useAppBackgroundMusicControl must be used inside AppBackgroundMusicProvider");
  }
  return control;
}
