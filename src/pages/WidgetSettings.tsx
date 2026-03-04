import { useState } from 'react';
import { ArrowLeft, Smartphone, Monitor, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { WidgetPreview } from '@/components/WidgetPreview';
import { isNative, platform, isIos, isAndroid } from '@/lib/platform';

interface WidgetSettingsProps {
  onBack: () => void;
}

export function WidgetSettings({ onBack }: WidgetSettingsProps) {
  const { t } = useLanguage();
  useBackHandler(true, onBack);
  const [activeTab, setActiveTab] = useState<'preview' | 'setup'>('preview');
  const isNativePlatform = isNative;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 px-4 py-4 pt-safe">
          <button
            onClick={onBack}
            className="p-4 hover:bg-accent rounded-xl transition-colors active:scale-95 touch-manipulation"
            aria-label={t.back}
          >
            <ArrowLeft className="w-6 h-6 rtl:scale-x-[-1]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{t.widgetSettings}</h1>
            <p className="text-sm text-muted-foreground">
              {t.widgetSettingsDesc}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pb-4">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Monitor className="w-4 h-4 inline-block me-2" />
            {t.widgetPreview}
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'setup'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Smartphone className="w-4 h-4 inline-block me-2" />
            {t.widgetSetup}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {activeTab === 'preview' && (
          <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-blue-500/10 border-2 border-blue-500/20 rounded-2xl p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {t.widgetInfo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.widgetInfoDesc}
                  </p>
                </div>
              </div>
            </div>

            {/* Widget Previews */}
            <WidgetPreview />

            {/* Status */}
            <div className="bg-muted rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3">
                {t.widgetStatus}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t.widgetPlatform}:
                  </span>
                  <span className="text-sm font-medium">
                    {isNativePlatform
                      ? platform
                      : t.widgetWeb}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t.widgetSupport}:
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isNativePlatform ? 'text-green-500' : 'text-orange-500'
                    }`}
                  >
                    {isNativePlatform
                      ? t.widgetAvailable
                      : t.widgetComingSoon}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="space-y-6">
            {/* Platform-specific instructions */}
            {isNativePlatform ? (
              <>
                {isIos && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold">
                      {t.widgetSetupiOS}
                    </h2>
                    <div className="bg-muted rounded-2xl p-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            1
                          </div>
                          <p className="text-sm">
                            {t.widgetStep1iOS}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            2
                          </div>
                          <p className="text-sm">
                            {t.widgetStep2iOS}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            3
                          </div>
                          <p className="text-sm">
                            {t.widgetStep3iOS}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            4
                          </div>
                          <p className="text-sm">
                            {t.widgetStep4iOS}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            5
                          </div>
                          <p className="text-sm">
                            {t.widgetStep5iOS}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isAndroid && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold">
                      {t.widgetSetupAndroid}
                    </h2>
                    <div className="bg-muted rounded-2xl p-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            1
                          </div>
                          <p className="text-sm">
                            {t.widgetStep1Android}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            2
                          </div>
                          <p className="text-sm">
                            {t.widgetStep2Android}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            3
                          </div>
                          <p className="text-sm">
                            {t.widgetStep3Android}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            4
                          </div>
                          <p className="text-sm">
                            {t.widgetStep4Android}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-orange-500/10 border-2 border-orange-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-3">
                  {t.widgetWebWarning}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.widgetWebWarningDesc}
                </p>
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">
                    💡 {t.widgetWebTip}
                  </p>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">
                {t.widgetFeatures}:
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature1}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature2}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature3}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature4}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature5}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
