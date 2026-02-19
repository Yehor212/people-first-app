export interface ReviewPlugin {
  requestReview(): Promise<void>;
  isSupported(): Promise<{ supported: boolean }>;
}
