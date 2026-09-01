export const UI_PREVIEW_FIXTURE_SENTINEL = "ZENFLOW_UI_PREVIEW_FIXTURE_ONLY_20260728";

export type UiPreviewFixtureLocale = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

export interface UiPreviewFixtureCopy {
  saveAppearance: string;
  openDisplayOptions: string;
  reviewPrivacySettings: string;
  displayName: string;
  displayNameHint: string;
  reduceMotion: string;
  accountPreferences: string;
  accountPreferencesDetail: string;
  clearPreviewState: string;
  retryPreviewState: string;
  boundaryNotice: string;
  offlineNotice: string;
  permissionNotice: string;
  pendingSyncNotice: string;
  recoveryNotice: string;
}

export const uiPreviewFixtureCopy: Readonly<Record<UiPreviewFixtureLocale, UiPreviewFixtureCopy>> =
  {
    en: {
      saveAppearance: "Save appearance",
      openDisplayOptions: "Open display options",
      reviewPrivacySettings: "Review privacy settings",
      displayName: "Display name",
      displayNameHint: "Preview the account field without loading an account.",
      reduceMotion: "Reduce motion",
      accountPreferences: "Account preferences",
      accountPreferencesDetail:
        "Appearance, privacy, and recovery controls remain readable at compact widths.",
      clearPreviewState: "Clear preview state",
      retryPreviewState: "Retry preview state",
      boundaryNotice:
        "Development-only UI evidence. No account, mood, habit, or journal data is loaded.",
      offlineNotice:
        "The preview is offline. Controls remain inspectable without creating user records.",
      permissionNotice:
        "Notification permission is blocked in this isolated preview; no system prompt is opened.",
      pendingSyncNotice:
        "The pending-sync treatment is visual evidence only; nothing is queued or transmitted.",
      recoveryNotice: "Recovery keeps the preview local and returns to the same component state.",
    },
    uk: {
      saveAppearance: "Зберегти вигляд",
      openDisplayOptions: "Відкрити параметри вигляду",
      reviewPrivacySettings: "Переглянути налаштування приватності",
      displayName: "Ім’я для відображення",
      displayNameHint: "Перевірка поля без завантаження облікового запису.",
      reduceMotion: "Зменшити рух",
      accountPreferences: "Налаштування облікового запису",
      accountPreferencesDetail:
        "Параметри вигляду, приватності й відновлення читаються на вузькому екрані.",
      clearPreviewState: "Очистити стан перевірки",
      retryPreviewState: "Повторити перевірку стану",
      boundaryNotice:
        "Лише перевірка інтерфейсу для розробки. Дані облікового запису й щоденника не завантажуються.",
      offlineNotice: "Перевірка офлайн. Елементи доступні без створення записів користувача.",
      permissionNotice:
        "Дозвіл на сповіщення заблоковано лише в перевірці; системний запит не відкривається.",
      pendingSyncNotice: "Очікування синхронізації показане лише візуально; дані не передаються.",
      recoveryNotice: "Відновлення лишається локальним і повертає той самий стан компонента.",
    },
    es: {
      saveAppearance: "Guardar apariencia",
      openDisplayOptions: "Abrir opciones de visualización",
      reviewPrivacySettings: "Revisar ajustes de privacidad",
      displayName: "Nombre visible",
      displayNameHint: "Revisa el campo sin cargar ninguna cuenta.",
      reduceMotion: "Reducir movimiento",
      accountPreferences: "Preferencias de la cuenta",
      accountPreferencesDetail:
        "Las opciones de apariencia, privacidad y recuperación siguen legibles en ancho compacto.",
      clearPreviewState: "Borrar estado de vista previa",
      retryPreviewState: "Reintentar estado de vista previa",
      boundaryNotice:
        "Evidencia de interfaz solo para desarrollo. No se cargan datos de cuenta ni de diario.",
      offlineNotice: "La vista previa está sin conexión y no crea registros de usuario.",
      permissionNotice:
        "El permiso de notificaciones está bloqueado en esta vista aislada; no se abre el aviso del sistema.",
      pendingSyncNotice:
        "La sincronización pendiente es solo evidencia visual; no se envía ningún dato.",
      recoveryNotice: "La recuperación permanece local y vuelve al mismo estado del componente.",
    },
    de: {
      saveAppearance: "Darstellung speichern",
      openDisplayOptions: "Anzeigeoptionen öffnen",
      reviewPrivacySettings: "Datenschutzeinstellungen prüfen",
      displayName: "Anzeigename",
      displayNameHint: "Kontofeld prüfen, ohne ein Konto zu laden.",
      reduceMotion: "Bewegung reduzieren",
      accountPreferences: "Kontoeinstellungen",
      accountPreferencesDetail:
        "Darstellung, Datenschutz und Wiederherstellung bleiben bei schmaler Breite lesbar.",
      clearPreviewState: "Vorschauzustand löschen",
      retryPreviewState: "Vorschauzustand erneut prüfen",
      boundaryNotice:
        "UI-Nachweis nur für die Entwicklung. Konto- und Tagebuchdaten werden nicht geladen.",
      offlineNotice: "Die Vorschau ist offline und erstellt keine Nutzerdatensätze.",
      permissionNotice:
        "Die Mitteilungsberechtigung ist nur in dieser Vorschau gesperrt; kein Systemdialog wird geöffnet.",
      pendingSyncNotice:
        "Der ausstehende Abgleich ist nur visuell; es werden keine Daten übertragen.",
      recoveryNotice:
        "Die Wiederherstellung bleibt lokal und kehrt zum gleichen Komponentenzustand zurück.",
    },
    fr: {
      saveAppearance: "Enregistrer l’apparence",
      openDisplayOptions: "Ouvrir les options d’affichage",
      reviewPrivacySettings: "Vérifier les réglages de confidentialité",
      displayName: "Nom affiché",
      displayNameHint: "Inspecter le champ sans charger de compte.",
      reduceMotion: "Réduire les animations",
      accountPreferences: "Préférences du compte",
      accountPreferencesDetail:
        "Apparence, confidentialité et récupération restent lisibles en largeur compacte.",
      clearPreviewState: "Effacer l’état d’aperçu",
      retryPreviewState: "Réessayer l’état d’aperçu",
      boundaryNotice:
        "Preuve d’interface réservée au développement. Aucune donnée de compte ou de journal n’est chargée.",
      offlineNotice: "L’aperçu est hors ligne et ne crée aucun enregistrement utilisateur.",
      permissionNotice:
        "L’autorisation de notification est bloquée dans cet aperçu isolé ; aucune invite système ne s’ouvre.",
      pendingSyncNotice:
        "La synchronisation en attente est uniquement visuelle ; aucune donnée n’est transmise.",
      recoveryNotice: "La récupération reste locale et revient au même état du composant.",
    },
    ja: {
      saveAppearance: "外観を保存",
      openDisplayOptions: "表示オプションを開く",
      reviewPrivacySettings: "プライバシー設定を確認",
      displayName: "表示名",
      displayNameHint: "アカウントを読み込まずに入力欄を確認します。",
      reduceMotion: "動きを減らす",
      accountPreferences: "アカウント設定",
      accountPreferencesDetail: "外観、プライバシー、復旧の操作は狭い画面でも読み取れます。",
      clearPreviewState: "プレビュー状態を消去",
      retryPreviewState: "プレビュー状態を再試行",
      boundaryNotice: "開発専用の UI 確認です。アカウントや日記のデータは読み込みません。",
      offlineNotice: "プレビューはオフラインです。ユーザー記録を作らずに操作を確認できます。",
      permissionNotice: "通知権限はこの分離プレビュー内だけで拒否され、システム画面は開きません。",
      pendingSyncNotice: "同期待ちの表示は視覚確認専用で、データは送信されません。",
      recoveryNotice: "復旧操作はローカルのまま、同じコンポーネント状態へ戻ります。",
    },
    ar: {
      saveAppearance: "حفظ المظهر",
      openDisplayOptions: "فتح خيارات العرض",
      reviewPrivacySettings: "مراجعة إعدادات الخصوصية",
      displayName: "اسم العرض",
      displayNameHint: "فحص الحقل من دون تحميل أي حساب.",
      reduceMotion: "تقليل الحركة",
      accountPreferences: "تفضيلات الحساب",
      accountPreferencesDetail: "تظل إعدادات المظهر والخصوصية والاسترداد مقروءة في العرض الضيق.",
      clearPreviewState: "مسح حالة المعاينة",
      retryPreviewState: "إعادة محاولة حالة المعاينة",
      boundaryNotice: "دليل واجهة مخصص للتطوير فقط. لا تُحمّل بيانات الحساب أو اليوميات.",
      offlineNotice:
        "المعاينة غير متصلة، وتبقى عناصر التحكم قابلة للفحص من دون إنشاء سجلات مستخدم.",
      permissionNotice:
        "إذن الإشعارات محظور داخل هذه المعاينة المعزولة فقط، ولن تظهر مطالبة النظام.",
      pendingSyncNotice: "حالة انتظار المزامنة دليل بصري فقط، ولا تُرسل أي بيانات.",
      recoveryNotice: "يبقى الاسترداد محليًا ويعود إلى حالة المكوّن نفسها.",
    },
    he: {
      saveAppearance: "שמירת המראה",
      openDisplayOptions: "פתיחת אפשרויות התצוגה",
      reviewPrivacySettings: "בדיקת הגדרות הפרטיות",
      displayName: "שם לתצוגה",
      displayNameHint: "בדיקת השדה בלי לטעון חשבון.",
      reduceMotion: "הפחתת תנועה",
      accountPreferences: "העדפות חשבון",
      accountPreferencesDetail: "אפשרויות המראה, הפרטיות והשחזור נשארות קריאות ברוחב צר.",
      clearPreviewState: "ניקוי מצב התצוגה המקדימה",
      retryPreviewState: "ניסיון חוזר של מצב התצוגה",
      boundaryNotice: "ראיית ממשק לפיתוח בלבד. לא נטענים נתוני חשבון או יומן.",
      offlineNotice: "התצוגה אינה מקוונת ואינה יוצרת רשומות משתמש.",
      permissionNotice: "הרשאת ההתראות חסומה רק בתצוגה המבודדת; לא נפתחת בקשת מערכת.",
      pendingSyncNotice: "ההמתנה לסנכרון היא ראיה חזותית בלבד; לא נשלחים נתונים.",
      recoveryNotice: "השחזור נשאר מקומי וחוזר לאותו מצב רכיב.",
    },
  };

export const uiPreviewFixtureBoundary = Object.freeze({
  sentinel: UI_PREVIEW_FIXTURE_SENTINEL,
  displayNameValue: "",
  switchInitiallyChecked: false,
});
