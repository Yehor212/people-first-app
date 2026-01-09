export type Language = 'ru' | 'en' | 'uk' | 'es' | 'de' | 'fr';

export interface Translations {
  // App
  appName: string;
  
  // Greetings
  goodMorning: string;
  goodAfternoon: string;
  goodEvening: string;
  
  // Navigation
  home: string;
  stats: string;
  settings: string;
  
  // Stats overview
  streakDays: string;
  days: string;
  habitsToday: string;
  focusToday: string;
  minutes: string;
  min: string;
  gratitudes: string;
  
  // Mood tracker
  howAreYouFeeling: string;
  moodToday: string;
  great: string;
  good: string;
  okay: string;
  bad: string;
  terrible: string;
  addNote: string;
  saveMood: string;
  
  // Habits
  habits: string;
  habitName: string;
  icon: string;
  color: string;
  addHabit: string;
  addFirstHabit: string;
  completedTimes: string;
  
  // Focus timer
  focus: string;
  breakTime: string;
  todayMinutes: string;
  concentrate: string;
  takeRest: string;
  
  // Gratitude
  gratitude: string;
  today: string;
  whatAreYouGratefulFor: string;
  iAmGratefulFor: string;
  save: string;
  cancel: string;
  recentEntries: string;
  
  // Weekly calendar
  thisWeek: string;
  
  // Stats page
  statistics: string;
  monthlyOverview: string;
  moodEntries: string;
  focusMinutes: string;
  achievements: string;
  currentStreak: string;
  daysInRow: string;
  totalFocus: string;
  allTime: string;
  habitsCompleted: string;
  totalTimes: string;
  moodDistribution: string;
  topHabit: string;
  completedTimes2: string;
  
  // Settings
  profile: string;
  yourName: string;
  notifications: string;
  notificationsComingSoon: string;
  data: string;
  exportData: string;
  comingSoon: string;
  resetAllData: string;
  areYouSure: string;
  cannotBeUndone: string;
  delete: string;
  
  // Premium
  premium: string;
  premiumDescription: string;
  
  // Language
  language: string;
  selectLanguage: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  continue: string;
  
  // Misc
  version: string;
  tagline: string;
  
  // Days of week
  sun: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  
  // Months
  january: string;
  february: string;
  march: string;
  april: string;
  may: string;
  june: string;
  july: string;
  august: string;
  september: string;
  october: string;
  november: string;
  december: string;
}

export const translations: Record<Language, Translations> = {
  ru: {
    appName: 'ZenFlow',
    goodMorning: 'Доброе утро',
    goodAfternoon: 'Добрый день',
    goodEvening: 'Добрый вечер',
    home: 'Главная',
    stats: 'Статистика',
    settings: 'Настройки',
    streakDays: 'Серия дней',
    days: 'дн',
    habitsToday: 'Привычки сегодня',
    focusToday: 'Фокус сегодня',
    minutes: 'минут',
    min: 'мин',
    gratitudes: 'Благодарности',
    howAreYouFeeling: 'Как вы себя чувствуете?',
    moodToday: 'Настроение сегодня',
    great: 'Отлично',
    good: 'Хорошо',
    okay: 'Нормально',
    bad: 'Плохо',
    terrible: 'Ужасно',
    addNote: 'Добавьте заметку (необязательно)...',
    saveMood: 'Сохранить настроение',
    habits: 'Привычки',
    habitName: 'Название привычки...',
    icon: 'Иконка',
    color: 'Цвет',
    addHabit: 'Добавить привычку',
    addFirstHabit: 'Добавьте свою первую привычку! ✨',
    completedTimes: 'Выполнено',
    focus: 'Фокус',
    breakTime: 'Перерыв',
    todayMinutes: 'мин сегодня',
    concentrate: 'Сконцентрируйтесь',
    takeRest: 'Отдохните',
    gratitude: 'Благодарность',
    today: 'сегодня',
    whatAreYouGratefulFor: 'За что вы благодарны сегодня?',
    iAmGratefulFor: 'Я благодарен за...',
    save: 'Сохранить',
    cancel: 'Отмена',
    recentEntries: 'Недавние записи',
    thisWeek: 'Эта неделя',
    statistics: 'Статистика',
    monthlyOverview: 'Обзор месяца',
    moodEntries: 'Записей настроения',
    focusMinutes: 'Минут фокуса',
    achievements: 'Достижения',
    currentStreak: 'Текущая серия',
    daysInRow: 'Дней подряд',
    totalFocus: 'Всего фокуса',
    allTime: 'За все время',
    habitsCompleted: 'Привычки выполнены',
    totalTimes: 'Всего раз',
    moodDistribution: 'Распределение настроения',
    topHabit: 'Лучшая привычка',
    completedTimes2: 'раз',
    profile: 'Профиль',
    yourName: 'Ваше имя',
    notifications: 'Уведомления',
    notificationsComingSoon: 'Уведомления будут доступны в следующих обновлениях.',
    data: 'Данные',
    exportData: 'Экспорт данных',
    comingSoon: 'скоро',
    resetAllData: 'Сбросить все данные',
    areYouSure: 'Вы уверены?',
    cannotBeUndone: 'Это действие нельзя отменить.',
    delete: 'Удалить',
    premium: 'ZenFlow Premium',
    premiumDescription: 'Разблокируйте расширенную аналитику, экспорт данных и премиум темы!',
    language: 'Язык',
    selectLanguage: 'Выберите язык',
    welcomeTitle: 'Добро пожаловать в ZenFlow',
    welcomeSubtitle: 'Ваш путь к осознанной жизни начинается здесь',
    continue: 'Продолжить',
    version: 'Версия',
    tagline: 'Ваш путь к осознанной жизни 🌿',
    sun: 'Вс', mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб',
    january: 'Январь', february: 'Февраль', march: 'Март', april: 'Апрель',
    may: 'Май', june: 'Июнь', july: 'Июль', august: 'Август',
    september: 'Сентябрь', october: 'Октябрь', november: 'Ноябрь', december: 'Декабрь',
  },
  
  en: {
    appName: 'ZenFlow',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    home: 'Home',
    stats: 'Stats',
    settings: 'Settings',
    streakDays: 'Streak',
    days: 'd',
    habitsToday: 'Habits today',
    focusToday: 'Focus today',
    minutes: 'minutes',
    min: 'min',
    gratitudes: 'Gratitudes',
    howAreYouFeeling: 'How are you feeling?',
    moodToday: 'Mood today',
    great: 'Great',
    good: 'Good',
    okay: 'Okay',
    bad: 'Bad',
    terrible: 'Terrible',
    addNote: 'Add a note (optional)...',
    saveMood: 'Save mood',
    habits: 'Habits',
    habitName: 'Habit name...',
    icon: 'Icon',
    color: 'Color',
    addHabit: 'Add habit',
    addFirstHabit: 'Add your first habit! ✨',
    completedTimes: 'Completed',
    focus: 'Focus',
    breakTime: 'Break',
    todayMinutes: 'min today',
    concentrate: 'Concentrate',
    takeRest: 'Take a rest',
    gratitude: 'Gratitude',
    today: 'today',
    whatAreYouGratefulFor: 'What are you grateful for today?',
    iAmGratefulFor: 'I am grateful for...',
    save: 'Save',
    cancel: 'Cancel',
    recentEntries: 'Recent entries',
    thisWeek: 'This week',
    statistics: 'Statistics',
    monthlyOverview: 'Monthly overview',
    moodEntries: 'Mood entries',
    focusMinutes: 'Focus minutes',
    achievements: 'Achievements',
    currentStreak: 'Current streak',
    daysInRow: 'Days in a row',
    totalFocus: 'Total focus',
    allTime: 'All time',
    habitsCompleted: 'Habits completed',
    totalTimes: 'Total times',
    moodDistribution: 'Mood distribution',
    topHabit: 'Top habit',
    completedTimes2: 'times',
    profile: 'Profile',
    yourName: 'Your name',
    notifications: 'Notifications',
    notificationsComingSoon: 'Notifications will be available in future updates.',
    data: 'Data',
    exportData: 'Export data',
    comingSoon: 'coming soon',
    resetAllData: 'Reset all data',
    areYouSure: 'Are you sure?',
    cannotBeUndone: 'This action cannot be undone.',
    delete: 'Delete',
    premium: 'ZenFlow Premium',
    premiumDescription: 'Unlock advanced analytics, data export and premium themes!',
    language: 'Language',
    selectLanguage: 'Select language',
    welcomeTitle: 'Welcome to ZenFlow',
    welcomeSubtitle: 'Your journey to mindful living starts here',
    continue: 'Continue',
    version: 'Version',
    tagline: 'Your path to mindful living 🌿',
    sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
    january: 'January', february: 'February', march: 'March', april: 'April',
    may: 'May', june: 'June', july: 'July', august: 'August',
    september: 'September', october: 'October', november: 'November', december: 'December',
  },
  
  uk: {
    appName: 'ZenFlow',
    goodMorning: 'Доброго ранку',
    goodAfternoon: 'Добрий день',
    goodEvening: 'Добрий вечір',
    home: 'Головна',
    stats: 'Статистика',
    settings: 'Налаштування',
    streakDays: 'Серія днів',
    days: 'дн',
    habitsToday: 'Звички сьогодні',
    focusToday: 'Фокус сьогодні',
    minutes: 'хвилин',
    min: 'хв',
    gratitudes: 'Подяки',
    howAreYouFeeling: 'Як ви себе почуваєте?',
    moodToday: 'Настрій сьогодні',
    great: 'Чудово',
    good: 'Добре',
    okay: 'Нормально',
    bad: 'Погано',
    terrible: 'Жахливо',
    addNote: 'Додайте нотатку (необов\'язково)...',
    saveMood: 'Зберегти настрій',
    habits: 'Звички',
    habitName: 'Назва звички...',
    icon: 'Іконка',
    color: 'Колір',
    addHabit: 'Додати звичку',
    addFirstHabit: 'Додайте свою першу звичку! ✨',
    completedTimes: 'Виконано',
    focus: 'Фокус',
    breakTime: 'Перерва',
    todayMinutes: 'хв сьогодні',
    concentrate: 'Сконцентруйтесь',
    takeRest: 'Відпочиньте',
    gratitude: 'Подяка',
    today: 'сьогодні',
    whatAreYouGratefulFor: 'За що ви вдячні сьогодні?',
    iAmGratefulFor: 'Я вдячний за...',
    save: 'Зберегти',
    cancel: 'Скасувати',
    recentEntries: 'Останні записи',
    thisWeek: 'Цей тиждень',
    statistics: 'Статистика',
    monthlyOverview: 'Огляд місяця',
    moodEntries: 'Записів настрою',
    focusMinutes: 'Хвилин фокусу',
    achievements: 'Досягнення',
    currentStreak: 'Поточна серія',
    daysInRow: 'Днів поспіль',
    totalFocus: 'Всього фокусу',
    allTime: 'За весь час',
    habitsCompleted: 'Звички виконані',
    totalTimes: 'Всього разів',
    moodDistribution: 'Розподіл настрою',
    topHabit: 'Найкраща звичка',
    completedTimes2: 'разів',
    profile: 'Профіль',
    yourName: 'Ваше ім\'я',
    notifications: 'Сповіщення',
    notificationsComingSoon: 'Сповіщення будуть доступні в наступних оновленнях.',
    data: 'Дані',
    exportData: 'Експорт даних',
    comingSoon: 'скоро',
    resetAllData: 'Скинути всі дані',
    areYouSure: 'Ви впевнені?',
    cannotBeUndone: 'Цю дію не можна скасувати.',
    delete: 'Видалити',
    premium: 'ZenFlow Premium',
    premiumDescription: 'Розблокуйте розширену аналітику, експорт даних та преміум теми!',
    language: 'Мова',
    selectLanguage: 'Оберіть мову',
    welcomeTitle: 'Ласкаво просимо до ZenFlow',
    welcomeSubtitle: 'Ваш шлях до усвідомленого життя починається тут',
    continue: 'Продовжити',
    version: 'Версія',
    tagline: 'Ваш шлях до усвідомленого життя 🌿',
    sun: 'Нд', mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб',
    january: 'Січень', february: 'Лютий', march: 'Березень', april: 'Квітень',
    may: 'Травень', june: 'Червень', july: 'Липень', august: 'Серпень',
    september: 'Вересень', october: 'Жовтень', november: 'Листопад', december: 'Грудень',
  },
  
  es: {
    appName: 'ZenFlow',
    goodMorning: 'Buenos días',
    goodAfternoon: 'Buenas tardes',
    goodEvening: 'Buenas noches',
    home: 'Inicio',
    stats: 'Estadísticas',
    settings: 'Ajustes',
    streakDays: 'Racha',
    days: 'd',
    habitsToday: 'Hábitos hoy',
    focusToday: 'Enfoque hoy',
    minutes: 'minutos',
    min: 'min',
    gratitudes: 'Gratitudes',
    howAreYouFeeling: '¿Cómo te sientes?',
    moodToday: 'Estado de ánimo hoy',
    great: 'Genial',
    good: 'Bien',
    okay: 'Regular',
    bad: 'Mal',
    terrible: 'Terrible',
    addNote: 'Añade una nota (opcional)...',
    saveMood: 'Guardar estado',
    habits: 'Hábitos',
    habitName: 'Nombre del hábito...',
    icon: 'Icono',
    color: 'Color',
    addHabit: 'Añadir hábito',
    addFirstHabit: '¡Añade tu primer hábito! ✨',
    completedTimes: 'Completado',
    focus: 'Enfoque',
    breakTime: 'Descanso',
    todayMinutes: 'min hoy',
    concentrate: 'Concéntrate',
    takeRest: 'Descansa',
    gratitude: 'Gratitud',
    today: 'hoy',
    whatAreYouGratefulFor: '¿Por qué estás agradecido hoy?',
    iAmGratefulFor: 'Estoy agradecido por...',
    save: 'Guardar',
    cancel: 'Cancelar',
    recentEntries: 'Entradas recientes',
    thisWeek: 'Esta semana',
    statistics: 'Estadísticas',
    monthlyOverview: 'Resumen mensual',
    moodEntries: 'Entradas de ánimo',
    focusMinutes: 'Minutos de enfoque',
    achievements: 'Logros',
    currentStreak: 'Racha actual',
    daysInRow: 'Días seguidos',
    totalFocus: 'Enfoque total',
    allTime: 'Todo el tiempo',
    habitsCompleted: 'Hábitos completados',
    totalTimes: 'Veces totales',
    moodDistribution: 'Distribución del ánimo',
    topHabit: 'Mejor hábito',
    completedTimes2: 'veces',
    profile: 'Perfil',
    yourName: 'Tu nombre',
    notifications: 'Notificaciones',
    notificationsComingSoon: 'Las notificaciones estarán disponibles en futuras actualizaciones.',
    data: 'Datos',
    exportData: 'Exportar datos',
    comingSoon: 'próximamente',
    resetAllData: 'Restablecer todos los datos',
    areYouSure: '¿Estás seguro?',
    cannotBeUndone: 'Esta acción no se puede deshacer.',
    delete: 'Eliminar',
    premium: 'ZenFlow Premium',
    premiumDescription: '¡Desbloquea análisis avanzados, exportación de datos y temas premium!',
    language: 'Idioma',
    selectLanguage: 'Selecciona idioma',
    welcomeTitle: 'Bienvenido a ZenFlow',
    welcomeSubtitle: 'Tu viaje hacia una vida consciente comienza aquí',
    continue: 'Continuar',
    version: 'Versión',
    tagline: 'Tu camino hacia una vida consciente 🌿',
    sun: 'Dom', mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb',
    january: 'Enero', february: 'Febrero', march: 'Marzo', april: 'Abril',
    may: 'Mayo', june: 'Junio', july: 'Julio', august: 'Agosto',
    september: 'Septiembre', october: 'Octubre', november: 'Noviembre', december: 'Diciembre',
  },
  
  de: {
    appName: 'ZenFlow',
    goodMorning: 'Guten Morgen',
    goodAfternoon: 'Guten Tag',
    goodEvening: 'Guten Abend',
    home: 'Start',
    stats: 'Statistiken',
    settings: 'Einstellungen',
    streakDays: 'Serie',
    days: 'T',
    habitsToday: 'Gewohnheiten heute',
    focusToday: 'Fokus heute',
    minutes: 'Minuten',
    min: 'Min',
    gratitudes: 'Dankbarkeiten',
    howAreYouFeeling: 'Wie fühlst du dich?',
    moodToday: 'Stimmung heute',
    great: 'Super',
    good: 'Gut',
    okay: 'Okay',
    bad: 'Schlecht',
    terrible: 'Schrecklich',
    addNote: 'Notiz hinzufügen (optional)...',
    saveMood: 'Stimmung speichern',
    habits: 'Gewohnheiten',
    habitName: 'Name der Gewohnheit...',
    icon: 'Symbol',
    color: 'Farbe',
    addHabit: 'Gewohnheit hinzufügen',
    addFirstHabit: 'Füge deine erste Gewohnheit hinzu! ✨',
    completedTimes: 'Abgeschlossen',
    focus: 'Fokus',
    breakTime: 'Pause',
    todayMinutes: 'Min heute',
    concentrate: 'Konzentriere dich',
    takeRest: 'Mach eine Pause',
    gratitude: 'Dankbarkeit',
    today: 'heute',
    whatAreYouGratefulFor: 'Wofür bist du heute dankbar?',
    iAmGratefulFor: 'Ich bin dankbar für...',
    save: 'Speichern',
    cancel: 'Abbrechen',
    recentEntries: 'Letzte Einträge',
    thisWeek: 'Diese Woche',
    statistics: 'Statistiken',
    monthlyOverview: 'Monatsübersicht',
    moodEntries: 'Stimmungseinträge',
    focusMinutes: 'Fokusminuten',
    achievements: 'Erfolge',
    currentStreak: 'Aktuelle Serie',
    daysInRow: 'Tage am Stück',
    totalFocus: 'Gesamtfokus',
    allTime: 'Alle Zeit',
    habitsCompleted: 'Gewohnheiten abgeschlossen',
    totalTimes: 'Insgesamt Mal',
    moodDistribution: 'Stimmungsverteilung',
    topHabit: 'Beste Gewohnheit',
    completedTimes2: 'Mal',
    profile: 'Profil',
    yourName: 'Dein Name',
    notifications: 'Benachrichtigungen',
    notificationsComingSoon: 'Benachrichtigungen werden in zukünftigen Updates verfügbar sein.',
    data: 'Daten',
    exportData: 'Daten exportieren',
    comingSoon: 'bald verfügbar',
    resetAllData: 'Alle Daten zurücksetzen',
    areYouSure: 'Bist du sicher?',
    cannotBeUndone: 'Diese Aktion kann nicht rückgängig gemacht werden.',
    delete: 'Löschen',
    premium: 'ZenFlow Premium',
    premiumDescription: 'Schalte erweiterte Analysen, Datenexport und Premium-Themes frei!',
    language: 'Sprache',
    selectLanguage: 'Sprache wählen',
    welcomeTitle: 'Willkommen bei ZenFlow',
    welcomeSubtitle: 'Deine Reise zu einem achtsamen Leben beginnt hier',
    continue: 'Fortfahren',
    version: 'Version',
    tagline: 'Dein Weg zu einem achtsamen Leben 🌿',
    sun: 'So', mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa',
    january: 'Januar', february: 'Februar', march: 'März', april: 'April',
    may: 'Mai', june: 'Juni', july: 'Juli', august: 'August',
    september: 'September', october: 'Oktober', november: 'November', december: 'Dezember',
  },
  
  fr: {
    appName: 'ZenFlow',
    goodMorning: 'Bonjour',
    goodAfternoon: 'Bon après-midi',
    goodEvening: 'Bonsoir',
    home: 'Accueil',
    stats: 'Statistiques',
    settings: 'Paramètres',
    streakDays: 'Série',
    days: 'j',
    habitsToday: 'Habitudes aujourd\'hui',
    focusToday: 'Focus aujourd\'hui',
    minutes: 'minutes',
    min: 'min',
    gratitudes: 'Gratitudes',
    howAreYouFeeling: 'Comment vous sentez-vous?',
    moodToday: 'Humeur aujourd\'hui',
    great: 'Super',
    good: 'Bien',
    okay: 'Correct',
    bad: 'Mal',
    terrible: 'Terrible',
    addNote: 'Ajouter une note (optionnel)...',
    saveMood: 'Sauvegarder l\'humeur',
    habits: 'Habitudes',
    habitName: 'Nom de l\'habitude...',
    icon: 'Icône',
    color: 'Couleur',
    addHabit: 'Ajouter une habitude',
    addFirstHabit: 'Ajoutez votre première habitude! ✨',
    completedTimes: 'Complété',
    focus: 'Focus',
    breakTime: 'Pause',
    todayMinutes: 'min aujourd\'hui',
    concentrate: 'Concentrez-vous',
    takeRest: 'Reposez-vous',
    gratitude: 'Gratitude',
    today: 'aujourd\'hui',
    whatAreYouGratefulFor: 'Pour quoi êtes-vous reconnaissant aujourd\'hui?',
    iAmGratefulFor: 'Je suis reconnaissant pour...',
    save: 'Sauvegarder',
    cancel: 'Annuler',
    recentEntries: 'Entrées récentes',
    thisWeek: 'Cette semaine',
    statistics: 'Statistiques',
    monthlyOverview: 'Aperçu mensuel',
    moodEntries: 'Entrées d\'humeur',
    focusMinutes: 'Minutes de focus',
    achievements: 'Réalisations',
    currentStreak: 'Série actuelle',
    daysInRow: 'Jours consécutifs',
    totalFocus: 'Focus total',
    allTime: 'Tout le temps',
    habitsCompleted: 'Habitudes complétées',
    totalTimes: 'Fois au total',
    moodDistribution: 'Distribution de l\'humeur',
    topHabit: 'Meilleure habitude',
    completedTimes2: 'fois',
    profile: 'Profil',
    yourName: 'Votre nom',
    notifications: 'Notifications',
    notificationsComingSoon: 'Les notifications seront disponibles dans les prochaines mises à jour.',
    data: 'Données',
    exportData: 'Exporter les données',
    comingSoon: 'bientôt',
    resetAllData: 'Réinitialiser toutes les données',
    areYouSure: 'Êtes-vous sûr?',
    cannotBeUndone: 'Cette action ne peut pas être annulée.',
    delete: 'Supprimer',
    premium: 'ZenFlow Premium',
    premiumDescription: 'Débloquez des analyses avancées, l\'export de données et des thèmes premium!',
    language: 'Langue',
    selectLanguage: 'Sélectionner la langue',
    welcomeTitle: 'Bienvenue sur ZenFlow',
    welcomeSubtitle: 'Votre voyage vers une vie consciente commence ici',
    continue: 'Continuer',
    version: 'Version',
    tagline: 'Votre chemin vers une vie consciente 🌿',
    sun: 'Dim', mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam',
    january: 'Janvier', february: 'Février', march: 'Mars', april: 'Avril',
    may: 'Mai', june: 'Juin', july: 'Juillet', august: 'Août',
    september: 'Septembre', october: 'Octobre', november: 'Novembre', december: 'Décembre',
  },
};

export const languageNames: Record<Language, string> = {
  ru: 'Русский',
  en: 'English',
  uk: 'Українська',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
};

export const languageFlags: Record<Language, string> = {
  ru: '🇷🇺',
  en: '🇬🇧',
  uk: '🇺🇦',
  es: '🇪🇸',
  de: '🇩🇪',
  fr: '🇫🇷',
};
