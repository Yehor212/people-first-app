export interface HyperfocusGeneratedAudioManifestEntry {
  publicPath: string;
  sha256: string;
  bytes: number;
  generatedAt: string;
  provider?: string;
  model?: string;
  generationId?: string;
  source?: string;
}

export const HYPERFOCUS_GENERATED_AUDIO_MANIFEST: Readonly<Record<string, HyperfocusGeneratedAudioManifestEntry>> = {
};
