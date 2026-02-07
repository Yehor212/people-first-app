import { useState } from 'react';
import { ArrowLeft, Smartphone, Monitor, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { WidgetPreview } from '@/components/WidgetPreview';
import { Capacitor } from '@capacitor/core';

interface WidgetSettingsProps {
  onBack: () => void;
}

export function WidgetSettings({ onBack }: WidgetSettingsProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'preview' | 'setup'>('preview');
  const isNativePlatform = Capacitor.isNativePlatform();

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
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{t.widgetSettings || 'Настройки виджетов'}</h1>
            <p className="text-sm text-muted-foreground">
              {t.widgetSettingsDesc || 'Настройте виджеты для домашнего экрана'}
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
            <Monitor className="w-4 h-4 inline-block mr-2" />
            {t.widgetPreview || 'Превью'}
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'setup'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Smartphone className="w-4 h-4 inline-block mr-2" />
            {t.widgetSetup || 'Установка'}
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
                    {t.widgetInfo || 'Виджеты обновляются автоматически'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.widgetInfoDesc ||
                      'Данные в виджетах синхронизируются каждый раз, когда вы обновляете привычки, завершаете фокус-сессию или получаете новый бейдж.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Widget Previews */}
            <WidgetPreview />

            {/* Status */}
            <div className="bg-muted rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3">
                {t.widgetStatus || 'Статус виджетов'}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t.widgetPlatform || 'Платформа'}:
                  </span>
                  <span className="text-sm font-medium">
                    {isNativePlatform
                      ? Capacitor.getPlatform()
                      : t.widgetWeb || 'Web (виджеты недоступны)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t.widgetSupport || 'Поддержка виджетов'}:
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isNativePlatform ? 'text-green-500' : 'text-orange-500'
                    }`}
                  >
                    {isNativePlatform
                      ? t.widgetAvailable || 'Доступны'
                      : t.widgetComingSoon || 'Скоро'}
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
                {Capacitor.getPlatform() === 'ios' && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold">
                      {t.widgetSetupiOS || 'Установка виджета на iOS'}
                    </h2>
                    <div className="bg-muted rounded-2xl p-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            1
                          </div>
                          <p className="text-sm">
                            {t.widgetStep1iOS ||
                              'Долгое нажатие на домашнем экране, пока иконки не начнут трястись'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            2
                          </div>
                          <p className="text-sm">
                            {t.widgetStep2iOS || 'Нажмите "+" в левом верхнем углу'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            3
                          </div>
                          <p className="text-sm">
                            {t.widgetStep3iOS || 'Найдите "ZenFlow" в списке приложений'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            4
                          </div>
                          <p className="text-sm">
                            {t.widgetStep4iOS ||
                              'Выберите размер виджета (маленький, средний или большой)'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            5
                          </div>
                          <p className="text-sm">
                            {t.widgetStep5iOS || 'Нажмите "Добавить виджет"'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {Capacitor.getPlatform() === 'android' && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold">
                      {t.widgetSetupAndroid || 'Установка виджета на Android'}
                    </h2>
                    <div className="bg-muted rounded-2xl p-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            1
                          </div>
                          <p className="text-sm">
                            {t.widgetStep1Android ||
                              'Долгое нажатие на пустом месте домашнего экрана'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            2
                          </div>
                          <p className="text-sm">
                            {t.widgetStep2Android || 'Нажмите "Виджеты" в появившемся меню'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            3
                          </div>
                          <p className="text-sm">
                            {t.widgetStep3Android || 'Найдите "ZenFlow" в списке приложений'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                            4
                          </div>
                          <p className="text-sm">
                            {t.widgetStep4Android ||
                              'Перетащите виджет нужного размера на домашний экран'}
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
                  {t.widgetWebWarning || 'Виджеты недоступны в веб-версии'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.widgetWebWarningDesc ||
                    'Виджеты работают только на мобильных устройствах (iOS и Android). Установите мобильное приложение, чтобы использовать виджеты.'}
                </p>
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">
                    💡 {t.widgetWebTip ||
                      'Веб-версия отображает превью виджетов, чтобы вы могли видеть, как они будут выглядеть на мобильном устройстве.'}
                  </p>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">
                {t.widgetFeatures || 'Возможности виджетов'}:
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature1 || 'Отображение текущего стрика дней подряд'}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature2 || 'Прогресс выполнения привычек за сегодня'}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature3 || 'Количество минут фокус-сессий'}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature4 || 'Последний полученный бейдж'}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-muted rounded-xl p-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <p className="text-sm">
                    {t.widgetFeature5 || 'Список привычек с отметками выполнения'}
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
