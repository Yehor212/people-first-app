import { useState } from 'react';
import { User, Bell, Trash2, Download, Crown, ExternalLink } from 'lucide-react';

interface SettingsPanelProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
}

export function SettingsPanel({ userName, onNameChange, onResetData }: SettingsPanelProps) {
  const [name, setName] = useState(userName);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleNameSave = () => {
    if (name.trim()) {
      onNameChange(name.trim());
    }
  };

  const handleReset = () => {
    onResetData();
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-foreground">Настройки</h2>

      {/* Profile */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Профиль</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Ваше имя</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleNameSave}
                className="px-4 py-2 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Promo */}
      <div className="bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl p-6 border border-accent/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 zen-gradient-warm rounded-xl">
            <Crown className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">ZenFlow Premium</h3>
        </div>
        <p className="text-muted-foreground mb-4">
          Разблокируйте расширенную аналитику, экспорт данных и премиум темы!
        </p>
        <button className="w-full py-3 zen-gradient-warm text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <span>Скоро</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Notifications (placeholder) */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Уведомления</h3>
        </div>
        <p className="text-muted-foreground">
          Уведомления будут доступны в следующих обновлениях.
        </p>
      </div>

      {/* Data */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Данные</h3>
        </div>
        
        <div className="space-y-3">
          <button className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors">
            Экспорт данных (скоро)
          </button>
          
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-medium hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Сбросить все данные</span>
            </button>
          ) : (
            <div className="p-4 bg-destructive/10 rounded-xl animate-scale-in">
              <p className="text-destructive font-medium mb-3">
                Вы уверены? Это действие нельзя отменить.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
                >
                  Отмена
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg"
                >
                  Удалить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">ZenFlow v1.0.0</p>
        <p className="text-xs mt-1">Ваш путь к осознанной жизни 🌿</p>
      </div>
    </div>
  );
}
