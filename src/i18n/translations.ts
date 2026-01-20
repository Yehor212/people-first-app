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
  howAreYouNow: string;
  moodToday: string;
  moodHistory: string;
  moodRecorded: string;
  moodNotes: string;
  todayProgress: string;
  completed: string;
  updateMood: string;
  great: string;
  good: string;
  okay: string;
  bad: string;
  terrible: string;
  addNote: string;
  saveMood: string;
  startHere: string;
  tapToStart: string;
  moodPrompt: string;
  moodTagsTitle: string;
  moodTagPlaceholder: string;
  moodTagAdd: string;
  moodTagFilter: string;
  allTags: string;
  tagWork: string;
  tagFamily: string;
  tagHealth: string;
  tagSleep: string;
  tagMoney: string;
  tagWeather: string;
  moodPatternsTitle: string;
  moodBestDay: string;
  moodFocusComparison: string;
  moodFocusWith: string;
  moodFocusWithout: string;
  moodHabitCorrelations: string;
  moodNoData: string;
  editMood: string;
  changeMood: string;
  changeMoodConfirmTitle: string;
  changeMoodConfirmMessage: string;
  moodChanged: string;
  confirm: string;
  dailyProgress: string;
  continueProgress: string;
  dayTimeline: string;
  dayComplete: string;
  perfectDay: string;
  startYourDay: string;
  keepGoing: string;
  almostThere: string;
  soClose: string;
  legendaryDay: string;

  // Schedule Timeline
  scheduleTitle: string;
  scheduleAddEvent: string;
  scheduleEmpty: string;
  scheduleEmptyDay: string;
  scheduleStart: string;
  scheduleEnd: string;
  scheduleAdd: string;
  scheduleCustomTitle: string;
  scheduleWork: string;
  scheduleMeal: string;
  scheduleRest: string;
  scheduleExercise: string;
  scheduleStudy: string;
  scheduleMeeting: string;
  scheduleNote: string;
  scheduleNotePlaceholder: string;

  // Time Awareness (ADHD time blindness helper)
  timeUntilEndOfDay: string;
  timeIn: string;
  timePassed: string;
  timeNow: string;
  hoursShort: string;
  minutesShort: string;
  night: string;

  // AI Insights
  aiInsights: string;
  aiInsight: string;
  personalizedForYou: string;
  insightsNeedMoreData: string;
  daysLogged: string;
  showMore: string;
  moreInsights: string;
  hideInsights: string;

  // Onboarding Hints
  hintFirstMoodTitle: string;
  hintFirstMoodDesc: string;
  hintFirstMoodAction: string;
  hintFirstHabitTitle: string;
  hintFirstHabitDesc: string;
  hintFirstHabitAction: string;
  hintFirstFocusTitle: string;
  hintFirstFocusDesc: string;
  hintFirstFocusAction: string;
  hintFirstGratitudeTitle: string;
  hintFirstGratitudeDesc: string;
  hintFirstGratitudeAction: string;
  hintScheduleTipTitle: string;
  hintScheduleTipDesc: string;
  hintScheduleTipAction: string;

  // Habits
  habits: string;
  habitName: string;
  icon: string;
  color: string;
  addHabit: string;
  addFirstHabit: string;
  completedTimes: string;
  habitNameHint: string;
  habitType: string;
  habitTypeDaily: string;
  habitTypeWeekly: string;
  habitTypeFrequency: string;
  habitTypeReduce: string;
  habitWeeklyGoal: string;
  habitFrequencyInterval: string;
  habitReduceLimit: string;
  habitStrictStreak: string;
  habitGraceDays: string;
  habitWeeklyProgress: string;
  habitEvery: string;
  habitReduceProgress: string;
  noHabitsToday: string;
  habitsOther: string;
  habitTypeContinuous: string;
  habitTypeScheduled: string;
  habitTypeMultiple: string;
  habitDailyTarget: string;
  habitStartDate: string;
  habitReminders: string;
  habitAddReminder: string;
  habitReminderTime: string;
  habitReminderDays: string;
  habitReminderEnabled: string;
  habitRemindersPerHabit: string;
  perHabitRemindersTitle: string;
  perHabitRemindersDesc: string;
  quickAdd: string;
  createCustomHabit: string;
  streak: string;

  // Habit Frequency
  habitFrequency: string;
  habitFrequencyOnce: string;
  habitFrequencyDaily: string;
  habitFrequencyWeekly: string;
  habitFrequencyCustom: string;
  habitFrequencySelectDays: string;
  habitDurationRequired: string;
  habitTargetDuration: string;
  habitDurationMinutes: string;

  // Focus timer
  focus: string;
  breakTime: string;
  todayMinutes: string;
  concentrate: string;
  takeRest: string;
  focusPreset25: string;
  focusPreset50: string;
  focusPresetCustom: string;
  focusLabelPrompt: string;
  focusLabelPlaceholder: string;
  focusCustomWork: string;
  focusCustomBreak: string;
  focusReflectionTitle: string;
  focusReflectionQuestion: string;
  focusReflectionSkip: string;
  focusReflectionSave: string;

  // Breathing exercises
  breathingTitle: string;
  breathingSubtitle: string;
  breathingBox: string;
  breathingBoxDesc: string;
  breathing478: string;
  breathing478Desc: string;
  breathingEnergize: string;
  breathingEnergizeDesc: string;
  breathingSleep: string;
  breathingSleepDesc: string;
  breatheIn: string;
  breatheOut: string;
  hold: string;
  cycles: string;
  cycle: string;
  effectCalming: string;
  effectFocusing: string;
  effectEnergizing: string;
  effectSleeping: string;
  startBreathing: string;
  breathingComplete: string;
  breathingCompleteMsg: string;
  breathingAgain: string;
  pause: string;
  resume: string;

  // Gratitude
  gratitude: string;
  today: string;
  tomorrow: string;
  scheduleDate: string;
  whatAreYouGratefulFor: string;
  iAmGratefulFor: string;
  save: string;
  cancel: string;
  recentEntries: string;
  gratitudeTemplate1: string;
  gratitudeTemplate2: string;
  gratitudeTemplate3: string;
  gratitudeLimit: string;
  gratitudeMemoryJar: string;
  
  // Weekly calendar
  thisWeek: string;
  
  // Stats page
  statistics: string;
  monthlyOverview: string;
  statsRange: string;
  statsRangeWeek: string;
  statsRangeMonth: string;
  statsRangeAll: string;
  statsRangeApply: string;
  calendarTitle: string;
  calendarYear: string;
  calendarSelectDay: string;
  calendarPrevMonth: string;
  calendarNextMonth: string;
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
  moodHeatmap: string;
  topHabit: string;
  completedTimes2: string;
  
  // Settings
  profile: string;
  yourName: string;
  nameSaved: string;
  notifications: string;
  notificationsComingSoon: string;
  data: string;
  exportData: string;
  importData: string;
  importMode: string;
  importMerge: string;
  importReplace: string;
  exportSuccess: string;
  exportError: string;
  importSuccess: string;
  importError: string;
  importedItems: string;
  importAdded: string;
  importUpdated: string;
  importSkipped: string;
  comingSoon: string;
  resetAllData: string;
  installApp: string;
  installAppDescription: string;
  installBannerTitle: string;
  installBannerBody: string;
  installNow: string;
  installLater: string;
  appInstalled: string;
  appInstalledDescription: string;
  remindersTitle: string;
  remindersDescription: string;
  moodReminder: string;
  habitReminder: string;
  focusReminder: string;
  quietHours: string;
  reminderDays: string;
  selectedHabits: string;
  noHabitsYet: string;
  reminderMoodTitle: string;
  reminderMoodBody: string;
  reminderHabitTitle: string;
  reminderHabitBody: string;
  reminderFocusTitle: string;
  reminderFocusBody: string;
  reminderDismiss: string;
  notificationPermissionTitle: string;
  notificationPermissionDescription: string;
  notificationFeature1Title: string;
  notificationFeature1Desc: string;
  notificationFeature2Title: string;
  notificationFeature2Desc: string;
  notificationFeature3Title: string;
  notificationFeature3Desc: string;
  notificationAllow: string;
  notificationDeny: string;
  notificationPrivacyNote: string;
  onboardingStep: string;
  onboardingValueTitle: string;
  onboardingValueBody: string;
  onboardingStart: string;
  onboardingExplore: string;
  onboardingGoalTitle: string;
  onboardingGoalLessStress: string;
  onboardingGoalLessStressDesc: string;
  onboardingGoalMoreEnergy: string;
  onboardingGoalMoreEnergyDesc: string;
  onboardingGoalBetterRoutine: string;
  onboardingGoalBetterRoutineDesc: string;
  onboardingContinue: string;
  onboardingCheckinTitle: string;
  onboardingHabitsPrompt: string;
  onboardingPickTwo: string;
  onboardingReminderTitle: string;
  onboardingReminderBody: string;
  onboardingMorning: string;
  onboardingEvening: string;
  onboardingEnable: string;
  onboardingSkip: string;
  onboardingHabitBreathing: string;
  onboardingHabitEveningWalk: string;
  onboardingHabitStretch: string;
  onboardingHabitJournaling: string;
  onboardingHabitWater: string;
  onboardingHabitSunlight: string;
  onboardingHabitMovement: string;
  onboardingHabitSleepOnTime: string;
  onboardingHabitMorningPlan: string;
  onboardingHabitRead: string;
  onboardingHabitNoScreens: string;
  onboardingHabitDailyReview: string;
  account: string;
  accountDescription: string;
  emailPlaceholder: string;
  sendMagicLink: string;
  continueWithGoogle: string;
  signedInAs: string;
  signOut: string;
  syncNow: string;
  cloudSyncDisabled: string;
  deleteAccount: string;
  deleteAccountConfirm: string;
  deleteAccountWarning: string;
  deleteAccountSuccess: string;
  deleteAccountError: string;
  deleteAccountLink: string;
  authEmailSent: string;
  authSignedOut: string;
  authError: string;
  authNotConfigured: string;
  syncSuccess: string;
  syncPulled: string;
  syncPushed: string;
  syncError: string;
  authGateTitle: string;
  authGateBody: string;
  authGateContinue: string;
  errorBoundaryTitle: string;
  errorBoundaryBody: string;
  errorBoundaryExport: string;
  errorBoundaryReload: string;
  pushTitle: string;
  pushEnable: string;
  pushDisable: string;
  pushTest: string;
  pushTestTitle: string;
  pushTestBody: string;
  pushTestSent: string;
  pushTestError: string;
  pushNowMood: string;
  pushNowHabit: string;
  pushNowFocus: string;
  pushEnabled: string;
  pushDisabled: string;
  pushError: string;
  pushNeedsAccount: string;
  pushPermissionDenied: string;
  privacyTitle: string;
  privacyDescription: string;
  privacyNoTracking: string;
  privacyNoTrackingHint: string;
  privacyAnalytics: string;
  privacyAnalyticsHint: string;
  privacyPolicy: string;
  termsOfService: string;

  // GDPR Consent
  consentTitle: string;
  consentDescription: string;
  consentAnalyticsTitle: string;
  consentAnalyticsDesc: string;
  consentAccept: string;
  consentDecline: string;
  consentFooter: string;

  areYouSure: string;
  cannotBeUndone: string;
  delete: string;

  // Social Share
  shareAchievements: string;
  shareTitle: string;
  shareText: string;
  shareButton: string;
  shareDownload: string;
  shareDownloading: string;
  shareCopyLink: string;
  shareCopied: string;
  sharePrivacyNote: string;
  shareStreak: string;
  shareHabits: string;
  shareFocus: string;
  shareGratitude: string;
  shareFooter: string;
  myProgress: string;
  shareSquare: string;
  shareStory: string;
  shareFormatHint: string;

  // Challenges & Badges
  challengesTitle: string;
  challengesSubtitle: string;
  activeChallenges: string;
  availableChallenges: string;
  badges: string;
  noChallengesActive: string;
  noChallengesActiveHint: string;
  progress: string;
  reward: string;
  target: string;
  startChallenge: string;
  challengeActive: string;
  requirement: string;
  challengeTypeStreak: string;
  challengeTypeFocus: string;
  challengeTypeGratitude: string;
  challengeTypeTotal: string;

  // Hyperfocus Mode
  hyperfocusMode: string;
  hyperfocusStart: string;
  hyperfocusPause: string;
  hyperfocusResume: string;
  hyperfocusExit: string;
  hyperfocusReady: string;
  hyperfocusFocusing: string;
  hyperfocusPaused: string;
  hyperfocusTimeLeft: string;
  hyperfocusBreathe: string;
  hyperfocusBreathDesc: string;
  hyperfocusEmergencyConfirm: string;
  hyperfocusAmbientSound: string;
  hyperfocusSoundNone: string;
  hyperfocusSoundWhiteNoise: string;
  hyperfocusSoundRain: string;
  hyperfocusSoundOcean: string;
  hyperfocusSoundForest: string;
  hyperfocusSoundCoffee: string;
  hyperfocusSoundFireplace: string;
  hyperfocusSoundVariants: string;
  hyperfocusShowVariants: string;
  hyperfocusHideVariants: string;
  hyperfocusTip: string;
  hyperfocusTipText: string;
  hyperfocusPauseMsg: string;

  // Widget Settings
  widgetSettings: string;
  widgetSettingsDesc: string;
  widgetPreview: string;
  widgetSetup: string;
  widgetInfo: string;
  widgetInfoDesc: string;
  widgetStatus: string;
  widgetPlatform: string;
  widgetWeb: string;
  widgetSupport: string;
  widgetAvailable: string;
  widgetComingSoon: string;
  widgetSetupiOS: string;
  widgetSetupAndroid: string;
  widgetStep1iOS: string;
  widgetStep2iOS: string;
  widgetStep3iOS: string;
  widgetStep4iOS: string;
  widgetStep5iOS: string;
  widgetStep1Android: string;
  widgetStep2Android: string;
  widgetStep3Android: string;
  widgetStep4Android: string;
  widgetWebWarning: string;
  widgetWebWarningDesc: string;
  widgetWebTip: string;
  widgetFeatures: string;
  widgetFeature1: string;
  widgetFeature2: string;
  widgetFeature3: string;
  widgetFeature4: string;
  widgetFeature5: string;
  widgetSmall: string;
  widgetMedium: string;
  widgetLarge: string;
  widgetNoData: string;
  todayHabits: string;
  lastBadge: string;
  done: string;

  // Dopamine Settings
  dopamineSettings: string;
  dopamineSettingsDesc: string;
  dopamineIntensity: string;
  dopamineMinimal: string;
  dopamineNormal: string;
  dopamineADHD: string;
  dopamineMinimalDesc: string;
  dopamineNormalDesc: string;
  dopamineADHDDesc: string;
  dopamineCustomize: string;
  dopamineAnimations: string;
  dopamineAnimationsDesc: string;
  dopamineSounds: string;
  dopamineSoundsDesc: string;
  dopamineHaptics: string;
  dopamineHapticsDesc: string;
  dopamineConfetti: string;
  dopamineConfettiDesc: string;
  dopamineStreakFire: string;
  dopamineStreakFireDesc: string;
  dopamineTip: string;
  dopamineTipText: string;
  dopamineSave: string;

  // ADHD Hooks
  dailyRewards: string;
  loginStreak: string;
  day: string;
  claim: string;
  claimed: string;
  streakBonus: string;
  dailyRewardsTip: string;
  spinWheel: string;
  spinsAvailable: string;
  spin: string;
  noSpins: string;
  claimPrize: string;
  challengeExpired: string;
  challengeComplete: string;
  earned: string;
  comboText: string;
  mysteryBox: string;
  openBox: string;

  // Inner World Garden
  myCompanion: string;
  missedYou: string;
  welcomeBack: string;
  warmth: string;
  energy: string;
  wisdom: string;
  companionStreak: string;
  chooseCompanion: string;
  levelUpHint: string;
  gardenEmpty: string;
  gardenSprouting: string;
  gardenGrowing: string;
  gardenFlourishing: string;
  gardenMagical: string;
  gardenLegendary: string;

  // Companion Notifications (soft reminders)
  companionMissesYou: string;
  companionWantsToPlay: string;
  companionWaiting: string;
  companionProud: string;
  companionCheersYou: string;
  companionQuickMood: string;  // Quick mood log prompt

  // Companion Panel UI (additional)
  pet: string;
  feed: string;
  talk: string;
  happiness: string;
  satiety: string;

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

  // New translations for onboarding
  welcomeMessage: string;
  featureMood: string;
  featureMoodDescription: string;
  featureHabits: string;
  featureHabitsDescription: string;
  featureFocus: string;
  featureFocusDescription: string;
  privacyNote: string;
  install: string;
  installDescription: string;
  onboardingMoodTitle: string;
  onboardingMoodDescription: string;
  onboardingHabitsTitle: string;
  onboardingHabitsDescription: string;
  onboardingRemindersTitle: string;
  onboardingRemindersDescription: string;
  enableReminders: string;
  morning: string;
  afternoon: string;
  evening: string;
  close: string;
  skip: string;
  getStarted: string;
  next: string;
  remindersActive: string;
  greatChoice: string;
  habitsSelected: string;

  // Welcome Tutorial
  tutorialWelcomeTitle: string;
  tutorialWelcomeSubtitle: string;
  tutorialWelcomeDesc: string;
  tutorialBrainTitle: string;
  tutorialBrainSubtitle: string;
  tutorialBrainDesc: string;
  tutorialFeaturesTitle: string;
  tutorialFeaturesSubtitle: string;
  tutorialFeaturesDesc: string;
  tutorialFeature1: string;
  tutorialFeature2: string;
  tutorialFeature3: string;
  tutorialFeature4: string;
  tutorialMoodTitle: string;
  tutorialMoodSubtitle: string;
  tutorialMoodDesc: string;
  tutorialFocusTitle: string;
  tutorialFocusSubtitle: string;
  tutorialFocusDesc: string;
  tutorialDayClockTitle: string;
  tutorialDayClockSubtitle: string;
  tutorialDayClockDesc: string;
  tutorialDayClockFeature1: string;
  tutorialDayClockFeature2: string;
  tutorialDayClockFeature3: string;
  tutorialDayClockFeature4: string;
  tutorialMoodThemeTitle: string;
  tutorialMoodThemeSubtitle: string;
  tutorialMoodThemeDesc: string;
  tutorialMoodThemeFeature1: string;
  tutorialMoodThemeFeature2: string;
  tutorialMoodThemeFeature3: string;
  tutorialMoodThemeFeature4: string;
  tutorialReadyTitle: string;
  tutorialReadySubtitle: string;
  tutorialReadyDesc: string;
  tutorialStart: string;

  // Weekly Report
  weeklyReport: string;
  incredibleWeek: string;
  pathToMastery: string;
  greatWork: string;
  keepMomentum: string;
  goodProgress: string;
  everyStepCounts: string;
  newWeekOpportunities: string;
  startSmall: string;
  bestDay: string;
  continueBtn: string;

  // Streak Celebration
  dayStreak: string;
  keepItUp: string;

  // Garden / My World tab
  myWorld: string;
  plants: string;
  creatures: string;
  level: string;

  // Streak Banner
  startStreak: string;
  legendaryStreak: string;
  amazingStreak: string;
  goodStart: string;
  todayActivities: string;

  // Companion
  companionPet: string;
  companionFeed: string;
  companionTalk: string;
  companionHappiness: string;
  companionHunger: string;

  // New Companion System
  companionHungryCanFeed: string;
  companionHungryNoTreats: string;
  companionStreakLegend: string;
  companionStreakGood: string;
  companionAskMood: string;
  companionAskHabits: string;
  companionAskFocus: string;
  companionAskGratitude: string;
  companionAllDone: string;
  companionHappy: string;
  companionMorning: string;
  companionAfternoon: string;
  companionEvening: string;
  companionNight: string;
  companionLevelUp: string;
  companionNeedsFood: string;
  petReaction1: string;
  petReaction2: string;
  petReaction3: string;
  petReaction4: string;
  feedReaction1: string;
  feedReaction2: string;
  feedReaction3: string;
  feedReaction4: string;
  feedNotEnough: string;
  free: string;
  fullness: string;
  earnTreatsHint: string;

  // Seasonal Tree System
  myTree: string;
  touch: string;
  water: string;
  waterLevel: string;
  growth: string;
  stage: string;
  treeThirstyCanWater: string;
  treeThirstyNoTreats: string;
  treeStreakLegend: string;
  treeStreakGood: string;
  treeMaxStage: string;
  treeStage4: string;
  treeStage3: string;
  treeStage2: string;
  treeStage1: string;
  treeHappy: string;
  treeSeason: string;
  treeStageUp: string;
  treeMissedYou: string;
  treeNeedsWater: string;
  waterDecayHint: string;
  seasonTreeHint: string;
  xpToNextStage: string;
  touchReaction1: string;
  touchReaction2: string;
  touchReaction3: string;
  touchReaction4: string;
  waterReaction1: string;
  waterReaction2: string;
  waterReaction3: string;
  waterReaction4: string;
  waterNotEnough: string;

  // Rest Mode
  restDayTitle: string;
  restDayMessage: string;
  restDayButton: string;
  restDayCancel: string;
  daysSaved: string;
  restDaySupportive: string;

  // Task Momentum
  taskMomentum: string;
  taskMomentumDesc: string;
  tasksInARow: string;
  taskNamePlaceholder: string;
  durationMinutes: string;
  interestLevel: string;
  markAsUrgent: string;
  urgent: string;
  addTask: string;
  topRecommendedTasks: string;
  quickWins: string;
  allTasks: string;
  noTasksYet: string;
  addFirstTaskMessage: string;
  addFirstTask: string;
  adhdTaskTips: string;
  taskTip1: string;
  taskTip2: string;
  taskTip3: string;
  taskTip4: string;
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
    howAreYouNow: 'Как вы сейчас?',
    moodToday: 'Настроение сегодня',
    moodHistory: 'История за день',
    moodRecorded: 'Настроение записано!',
    moodNotes: 'Записи настроения',
    todayProgress: 'Прогресс сегодня',
    completed: 'Выполнено!',
    updateMood: 'Обновить',
    great: 'Отлично',
    good: 'Хорошо',
    okay: 'Нормально',
    bad: 'Плохо',
    terrible: 'Ужасно',
    addNote: 'Добавьте заметку (необязательно)...',
    saveMood: 'Сохранить настроение',
    startHere: 'Начни здесь',
    tapToStart: 'Нажми на эмодзи, чтобы начать день',
    moodPrompt: 'Что повлияло на настроение?',
    moodTagsTitle: 'Теги',
    moodTagPlaceholder: 'Добавить тег...',
    moodTagAdd: 'Добавить',
    moodTagFilter: 'Фильтр по тегу',
    allTags: 'Все теги',
    tagWork: 'Работа',
    tagFamily: 'Семья',
    tagHealth: 'Здоровье',
    tagSleep: 'Сон',
    tagMoney: 'Финансы',
    tagWeather: 'Погода',
    moodPatternsTitle: 'Паттерны настроения',
    moodBestDay: 'Лучший день недели',
    moodFocusComparison: 'Настроение и фокус',
    moodFocusWith: 'С фокус-сессиями',
    moodFocusWithout: 'Без фокуса',
    moodHabitCorrelations: 'Привычки и настроение',
    moodNoData: 'Недостаточно данных',
    editMood: 'Изменить настроение',
    changeMood: 'Изменить настроение',
    changeMoodConfirmTitle: 'Изменить настроение?',
    changeMoodConfirmMessage: 'Вы уверены, что хотите изменить своё настроение?',
    moodChanged: 'Настроение обновлено!',
    confirm: 'Изменить',
    dailyProgress: 'Прогресс за день',
    continueProgress: 'Продолжить',
    dayTimeline: 'Твой день',
    dayComplete: 'дня прошло',
    perfectDay: 'Идеальный день!',
    startYourDay: 'Начни свой день! 🌅',
    keepGoing: 'Продолжай! Ты молодец 💪',
    almostThere: 'Почти на месте! 🚀',
    soClose: 'Так близко к совершенству! ⭐',
    legendaryDay: 'ЛЕГЕНДАРНЫЙ ДЕНЬ! 🏆🔥✨',

    // Schedule Timeline
    scheduleTitle: 'Ваше расписание',
    scheduleAddEvent: 'Добавить событие',
    scheduleEmpty: 'Нет запланированных событий. Нажмите + чтобы добавить!',
    scheduleEmptyDay: 'Нет событий на этот день',
    scheduleStart: 'Начало',
    scheduleEnd: 'Конец',
    scheduleAdd: 'Добавить в расписание',
    scheduleCustomTitle: 'Своё название (опционально)',
    scheduleWork: 'Работа',
    scheduleMeal: 'Еда',
    scheduleRest: 'Отдых',
    scheduleExercise: 'Спорт',
    scheduleStudy: 'Учёба',
    scheduleMeeting: 'Встреча',
    scheduleNote: 'Заметка (опционально)',
    scheduleNotePlaceholder: 'Добавьте детали или напоминания...',

    // Time Awareness (ADHD time blindness helper)
    timeUntilEndOfDay: 'До конца дня',
    timeIn: 'через',
    timePassed: 'Время прошло',
    timeNow: 'Сейчас!',
    hoursShort: 'ч',
    minutesShort: 'м',
    night: 'Ночь',

    // AI Insights
    aiInsights: 'AI Аналитика',
    aiInsight: 'AI Инсайт',
    personalizedForYou: 'Персонально для вас',
    insightsNeedMoreData: 'Записывайте настроение неделю, чтобы разблокировать персональные инсайты!',
    daysLogged: 'дней записано',
    showMore: 'Показать ещё',
    moreInsights: 'инсайтов',
    hideInsights: 'Скрыть инсайты',

    // Onboarding Hints
    hintFirstMoodTitle: 'Как вы себя чувствуете?',
    hintFirstMoodDesc: 'Начните день с записи настроения. Это займёт 5 секунд и поможет лучше понять себя!',
    hintFirstMoodAction: 'Записать настроение',
    hintFirstHabitTitle: 'Создайте первую привычку',
    hintFirstHabitDesc: 'Маленькие привычки ведут к большим переменам. Попробуйте добавить что-то простое, например "Выпить воду".',
    hintFirstHabitAction: 'Добавить привычку',
    hintFirstFocusTitle: 'Готовы сфокусироваться?',
    hintFirstFocusDesc: 'Используйте таймер фокуса с успокаивающими звуками. Начните с 25 минут!',
    hintFirstFocusAction: 'Начать фокус',
    hintFirstGratitudeTitle: 'Практикуйте благодарность',
    hintFirstGratitudeDesc: 'Запишите одну вещь, за которую вы благодарны. Это мощный способ поднять настроение!',
    hintFirstGratitudeAction: 'Добавить благодарность',
    hintScheduleTipTitle: 'Спланируйте день',
    hintScheduleTipDesc: 'Используйте таймлайн чтобы видеть свой день. Добавляйте события чтобы не сбиваться!',
    hintScheduleTipAction: 'Смотреть таймлайн',

    habits: 'Привычки',
    habitName: 'Название привычки...',
    icon: 'Иконка',
    color: 'Цвет',
    addHabit: 'Добавить привычку',
    addFirstHabit: 'Добавьте свою первую привычку! ✨',
    completedTimes: 'Выполнено',
    habitNameHint: 'Введите название привычки, чтобы добавить.',
    habitType: 'Тип привычки',
    habitTypeDaily: 'Ежедневная',
    habitTypeWeekly: 'Цель за неделю',
    habitTypeFrequency: 'Каждые N дней',
    habitTypeReduce: 'Снизить (лимит)',
    habitWeeklyGoal: 'Цель в неделю (раз)',
    habitFrequencyInterval: 'Интервал (дней)',
    habitReduceLimit: 'Лимит в день',
    habitStrictStreak: 'Строгая серия',
    habitGraceDays: 'Грейс-дней в неделю',
    habitWeeklyProgress: 'На этой неделе',
    habitEvery: 'Каждые',
    habitReduceProgress: 'Сегодня',
    noHabitsToday: 'На сегодня привычек нет.',
    habitsOther: 'Другие привычки',
    habitTypeContinuous: 'Непрерывная (бросить)',
    habitTypeScheduled: 'По расписанию',
    habitTypeMultiple: 'Несколько раз в день',
    habitDailyTarget: 'Цель на день',
    habitStartDate: 'Дата начала',
    habitReminders: 'Напоминания',
    habitAddReminder: 'Добавить напоминание',
    habitReminderTime: 'Время',
    habitReminderDays: 'Дни недели',
    habitReminderEnabled: 'Включено',
    habitRemindersPerHabit: 'Напоминания теперь настраиваются индивидуально для каждой привычки. Добавьте напоминания при создании или редактировании привычек.',
    perHabitRemindersTitle: 'Индивидуальные напоминания',
    perHabitRemindersDesc: 'Каждая привычка может иметь свои собственные настраиваемые времена напоминаний. Установите их при создании новой привычки или редактировании существующей.',
    quickAdd: 'Быстро добавить',
    createCustomHabit: 'Создать свою привычку',
    streak: 'серия',

    // Habit Frequency
    habitFrequency: 'Частота',
    habitFrequencyOnce: 'Один раз',
    habitFrequencyDaily: 'Ежедневно',
    habitFrequencyWeekly: 'Еженедельно',
    habitFrequencyCustom: 'Свои дни',
    habitFrequencySelectDays: 'Выберите дни',
    habitDurationRequired: 'Требует времени?',
    habitTargetDuration: 'Целевое время (минуты)',
    habitDurationMinutes: 'минут',

    focus: 'Фокус',
    breakTime: 'Перерыв',
    todayMinutes: 'мин сегодня',
    concentrate: 'Сконцентрируйтесь',
    takeRest: 'Отдохните',
    focusPreset25: '25/5',
    focusPreset50: '50/10',
    focusPresetCustom: 'Кастом',
    focusLabelPrompt: 'На чём фокус?',
    focusLabelPlaceholder: 'Например: Отчёт, Учёба, Проект...',
    focusCustomWork: 'Работа (мин)',
    focusCustomBreak: 'Перерыв (мин)',
    focusReflectionTitle: 'Рефлексия',
    focusReflectionQuestion: 'Как прошла сессия?',
    focusReflectionSkip: 'Пропустить',
    focusReflectionSave: 'Сохранить',

    // Breathing
    breathingTitle: 'Дыхание',
    breathingSubtitle: 'Успокой разум',
    breathingBox: 'Квадратное дыхание',
    breathingBoxDesc: 'Равные фазы для фокуса',
    breathing478: '4-7-8 Расслабление',
    breathing478Desc: 'Глубокое успокоение',
    breathingEnergize: 'Энергетическое',
    breathingEnergizeDesc: 'Заряд бодрости',
    breathingSleep: 'Перед сном',
    breathingSleepDesc: 'Медленное для сна',
    breatheIn: 'Вдох',
    breatheOut: 'Выдох',
    hold: 'Задержка',
    cycles: 'циклов',
    cycle: 'Цикл',
    effectCalming: 'Спокойствие',
    effectFocusing: 'Фокус',
    effectEnergizing: 'Энергия',
    effectSleeping: 'Сон',
    startBreathing: 'Начать',
    breathingComplete: 'Отлично!',
    breathingCompleteMsg: 'Вы завершили дыхательное упражнение',
    breathingAgain: 'Ещё раз',
    pause: 'Пауза',
    resume: 'Продолжить',
    gratitude: 'Благодарность',
    today: 'сегодня',
    tomorrow: 'завтра',
    scheduleDate: 'Дата',
    whatAreYouGratefulFor: 'За что вы благодарны сегодня?',
    iAmGratefulFor: 'Я благодарен за...',
    save: 'Сохранить',
    cancel: 'Отмена',
    recentEntries: 'Недавние записи',
    gratitudeTemplate1: 'Сегодня я благодарен за...',
    gratitudeTemplate2: 'Хороший момент дня...',
    gratitudeTemplate3: 'Я ценю в себе...',
    gratitudeLimit: 'До 3 пунктов в день',
    gratitudeMemoryJar: 'Памятная запись',
    thisWeek: 'Эта неделя',
    statistics: 'Статистика',
    monthlyOverview: 'Обзор месяца',
    statsRange: 'Период',
    statsRangeWeek: 'Неделя',
    statsRangeMonth: 'Месяц',
    statsRangeAll: 'Всё время',
    statsRangeApply: 'Применить',
    calendarTitle: 'Календарь',
    calendarYear: 'Год',
    calendarSelectDay: 'Выберите день',
    calendarPrevMonth: 'Предыдущий месяц',
    calendarNextMonth: 'Следующий месяц',
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
    moodHeatmap: 'Календарь настроения',
    topHabit: 'Лучшая привычка',
    completedTimes2: 'раз',
    profile: 'Профиль',
    yourName: 'Ваше имя',
    nameSaved: 'Имя сохранено',
    notifications: 'Уведомления',
    notificationsComingSoon: 'Уведомления будут доступны в следующих обновлениях.',
    data: 'Данные',
    exportData: 'Экспорт данных',
    importData: 'Импорт данных',
    importMode: 'Режим импорта',
    importMerge: 'Объединить',
    importReplace: 'Заменить',
    exportSuccess: 'Экспорт готов.',
    exportError: 'Не удалось экспортировать данные.',
    importSuccess: 'Импорт завершён.',
    importError: 'Не удалось импортировать файл.',
    importedItems: 'Добавлено',
    importAdded: 'добавлено',
    importUpdated: 'обновлено',
    importSkipped: 'пропущено',
    comingSoon: 'скоро',
    resetAllData: 'Сбросить все данные',
    privacyTitle: 'Приватность',
    privacyDescription: 'Данные остаются на устройстве. Без скрытого трекинга.',
    privacyNoTracking: 'Без трекинга',
    privacyNoTrackingHint: 'Мы не собираем поведенческие данные.',
    privacyAnalytics: 'Аналитика',
    privacyAnalyticsHint: 'Помогает улучшать приложение. Можно отключить.',
    privacyPolicy: 'Политика конфиденциальности',
    termsOfService: 'Условия использования',

    // GDPR Consent
    consentTitle: 'Настройки приватности',
    consentDescription: 'Мы уважаем вашу приватность. Разрешить анонимную аналитику для улучшения приложения?',
    consentAnalyticsTitle: 'Анонимная аналитика',
    consentAnalyticsDesc: 'Только паттерны использования. Без личных данных. Можно изменить в настройках.',
    consentAccept: 'Разрешить',
    consentDecline: 'Нет, спасибо',
    consentFooter: 'Можно изменить в любое время в Настройки > Приватность',

    installApp: 'Установить приложение',
    installAppDescription: 'Установите ZenFlow для быстрого запуска и офлайн-доступа.',
    installBannerTitle: 'Установите ZenFlow',
    installBannerBody: 'Быстрый запуск и офлайн-доступ после установки.',
    installNow: 'Установить',
    installLater: 'Позже',
    appInstalled: 'Приложение установлено',
    appInstalledDescription: 'ZenFlow установлен на вашем устройстве.',
    remindersTitle: 'Напоминания',
    remindersDescription: 'Мягкие напоминания, чтобы не сбиваться с курса.',
    moodReminder: 'Время для отметки настроения',
    habitReminder: 'Время напоминаний о привычках',
    focusReminder: 'Время фокус-сессии',
    quietHours: 'Тихие часы',
    reminderDays: 'Дни недели',
    selectedHabits: 'Привычки для напоминаний',
    noHabitsYet: 'Пока нет привычек.',
    reminderMoodTitle: 'Проверка настроения',
    reminderMoodBody: 'Потратьте 30 секунд и отметьте, как вы себя чувствуете.',
    reminderHabitTitle: 'Напоминание о привычках',
    reminderHabitBody: 'Время проверить привычки:',
    reminderFocusTitle: 'Фокус-сессия',
    reminderFocusBody: 'Готовы к фокус-сессии?',
    reminderDismiss: 'Скрыть',
    notificationPermissionTitle: 'Оставайтесь на пути к цели',
    notificationPermissionDescription: 'Получайте напоминания для отслеживания настроения, выполнения привычек и перерывов. Уведомления помогают строить здоровые привычки.',
    notificationFeature1Title: 'Ежедневные напоминания о настроении',
    notificationFeature1Desc: 'Отмечайте свое состояние каждый день',
    notificationFeature2Title: 'Отслеживание привычек',
    notificationFeature2Desc: 'Будьте последовательны в достижении целей',
    notificationFeature3Title: 'Сессии фокуса',
    notificationFeature3Desc: 'Напоминания о продуктивных перерывах',
    notificationAllow: 'Включить уведомления',
    notificationDeny: 'Может быть позже',
    notificationPrivacyNote: 'Вы можете изменить это в любое время в настройках. Уведомления локальные и приватные.',
    onboardingStep: 'Шаг',
    onboardingValueTitle: 'Трекер настроения и привычек за 30 секунд в день',
    onboardingValueBody: 'Быстрые чек-ины, без лишнего, всё приватно.',
    onboardingStart: 'Старт за 30 сек',
    onboardingExplore: 'Посмотреть',
    onboardingGoalTitle: 'Выберите цель',
    onboardingGoalLessStress: 'Меньше стресса',
    onboardingGoalLessStressDesc: 'Спокойствие и мягкие привычки',
    onboardingGoalMoreEnergy: 'Больше энергии',
    onboardingGoalMoreEnergyDesc: 'Сон, движение, вода',
    onboardingGoalBetterRoutine: 'Лучший режим',
    onboardingGoalBetterRoutineDesc: 'Стабильность и ритм',
    onboardingContinue: 'Далее',
    onboardingCheckinTitle: 'Быстрый чек-ин',
    onboardingHabitsPrompt: 'Выберите 2 привычки',
    onboardingPickTwo: 'Можно выбрать только две',
    onboardingReminderTitle: 'Включить напоминания',
    onboardingReminderBody: 'Выберите удобное время. Никакого спама.',
    onboardingMorning: 'Утро',
    onboardingEvening: 'Вечер',
    onboardingEnable: 'Включить',
    onboardingSkip: 'Пока нет',
    onboardingHabitBreathing: 'Дыхание',
    onboardingHabitEveningWalk: 'Вечерняя прогулка',
    onboardingHabitStretch: 'Растяжка',
    onboardingHabitJournaling: 'Дневник',
    onboardingHabitWater: 'Вода',
    onboardingHabitSunlight: 'Свет и воздух',
    onboardingHabitMovement: 'Движение',
    onboardingHabitSleepOnTime: 'Сон вовремя',
    onboardingHabitMorningPlan: 'План на утро',
    onboardingHabitRead: 'Чтение 10 мин',
    onboardingHabitNoScreens: 'Без экранов поздно',
    onboardingHabitDailyReview: 'Итоги дня',
    account: 'Аккаунт',
    accountDescription: 'Вход по почте, чтобы синхронизировать прогресс между устройствами.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Отправить ссылку',
    continueWithGoogle: 'Войти через Google',
    signedInAs: 'Вы вошли как',
    signOut: 'Выйти',
    syncNow: 'Синхронизировать',
    cloudSyncDisabled: 'Облачная синхронизация отключена.',
    deleteAccount: 'Удалить аккаунт',
    deleteAccountConfirm: 'Удалить аккаунт?',
    deleteAccountWarning: 'Будут удалены облачные данные и доступ к аккаунту.',
    deleteAccountSuccess: 'Аккаунт удалён.',
    deleteAccountError: 'Не удалось удалить аккаунт.',
    deleteAccountLink: 'Как удалить аккаунт и данные',
    authEmailSent: 'Ссылка для входа отправлена на почту.',
    authSignedOut: 'Вы вышли из аккаунта.',
    authError: 'Не удалось отправить ссылку.',
    authNotConfigured: 'Supabase не настроен.',
    syncSuccess: 'Синхронизация завершена.',
    syncPulled: 'Данные восстановлены из облака.',
    syncPushed: 'Облако обновлено.',
    syncError: 'Не удалось синхронизировать.',
    authGateTitle: 'Вход в аккаунт',
    authGateBody: 'Войдите по почте, чтобы сохранять прогресс и синхронизировать между устройствами.',
    authGateContinue: 'Продолжить без аккаунта',
    errorBoundaryTitle: 'Что-то пошло не так',
    errorBoundaryBody: 'Попробуйте перезагрузить приложение или отправить отчёт.',
    errorBoundaryExport: 'Экспортировать отчёт',
    errorBoundaryReload: 'Перезагрузить приложение',
    pushTitle: 'Push-уведомления',
    pushEnable: 'Включить push',
    pushDisable: 'Выключить push',
    pushTest: 'Тест push',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Тестовое уведомление.',
    pushTestSent: 'Тест отправлен.',
    pushTestError: 'Не удалось отправить тест.',
    pushNowMood: 'Пуш: настроение',
    pushNowHabit: 'Пуш: привычки',
    pushNowFocus: 'Пуш: фокус',
    pushEnabled: 'Push включены.',
    pushDisabled: 'Push выключены.',
    pushError: 'Не удалось включить push.',
    pushNeedsAccount: 'Войдите в аккаунт, чтобы включить push.',
    pushPermissionDenied: 'Разрешение на уведомления отклонено.',
    areYouSure: 'Вы уверены?',
    cannotBeUndone: 'Это действие нельзя отменить.',
    delete: 'Удалить',
    shareAchievements: 'Поделиться прогрессом',
    shareTitle: 'Мой прогресс в ZenFlow',
    shareText: '{streak} дней подряд! {habits} привычек выполнено, {focus} минут фокуса.',
    shareButton: 'Поделиться',
    shareDownload: 'Скачать изображение',
    shareDownloading: 'Скачивается...',
    shareCopyLink: 'Скопировать ссылку',
    shareCopied: 'Скопировано!',
    sharePrivacyNote: 'Личные данные не передаются. Только сводка прогресса.',
    shareStreak: 'Дней подряд',
    shareHabits: 'Привычек',
    shareFocus: 'Минут',
    shareGratitude: 'Благодарностей',
    shareFooter: 'Отслеживай привычки, настроение и фокус',
    myProgress: 'Мой прогресс',
    shareSquare: 'Пост 1:1',
    shareStory: 'Сторис 9:16',
    shareFormatHint: '📱 Формат сторис для Instagram/TikTok • Формат поста для лент',
    challengesTitle: 'Челленджи и награды',
    challengesSubtitle: 'Принимайте вызовы и зарабатывайте бейджи',
    activeChallenges: 'Активные',
    availableChallenges: 'Доступные',
    badges: 'Награды',
    noChallengesActive: 'Нет активных челленджей',
    noChallengesActiveHint: 'Начните челлендж, чтобы отслеживать свой прогресс',
    progress: 'Прогресс',
    reward: 'Награда',
    target: 'Цель',
    startChallenge: 'Начать челлендж',
    challengeActive: 'Активен',
    requirement: 'Требование',
    challengeTypeStreak: 'Стрик',
    challengeTypeFocus: 'Фокус',
    challengeTypeGratitude: 'Благодарность',
    challengeTypeTotal: 'Всего',
    hyperfocusMode: 'Режим гиперфокуса',
    hyperfocusStart: 'Начать',
    hyperfocusPause: 'Пауза',
    hyperfocusResume: 'Продолжить',
    hyperfocusExit: 'Выход',
    hyperfocusReady: 'Готовы к гиперфокусу?',
    hyperfocusFocusing: 'В зоне фокуса...',
    hyperfocusPaused: 'Приостановлено',
    hyperfocusTimeLeft: 'осталось',
    hyperfocusBreathe: 'Дышите...',
    hyperfocusBreathDesc: 'Вдох 4 сек • Выдох 4 сек',
    hyperfocusEmergencyConfirm: 'Хотите приостановить сессию? Без чувства вины! 💜',
    hyperfocusAmbientSound: 'Фоновый звук',
    hyperfocusSoundNone: 'Без звука',
    hyperfocusSoundWhiteNoise: 'Белый шум',
    hyperfocusSoundRain: 'Дождь',
    hyperfocusSoundOcean: 'Океан',
    hyperfocusSoundForest: 'Лес',
    hyperfocusSoundCoffee: 'Кафе',
    hyperfocusSoundFireplace: 'Костёр',
    hyperfocusSoundVariants: 'Варианты звука',
    hyperfocusShowVariants: 'Показать варианты',
    hyperfocusHideVariants: 'Скрыть варианты',
    hyperfocusTip: 'Совет',
    hyperfocusTipText: 'Каждые 25 минут будет короткая дыхательная пауза. Это помогает избежать выгорания!',
    hyperfocusPauseMsg: 'Нажмите Play, чтобы продолжить',

    // Widget Settings
    widgetSettings: 'Настройки виджетов',
    widgetSettingsDesc: 'Настройте виджеты для домашнего экрана',
    widgetPreview: 'Превью',
    widgetSetup: 'Установка',
    widgetInfo: 'Виджеты обновляются автоматически',
    widgetInfoDesc: 'Данные в виджетах синхронизируются каждый раз, когда вы обновляете привычки, завершаете фокус-сессию или получаете новый бейдж.',
    widgetStatus: 'Статус виджетов',
    widgetPlatform: 'Платформа',
    widgetWeb: 'Web (виджеты недоступны)',
    widgetSupport: 'Поддержка виджетов',
    widgetAvailable: 'Доступны',
    widgetComingSoon: 'Скоро',
    widgetSetupiOS: 'Установка виджета на iOS',
    widgetSetupAndroid: 'Установка виджета на Android',
    widgetStep1iOS: 'Долгое нажатие на домашнем экране, пока иконки не начнут трястись',
    widgetStep2iOS: 'Нажмите "+" в левом верхнем углу',
    widgetStep3iOS: 'Найдите "ZenFlow" в списке приложений',
    widgetStep4iOS: 'Выберите размер виджета (маленький, средний или большой)',
    widgetStep5iOS: 'Нажмите "Добавить виджет"',
    widgetStep1Android: 'Долгое нажатие на пустом месте домашнего экрана',
    widgetStep2Android: 'Нажмите "Виджеты" в появившемся меню',
    widgetStep3Android: 'Найдите "ZenFlow" в списке приложений',
    widgetStep4Android: 'Перетащите виджет нужного размера на домашний экран',
    widgetWebWarning: 'Виджеты недоступны в веб-версии',
    widgetWebWarningDesc: 'Виджеты работают только на мобильных устройствах (iOS и Android). Установите мобильное приложение, чтобы использовать виджеты.',
    widgetWebTip: 'Веб-версия отображает превью виджетов, чтобы вы могли видеть, как они будут выглядеть на мобильном устройстве.',
    widgetFeatures: 'Возможности виджетов',
    widgetFeature1: 'Отображение текущего стрика дней подряд',
    widgetFeature2: 'Прогресс выполнения привычек за сегодня',
    widgetFeature3: 'Количество минут фокус-сессий',
    widgetFeature4: 'Последний полученный бейдж',
    widgetFeature5: 'Список привычек с отметками выполнения',
    widgetSmall: 'Маленький виджет',
    widgetMedium: 'Средний виджет',
    widgetLarge: 'Большой виджет',
    widgetNoData: 'Нет данных для виджета',
    todayHabits: 'Привычки на сегодня',
    lastBadge: 'Последний бейдж',
    done: 'готово',

    dopamineSettings: 'Dopamine Dashboard',
    dopamineSettingsDesc: 'Настройте уровень обратной связи',
    dopamineIntensity: 'Уровень интенсивности',
    dopamineMinimal: 'Минимум',
    dopamineNormal: 'Норма',
    dopamineADHD: 'СДВГ',
    dopamineMinimalDesc: 'Спокойный опыт без отвлечений',
    dopamineNormalDesc: 'Сбалансированная обратная связь',
    dopamineADHDDesc: 'Максимум допамина! Все эффекты включены 🎉',
    dopamineCustomize: 'Точная настройка',
    dopamineAnimations: 'Анимации',
    dopamineAnimationsDesc: 'Плавные переходы и эффекты',
    dopamineSounds: 'Звуки',
    dopamineSoundsDesc: 'Звуки успеха и обратная связь',
    dopamineHaptics: 'Вибрация',
    dopamineHapticsDesc: 'Тактильная обратная связь (только на мобильном)',
    dopamineConfetti: 'Конфетти',
    dopamineConfettiDesc: 'Празднуйте завершение привычек',
    dopamineStreakFire: 'Огонь стрика',
    dopamineStreakFireDesc: 'Анимация огня для стриков',
    dopamineTip: 'Совет для СДВГ',
    dopamineTipText: 'Мозгу с СДВГ нужно больше допамина! Попробуйте режим СДВГ для максимальной мотивации. Можно настроить отдельные параметры.',
    dopamineSave: 'Сохранить и закрыть',
    dailyRewards: 'Ежедневные награды',
    loginStreak: 'Дней подряд',
    day: 'День',
    claim: 'Забрать!',
    claimed: 'Получено',
    streakBonus: 'Бонус за серию',
    dailyRewardsTip: 'Заходи каждый день за лучшими наградами!',
    spinWheel: 'Крути колесо!',
    spinsAvailable: 'Вращений доступно',
    spin: 'КРУТИТЬ',
    noSpins: 'Нет вращений',
    claimPrize: 'Забрать приз!',
    challengeExpired: 'Испытание истекло',
    challengeComplete: 'Испытание выполнено!',
    earned: 'заработано',
    comboText: 'КОМБО',
    mysteryBox: 'Сундук',
    openBox: 'Открыть',
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

    // Onboarding
    welcomeMessage: 'Добро пожаловать в ZenFlow!',
    featureMood: 'Отслеживание настроения',
    featureMoodDescription: 'Записывайте своё настроение каждый день',
    featureHabits: 'Привычки',
    featureHabitsDescription: 'Создавайте и отслеживайте полезные привычки',
    featureFocus: 'Фокус-сессии',
    featureFocusDescription: 'Концентрируйтесь с помощью таймера Pomodoro',
    privacyNote: 'Ваши данные хранятся локально и защищены',
    install: 'Установить приложение',
    installDescription: 'Установите ZenFlow на домашний экран',
    onboardingMoodTitle: 'Как вы себя чувствуете?',
    onboardingMoodDescription: 'Отслеживайте своё настроение ежедневно',
    onboardingHabitsTitle: 'Создайте свои первые привычки',
    onboardingHabitsDescription: 'Начните с небольших шагов',
    onboardingRemindersTitle: 'Напоминания',
    onboardingRemindersDescription: 'Получайте напоминания о привычках',
    enableReminders: 'Включить напоминания',
    morning: 'Утро',
    afternoon: 'День',
    evening: 'Вечер',
    close: 'Закрыть',
    skip: 'Пропустить',
    getStarted: 'Начать',
    next: 'Далее',
    remindersActive: 'Напоминания активны',
    greatChoice: 'Отличный выбор!',
    habitsSelected: 'привычек выбрано',

    // Welcome Tutorial
    tutorialWelcomeTitle: 'Добро пожаловать в ZenFlow',
    tutorialWelcomeSubtitle: 'Ваш персональный помощник для продуктивности',
    tutorialWelcomeDesc: 'Приложение, созданное чтобы помочь вам сохранять фокус, формировать полезные привычки и чувствовать себя лучше каждый день.',
    tutorialBrainTitle: 'Создано для вашего мозга',
    tutorialBrainSubtitle: 'Есть СДВГ или просто сложно сосредоточиться?',
    tutorialBrainDesc: 'ZenFlow использует научно обоснованные техники для управления вниманием, временем и энергией. Диагноз не нужен — если вам сложно концентрироваться, это приложение для вас.',
    tutorialFeaturesTitle: 'Что вы можете делать',
    tutorialFeaturesSubtitle: 'Простые инструменты, большой эффект',
    tutorialFeaturesDesc: 'Отслеживайте прогресс и набирайте обороты:',
    tutorialFeature1: 'Отслеживание настроения и энергии',
    tutorialFeature2: 'Формирование привычек шаг за шагом',
    tutorialFeature3: 'Сессии фокуса с фоновыми звуками',
    tutorialFeature4: 'Дневник благодарности',
    tutorialMoodTitle: 'Понимайте себя лучше',
    tutorialMoodSubtitle: 'Отслеживайте настроение, находите паттерны',
    tutorialMoodDesc: 'Быстрые ежедневные отметки помогут заметить, что влияет на вашу энергию и фокус. Со временем вы лучше поймёте себя.',
    tutorialFocusTitle: 'Режим глубокого фокуса',
    tutorialFocusSubtitle: 'Блокируйте отвлечения, делайте дела',
    tutorialFocusDesc: 'Используйте технику Помодоро с успокаивающими фоновыми звуками. Идеально для работы, учёбы или творчества.',
    tutorialDayClockTitle: 'Ваш день на одном экране',
    tutorialDayClockSubtitle: 'Визуальный энергометр для СДВГ мозга',
    tutorialDayClockDesc: 'Смотрите на свой день как на круг с утром, днём и вечером. Наблюдайте, как растёт ваша энергия с каждым действием!',
    tutorialDayClockFeature1: '⚡ Энергометр заполняется с прогрессом',
    tutorialDayClockFeature2: '😊 Маскот реагирует на ваши достижения',
    tutorialDayClockFeature3: '🎯 Отслеживайте все активности в одном месте',
    tutorialDayClockFeature4: '🏆 Достигните 100% для Идеального Дня!',
    tutorialMoodThemeTitle: 'Приложение адаптируется под вас',
    tutorialMoodThemeSubtitle: 'Дизайн меняется с вашим настроением',
    tutorialMoodThemeDesc: 'Когда вам хорошо, приложение празднует яркими цветами. Когда грустно — становится спокойным и поддерживающим.',
    tutorialMoodThemeFeature1: '😄 Отличное настроение: Яркий фиолетовый и золотой',
    tutorialMoodThemeFeature2: '🙂 Хорошее настроение: Тёплые зелёные тона',
    tutorialMoodThemeFeature3: '😔 Плохое настроение: Успокаивающий синий',
    tutorialMoodThemeFeature4: '😢 Тяжёлые времена: Мягкий, минималистичный дизайн',
    tutorialReadyTitle: 'Готовы начать?',
    tutorialReadySubtitle: 'Ваш путь начинается сейчас',
    tutorialReadyDesc: 'Начните с малого — просто отметьте, как вы себя чувствуете сегодня. Каждый шаг важен!',
    tutorialStart: 'Поехали!',

    // Weekly Report
    weeklyReport: 'Недельный отчет',
    incredibleWeek: 'Невероятная неделя!',
    pathToMastery: 'Вы на пути к мастерству!',
    greatWork: 'Отличная работа!',
    keepMomentum: 'Продолжайте в том же духе!',
    goodProgress: 'Хороший прогресс!',
    everyStepCounts: 'Каждый шаг имеет значение!',
    newWeekOpportunities: 'Новая неделя - новые возможности!',
    startSmall: 'Начните с малого, двигайтесь вперед!',
    bestDay: 'Лучший день',
    continueBtn: 'Продолжить',

    // Streak Celebration
    dayStreak: 'дней подряд',
    keepItUp: 'Так держать!',

    // Inner World Garden
    myCompanion: 'Мой компаньон',
    missedYou: 'скучал по тебе!',
    welcomeBack: 'С возвращением в твой сад',
    warmth: 'Тепло',
    energy: 'Энергия',
    wisdom: 'Мудрость',
    companionStreak: 'Дней подряд!',
    chooseCompanion: 'Выбери компаньона',
    levelUpHint: 'Выполняй активности, чтобы получать XP и повышать уровень!',
    pet: 'Погладить',
    feed: 'Покормить',
    talk: 'Поговорить',
    happiness: 'Счастье',
    satiety: 'Сытость',
    gardenEmpty: 'Новое начало',
    gardenSprouting: 'Ростки',
    gardenGrowing: 'Рост',
    gardenFlourishing: 'Цветение',
    gardenMagical: 'Магия',
    gardenLegendary: 'Легенда',

    // Companion Notifications
    companionMissesYou: 'скучает по тебе! 💕',
    companionWantsToPlay: 'хочет провести время вместе!',
    companionWaiting: 'ждёт тебя в саду 🌱',
    companionProud: 'гордится тобой! ⭐',
    companionCheersYou: 'болеет за тебя! 💪',
    companionQuickMood: 'Как настроение? Нажми! 😊',

    // Garden / My World
    myWorld: 'Мой мир',
    plants: 'Растений',
    creatures: 'Существ',
    level: 'Уровень',

    // Streak Banner
    startStreak: 'Начни серию сегодня!',
    legendaryStreak: 'Легендарная серия!',
    amazingStreak: 'Потрясающе!',
    goodStart: 'Отличное начало!',
    todayActivities: 'Сегодня',

    // Companion
    companionPet: 'Погладить',
    companionFeed: 'Покормить',
    companionTalk: 'Поговорить',
    companionHappiness: 'Счастье',
    companionHunger: 'Сытость',

    // New Companion System
    companionHungryCanFeed: '🥺 Я голодный... Покорми меня?',
    companionHungryNoTreats: '🥺 Я голодный... Выполняй активности чтобы заработать вкусняшки!',
    companionStreakLegend: '🏆 {streak} дней! Ты легенда!',
    companionStreakGood: '🔥 {streak} дней! Так держать!',
    companionAskMood: '💜 Как ты себя чувствуешь сегодня?',
    companionAskHabits: '🎯 Время для привычек!',
    companionAskFocus: '🧠 Готов сфокусироваться?',
    companionAskGratitude: '💖 За что ты благодарен сегодня?',
    companionAllDone: '🏆 Идеальный день! Ты молодец!',
    companionHappy: '💕 Я тебя люблю!',
    companionMorning: '☀️ Доброе утро!',
    companionAfternoon: '🌤️ Как проходит твой день?',
    companionEvening: '🌙 Добрый вечер!',
    companionNight: '💤 Zzz...',
    companionLevelUp: '🎉 Новый уровень! Теперь {level}!',
    companionNeedsFood: 'Твой компаньон голоден!',
    petReaction1: '💕 *мурр*',
    petReaction2: '✨ Как приятно!',
    petReaction3: '😊 Спасибо!',
    petReaction4: '💖 Люблю тебя!',
    feedReaction1: '🍪 Вкусно!',
    feedReaction2: '😋 Объедение!',
    feedReaction3: '✨ Спасибо!',
    feedReaction4: '💪 Энергия!',
    feedNotEnough: '🍪 Нужно {needed} вкусняшек, есть {have}',
    free: 'Бесплатно',
    fullness: 'Сытость',
    earnTreatsHint: 'Выполняй активности чтобы зарабатывать вкусняшки для питомца!',

    // Seasonal Tree System
    myTree: 'Моё дерево',
    touch: 'Потрогать',
    water: 'Полить',
    waterLevel: 'Уровень воды',
    growth: 'Рост',
    stage: 'Стадия',
    treeThirstyCanWater: '💧 Дерево хочет пить...',
    treeThirstyNoTreats: '🥀 Жажда... Выполняй активности чтобы заработать вкусняшки!',
    treeStreakLegend: '🌟 {streak} дней! Дерево сияет!',
    treeStreakGood: '✨ {streak} дней! Растёт сильным!',
    treeMaxStage: '🌳 Великолепное великое дерево!',
    treeStage4: '🌲 Красивое взрослое дерево!',
    treeStage3: '🌿 Растёт в крепкий саженец!',
    treeStage2: '🌱 Молодой росток тянется к свету!',
    treeStage1: '🌰 Маленькое семечко полное потенциала!',
    treeHappy: '💚 Дерево процветает!',
    treeSeason: '{emoji} Прекрасная {season}!',
    treeStageUp: '🎉 Эволюция в {stage}!',
    treeMissedYou: 'Твоё дерево скучало по тебе!',
    treeNeedsWater: 'Дереву нужна вода!',
    waterDecayHint: 'Уровень воды падает -2% в час',
    seasonTreeHint: 'Дерево меняется со сменой сезонов!',
    xpToNextStage: '{xp} XP до {stage}',
    touchReaction1: '✨ *шелест листьев*',
    touchReaction2: '🍃 Листья танцуют!',
    touchReaction3: '💚 Чувствую жизнь!',
    touchReaction4: '🌿 Расту сильнее!',
    waterReaction1: '💧 *впитывает воду*',
    waterReaction2: '🌊 Освежает!',
    waterReaction3: '💦 Спасибо!',
    waterReaction4: '✨ Расту!',
    waterNotEnough: '🍪 Нужно {needed} вкусняшек, есть {have}',

    // Rest Mode
    restDayTitle: 'День отдыха',
    restDayMessage: 'Отдыхай, твой стрик в безопасности',
    restDayButton: 'День отдыха',
    restDayCancel: 'Всё-таки хочу записать',
    daysSaved: 'дней сохранено',
    restDaySupportive: 'Завтра продолжим вместе 💚',

    // Task Momentum
    taskMomentum: 'Задачи',
    taskMomentumDesc: 'СДВГ-дружелюбная приоритизация',
    tasksInARow: 'задач подряд',
    taskNamePlaceholder: 'Название задачи...',
    durationMinutes: 'Длительность (мин)',
    interestLevel: 'Интерес (1-10)',
    markAsUrgent: 'Срочная задача',
    urgent: 'Срочно',
    addTask: 'Добавить',
    topRecommendedTasks: 'Топ-3 рекомендуемых',
    quickWins: 'Быстрые победы (до 2 мин)',
    allTasks: 'Все задачи',
    noTasksYet: 'Пока нет задач',
    addFirstTaskMessage: 'Добавьте первую задачу для начала!',
    addFirstTask: 'Добавить задачу',
    adhdTaskTips: 'СДВГ советы',
    taskTip1: 'Начните с быстрых задач (2-5 мин)',
    taskTip2: 'Наращивайте момент последовательными выполнениями',
    taskTip3: 'Интересные задачи дают больше дофамина',
    taskTip4: 'Срочное + короткое = идеальная комбинация',
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
    howAreYouNow: 'How are you now?',
    moodToday: 'Mood today',
    moodHistory: 'Today\'s history',
    moodRecorded: 'Mood Recorded!',
    moodNotes: 'Mood Notes',
    todayProgress: "Today's Progress",
    completed: 'Completed!',
    updateMood: 'Update',
    great: 'Great',
    good: 'Good',
    okay: 'Okay',
    bad: 'Bad',
    terrible: 'Terrible',
    addNote: 'Add a note (optional)...',
    saveMood: 'Save mood',
    startHere: 'Start here',
    tapToStart: 'Tap an emoji to start your day',
    moodPrompt: 'What influenced it?',
    moodTagsTitle: 'Tags',
    moodTagPlaceholder: 'Add a tag...',
    moodTagAdd: 'Add',
    moodTagFilter: 'Filter by tag',
    allTags: 'All tags',
    tagWork: 'Work',
    tagFamily: 'Family',
    tagHealth: 'Health',
    tagSleep: 'Sleep',
    tagMoney: 'Money',
    tagWeather: 'Weather',
    moodPatternsTitle: 'Mood patterns',
    moodBestDay: 'Best weekday',
    moodFocusComparison: 'Mood vs focus',
    moodFocusWith: 'With focus sessions',
    moodFocusWithout: 'Without focus',
    moodHabitCorrelations: 'Habits vs mood',
    moodNoData: 'Not enough data',
    editMood: 'Edit mood',
    changeMood: 'Change mood',
    changeMoodConfirmTitle: 'Change mood?',
    changeMoodConfirmMessage: 'Are you sure you want to change your mood?',
    moodChanged: 'Mood updated!',
    confirm: 'Change',
    dailyProgress: 'Daily Progress',
    continueProgress: 'Continue your progress',
    dayTimeline: 'Your Day',
    dayComplete: 'of day',
    perfectDay: 'Perfect Day!',
    startYourDay: 'Start your day! 🌅',
    keepGoing: "Keep going! You're doing great 💪",
    almostThere: 'Almost there! 🚀',
    soClose: 'So close to perfection! ⭐',
    legendaryDay: 'LEGENDARY DAY! 🏆🔥✨',

    // Schedule Timeline
    scheduleTitle: 'Your Schedule',
    scheduleAddEvent: 'Add Event',
    scheduleEmpty: 'No events planned. Tap + to add your schedule!',
    scheduleEmptyDay: 'No events for this day',
    scheduleStart: 'Start',
    scheduleEnd: 'End',
    scheduleAdd: 'Add to Schedule',
    scheduleCustomTitle: 'Custom title (optional)',
    scheduleWork: 'Work',
    scheduleMeal: 'Meal',
    scheduleRest: 'Rest',
    scheduleExercise: 'Exercise',
    scheduleStudy: 'Study',
    scheduleMeeting: 'Meeting',
    scheduleNote: 'Note (optional)',
    scheduleNotePlaceholder: 'Add details or reminders...',

    // Time Awareness (ADHD time blindness helper)
    timeUntilEndOfDay: 'Until end of day',
    timeIn: 'in',
    timePassed: 'Time passed',
    timeNow: 'Now!',
    hoursShort: 'h',
    minutesShort: 'm',
    night: 'Night',

    // AI Insights
    aiInsights: 'AI Insights',
    aiInsight: 'AI Insight',
    personalizedForYou: 'Personalized for you',
    insightsNeedMoreData: 'Log your mood for a week to unlock personalized insights!',
    daysLogged: 'days logged',
    showMore: 'Show',
    moreInsights: 'more insights',
    hideInsights: 'Hide insights',

    // Onboarding Hints
    hintFirstMoodTitle: 'How are you feeling?',
    hintFirstMoodDesc: 'Start your day by logging your mood. It takes just 5 seconds and helps you understand yourself better!',
    hintFirstMoodAction: 'Log mood',
    hintFirstHabitTitle: 'Build your first habit',
    hintFirstHabitDesc: "Small habits lead to big changes. Try adding something simple like 'Drink water' or 'Take a break'.",
    hintFirstHabitAction: 'Add habit',
    hintFirstFocusTitle: 'Ready to focus?',
    hintFirstFocusDesc: 'Use the focus timer with calming sounds. Start with just 25 minutes - your brain will thank you!',
    hintFirstFocusAction: 'Start focus',
    hintFirstGratitudeTitle: 'Practice gratitude',
    hintFirstGratitudeDesc: "Write down one thing you're grateful for. It's a powerful mood booster!",
    hintFirstGratitudeAction: 'Add gratitude',
    hintScheduleTipTitle: 'Plan your day',
    hintScheduleTipDesc: 'Use the timeline to see your day at a glance. Add events to stay on track!',
    hintScheduleTipAction: 'View timeline',

    habits: 'Habits',
    habitName: 'Habit name...',
    icon: 'Icon',
    color: 'Color',
    addHabit: 'Add habit',
    addFirstHabit: 'Add your first habit! ✨',
    completedTimes: 'Completed',
    habitNameHint: 'Enter a habit name to add it.',
    habitType: 'Habit type',
    habitTypeDaily: 'Daily',
    habitTypeWeekly: 'Weekly goal',
    habitTypeFrequency: 'Every N days',
    habitTypeReduce: 'Reduce (limit)',
    habitWeeklyGoal: 'Weekly goal (times)',
    habitFrequencyInterval: 'Interval (days)',
    habitReduceLimit: 'Daily limit',
    habitStrictStreak: 'Strict streak',
    habitGraceDays: 'Grace days per week',
    habitWeeklyProgress: 'This week',
    habitEvery: 'Every',
    habitReduceProgress: 'Today',
    noHabitsToday: 'No habits today.',
    habitsOther: 'Other habits',
    habitTypeContinuous: 'Continuous (quit)',
    habitTypeScheduled: 'Scheduled',
    habitTypeMultiple: 'Multiple times per day',
    habitDailyTarget: 'Daily target',
    habitStartDate: 'Start date',
    habitReminders: 'Reminders',
    habitAddReminder: 'Add reminder',
    habitReminderTime: 'Time',
    habitReminderDays: 'Days of week',
    habitReminderEnabled: 'Enabled',
    habitRemindersPerHabit: 'Reminders are now configured individually for each habit. Add reminders when creating or editing habits.',
    perHabitRemindersTitle: 'Per-Habit Reminders',
    perHabitRemindersDesc: 'Each habit can have its own custom reminder times. Set them when creating a new habit or editing an existing one.',
    quickAdd: 'Quick Add',
    createCustomHabit: 'Create custom habit',
    streak: 'streak',

    // Habit Frequency
    habitFrequency: 'Frequency',
    habitFrequencyOnce: 'One-time',
    habitFrequencyDaily: 'Daily',
    habitFrequencyWeekly: 'Weekly',
    habitFrequencyCustom: 'Custom',
    habitFrequencySelectDays: 'Select Days',
    habitDurationRequired: 'Requires Duration?',
    habitTargetDuration: 'Target Duration (minutes)',
    habitDurationMinutes: 'minutes',

    focus: 'Focus',
    breakTime: 'Break',
    todayMinutes: 'min today',
    concentrate: 'Concentrate',
    takeRest: 'Take a rest',
    focusPreset25: '25/5',
    focusPreset50: '50/10',
    focusPresetCustom: 'Custom',
    focusLabelPrompt: 'What are you focusing on?',
    focusLabelPlaceholder: 'e.g. Report, Study, Project...',
    focusCustomWork: 'Work (min)',
    focusCustomBreak: 'Break (min)',
    focusReflectionTitle: 'Reflection',
    focusReflectionQuestion: 'How was the session?',
    focusReflectionSkip: 'Skip',
    focusReflectionSave: 'Save',

    // Breathing
    breathingTitle: 'Breathing',
    breathingSubtitle: 'Calm your mind',
    breathingBox: 'Box Breathing',
    breathingBoxDesc: 'Equal phases for focus',
    breathing478: '4-7-8 Relaxing',
    breathing478Desc: 'Deep calming breath',
    breathingEnergize: 'Energizing Breath',
    breathingEnergizeDesc: 'Quick energy boost',
    breathingSleep: 'Sleep Preparation',
    breathingSleepDesc: 'Slow exhales for sleep',
    breatheIn: 'Breathe in',
    breatheOut: 'Breathe out',
    hold: 'Hold',
    cycles: 'cycles',
    cycle: 'Cycle',
    effectCalming: 'Calming',
    effectFocusing: 'Focus',
    effectEnergizing: 'Energy',
    effectSleeping: 'Sleep',
    startBreathing: 'Start',
    breathingComplete: 'Well done!',
    breathingCompleteMsg: 'You completed the breathing exercise',
    breathingAgain: 'Do again',
    pause: 'Pause',
    resume: 'Resume',
    gratitude: 'Gratitude',
    today: 'today',
    tomorrow: 'tomorrow',
    scheduleDate: 'Date',
    whatAreYouGratefulFor: 'What are you grateful for today?',
    iAmGratefulFor: 'I am grateful for...',
    save: 'Save',
    cancel: 'Cancel',
    recentEntries: 'Recent entries',
    gratitudeTemplate1: 'Today I am grateful for...',
    gratitudeTemplate2: 'A good moment today...',
    gratitudeTemplate3: 'I appreciate in myself...',
    gratitudeLimit: 'Up to 3 items per day',
    gratitudeMemoryJar: 'Memory jar',
    thisWeek: 'This week',
    statistics: 'Statistics',
    monthlyOverview: 'Monthly overview',
    statsRange: 'Range',
    statsRangeWeek: 'Week',
    statsRangeMonth: 'Month',
    statsRangeAll: 'All time',
    statsRangeApply: 'Apply',
    calendarTitle: 'Calendar',
    calendarYear: 'Year',
    calendarSelectDay: 'Select a day',
    calendarPrevMonth: 'Previous month',
    calendarNextMonth: 'Next month',
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
    moodHeatmap: 'Mood heatmap',
    topHabit: 'Top habit',
    completedTimes2: 'times',
    profile: 'Profile',
    yourName: 'Your name',
    nameSaved: 'Name saved',
    notifications: 'Notifications',
    notificationsComingSoon: 'Notifications will be available in future updates.',
    data: 'Data',
    exportData: 'Export data',
    importData: 'Import data',
    importMode: 'Import mode',
    importMerge: 'Merge',
    importReplace: 'Replace',
    exportSuccess: 'Export ready.',
    exportError: 'Failed to export data.',
    importSuccess: 'Import complete.',
    importError: 'Failed to import file.',
    importedItems: 'Added',
    importAdded: 'added',
    importUpdated: 'updated',
    importSkipped: 'skipped',
    comingSoon: 'coming soon',
    resetAllData: 'Reset all data',
    privacyTitle: 'Privacy',
    privacyDescription: 'Your data stays on device. No hidden tracking.',
    privacyNoTracking: 'No tracking',
    privacyNoTrackingHint: 'We do not collect behavioral data.',
    privacyAnalytics: 'Analytics',
    privacyAnalyticsHint: 'Helps improve the app. You can turn it off.',
    privacyPolicy: 'Privacy policy',
    termsOfService: 'Terms of service',

    // GDPR Consent
    consentTitle: 'Privacy Settings',
    consentDescription: 'We respect your privacy. Help us improve the app by allowing anonymous analytics?',
    consentAnalyticsTitle: 'Anonymous Analytics',
    consentAnalyticsDesc: 'Usage patterns only. No personal data. You can change this anytime in Settings.',
    consentAccept: 'Allow',
    consentDecline: 'No thanks',
    consentFooter: 'You can change this anytime in Settings > Privacy',

    installApp: 'Install app',
    installAppDescription: 'Install ZenFlow for faster launch and offline access.',
    installBannerTitle: 'Install ZenFlow',
    installBannerBody: 'Get faster launch and offline access by installing the app.',
    installNow: 'Install',
    installLater: 'Later',
    appInstalled: 'App installed',
    appInstalledDescription: 'ZenFlow is installed on your device.',
    remindersTitle: 'Reminders',
    remindersDescription: 'Gentle reminders to keep you on track.',
    moodReminder: 'Mood check-in time',
    habitReminder: 'Habit reminder time',
    focusReminder: 'Focus nudge time',
    quietHours: 'Quiet hours',
    reminderDays: 'Days of week',
    selectedHabits: 'Habits to remind',
    noHabitsYet: 'No habits yet.',
    reminderMoodTitle: 'Mood check-in',
    reminderMoodBody: 'Take 30 seconds to log how you feel.',
    reminderHabitTitle: 'Habit reminder',
    reminderHabitBody: 'Time to check your habits:',
    reminderFocusTitle: 'Focus nudge',
    reminderFocusBody: 'Ready for a focused session?',
    reminderDismiss: 'Dismiss',
    notificationPermissionTitle: 'Stay on Track',
    notificationPermissionDescription: 'Get gentle reminders to track your mood, complete habits, and take focus breaks. Notifications help you build healthy routines.',
    notificationFeature1Title: 'Daily Mood Reminders',
    notificationFeature1Desc: 'Check in with yourself every day',
    notificationFeature2Title: 'Habit Tracking',
    notificationFeature2Desc: 'Stay consistent with your goals',
    notificationFeature3Title: 'Focus Sessions',
    notificationFeature3Desc: 'Get reminded to take productive breaks',
    notificationAllow: 'Enable Notifications',
    notificationDeny: 'Maybe Later',
    notificationPrivacyNote: 'You can change this anytime in Settings. Notifications are local and private.',
    onboardingStep: 'Step',
    onboardingValueTitle: 'Track mood + habits in 30 seconds a day',
    onboardingValueBody: 'Quick check-ins, zero clutter, fully private.',
    onboardingStart: 'Start in 30 sec',
    onboardingExplore: 'Explore',
    onboardingGoalTitle: 'Pick your focus',
    onboardingGoalLessStress: 'Less stress',
    onboardingGoalLessStressDesc: 'Calm and gentle habits',
    onboardingGoalMoreEnergy: 'More energy',
    onboardingGoalMoreEnergyDesc: 'Sleep, movement, hydration',
    onboardingGoalBetterRoutine: 'Better routine',
    onboardingGoalBetterRoutineDesc: 'Stability and rhythm',
    onboardingContinue: 'Continue',
    onboardingCheckinTitle: 'Quick check-in',
    onboardingHabitsPrompt: 'Choose two habits',
    onboardingPickTwo: 'Pick up to two',
    onboardingReminderTitle: 'Enable reminders',
    onboardingReminderBody: 'Choose a time that fits you. No spam.',
    onboardingMorning: 'Morning',
    onboardingEvening: 'Evening',
    onboardingEnable: 'Enable',
    onboardingSkip: 'Skip for now',
    onboardingHabitBreathing: 'Breathing',
    onboardingHabitEveningWalk: 'Evening walk',
    onboardingHabitStretch: 'Stretch',
    onboardingHabitJournaling: 'Journaling',
    onboardingHabitWater: 'Water',
    onboardingHabitSunlight: 'Sunlight',
    onboardingHabitMovement: 'Movement',
    onboardingHabitSleepOnTime: 'Sleep on time',
    onboardingHabitMorningPlan: 'Morning plan',
    onboardingHabitRead: 'Read 10 min',
    onboardingHabitNoScreens: 'No late screens',
    onboardingHabitDailyReview: 'Daily review',
    account: 'Account',
    accountDescription: 'Sign in by email to sync progress across devices.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Send magic link',
    continueWithGoogle: 'Continue with Google',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    syncNow: 'Sync now',
    cloudSyncDisabled: 'Cloud sync disabled.',
    deleteAccount: 'Delete account',
    deleteAccountConfirm: 'Delete your account?',
    deleteAccountWarning: 'This will remove cloud data and access to your account.',
    deleteAccountSuccess: 'Account deleted.',
    deleteAccountError: 'Failed to delete account.',
    deleteAccountLink: 'How to delete account/data',
    authEmailSent: 'Login link sent to your email.',
    authSignedOut: 'Signed out.',
    authError: 'Failed to send link.',
    authNotConfigured: 'Supabase not configured.',
    syncSuccess: 'Sync complete.',
    syncPulled: 'Cloud data restored.',
    syncPushed: 'Cloud updated.',
    syncError: 'Sync failed.',
    authGateTitle: 'Sign in',
    authGateBody: 'Sign in by email to save progress and sync across devices.',
    authGateContinue: 'Continue without account',
    errorBoundaryTitle: 'Something went wrong',
    errorBoundaryBody: 'Try reloading the app or export a debug report.',
    errorBoundaryExport: 'Export debug report',
    errorBoundaryReload: 'Reload app',
    pushTitle: 'Push notifications',
    pushEnable: 'Enable push',
    pushDisable: 'Disable push',
    pushTest: 'Test push',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Test notification.',
    pushTestSent: 'Test sent.',
    pushTestError: 'Failed to send test.',
    pushNowMood: 'Push: mood',
    pushNowHabit: 'Push: habits',
    pushNowFocus: 'Push: focus',
    pushEnabled: 'Push enabled.',
    pushDisabled: 'Push disabled.',
    pushError: 'Failed to enable push.',
    pushNeedsAccount: 'Sign in to enable push.',
    pushPermissionDenied: 'Notification permission denied.',
    areYouSure: 'Are you sure?',
    cannotBeUndone: 'This action cannot be undone.',
    delete: 'Delete',
    shareAchievements: 'Share Your Progress',
    shareTitle: 'My Progress on ZenFlow',
    shareText: '{streak} day streak! {habits} habits completed, {focus} minutes of focus.',
    shareButton: 'Share',
    shareDownload: 'Download Image',
    shareDownloading: 'Downloading...',
    shareCopyLink: 'Copy Link',
    shareCopied: 'Copied!',
    sharePrivacyNote: 'No personal data is shared. Only your progress summary.',
    shareStreak: 'Day Streak',
    shareHabits: 'Habits',
    shareFocus: 'Minutes',
    shareGratitude: 'Gratitudes',
    shareFooter: 'Track your habits, mood & focus',
    myProgress: 'My Progress',
    shareSquare: 'Post 1:1',
    shareStory: 'Story 9:16',
    shareFormatHint: '📱 Story format for Instagram/TikTok • Post format for feeds',
    challengesTitle: 'Challenges & Badges',
    challengesSubtitle: 'Take on challenges and earn badges',
    activeChallenges: 'Active',
    availableChallenges: 'Available',
    badges: 'Badges',
    noChallengesActive: 'No Active Challenges',
    noChallengesActiveHint: 'Start a challenge to track your progress',
    progress: 'Progress',
    reward: 'Reward',
    target: 'Target',
    startChallenge: 'Start Challenge',
    challengeActive: 'Active',
    requirement: 'Requirement',
    challengeTypeStreak: 'Streak',
    challengeTypeFocus: 'Focus',
    challengeTypeGratitude: 'Gratitude',
    challengeTypeTotal: 'Total',
    hyperfocusMode: 'Hyperfocus Mode',
    hyperfocusStart: 'Start',
    hyperfocusPause: 'Pause',
    hyperfocusResume: 'Resume',
    hyperfocusExit: 'Exit',
    hyperfocusReady: 'Ready for hyperfocus?',
    hyperfocusFocusing: 'In the zone...',
    hyperfocusPaused: 'Paused',
    hyperfocusTimeLeft: 'left',
    hyperfocusBreathe: 'Breathe...',
    hyperfocusBreathDesc: 'Inhale 4s • Exhale 4s',
    hyperfocusEmergencyConfirm: 'Want to pause the session? No guilt! 💜',
    hyperfocusAmbientSound: 'Ambient Sound',
    hyperfocusSoundNone: 'None',
    hyperfocusSoundWhiteNoise: 'White Noise',
    hyperfocusSoundRain: 'Rain',
    hyperfocusSoundOcean: 'Ocean',
    hyperfocusSoundForest: 'Forest',
    hyperfocusSoundCoffee: 'Coffee Shop',
    hyperfocusSoundFireplace: 'Fireplace',
    hyperfocusSoundVariants: 'Sound variants',
    hyperfocusShowVariants: 'Show variants',
    hyperfocusHideVariants: 'Hide variants',
    hyperfocusTip: 'Tip',
    hyperfocusTipText: 'Every 25 minutes there will be a short breathing pause. This helps prevent burnout!',
    hyperfocusPauseMsg: 'Press Play to continue',

    // Widget Settings
    widgetSettings: 'Widget Settings',
    widgetSettingsDesc: 'Configure widgets for your home screen',
    widgetPreview: 'Preview',
    widgetSetup: 'Setup',
    widgetInfo: 'Widgets update automatically',
    widgetInfoDesc: 'Widget data syncs whenever you update habits, complete focus sessions, or earn new badges.',
    widgetStatus: 'Widget Status',
    widgetPlatform: 'Platform',
    widgetWeb: 'Web (widgets unavailable)',
    widgetSupport: 'Widget Support',
    widgetAvailable: 'Available',
    widgetComingSoon: 'Coming Soon',
    widgetSetupiOS: 'iOS Widget Setup',
    widgetSetupAndroid: 'Android Widget Setup',
    widgetStep1iOS: 'Long press on home screen until icons wiggle',
    widgetStep2iOS: 'Tap "+" in the top left corner',
    widgetStep3iOS: 'Find "ZenFlow" in the app list',
    widgetStep4iOS: 'Choose widget size (small, medium, or large)',
    widgetStep5iOS: 'Tap "Add Widget"',
    widgetStep1Android: 'Long press on empty space on home screen',
    widgetStep2Android: 'Tap "Widgets" in the menu',
    widgetStep3Android: 'Find "ZenFlow" in the app list',
    widgetStep4Android: 'Drag the widget to your home screen',
    widgetWebWarning: 'Widgets unavailable in web version',
    widgetWebWarningDesc: 'Widgets only work on mobile devices (iOS and Android). Install the mobile app to use widgets.',
    widgetWebTip: 'Web version shows widget previews so you can see how they look on mobile.',
    widgetFeatures: 'Widget Features',
    widgetFeature1: 'Display current streak days',
    widgetFeature2: 'Today\'s habit completion progress',
    widgetFeature3: 'Focus session minutes',
    widgetFeature4: 'Latest earned badge',
    widgetFeature5: 'Habit list with completion status',
    widgetSmall: 'Small Widget',
    widgetMedium: 'Medium Widget',
    widgetLarge: 'Large Widget',
    widgetNoData: 'No widget data available',
    todayHabits: 'Today\'s Habits',
    lastBadge: 'Latest Badge',
    done: 'done',

    dopamineSettings: 'Dopamine Dashboard',
    dopamineSettingsDesc: 'Customize your feedback experience',
    dopamineIntensity: 'Intensity Level',
    dopamineMinimal: 'Minimal',
    dopamineNormal: 'Normal',
    dopamineADHD: 'ADHD',
    dopamineMinimalDesc: 'Quiet, distraction-free experience',
    dopamineNormalDesc: 'Balanced feedback and motivation',
    dopamineADHDDesc: 'Maximum dopamine! All effects enabled 🎉',
    dopamineCustomize: 'Fine-tune Settings',
    dopamineAnimations: 'Animations',
    dopamineAnimationsDesc: 'Smooth transitions and effects',
    dopamineSounds: 'Sounds',
    dopamineSoundsDesc: 'Success sounds and audio feedback',
    dopamineHaptics: 'Haptics',
    dopamineHapticsDesc: 'Vibration feedback (mobile only)',
    dopamineConfetti: 'Confetti',
    dopamineConfettiDesc: 'Celebrate habit completions',
    dopamineStreakFire: 'Streak Fire',
    dopamineStreakFireDesc: 'Animated fire for streaks',
    dopamineTip: 'ADHD Tip',
    dopamineTipText: 'ADHD brains need more dopamine! Try ADHD mode for maximum motivation and feedback. You can always adjust individual settings.',
    dopamineSave: 'Save & Close',
    dailyRewards: 'Daily Rewards',
    loginStreak: 'Login Streak',
    day: 'Day',
    claim: 'Claim!',
    claimed: 'Claimed',
    streakBonus: 'Streak Bonus',
    dailyRewardsTip: 'Come back every day for better rewards!',
    spinWheel: 'Spin the Wheel!',
    spinsAvailable: 'Spins Available',
    spin: 'SPIN',
    noSpins: 'No Spins Left',
    claimPrize: 'Claim Prize!',
    challengeExpired: 'Challenge Expired',
    challengeComplete: 'Challenge Complete!',
    earned: 'earned',
    comboText: 'COMBO',
    mysteryBox: 'Mystery Box',
    openBox: 'Open',
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

    // Onboarding
    welcomeMessage: 'Welcome to ZenFlow!',
    featureMood: 'Mood tracking',
    featureMoodDescription: 'Track your mood every day',
    featureHabits: 'Habits',
    featureHabitsDescription: 'Create and track healthy habits',
    featureFocus: 'Focus sessions',
    featureFocusDescription: 'Stay focused with Pomodoro timer',
    privacyNote: 'Your data is stored locally and protected',
    install: 'Install app',
    installDescription: 'Install ZenFlow on your home screen',
    onboardingMoodTitle: 'How are you feeling?',
    onboardingMoodDescription: 'Track your mood daily',
    onboardingHabitsTitle: 'Create your first habits',
    onboardingHabitsDescription: 'Start with small steps',
    onboardingRemindersTitle: 'Reminders',
    onboardingRemindersDescription: 'Get reminders for your habits',
    enableReminders: 'Enable reminders',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    close: 'Close',
    skip: 'Skip',
    getStarted: 'Get started',
    next: 'Next',
    remindersActive: 'Reminders active',
    greatChoice: 'Great choice!',
    habitsSelected: 'habits selected',

    // Welcome Tutorial
    tutorialWelcomeTitle: 'Welcome to ZenFlow',
    tutorialWelcomeSubtitle: 'Your personal wellness companion',
    tutorialWelcomeDesc: 'An app designed to help you stay focused, build healthy habits, and feel better every day.',
    tutorialBrainTitle: 'Built for your brain',
    tutorialBrainSubtitle: 'Whether you have ADHD or just struggle with focus',
    tutorialBrainDesc: 'ZenFlow uses science-backed techniques to help you manage attention, time, and energy. No diagnosis needed – if you struggle with focus, this app is for you.',
    tutorialFeaturesTitle: 'What you can do',
    tutorialFeaturesSubtitle: 'Simple tools, big impact',
    tutorialFeaturesDesc: 'Track your progress and build momentum:',
    tutorialFeature1: 'Track daily mood and energy',
    tutorialFeature2: 'Build habits step by step',
    tutorialFeature3: 'Focus sessions with ambient sounds',
    tutorialFeature4: 'Gratitude journaling',
    tutorialMoodTitle: 'Understand yourself',
    tutorialMoodSubtitle: 'Track moods to find patterns',
    tutorialMoodDesc: 'Quick daily check-ins help you notice what affects your energy and focus. Over time, you\'ll understand yourself better.',
    tutorialFocusTitle: 'Deep focus mode',
    tutorialFocusSubtitle: 'Block distractions, get things done',
    tutorialFocusDesc: 'Use the Pomodoro technique with calming ambient sounds. Perfect for work, study, or creative projects.',
    tutorialDayClockTitle: 'Your Day at a Glance',
    tutorialDayClockSubtitle: 'Visual energy meter for ADHD brains',
    tutorialDayClockDesc: 'See your day as a circle with morning, afternoon, and evening zones. Watch your energy grow as you complete activities!',
    tutorialDayClockFeature1: '⚡ Energy meter fills up with progress',
    tutorialDayClockFeature2: '😊 Mascot reacts to your achievements',
    tutorialDayClockFeature3: '🎯 Track all activities in one place',
    tutorialDayClockFeature4: '🏆 Reach 100% for Perfect Day!',
    tutorialMoodThemeTitle: 'App Adapts to You',
    tutorialMoodThemeSubtitle: 'Design changes with your mood',
    tutorialMoodThemeDesc: 'When you feel great, the app celebrates with vibrant colors. When you feel down, it becomes calm and supportive.',
    tutorialMoodThemeFeature1: '😄 Great mood: Vibrant purple & gold',
    tutorialMoodThemeFeature2: '🙂 Good mood: Warm greens',
    tutorialMoodThemeFeature3: '😔 Bad mood: Calming blues',
    tutorialMoodThemeFeature4: '😢 Tough times: Gentle, minimal design',
    tutorialReadyTitle: 'Ready to start?',
    tutorialReadySubtitle: 'Your journey begins now',
    tutorialReadyDesc: 'Start small – just check in with how you\'re feeling today. Every step counts!',
    tutorialStart: 'Let\'s Go!',

    // Weekly Report
    weeklyReport: 'Weekly Report',
    incredibleWeek: 'Incredible Week!',
    pathToMastery: 'You\'re on the path to mastery!',
    greatWork: 'Great Work!',
    keepMomentum: 'Keep up the momentum!',
    goodProgress: 'Good Progress!',
    everyStepCounts: 'Every step counts!',
    newWeekOpportunities: 'New Week - New Opportunities!',
    startSmall: 'Start small, move forward!',
    bestDay: 'Best Day',
    continueBtn: 'Continue',

    // Streak Celebration
    dayStreak: 'day streak',
    keepItUp: 'Keep it up!',

    // Inner World Garden
    myCompanion: 'My Companion',
    missedYou: 'missed you!',
    welcomeBack: 'Welcome back to your garden',
    warmth: 'Warmth',
    energy: 'Energy',
    wisdom: 'Wisdom',
    companionStreak: 'Day Streak!',
    chooseCompanion: 'Choose Companion',
    levelUpHint: 'Complete activities to earn XP and level up!',
    pet: 'Pet',
    feed: 'Feed',
    talk: 'Talk',
    happiness: 'Happiness',
    satiety: 'Fullness',
    gardenEmpty: 'New Beginning',
    gardenSprouting: 'Sprouting',
    gardenGrowing: 'Growing',
    gardenFlourishing: 'Flourishing',
    gardenMagical: 'Magical',
    gardenLegendary: 'Legendary',

    // Companion Notifications
    companionMissesYou: 'misses you! 💕',
    companionWantsToPlay: 'wants to spend time with you!',
    companionWaiting: 'is waiting in the garden 🌱',
    companionProud: 'is proud of you! ⭐',
    companionCheersYou: 'is cheering for you! 💪',
    companionQuickMood: 'How are you feeling? Tap! 😊',

    // Garden / My World
    myWorld: 'My World',
    plants: 'Plants',
    creatures: 'Creatures',
    level: 'Level',

    // Streak Banner
    startStreak: 'Start your streak today!',
    legendaryStreak: 'Legendary streak!',
    amazingStreak: 'Amazing!',
    goodStart: 'Great start!',
    todayActivities: 'Today',

    // Companion
    companionPet: 'Pet',
    companionFeed: 'Feed',
    companionTalk: 'Talk',
    companionHappiness: 'Happiness',
    companionHunger: 'Fullness',

    // New Companion System
    companionHungryCanFeed: '🥺 I\'m hungry... Feed me?',
    companionHungryNoTreats: '🥺 I\'m hungry... Do activities to earn treats!',
    companionStreakLegend: '🏆 {streak} days! You\'re a legend!',
    companionStreakGood: '🔥 {streak} days! Keep it up!',
    companionAskMood: '💜 How are you feeling today?',
    companionAskHabits: '🎯 Time for habits!',
    companionAskFocus: '🧠 Ready to focus?',
    companionAskGratitude: '💖 What are you grateful for?',
    companionAllDone: '🏆 Perfect day! You\'re amazing!',
    companionHappy: '💕 I love you!',
    companionMorning: '☀️ Good morning!',
    companionAfternoon: '🌤️ How\'s your day going?',
    companionEvening: '🌙 Good evening!',
    companionNight: '💤 Zzz...',
    companionLevelUp: '🎉 Level up! Now level {level}!',
    companionNeedsFood: 'Your companion is hungry!',
    petReaction1: '💕 *purr*',
    petReaction2: '✨ That feels nice!',
    petReaction3: '😊 Thank you!',
    petReaction4: '💖 I love you!',
    feedReaction1: '🍪 Yummy!',
    feedReaction2: '😋 Delicious!',
    feedReaction3: '✨ Thank you!',
    feedReaction4: '💪 Energy!',
    feedNotEnough: '🍪 Need {needed} treats, have {have}',
    free: 'Free',
    fullness: 'Fullness',
    earnTreatsHint: 'Complete activities to earn treats for your companion!',

    // Seasonal Tree System
    myTree: 'My Tree',
    touch: 'Touch',
    water: 'Water',
    waterLevel: 'Water Level',
    growth: 'Growth',
    stage: 'Stage',
    treeThirstyCanWater: '💧 The tree needs water...',
    treeThirstyNoTreats: '🥀 Thirsty... Do activities to earn treats!',
    treeStreakLegend: '🌟 {streak} days! The tree is glowing!',
    treeStreakGood: '✨ {streak} days! Growing strong!',
    treeMaxStage: '🌳 A magnificent great tree!',
    treeStage4: '🌲 A beautiful mature tree!',
    treeStage3: '🌿 Growing into a strong sapling!',
    treeStage2: '🌱 A young sprout reaching for light!',
    treeStage1: '🌰 A tiny seed full of potential!',
    treeHappy: '💚 The tree is flourishing!',
    treeSeason: '{emoji} Beautiful {season}!',
    treeStageUp: '🎉 Evolved to {stage}!',
    treeMissedYou: 'Your tree missed you!',
    treeNeedsWater: 'The tree needs water!',
    waterDecayHint: 'Water level decreases -2% per hour',
    seasonTreeHint: 'The tree changes with the seasons!',
    xpToNextStage: '{xp} XP to {stage}',
    touchReaction1: '✨ *rustles leaves*',
    touchReaction2: '🍃 The leaves dance!',
    touchReaction3: '💚 Feels alive!',
    touchReaction4: '🌿 Growing stronger!',
    waterReaction1: '💧 *absorbs water*',
    waterReaction2: '🌊 Refreshing!',
    waterReaction3: '💦 Thank you!',
    waterReaction4: '✨ Growing!',
    waterNotEnough: '🍪 Need {needed} treats, have {have}',

    // Rest Mode
    restDayTitle: 'Rest Day',
    restDayMessage: 'Rest well, your streak is safe',
    restDayButton: 'Rest Day',
    restDayCancel: 'I want to track anyway',
    daysSaved: 'days preserved',
    restDaySupportive: "We'll continue together tomorrow 💚",

    // Task Momentum
    taskMomentum: 'Task Momentum',
    taskMomentumDesc: 'ADHD-friendly task prioritization',
    tasksInARow: 'tasks in a row',
    taskNamePlaceholder: 'Task name...',
    durationMinutes: 'Duration (minutes)',
    interestLevel: 'Interest (1-10)',
    markAsUrgent: 'Mark as urgent',
    urgent: 'Urgent',
    addTask: 'Add Task',
    topRecommendedTasks: 'Top 3 Recommended Tasks',
    quickWins: 'Quick Wins (Under 2 min)',
    allTasks: 'All Tasks',
    noTasksYet: 'No tasks yet',
    addFirstTaskMessage: 'Add your first task to get started with Task Momentum!',
    addFirstTask: 'Add Your First Task',
    adhdTaskTips: 'ADHD Task Tips',
    taskTip1: 'Start with quick wins (2-5 min tasks)',
    taskTip2: 'Build momentum with consecutive completions',
    taskTip3: 'High interest tasks give more dopamine',
    taskTip4: 'Urgent + short = perfect combo',
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
    howAreYouNow: 'Як ви зараз?',
    moodToday: 'Настрій сьогодні',
    moodHistory: 'Історія за день',
    moodRecorded: 'Настрій записано!',
    moodNotes: 'Записи настрою',
    todayProgress: 'Прогрес сьогодні',
    completed: 'Виконано!',
    updateMood: 'Оновити',
    great: 'Чудово',
    good: 'Добре',
    okay: 'Нормально',
    bad: 'Погано',
    terrible: 'Жахливо',
    addNote: 'Додайте нотатку (необов\'язково)...',
    saveMood: 'Зберегти настрій',
    startHere: 'Почни тут',
    tapToStart: 'Натисни на емодзі, щоб почати день',
    moodPrompt: 'Що вплинуло на настрій?',
    moodTagsTitle: 'Теги',
    moodTagPlaceholder: 'Додати тег...',
    moodTagAdd: 'Додати',
    moodTagFilter: 'Фільтр за тегом',
    allTags: 'Усі теги',
    tagWork: 'Робота',
    tagFamily: 'Сім\'я',
    tagHealth: 'Здоров\'я',
    tagSleep: 'Сон',
    tagMoney: 'Фінанси',
    tagWeather: 'Погода',
    moodPatternsTitle: 'Патерни настрою',
    moodBestDay: 'Найкращий день тижня',
    moodFocusComparison: 'Настрій і фокус',
    moodFocusWith: 'З фокус-сесіями',
    moodFocusWithout: 'Без фокусу',
    moodHabitCorrelations: 'Звички і настрій',
    moodNoData: 'Недостатньо даних',
    editMood: 'Змінити настрій',
    changeMood: 'Змінити настрій',
    changeMoodConfirmTitle: 'Змінити настрій?',
    changeMoodConfirmMessage: 'Ви впевнені, що хочете змінити свій настрій?',
    moodChanged: 'Настрій оновлено!',
    confirm: 'Змінити',
    dailyProgress: 'Прогрес за день',
    continueProgress: 'Продовжити',
    dayTimeline: 'Твій день',
    dayComplete: 'дня минуло',
    perfectDay: 'Ідеальний день!',
    startYourDay: 'Почни свій день! 🌅',
    keepGoing: 'Продовжуй! Ти молодець 💪',
    almostThere: 'Майже на місці! 🚀',
    soClose: 'Так близько до досконалості! ⭐',
    legendaryDay: 'ЛЕГЕНДАРНИЙ ДЕНЬ! 🏆🔥✨',

    // Schedule Timeline
    scheduleTitle: 'Ваш розклад',
    scheduleAddEvent: 'Додати подію',
    scheduleEmpty: 'Немає запланованих подій. Натисніть + щоб додати!',
    scheduleEmptyDay: 'Немає подій на цей день',
    scheduleStart: 'Початок',
    scheduleEnd: 'Кінець',
    scheduleAdd: 'Додати до розкладу',
    scheduleCustomTitle: 'Своя назва (опціонально)',
    scheduleWork: 'Робота',
    scheduleMeal: 'Їжа',
    scheduleRest: 'Відпочинок',
    scheduleExercise: 'Спорт',
    scheduleStudy: 'Навчання',
    scheduleMeeting: 'Зустріч',
    scheduleNote: 'Нотатка (опціонально)',
    scheduleNotePlaceholder: 'Додайте деталі або нагадування...',

    // Time Awareness (ADHD time blindness helper)
    timeUntilEndOfDay: 'До кінця дня',
    timeIn: 'через',
    timePassed: 'Час минув',
    timeNow: 'Зараз!',
    hoursShort: 'г',
    minutesShort: 'хв',
    night: 'Ніч',

    // AI Insights
    aiInsights: 'AI Аналітика',
    aiInsight: 'AI Інсайт',
    personalizedForYou: 'Персонально для вас',
    insightsNeedMoreData: 'Записуйте настрій тиждень, щоб розблокувати персональні інсайти!',
    daysLogged: 'днів записано',
    showMore: 'Показати ще',
    moreInsights: 'інсайтів',
    hideInsights: 'Сховати інсайти',

    // Onboarding Hints
    hintFirstMoodTitle: 'Як ви себе почуваєте?',
    hintFirstMoodDesc: 'Почніть день із запису настрою. Це займе 5 секунд і допоможе краще зрозуміти себе!',
    hintFirstMoodAction: 'Записати настрій',
    hintFirstHabitTitle: 'Створіть першу звичку',
    hintFirstHabitDesc: 'Маленькі звички ведуть до великих змін. Спробуйте додати щось просте, наприклад "Випити воду".',
    hintFirstHabitAction: 'Додати звичку',
    hintFirstFocusTitle: 'Готові сфокусуватися?',
    hintFirstFocusDesc: 'Використовуйте таймер фокусу з заспокійливими звуками. Почніть з 25 хвилин!',
    hintFirstFocusAction: 'Почати фокус',
    hintFirstGratitudeTitle: 'Практикуйте вдячність',
    hintFirstGratitudeDesc: 'Запишіть одну річ, за яку ви вдячні. Це потужний спосіб підняти настрій!',
    hintFirstGratitudeAction: 'Додати вдячність',
    hintScheduleTipTitle: 'Сплануйте день',
    hintScheduleTipDesc: 'Використовуйте таймлайн щоб бачити свій день. Додавайте події щоб не збиватися!',
    hintScheduleTipAction: 'Дивитися таймлайн',

    habits: 'Звички',
    habitName: 'Назва звички...',
    icon: 'Іконка',
    color: 'Колір',
    addHabit: 'Додати звичку',
    addFirstHabit: 'Додайте свою першу звичку! ✨',
    completedTimes: 'Виконано',
    habitNameHint: 'Введіть назву звички, щоб додати її.',
    habitType: 'Тип звички',
    habitTypeDaily: 'Щоденна',
    habitTypeWeekly: 'Ціль за тиждень',
    habitTypeFrequency: 'Кожні N днів',
    habitTypeReduce: 'Зменшити (ліміт)',
    habitWeeklyGoal: 'Ціль на тиждень (разів)',
    habitFrequencyInterval: 'Інтервал (днів)',
    habitReduceLimit: 'Ліміт на день',
    habitStrictStreak: 'Строга серія',
    habitGraceDays: 'Грейс-днів на тиждень',
    habitWeeklyProgress: 'Цього тижня',
    habitEvery: 'Кожні',
    habitReduceProgress: 'Сьогодні',
    noHabitsToday: 'На сьогодні звичок немає.',
    habitsOther: 'Інші звички',
    habitTypeContinuous: 'Безперервна (кинути)',
    habitTypeScheduled: 'За розкладом',
    habitTypeMultiple: 'Декілька разів на день',
    habitDailyTarget: 'Мета на день',
    habitStartDate: 'Дата початку',
    habitReminders: 'Нагадування',
    habitAddReminder: 'Додати нагадування',
    habitReminderTime: 'Час',
    habitReminderDays: 'Дні тижня',
    habitReminderEnabled: 'Увімкнено',
    habitRemindersPerHabit: 'Нагадування тепер налаштовуються індивідуально для кожної звички. Додайте нагадування при створенні або редагуванні звичок.',
    perHabitRemindersTitle: 'Індивідуальні нагадування',
    perHabitRemindersDesc: 'Кожна звичка може мати свої власні налаштовані часи нагадувань. Встановіть їх при створенні нової звички або редагуванні існуючої.',
    quickAdd: 'Швидко додати',
    createCustomHabit: 'Створити свою звичку',
    streak: 'серія',

    // Habit Frequency
    habitFrequency: 'Частота',
    habitFrequencyOnce: 'Один раз',
    habitFrequencyDaily: 'Щоденно',
    habitFrequencyWeekly: 'Щотижня',
    habitFrequencyCustom: 'Свої дні',
    habitFrequencySelectDays: 'Оберіть дні',
    habitDurationRequired: 'Потребує часу?',
    habitTargetDuration: 'Цільовий час (хвилини)',
    habitDurationMinutes: 'хвилин',

    focus: 'Фокус',
    breakTime: 'Перерва',
    todayMinutes: 'хв сьогодні',
    concentrate: 'Сконцентруйтесь',
    takeRest: 'Відпочиньте',
    focusPreset25: '25/5',
    focusPreset50: '50/10',
    focusPresetCustom: 'Кастом',
    focusLabelPrompt: 'На чому фокус?',
    focusLabelPlaceholder: 'Напр: Звіт, Навчання, Проєкт...',
    focusCustomWork: 'Робота (хв)',
    focusCustomBreak: 'Перерва (хв)',
    focusReflectionTitle: 'Рефлексія',
    focusReflectionQuestion: 'Як пройшла сесія?',
    focusReflectionSkip: 'Пропустити',
    focusReflectionSave: 'Зберегти',

    // Breathing
    breathingTitle: 'Дихання',
    breathingSubtitle: 'Заспокой розум',
    breathingBox: 'Квадратне дихання',
    breathingBoxDesc: 'Рівні фази для фокусу',
    breathing478: '4-7-8 Розслаблення',
    breathing478Desc: 'Глибоке заспокоєння',
    breathingEnergize: 'Енергетичне',
    breathingEnergizeDesc: 'Заряд бадьорості',
    breathingSleep: 'Перед сном',
    breathingSleepDesc: 'Повільне для сну',
    breatheIn: 'Вдих',
    breatheOut: 'Видих',
    hold: 'Затримка',
    cycles: 'циклів',
    cycle: 'Цикл',
    effectCalming: 'Спокій',
    effectFocusing: 'Фокус',
    effectEnergizing: 'Енергія',
    effectSleeping: 'Сон',
    startBreathing: 'Почати',
    breathingComplete: 'Чудово!',
    breathingCompleteMsg: 'Ви завершили дихальну вправу',
    breathingAgain: 'Ще раз',
    pause: 'Пауза',
    resume: 'Продовжити',
    gratitude: 'Подяка',
    today: 'сьогодні',
    tomorrow: 'завтра',
    scheduleDate: 'Дата',
    whatAreYouGratefulFor: 'За що ви вдячні сьогодні?',
    iAmGratefulFor: 'Я вдячний за...',
    save: 'Зберегти',
    cancel: 'Скасувати',
    recentEntries: 'Останні записи',
    gratitudeTemplate1: 'Сьогодні я вдячний за...',
    gratitudeTemplate2: 'Хороший момент дня...',
    gratitudeTemplate3: 'Я ціную в собі...',
    gratitudeLimit: 'До 3 пунктів на день',
    gratitudeMemoryJar: 'Скринька спогадів',
    thisWeek: 'Цей тиждень',
    statistics: 'Статистика',
    monthlyOverview: 'Огляд місяця',
    statsRange: 'Період',
    statsRangeWeek: 'Тиждень',
    statsRangeMonth: 'Місяць',
    statsRangeAll: 'Увесь час',
    statsRangeApply: 'Застосувати',
    calendarTitle: 'Календар',
    calendarYear: 'Рік',
    calendarSelectDay: 'Оберіть день',
    calendarPrevMonth: 'Попередній місяць',
    calendarNextMonth: 'Наступний місяць',
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
    moodHeatmap: 'Календар настрою',
    topHabit: 'Найкраща звичка',
    completedTimes2: 'разів',
    profile: 'Профіль',
    yourName: 'Ваше ім\'я',
    nameSaved: 'Імʼя збережено',
    notifications: 'Сповіщення',
    notificationsComingSoon: 'Сповіщення будуть доступні в наступних оновленнях.',
    data: 'Дані',
    exportData: 'Експорт даних',
    importData: 'Імпорт даних',
    importMode: 'Режим імпорту',
    importMerge: 'Обʼєднати',
    importReplace: 'Замінити',
    exportSuccess: 'Експорт готовий.',
    exportError: 'Не вдалося експортувати дані.',
    importSuccess: 'Імпорт завершено.',
    importError: 'Не вдалося імпортувати файл.',
    importedItems: 'Додано',
    importAdded: 'додано',
    importUpdated: 'оновлено',
    importSkipped: 'пропущено',
    comingSoon: 'скоро',
    resetAllData: 'Скинути всі дані',
    privacyTitle: 'Конфіденційність',
    privacyDescription: 'Ваші дані залишаються на пристрої. Без прихованого відстеження.',
    privacyNoTracking: 'Без відстеження',
    privacyNoTrackingHint: 'Ми не збираємо поведінкові дані.',
    privacyAnalytics: 'Аналітика',
    privacyAnalyticsHint: 'Допомагає покращувати додаток. Можна вимкнути.',
    privacyPolicy: 'Політика конфіденційності',
    termsOfService: 'Умови користування',

    // GDPR Consent
    consentTitle: 'Налаштування приватності',
    consentDescription: 'Ми поважаємо вашу приватність. Дозволити анонімну аналітику для покращення додатку?',
    consentAnalyticsTitle: 'Анонімна аналітика',
    consentAnalyticsDesc: 'Лише патерни використання. Без особистих даних. Можна змінити в налаштуваннях.',
    consentAccept: 'Дозволити',
    consentDecline: 'Ні, дякую',
    consentFooter: 'Можна змінити в будь-який час в Налаштування > Приватність',

    installApp: 'Встановити додаток',
    installAppDescription: 'Встановіть ZenFlow для швидшого запуску та офлайн-доступу.',
    installBannerTitle: 'Встановити ZenFlow',
    installBannerBody: 'Отримайте швидший запуск та офлайн-доступ, встановивши додаток.',
    installNow: 'Встановити',
    installLater: 'Пізніше',
    appInstalled: 'Додаток встановлено',
    appInstalledDescription: 'ZenFlow встановлено на вашому пристрої.',
    remindersTitle: 'Нагадування',
    remindersDescription: 'М\'які нагадування, щоб тримати вас на шляху до мети.',
    moodReminder: 'Час перевірки настрою',
    habitReminder: 'Час нагадування про звички',
    focusReminder: 'Час нагадування про фокус',
    quietHours: 'Тихі години',
    reminderDays: 'Дні тижня',
    selectedHabits: 'Звички для нагадування',
    noHabitsYet: 'Поки немає звичок.',
    reminderMoodTitle: 'Перевірка настрою',
    reminderMoodBody: 'Витратьте 30 секунд, щоб записати, як ви себе почуваєте.',
    reminderHabitTitle: 'Нагадування про звички',
    reminderHabitBody: 'Час перевірити ваші звички:',
    reminderFocusTitle: 'Нагадування про фокус',
    reminderFocusBody: 'Готові до фокус-сесії?',
    reminderDismiss: 'Відхилити',
    notificationPermissionTitle: 'Залишайтеся на шляху до мети',
    notificationPermissionDescription: 'Отримуйте м\'які нагадування відстежувати настрій, виконувати звички та робити перерви. Сповіщення допомагають формувати здорові звички.',
    notificationFeature1Title: 'Щоденні нагадування про настрій',
    notificationFeature1Desc: 'Відстежуйте свій стан щодня',
    notificationFeature2Title: 'Відстеження звичок',
    notificationFeature2Desc: 'Будьте послідовними у своїх цілях',
    notificationFeature3Title: 'Фокус-сесії',
    notificationFeature3Desc: 'Отримуйте нагадування про продуктивні перерви',
    notificationAllow: 'Увімкнути сповіщення',
    notificationDeny: 'Можливо, пізніше',
    notificationPrivacyNote: 'Ви можете змінити це в будь-який час у Налаштуваннях. Сповіщення локальні та приватні.',
    onboardingStep: 'Крок',
    onboardingValueTitle: 'Відстежуйте настрій + звички за 30 секунд на день',
    onboardingValueBody: 'Швидкі перевірки, без зайвого, повністю приватно.',
    onboardingStart: 'Почати за 30 сек',
    onboardingExplore: 'Дослідити',
    onboardingGoalTitle: 'Оберіть свій фокус',
    onboardingGoalLessStress: 'Менше стресу',
    onboardingGoalLessStressDesc: 'Спокійні та м\'які звички',
    onboardingGoalMoreEnergy: 'Більше енергії',
    onboardingGoalMoreEnergyDesc: 'Сон, рух, гідратація',
    onboardingGoalBetterRoutine: 'Краща рутина',
    onboardingGoalBetterRoutineDesc: 'Стабільність та ритм',
    onboardingContinue: 'Продовжити',
    onboardingCheckinTitle: 'Швидка перевірка',
    onboardingHabitsPrompt: 'Оберіть дві звички',
    onboardingPickTwo: 'Оберіть до двох',
    onboardingReminderTitle: 'Увімкнути нагадування',
    onboardingReminderBody: 'Оберіть зручний час. Без спаму.',
    onboardingMorning: 'Ранок',
    onboardingEvening: 'Вечір',
    onboardingEnable: 'Увімкнути',
    onboardingSkip: 'Пропустити поки що',
    onboardingHabitBreathing: 'Дихання',
    onboardingHabitEveningWalk: 'Вечірня прогулянка',
    onboardingHabitStretch: 'Розтяжка',
    onboardingHabitJournaling: 'Ведення щоденника',
    onboardingHabitWater: 'Вода',
    onboardingHabitSunlight: 'Сонячне світло',
    onboardingHabitMovement: 'Рух',
    onboardingHabitSleepOnTime: 'Сон вчасно',
    onboardingHabitMorningPlan: 'Ранковий план',
    onboardingHabitRead: 'Читати 10 хв',
    onboardingHabitNoScreens: 'Без екранів увечері',
    onboardingHabitDailyReview: 'Щоденний огляд',
    account: 'Акаунт',
    accountDescription: 'Sign in by email to sync progress across devices.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Send magic link',
    continueWithGoogle: 'Continue with Google',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    syncNow: 'Sync now',
    cloudSyncDisabled: 'Cloud sync disabled.',
    deleteAccount: 'Видалити акаунт',
    deleteAccountConfirm: 'Видалити акаунт?',
    deleteAccountWarning: 'Буде видалено хмарні дані та доступ до акаунту.',
    deleteAccountSuccess: 'Акаунт видалено.',
    deleteAccountError: 'Не вдалося видалити акаунт.',
    deleteAccountLink: 'Як видалити акаунт і дані',
    authEmailSent: 'Login link sent to your email.',
    authSignedOut: 'Signed out.',
    authError: 'Failed to send link.',
    authNotConfigured: 'Supabase not configured.',
    syncSuccess: 'Sync complete.',
    syncPulled: 'Cloud data restored.',
    syncPushed: 'Cloud updated.',
    syncError: 'Sync failed.',
    authGateTitle: 'Sign in',
    authGateBody: 'Sign in by email to save progress and sync across devices.',
    authGateContinue: 'Continue without account',
    errorBoundaryTitle: 'Something went wrong',
    errorBoundaryBody: 'Try reloading the app or export a debug report.',
    errorBoundaryExport: 'Export debug report',
    errorBoundaryReload: 'Reload app',
    pushTitle: 'Push notifications',
    pushEnable: 'Enable push',
    pushDisable: 'Disable push',
    pushTest: 'Test push',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Test notification.',
    pushTestSent: 'Test sent.',
    pushTestError: 'Failed to send test.',
    pushNowMood: 'Push: mood',
    pushNowHabit: 'Push: habits',
    pushNowFocus: 'Push: focus',
    pushEnabled: 'Push enabled.',
    pushDisabled: 'Push disabled.',
    pushError: 'Failed to enable push.',
    pushNeedsAccount: 'Sign in to enable push.',
    pushPermissionDenied: 'Notification permission denied.',
    areYouSure: 'Ви впевнені?',
    cannotBeUndone: 'Цю дію не можна скасувати.',
    delete: 'Видалити',
    shareAchievements: 'Поділитися прогресом',
    shareTitle: 'Мій прогрес у ZenFlow',
    shareText: '{streak} днів поспіль! {habits} звичок виконано, {focus} хвилин фокусу.',
    shareButton: 'Поділитися',
    shareDownload: 'Завантажити зображення',
    shareDownloading: 'Завантаження...',
    shareCopyLink: 'Скопіювати посилання',
    shareCopied: 'Скопійовано!',
    sharePrivacyNote: 'Особисті дані не передаються. Лише зведення прогресу.',
    shareStreak: 'Днів поспіль',
    shareHabits: 'Звичок',
    shareFocus: 'Хвилин',
    shareGratitude: 'Подяк',
    shareFooter: 'Відстежуй звички, настрій і фокус',
    myProgress: 'Мій прогрес',
    shareSquare: 'Пост 1:1',
    shareStory: 'Сторіс 9:16',
    shareFormatHint: '📱 Формат сторіс для Instagram/TikTok • Формат поста для стрічок',
    challengesTitle: 'Челенджі та нагороди',
    challengesSubtitle: 'Приймайте виклики та заробляйте бейджі',
    activeChallenges: 'Активні',
    availableChallenges: 'Доступні',
    badges: 'Нагороди',
    noChallengesActive: 'Немає активних челенджів',
    noChallengesActiveHint: 'Почніть челендж, щоб відстежувати свій прогрес',
    progress: 'Прогрес',
    reward: 'Нагорода',
    target: 'Ціль',
    startChallenge: 'Почати челендж',
    challengeActive: 'Активний',
    requirement: 'Вимога',
    challengeTypeStreak: 'Стрік',
    challengeTypeFocus: 'Фокус',
    challengeTypeGratitude: 'Вдячність',
    challengeTypeTotal: 'Всього',
    hyperfocusMode: 'Режим гіперфокусу',
    hyperfocusStart: 'Почати',
    hyperfocusPause: 'Пауза',
    hyperfocusResume: 'Продовжити',
    hyperfocusExit: 'Вихід',
    hyperfocusReady: 'Готові до гіперфокусу?',
    hyperfocusFocusing: 'У зоні фокусу...',
    hyperfocusPaused: 'Призупинено',
    hyperfocusTimeLeft: 'залишилось',
    hyperfocusBreathe: 'Дихайте...',
    hyperfocusBreathDesc: 'Вдих 4 сек • Видих 4 сек',
    hyperfocusEmergencyConfirm: 'Хочете призупинити сесію? Без почуття провини! 💜',
    hyperfocusAmbientSound: 'Фоновий звук',
    hyperfocusSoundNone: 'Без звуку',
    hyperfocusSoundWhiteNoise: 'Білий шум',
    hyperfocusSoundRain: 'Дощ',
    hyperfocusSoundOcean: 'Океан',
    hyperfocusSoundForest: 'Ліс',
    hyperfocusSoundCoffee: 'Кафе',
    hyperfocusSoundFireplace: 'Багаття',
    hyperfocusSoundVariants: 'Варіанти звуку',
    hyperfocusShowVariants: 'Показати варіанти',
    hyperfocusHideVariants: 'Сховати варіанти',
    hyperfocusTip: 'Порада',
    hyperfocusTipText: 'Кожні 25 хвилин буде коротка дихальна пауза. Це допомагає уникнути вигорання!',
    hyperfocusPauseMsg: 'Натисніть Play, щоб продовжити',

    // Widget Settings
    widgetSettings: 'Налаштування віджетів',
    widgetSettingsDesc: 'Налаштуйте віджети для домашнього екрану',
    widgetPreview: 'Перегляд',
    widgetSetup: 'Встановлення',
    widgetInfo: 'Віджети оновлюються автоматично',
    widgetInfoDesc: 'Дані у віджетах синхронізуються щоразу, коли ви оновлюєте звички, завершуєте фокус-сесію або отримуєте новий бейдж.',
    widgetStatus: 'Статус віджетів',
    widgetPlatform: 'Платформа',
    widgetWeb: 'Web (віджети недоступні)',
    widgetSupport: 'Підтримка віджетів',
    widgetAvailable: 'Доступні',
    widgetComingSoon: 'Скоро',
    widgetSetupiOS: 'Встановлення віджета на iOS',
    widgetSetupAndroid: 'Встановлення віджета на Android',
    widgetStep1iOS: 'Довге натискання на домашньому екрані, поки іконки не почнуть тремтіти',
    widgetStep2iOS: 'Натисніть "+" у лівому верхньому куті',
    widgetStep3iOS: 'Знайдіть "ZenFlow" у списку додатків',
    widgetStep4iOS: 'Виберіть розмір віджета (малий, середній або великий)',
    widgetStep5iOS: 'Натисніть "Додати віджет"',
    widgetStep1Android: 'Довге натискання на порожньому місці домашнього екрану',
    widgetStep2Android: 'Натисніть "Віджети" у меню',
    widgetStep3Android: 'Знайдіть "ZenFlow" у списку додатків',
    widgetStep4Android: 'Перетягніть віджет потрібного розміру на домашній екран',
    widgetWebWarning: 'Віджети недоступні у веб-версії',
    widgetWebWarningDesc: 'Віджети працюють лише на мобільних пристроях (iOS та Android). Встановіть мобільний додаток, щоб використовувати віджети.',
    widgetWebTip: 'Веб-версія показує перегляд віджетів, щоб ви могли бачити, як вони виглядатимуть на мобільному пристрої.',
    widgetFeatures: 'Можливості віджетів',
    widgetFeature1: 'Відображення поточного стріку днів поспіль',
    widgetFeature2: 'Прогрес виконання звичок за сьогодні',
    widgetFeature3: 'Кількість хвилин фокус-сесій',
    widgetFeature4: 'Останній отриманий бейдж',
    widgetFeature5: 'Список звичок з відмітками виконання',
    widgetSmall: 'Малий віджет',
    widgetMedium: 'Середній віджет',
    widgetLarge: 'Великий віджет',
    widgetNoData: 'Немає даних для віджета',
    todayHabits: 'Звички на сьогодні',
    lastBadge: 'Останній бейдж',
    done: 'готово',

    dopamineSettings: 'Dopamine Dashboard',
    dopamineSettingsDesc: 'Налаштуйте рівень зворотного зв\'язку',
    dopamineIntensity: 'Рівень інтенсивності',
    dopamineMinimal: 'Мінімум',
    dopamineNormal: 'Норма',
    dopamineADHD: 'ADHD',
    dopamineMinimalDesc: 'Спокійний досвід без відволікань',
    dopamineNormalDesc: 'Збалансований зворотний зв\'язок',
    dopamineADHDDesc: 'Максимум дофаміну! Усі ефекти увімкнені 🎉',
    dopamineCustomize: 'Точне налаштування',
    dopamineAnimations: 'Анімації',
    dopamineAnimationsDesc: 'Плавні переходи та ефекти',
    dopamineSounds: 'Звуки',
    dopamineSoundsDesc: 'Звуки успіху та зворотний зв\'язок',
    dopamineHaptics: 'Вібрація',
    dopamineHapticsDesc: 'Тактильний зворотний зв\'язок (тільки на мобільному)',
    dopamineConfetti: 'Конфеті',
    dopamineConfettiDesc: 'Святкуйте завершення звичок',
    dopamineStreakFire: 'Вогонь стріка',
    dopamineStreakFireDesc: 'Анімація вогню для стріків',
    dopamineTip: 'Порада для ADHD',
    dopamineTipText: 'Мозку з ADHD потрібно більше дофаміну! Спробуйте режим ADHD для максимальної мотивації. Можна налаштувати окремі параметри.',
    dopamineSave: 'Зберегти і закрити',
    dailyRewards: 'Щоденні нагороди',
    loginStreak: 'Днів поспіль',
    day: 'День',
    claim: 'Забрати!',
    claimed: 'Отримано',
    streakBonus: 'Бонус за серію',
    dailyRewardsTip: 'Заходь кожен день за кращими нагородами!',
    spinWheel: 'Крути колесо!',
    spinsAvailable: 'Обертань доступно',
    spin: 'КРУТИТИ',
    noSpins: 'Немає обертань',
    claimPrize: 'Забрати приз!',
    challengeExpired: 'Випробування завершилось',
    challengeComplete: 'Випробування виконано!',
    earned: 'зароблено',
    comboText: 'КОМБО',
    mysteryBox: 'Скриня',
    openBox: 'Відкрити',
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

    // Onboarding
    welcomeMessage: 'Ласкаво просимо до ZenFlow!',
    featureMood: 'Відстеження настрою',
    featureMoodDescription: 'Записуйте свій настрій щодня',
    featureHabits: 'Звички',
    featureHabitsDescription: 'Створюйте та відстежуйте корисні звички',
    featureFocus: 'Фокус-сесії',
    featureFocusDescription: 'Концентруйтесь за допомогою таймера Pomodoro',
    privacyNote: 'Ваші дані зберігаються локально та захищені',
    install: 'Встановити додаток',
    installDescription: 'Встановіть ZenFlow на головний екран',
    onboardingMoodTitle: 'Як ви себе почуваєте?',
    onboardingMoodDescription: 'Відстежуйте свій настрій щодня',
    onboardingHabitsTitle: 'Створіть свої перші звички',
    onboardingHabitsDescription: 'Почніть з невеликих кроків',
    onboardingRemindersTitle: 'Нагадування',
    onboardingRemindersDescription: 'Отримуйте нагадування про звички',
    enableReminders: 'Увімкнути нагадування',
    morning: 'Ранок',
    afternoon: 'День',
    evening: 'Вечір',
    close: 'Закрити',
    skip: 'Пропустити',
    getStarted: 'Почати',
    next: 'Далі',
    remindersActive: 'Нагадування активні',
    greatChoice: 'Чудовий вибір!',
    habitsSelected: 'звичок обрано',

    // Welcome Tutorial
    tutorialWelcomeTitle: 'Ласкаво просимо до ZenFlow',
    tutorialWelcomeSubtitle: 'Ваш персональний помічник для продуктивності',
    tutorialWelcomeDesc: 'Додаток, створений щоб допомогти вам зберігати фокус, формувати корисні звички і почуватися краще щодня.',
    tutorialBrainTitle: 'Створено для вашого мозку',
    tutorialBrainSubtitle: 'Маєте СДУГ або просто складно зосередитися?',
    tutorialBrainDesc: 'ZenFlow використовує науково обґрунтовані техніки для керування увагою, часом та енергією. Діагноз не потрібен — якщо вам складно концентруватися, цей додаток для вас.',
    tutorialFeaturesTitle: 'Що ви можете робити',
    tutorialFeaturesSubtitle: 'Прості інструменти, великий ефект',
    tutorialFeaturesDesc: 'Відстежуйте прогрес і набирайте обертів:',
    tutorialFeature1: 'Відстеження настрою та енергії',
    tutorialFeature2: 'Формування звичок крок за кроком',
    tutorialFeature3: 'Сесії фокусу з фоновими звуками',
    tutorialFeature4: 'Щоденник вдячності',
    tutorialMoodTitle: 'Розумійте себе краще',
    tutorialMoodSubtitle: 'Відстежуйте настрій, знаходьте патерни',
    tutorialMoodDesc: 'Швидкі щоденні відмітки допоможуть помітити, що впливає на вашу енергію та фокус. З часом ви краще зрозумієте себе.',
    tutorialFocusTitle: 'Режим глибокого фокусу',
    tutorialFocusSubtitle: 'Блокуйте відволікання, робіть справи',
    tutorialFocusDesc: 'Використовуйте техніку Помодоро з заспокійливими фоновими звуками. Ідеально для роботи, навчання або творчості.',
    tutorialDayClockTitle: 'Ваш день на одному екрані',
    tutorialDayClockSubtitle: 'Візуальний енергометр для СДУГ мозку',
    tutorialDayClockDesc: 'Дивіться на свій день як на коло з ранком, днем і вечором. Спостерігайте, як зростає ваша енергія з кожною дією!',
    tutorialDayClockFeature1: '⚡ Енергометр заповнюється з прогресом',
    tutorialDayClockFeature2: '😊 Маскот реагує на ваші досягнення',
    tutorialDayClockFeature3: '🎯 Відстежуйте всі активності в одному місці',
    tutorialDayClockFeature4: '🏆 Досягніть 100% для Ідеального Дня!',
    tutorialMoodThemeTitle: 'Додаток адаптується під вас',
    tutorialMoodThemeSubtitle: 'Дизайн змінюється з вашим настроєм',
    tutorialMoodThemeDesc: 'Коли вам добре, додаток святкує яскравими кольорами. Коли сумно — стає спокійним і підтримуючим.',
    tutorialMoodThemeFeature1: '😄 Чудовий настрій: Яскравий фіолетовий і золотий',
    tutorialMoodThemeFeature2: '🙂 Добрий настрій: Теплі зелені тони',
    tutorialMoodThemeFeature3: '😔 Поганий настрій: Заспокійливий синій',
    tutorialMoodThemeFeature4: '😢 Важкі часи: М\'який, мінімалістичний дизайн',
    tutorialReadyTitle: 'Готові почати?',
    tutorialReadySubtitle: 'Ваш шлях починається зараз',
    tutorialReadyDesc: 'Почніть з малого — просто відмітьте, як ви себе почуваєте сьогодні. Кожен крок важливий!',
    tutorialStart: 'Поїхали!',

    // Weekly Report
    weeklyReport: 'Тижневий звіт',
    incredibleWeek: 'Неймовірний тиждень!',
    pathToMastery: 'Ви на шляху до майстерності!',
    greatWork: 'Чудова робота!',
    keepMomentum: 'Продовжуйте в тому ж дусі!',
    goodProgress: 'Гарний прогрес!',
    everyStepCounts: 'Кожен крок має значення!',
    newWeekOpportunities: 'Новий тиждень - нові можливості!',
    startSmall: 'Почніть з малого, рухайтеся вперед!',
    bestDay: 'Кращий день',
    continueBtn: 'Продовжити',

    // Streak Celebration
    dayStreak: 'днів поспіль',
    keepItUp: 'Так тримати!',

    // Inner World Garden
    myCompanion: 'Мій компаньйон',
    missedYou: 'сумував за тобою!',
    welcomeBack: 'З поверненням до твого саду',
    warmth: 'Тепло',
    energy: 'Енергія',
    wisdom: 'Мудрість',
    companionStreak: 'Днів поспіль!',
    chooseCompanion: 'Обери компаньйона',
    levelUpHint: 'Виконуй активності, щоб отримувати XP і підвищувати рівень!',
    pet: 'Погладити',
    feed: 'Погодувати',
    talk: 'Поговорити',
    happiness: 'Щастя',
    satiety: 'Ситість',
    gardenEmpty: 'Новий початок',
    gardenSprouting: 'Паростки',
    gardenGrowing: 'Зростання',
    gardenFlourishing: 'Цвітіння',
    gardenMagical: 'Магія',
    gardenLegendary: 'Легенда',

    // Companion Notifications
    companionMissesYou: 'сумує за тобою! 💕',
    companionWantsToPlay: 'хоче провести час разом!',
    companionWaiting: 'чекає тебе в саду 🌱',
    companionProud: 'пишається тобою! ⭐',
    companionCheersYou: 'вболіває за тебе! 💪',
    companionQuickMood: 'Як настрій? Натисни! 😊',

    // Garden / My World
    myWorld: 'Мій світ',
    plants: 'Рослин',
    creatures: 'Істот',
    level: 'Рівень',

    // Streak Banner
    startStreak: 'Почни серію сьогодні!',
    legendaryStreak: 'Легендарна серія!',
    amazingStreak: 'Чудово!',
    goodStart: 'Чудовий початок!',
    todayActivities: 'Сьогодні',

    // Companion
    companionPet: 'Погладити',
    companionFeed: 'Погодувати',
    companionTalk: 'Поговорити',
    companionHappiness: 'Щастя',
    companionHunger: 'Ситість',

    // New Companion System
    companionHungryCanFeed: '🥺 Я голодний... Погодуй мене?',
    companionHungryNoTreats: '🥺 Я голодний... Виконуй активності щоб заробити смаколики!',
    companionStreakLegend: '🏆 {streak} днів! Ти легенда!',
    companionStreakGood: '🔥 {streak} днів! Так тримати!',
    companionAskMood: '💜 Як ти себе почуваєш сьогодні?',
    companionAskHabits: '🎯 Час для звичок!',
    companionAskFocus: '🧠 Готовий зосередитись?',
    companionAskGratitude: '💖 За що ти вдячний сьогодні?',
    companionAllDone: '🏆 Ідеальний день! Ти молодець!',
    companionHappy: '💕 Я тебе люблю!',
    companionMorning: '☀️ Доброго ранку!',
    companionAfternoon: '🌤️ Як проходить твій день?',
    companionEvening: '🌙 Добрий вечір!',
    companionNight: '💤 Zzz...',
    companionLevelUp: '🎉 Новий рівень! Тепер {level}!',
    companionNeedsFood: 'Твій компаньйон голодний!',
    petReaction1: '💕 *мурр*',
    petReaction2: '✨ Як приємно!',
    petReaction3: '😊 Дякую!',
    petReaction4: '💖 Люблю тебе!',
    feedReaction1: '🍪 Смачно!',
    feedReaction2: '😋 Об\'їдення!',
    feedReaction3: '✨ Дякую!',
    feedReaction4: '💪 Енергія!',
    feedNotEnough: '🍪 Потрібно {needed} смаколиків, є {have}',
    free: 'Безкоштовно',
    fullness: 'Ситість',
    earnTreatsHint: 'Виконуй активності щоб заробляти смаколики для улюбленця!',

    // Seasonal Tree System
    myTree: 'Моє дерево',
    touch: 'Доторкнутись',
    water: 'Полити',
    waterLevel: 'Рівень води',
    growth: 'Ріст',
    stage: 'Стадія',
    treeThirstyCanWater: '💧 Дерево хоче пити...',
    treeThirstyNoTreats: '🥀 Спрага... Виконуй активності щоб заробити смаколики!',
    treeStreakLegend: '🌟 {streak} днів! Дерево сяє!',
    treeStreakGood: '✨ {streak} днів! Росте міцним!',
    treeMaxStage: '🌳 Чудове велике дерево!',
    treeStage4: '🌲 Гарне доросле дерево!',
    treeStage3: '🌿 Росте в міцний саджанець!',
    treeStage2: '🌱 Молодий паросток тягнеться до світла!',
    treeStage1: '🌰 Маленьке насіння повне потенціалу!',
    treeHappy: '💚 Дерево процвітає!',
    treeSeason: '{emoji} Прекрасна {season}!',
    treeStageUp: '🎉 Еволюція в {stage}!',
    treeMissedYou: 'Твоє дерево сумувало за тобою!',
    treeNeedsWater: 'Дереву потрібна вода!',
    waterDecayHint: 'Рівень води падає -2% на годину',
    seasonTreeHint: 'Дерево змінюється зі зміною сезонів!',
    xpToNextStage: '{xp} XP до {stage}',
    touchReaction1: '✨ *шелест листя*',
    touchReaction2: '🍃 Листя танцює!',
    touchReaction3: '💚 Відчуваю життя!',
    touchReaction4: '🌿 Росту міцнішим!',
    waterReaction1: '💧 *поглинає воду*',
    waterReaction2: '🌊 Освіжає!',
    waterReaction3: '💦 Дякую!',
    waterReaction4: '✨ Росту!',
    waterNotEnough: '🍪 Потрібно {needed} смаколиків, є {have}',

    // Rest Mode
    restDayTitle: 'День відпочинку',
    restDayMessage: 'Відпочивай, твій стрік у безпеці',
    restDayButton: 'День відпочинку',
    restDayCancel: 'Все ж хочу записати',
    daysSaved: 'днів збережено',
    restDaySupportive: 'Завтра продовжимо разом 💚',

    // Task Momentum
    taskMomentum: 'Задачі',
    taskMomentumDesc: 'СДУГ-дружня пріоритизація',
    tasksInARow: 'задач поспіль',
    taskNamePlaceholder: 'Назва задачі...',
    durationMinutes: 'Тривалість (хв)',
    interestLevel: 'Інтерес (1-10)',
    markAsUrgent: 'Термінова задача',
    urgent: 'Терміново',
    addTask: 'Додати',
    topRecommendedTasks: 'Топ-3 рекомендованих',
    quickWins: 'Швидкі перемоги (до 2 хв)',
    allTasks: 'Усі задачі',
    noTasksYet: 'Поки немає задач',
    addFirstTaskMessage: 'Додайте першу задачу для початку!',
    addFirstTask: 'Додати задачу',
    adhdTaskTips: 'СДУГ поради',
    taskTip1: 'Починайте з швидких задач (2-5 хв)',
    taskTip2: 'Набирайте момент послідовними виконаннями',
    taskTip3: 'Цікаві задачі дають більше дофаміну',
    taskTip4: 'Термінове + коротке = ідеальна комбінація',
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
    howAreYouNow: '¿Cómo estás ahora?',
    moodToday: 'Estado de ánimo hoy',
    moodHistory: 'Historial del día',
    moodRecorded: '¡Estado de ánimo registrado!',
    moodNotes: 'Notas de ánimo',
    todayProgress: 'Progreso de hoy',
    completed: '¡Completado!',
    updateMood: 'Actualizar',
    great: 'Genial',
    good: 'Bien',
    okay: 'Regular',
    bad: 'Mal',
    terrible: 'Terrible',
    addNote: 'Añade una nota (opcional)...',
    saveMood: 'Guardar estado',
    startHere: 'Empieza aquí',
    tapToStart: 'Toca un emoji para empezar tu día',
    moodPrompt: '¿Qué influyó en tu ánimo?',
    moodTagsTitle: 'Etiquetas',
    moodTagPlaceholder: 'Añadir etiqueta...',
    moodTagAdd: 'Añadir',
    moodTagFilter: 'Filtrar por etiqueta',
    allTags: 'Todas las etiquetas',
    tagWork: 'Trabajo',
    tagFamily: 'Familia',
    tagHealth: 'Salud',
    tagSleep: 'Sueño',
    tagMoney: 'Dinero',
    tagWeather: 'Clima',
    moodPatternsTitle: 'Patrones de ánimo',
    moodBestDay: 'Mejor día de la semana',
    moodFocusComparison: 'Ánimo y enfoque',
    moodFocusWith: 'Con sesiones de enfoque',
    moodFocusWithout: 'Sin enfoque',
    moodHabitCorrelations: 'Hábitos y ánimo',
    moodNoData: 'No hay suficientes datos',
    editMood: 'Editar estado de ánimo',
    changeMood: 'Cambiar estado de ánimo',
    changeMoodConfirmTitle: '¿Cambiar estado de ánimo?',
    changeMoodConfirmMessage: '¿Estás seguro de que quieres cambiar tu estado de ánimo?',
    moodChanged: '¡Estado de ánimo actualizado!',
    confirm: 'Cambiar',
    dailyProgress: 'Progreso diario',
    continueProgress: 'Continuar tu progreso',
    dayTimeline: 'Tu día',
    dayComplete: 'del día',
    perfectDay: '¡Día perfecto!',
    startYourDay: '¡Empieza tu día! 🌅',
    keepGoing: '¡Sigue así! Lo estás haciendo genial 💪',
    almostThere: '¡Ya casi! 🚀',
    soClose: '¡Tan cerca de la perfección! ⭐',
    legendaryDay: '¡DÍA LEGENDARIO! 🏆🔥✨',

    // Schedule Timeline
    scheduleTitle: 'Tu Horario',
    scheduleAddEvent: 'Agregar Evento',
    scheduleEmpty: 'Sin eventos planificados. ¡Toca + para agregar!',
    scheduleEmptyDay: 'Sin eventos para este día',
    scheduleStart: 'Inicio',
    scheduleEnd: 'Fin',
    scheduleAdd: 'Agregar al Horario',
    scheduleCustomTitle: 'Título personalizado (opcional)',
    scheduleWork: 'Trabajo',
    scheduleMeal: 'Comida',
    scheduleRest: 'Descanso',
    scheduleExercise: 'Ejercicio',
    scheduleStudy: 'Estudio',
    scheduleMeeting: 'Reunión',
    scheduleNote: 'Nota (opcional)',
    scheduleNotePlaceholder: 'Agregar detalles o recordatorios...',

    // Time Awareness (ADHD time blindness helper)
    timeUntilEndOfDay: 'Hasta fin del día',
    timeIn: 'en',
    timePassed: 'Tiempo pasado',
    timeNow: '¡Ahora!',
    hoursShort: 'h',
    minutesShort: 'm',
    night: 'Noche',

    // AI Insights
    aiInsights: 'Análisis IA',
    aiInsight: 'Insight IA',
    personalizedForYou: 'Personalizado para ti',
    insightsNeedMoreData: '¡Registra tu ánimo una semana para desbloquear insights personalizados!',
    daysLogged: 'días registrados',
    showMore: 'Mostrar',
    moreInsights: 'más insights',
    hideInsights: 'Ocultar insights',

    // Onboarding Hints
    hintFirstMoodTitle: '¿Cómo te sientes?',
    hintFirstMoodDesc: 'Empieza el día registrando tu estado de ánimo. ¡Solo toma 5 segundos y te ayuda a entenderte mejor!',
    hintFirstMoodAction: 'Registrar ánimo',
    hintFirstHabitTitle: 'Crea tu primer hábito',
    hintFirstHabitDesc: 'Los pequeños hábitos llevan a grandes cambios. Prueba agregar algo simple como "Beber agua".',
    hintFirstHabitAction: 'Agregar hábito',
    hintFirstFocusTitle: '¿Listo para enfocarte?',
    hintFirstFocusDesc: 'Usa el temporizador de enfoque con sonidos relajantes. ¡Comienza con solo 25 minutos!',
    hintFirstFocusAction: 'Iniciar enfoque',
    hintFirstGratitudeTitle: 'Practica la gratitud',
    hintFirstGratitudeDesc: 'Escribe una cosa por la que estés agradecido. ¡Es un poderoso impulsor del ánimo!',
    hintFirstGratitudeAction: 'Agregar gratitud',
    hintScheduleTipTitle: 'Planifica tu día',
    hintScheduleTipDesc: '¡Usa la línea de tiempo para ver tu día de un vistazo. Agrega eventos para mantenerte en camino!',
    hintScheduleTipAction: 'Ver línea de tiempo',

    habits: 'Hábitos',
    habitName: 'Nombre del hábito...',
    icon: 'Icono',
    color: 'Color',
    addHabit: 'Añadir hábito',
    addFirstHabit: '¡Añade tu primer hábito! ✨',
    completedTimes: 'Completado',
    habitNameHint: 'Escribe un nombre para agregar.',
    habitType: 'Tipo de hábito',
    habitTypeDaily: 'Diario',
    habitTypeWeekly: 'Meta semanal',
    habitTypeFrequency: 'Cada N días',
    habitTypeReduce: 'Reducir (límite)',
    habitWeeklyGoal: 'Meta semanal (veces)',
    habitFrequencyInterval: 'Intervalo (días)',
    habitReduceLimit: 'Límite diario',
    habitStrictStreak: 'Racha estricta',
    habitGraceDays: 'Días de gracia por semana',
    habitWeeklyProgress: 'Esta semana',
    habitEvery: 'Cada',
    habitReduceProgress: 'Hoy',
    noHabitsToday: 'No hay hábitos hoy.',
    habitsOther: 'Otros hábitos',
    habitTypeContinuous: 'Continuo (dejar)',
    habitTypeScheduled: 'Programado',
    habitTypeMultiple: 'Varias veces al día',
    habitDailyTarget: 'Meta diaria',
    habitStartDate: 'Fecha de inicio',
    habitReminders: 'Recordatorios',
    habitAddReminder: 'Añadir recordatorio',
    habitReminderTime: 'Hora',
    habitReminderDays: 'Días de la semana',
    habitReminderEnabled: 'Habilitado',
    habitRemindersPerHabit: 'Los recordatorios ahora se configuran individualmente para cada hábito. Añade recordatorios al crear o editar hábitos.',
    perHabitRemindersTitle: 'Recordatorios por Hábito',
    perHabitRemindersDesc: 'Cada hábito puede tener sus propios horarios de recordatorio personalizados. Configúralos al crear un nuevo hábito o editar uno existente.',
    quickAdd: 'Añadir rápido',
    createCustomHabit: 'Crear hábito personalizado',
    streak: 'racha',

    // Habit Frequency
    habitFrequency: 'Frecuencia',
    habitFrequencyOnce: 'Una vez',
    habitFrequencyDaily: 'Diario',
    habitFrequencyWeekly: 'Semanal',
    habitFrequencyCustom: 'Personalizado',
    habitFrequencySelectDays: 'Seleccionar Días',
    habitDurationRequired: '¿Requiere Duración?',
    habitTargetDuration: 'Duración Objetivo (minutos)',
    habitDurationMinutes: 'minutos',

    // Focus timer
    focus: 'Enfoque',
    breakTime: 'Descanso',
    todayMinutes: 'min hoy',
    concentrate: 'Concéntrate',
    takeRest: 'Descansa',
    focusPreset25: '25/5',
    focusPreset50: '50/10',
    focusPresetCustom: 'Personalizado',
    focusLabelPrompt: '¿En qué te enfocas?',
    focusLabelPlaceholder: 'Ej.: Informe, Estudio, Proyecto...',
    focusCustomWork: 'Trabajo (min)',
    focusCustomBreak: 'Descanso (min)',
    focusReflectionTitle: 'Reflexión',
    focusReflectionQuestion: '¿Cómo fue la sesión?',
    focusReflectionSkip: 'Saltar',
    focusReflectionSave: 'Guardar',

    // Breathing
    breathingTitle: 'Respiración',
    breathingSubtitle: 'Calma tu mente',
    breathingBox: 'Respiración cuadrada',
    breathingBoxDesc: 'Fases iguales para enfoque',
    breathing478: '4-7-8 Relajante',
    breathing478Desc: 'Calma profunda',
    breathingEnergize: 'Energizante',
    breathingEnergizeDesc: 'Impulso de energía',
    breathingSleep: 'Preparación para dormir',
    breathingSleepDesc: 'Exhalación lenta',
    breatheIn: 'Inhala',
    breatheOut: 'Exhala',
    hold: 'Mantén',
    cycles: 'ciclos',
    cycle: 'Ciclo',
    effectCalming: 'Calma',
    effectFocusing: 'Enfoque',
    effectEnergizing: 'Energía',
    effectSleeping: 'Sueño',
    startBreathing: 'Comenzar',
    breathingComplete: '¡Bien hecho!',
    breathingCompleteMsg: 'Completaste el ejercicio de respiración',
    breathingAgain: 'Otra vez',
    pause: 'Pausa',
    resume: 'Continuar',
    gratitude: 'Gratitud',
    today: 'hoy',
    tomorrow: 'mañana',
    scheduleDate: 'Fecha',
    whatAreYouGratefulFor: '¿Por qué estás agradecido hoy?',
    iAmGratefulFor: 'Estoy agradecido por...',
    save: 'Guardar',
    cancel: 'Cancelar',
    recentEntries: 'Entradas recientes',
    gratitudeTemplate1: 'Hoy estoy agradecido por...',
    gratitudeTemplate2: 'Un buen momento de hoy...',
    gratitudeTemplate3: 'Aprecio en mí...',
    gratitudeLimit: 'Hasta 3 puntos por día',
    gratitudeMemoryJar: 'Frasco de recuerdos',
    thisWeek: 'Esta semana',
    statistics: 'Estadísticas',
    monthlyOverview: 'Resumen mensual',
    statsRange: 'Período',
    statsRangeWeek: 'Semana',
    statsRangeMonth: 'Mes',
    statsRangeAll: 'Todo el tiempo',
    statsRangeApply: 'Aplicar',
    calendarTitle: 'Calendario',
    calendarYear: 'Año',
    calendarSelectDay: 'Selecciona un día',
    calendarPrevMonth: 'Mes anterior',
    calendarNextMonth: 'Mes siguiente',
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
    moodHeatmap: 'Mapa de ánimo',
    topHabit: 'Mejor hábito',
    completedTimes2: 'veces',
    profile: 'Perfil',
    yourName: 'Tu nombre',
    nameSaved: 'Nombre guardado',
    notifications: 'Notificaciones',
    notificationsComingSoon: 'Las notificaciones estarán disponibles en futuras actualizaciones.',
    data: 'Datos',
    exportData: 'Exportar datos',
    importData: 'Importar datos',
    importMode: 'Modo de importación',
    importMerge: 'Combinar',
    importReplace: 'Reemplazar',
    exportSuccess: 'Exportación lista.',
    exportError: 'No se pudo exportar los datos.',
    importSuccess: 'Importación completada.',
    importError: 'No se pudo importar el archivo.',
    importedItems: 'Añadido',
    importAdded: 'añadido',
    importUpdated: 'actualizado',
    importSkipped: 'omitido',
    comingSoon: 'próximamente',
    resetAllData: 'Restablecer todos los datos',
    privacyTitle: 'Privacy',
    privacyDescription: 'Your data stays on device. No hidden tracking.',
    privacyNoTracking: 'No tracking',
    privacyNoTrackingHint: 'We do not collect behavioral data.',
    privacyAnalytics: 'Analytics',
    privacyAnalyticsHint: 'Ayuda a mejorar la app. Puedes desactivarlo.',
    privacyPolicy: 'Politica de privacidad',
    termsOfService: 'Terminos del servicio',

    // GDPR Consent
    consentTitle: 'Configuración de privacidad',
    consentDescription: 'Respetamos tu privacidad. ¿Permitir análisis anónimos para mejorar la app?',
    consentAnalyticsTitle: 'Análisis anónimos',
    consentAnalyticsDesc: 'Solo patrones de uso. Sin datos personales. Puedes cambiarlo en Ajustes.',
    consentAccept: 'Permitir',
    consentDecline: 'No, gracias',
    consentFooter: 'Puedes cambiarlo en cualquier momento en Ajustes > Privacidad',

    installApp: 'Instalar app',
    installAppDescription: 'Instala ZenFlow para un inicio más rápido y acceso sin conexión.',
    installBannerTitle: 'Instalar ZenFlow',
    installBannerBody: 'Obtén un inicio más rápido y acceso sin conexión instalando la app.',
    installNow: 'Instalar',
    installLater: 'Más tarde',
    appInstalled: 'App instalada',
    appInstalledDescription: 'ZenFlow está instalado en tu dispositivo.',
    remindersTitle: 'Recordatorios',
    remindersDescription: 'Gentle reminders to keep you on track.',
    moodReminder: 'Mood check-in time',
    habitReminder: 'Habit reminder time',
    focusReminder: 'Focus nudge time',
    quietHours: 'Quiet hours',
    reminderDays: 'Days of week',
    selectedHabits: 'Habits to remind',
    noHabitsYet: 'No habits yet.',
    reminderMoodTitle: 'Mood check-in',
    reminderMoodBody: 'Take 30 seconds to log how you feel.',
    reminderHabitTitle: 'Habit reminder',
    reminderHabitBody: 'Time to check your habits:',
    reminderFocusTitle: 'Focus nudge',
    reminderFocusBody: 'Ready for a focused session?',
    reminderDismiss: 'Dismiss',
    notificationPermissionTitle: 'Stay on Track',
    notificationPermissionDescription: 'Get gentle reminders to track your mood, complete habits, and take focus breaks. Notifications help you build healthy routines.',
    notificationFeature1Title: 'Daily Mood Reminders',
    notificationFeature1Desc: 'Check in with yourself every day',
    notificationFeature2Title: 'Habit Tracking',
    notificationFeature2Desc: 'Stay consistent with your goals',
    notificationFeature3Title: 'Focus Sessions',
    notificationFeature3Desc: 'Get reminded to take productive breaks',
    notificationAllow: 'Enable Notifications',
    notificationDeny: 'Maybe Later',
    notificationPrivacyNote: 'You can change this anytime in Settings. Notifications are local and private.',
    onboardingStep: 'Step',
    onboardingValueTitle: 'Track mood + habits in 30 seconds a day',
    onboardingValueBody: 'Quick check-ins, zero clutter, fully private.',
    onboardingStart: 'Start in 30 sec',
    onboardingExplore: 'Explore',
    onboardingGoalTitle: 'Pick your focus',
    onboardingGoalLessStress: 'Less stress',
    onboardingGoalLessStressDesc: 'Calm and gentle habits',
    onboardingGoalMoreEnergy: 'More energy',
    onboardingGoalMoreEnergyDesc: 'Sleep, movement, hydration',
    onboardingGoalBetterRoutine: 'Better routine',
    onboardingGoalBetterRoutineDesc: 'Stability and rhythm',
    onboardingContinue: 'Continue',
    onboardingCheckinTitle: 'Quick check-in',
    onboardingHabitsPrompt: 'Choose two habits',
    onboardingPickTwo: 'Pick up to two',
    onboardingReminderTitle: 'Enable reminders',
    onboardingReminderBody: 'Choose a time that fits you. No spam.',
    onboardingMorning: 'Morning',
    onboardingEvening: 'Evening',
    onboardingEnable: 'Enable',
    onboardingSkip: 'Skip for now',
    onboardingHabitBreathing: 'Breathing',
    onboardingHabitEveningWalk: 'Evening walk',
    onboardingHabitStretch: 'Stretch',
    onboardingHabitJournaling: 'Journaling',
    onboardingHabitWater: 'Water',
    onboardingHabitSunlight: 'Sunlight',
    onboardingHabitMovement: 'Movement',
    onboardingHabitSleepOnTime: 'Sleep on time',
    onboardingHabitMorningPlan: 'Morning plan',
    onboardingHabitRead: 'Read 10 min',
    onboardingHabitNoScreens: 'No late screens',
    onboardingHabitDailyReview: 'Daily review',
    account: 'Account',
    accountDescription: 'Sign in by email to sync progress across devices.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Send magic link',
    continueWithGoogle: 'Continue with Google',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    syncNow: 'Sync now',
    cloudSyncDisabled: 'Cloud sync disabled.',
    deleteAccount: 'Eliminar cuenta',
    deleteAccountConfirm: '¿Eliminar tu cuenta?',
    deleteAccountWarning: 'Esto eliminará los datos en la nube y el acceso a tu cuenta.',
    deleteAccountSuccess: 'Cuenta eliminada.',
    deleteAccountError: 'No se pudo eliminar la cuenta.',
    deleteAccountLink: 'Cómo eliminar la cuenta/datos',
    authEmailSent: 'Login link sent to your email.',
    authSignedOut: 'Signed out.',
    authError: 'Failed to send link.',
    authNotConfigured: 'Supabase not configured.',
    syncSuccess: 'Sync complete.',
    syncPulled: 'Cloud data restored.',
    syncPushed: 'Cloud updated.',
    syncError: 'Sync failed.',
    authGateTitle: 'Sign in',
    authGateBody: 'Sign in by email to save progress and sync across devices.',
    authGateContinue: 'Continue without account',
    errorBoundaryTitle: 'Something went wrong',
    errorBoundaryBody: 'Try reloading the app or export a debug report.',
    errorBoundaryExport: 'Export debug report',
    errorBoundaryReload: 'Reload app',
    pushTitle: 'Push notifications',
    pushEnable: 'Enable push',
    pushDisable: 'Disable push',
    pushTest: 'Test push',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Test notification.',
    pushTestSent: 'Test sent.',
    pushTestError: 'Failed to send test.',
    pushNowMood: 'Push: mood',
    pushNowHabit: 'Push: habits',
    pushNowFocus: 'Push: focus',
    pushEnabled: 'Push enabled.',
    pushDisabled: 'Push disabled.',
    pushError: 'Failed to enable push.',
    pushNeedsAccount: 'Sign in to enable push.',
    pushPermissionDenied: 'Notification permission denied.',
    areYouSure: '¿Estás seguro?',
    cannotBeUndone: 'Esta acción no se puede deshacer.',
    delete: 'Eliminar',
    shareAchievements: 'Compartir tu progreso',
    shareTitle: 'Mi progreso en ZenFlow',
    shareText: '¡{streak} días seguidos! {habits} hábitos completados, {focus} minutos de enfoque.',
    shareButton: 'Compartir',
    shareDownload: 'Descargar imagen',
    shareDownloading: 'Descargando...',
    shareCopyLink: 'Copiar enlace',
    shareCopied: '¡Copiado!',
    sharePrivacyNote: 'No se comparten datos personales. Solo tu resumen de progreso.',
    shareStreak: 'Días seguidos',
    shareHabits: 'Hábitos',
    shareFocus: 'Minutos',
    shareGratitude: 'Gratitudes',
    shareFooter: 'Rastrea tus hábitos, estado de ánimo y enfoque',
    myProgress: 'Mi progreso',
    shareSquare: 'Post 1:1',
    shareStory: 'Historia 9:16',
    shareFormatHint: '📱 Formato de historia para Instagram/TikTok • Formato de publicación para feeds',
    challengesTitle: 'Desafíos y insignias',
    challengesSubtitle: 'Acepta desafíos y gana insignias',
    activeChallenges: 'Activos',
    availableChallenges: 'Disponibles',
    badges: 'Insignias',
    noChallengesActive: 'Sin desafíos activos',
    noChallengesActiveHint: 'Comienza un desafío para rastrear tu progreso',
    progress: 'Progreso',
    reward: 'Recompensa',
    target: 'Objetivo',
    startChallenge: 'Iniciar desafío',
    challengeActive: 'Activo',
    requirement: 'Requisito',
    challengeTypeStreak: 'Racha',
    challengeTypeFocus: 'Enfoque',
    challengeTypeGratitude: 'Gratitud',
    challengeTypeTotal: 'Total',
    hyperfocusMode: 'Modo Hiperenfoque',
    hyperfocusStart: 'Comenzar',
    hyperfocusPause: 'Pausa',
    hyperfocusResume: 'Reanudar',
    hyperfocusExit: 'Salir',
    hyperfocusReady: '¿Listo para hiperenfoque?',
    hyperfocusFocusing: 'En la zona...',
    hyperfocusPaused: 'Pausado',
    hyperfocusTimeLeft: 'restante',
    hyperfocusBreathe: 'Respira...',
    hyperfocusBreathDesc: 'Inhala 4s • Exhala 4s',
    hyperfocusEmergencyConfirm: '¿Quieres pausar la sesión? ¡Sin culpa! 💜',
    hyperfocusAmbientSound: 'Sonido Ambiental',
    hyperfocusSoundNone: 'Ninguno',
    hyperfocusSoundWhiteNoise: 'Ruido Blanco',
    hyperfocusSoundRain: 'Lluvia',
    hyperfocusSoundOcean: 'Océano',
    hyperfocusSoundForest: 'Bosque',
    hyperfocusSoundCoffee: 'Cafetería',
    hyperfocusSoundFireplace: 'Chimenea',
    hyperfocusSoundVariants: 'Variantes de Sonido',
    hyperfocusShowVariants: 'Mostrar variantes',
    hyperfocusHideVariants: 'Ocultar variantes',
    hyperfocusTip: 'Consejo',
    hyperfocusTipText: 'Cada 25 minutos habrá una breve pausa de respiración. ¡Esto ayuda a prevenir el agotamiento!',
    hyperfocusPauseMsg: 'Presiona Play para continuar',

    // Widget Settings
    widgetSettings: 'Configuración de Widgets',
    widgetSettingsDesc: 'Configura widgets para tu pantalla de inicio',
    widgetPreview: 'Vista Previa',
    widgetSetup: 'Instalación',
    widgetInfo: 'Los widgets se actualizan automáticamente',
    widgetInfoDesc: 'Los datos de los widgets se sincronizan cada vez que actualizas hábitos, completas sesiones de enfoque u obtienes nuevas insignias.',
    widgetStatus: 'Estado de Widgets',
    widgetPlatform: 'Plataforma',
    widgetWeb: 'Web (widgets no disponibles)',
    widgetSupport: 'Soporte de Widgets',
    widgetAvailable: 'Disponibles',
    widgetComingSoon: 'Próximamente',
    widgetSetupiOS: 'Instalación de Widget en iOS',
    widgetSetupAndroid: 'Instalación de Widget en Android',
    widgetStep1iOS: 'Mantén presionado en la pantalla de inicio hasta que los iconos tiemblen',
    widgetStep2iOS: 'Toca "+" en la esquina superior izquierda',
    widgetStep3iOS: 'Busca "ZenFlow" en la lista de apps',
    widgetStep4iOS: 'Elige el tamaño del widget (pequeño, mediano o grande)',
    widgetStep5iOS: 'Toca "Añadir Widget"',
    widgetStep1Android: 'Mantén presionado en un espacio vacío de la pantalla de inicio',
    widgetStep2Android: 'Toca "Widgets" en el menú',
    widgetStep3Android: 'Busca "ZenFlow" en la lista de apps',
    widgetStep4Android: 'Arrastra el widget a tu pantalla de inicio',
    widgetWebWarning: 'Widgets no disponibles en versión web',
    widgetWebWarningDesc: 'Los widgets solo funcionan en dispositivos móviles (iOS y Android). Instala la app móvil para usar widgets.',
    widgetWebTip: 'La versión web muestra vistas previas de widgets para que puedas ver cómo se verán en móvil.',
    widgetFeatures: 'Funciones de Widgets',
    widgetFeature1: 'Mostrar racha actual de días consecutivos',
    widgetFeature2: 'Progreso de hábitos completados hoy',
    widgetFeature3: 'Minutos de sesiones de enfoque',
    widgetFeature4: 'Última insignia obtenida',
    widgetFeature5: 'Lista de hábitos con estado de completado',
    widgetSmall: 'Widget Pequeño',
    widgetMedium: 'Widget Mediano',
    widgetLarge: 'Widget Grande',
    widgetNoData: 'Sin datos de widget',
    todayHabits: 'Hábitos de Hoy',
    lastBadge: 'Última Insignia',
    done: 'hecho',

    dopamineSettings: 'Dopamine Dashboard',
    dopamineSettingsDesc: 'Personaliza tu experiencia de retroalimentación',
    dopamineIntensity: 'Nivel de intensidad',
    dopamineMinimal: 'Mínimo',
    dopamineNormal: 'Normal',
    dopamineADHD: 'TDAH',
    dopamineMinimalDesc: 'Experiencia tranquila sin distracciones',
    dopamineNormalDesc: 'Retroalimentación y motivación equilibradas',
    dopamineADHDDesc: '¡Máxima dopamina! Todos los efectos activados 🎉',
    dopamineCustomize: 'Ajustar configuración',
    dopamineAnimations: 'Animaciones',
    dopamineAnimationsDesc: 'Transiciones y efectos suaves',
    dopamineSounds: 'Sonidos',
    dopamineSoundsDesc: 'Sonidos de éxito y retroalimentación de audio',
    dopamineHaptics: 'Hápticos',
    dopamineHapticsDesc: 'Retroalimentación por vibración (solo móvil)',
    dopamineConfetti: 'Confeti',
    dopamineConfettiDesc: 'Celebra los hábitos completados',
    dopamineStreakFire: 'Fuego de racha',
    dopamineStreakFireDesc: 'Fuego animado para rachas',
    dopamineTip: 'Consejo TDAH',
    dopamineTipText: '¡Los cerebros con TDAH necesitan más dopamina! Prueba el modo TDAH para máxima motivación. Siempre puedes ajustar configuraciones individuales.',
    dopamineSave: 'Guardar y cerrar',
    dailyRewards: 'Recompensas Diarias',
    loginStreak: 'Días Consecutivos',
    day: 'Día',
    claim: '¡Reclamar!',
    claimed: 'Reclamado',
    streakBonus: 'Bono de Racha',
    dailyRewardsTip: '¡Vuelve cada día para mejores recompensas!',
    spinWheel: '¡Gira la Ruleta!',
    spinsAvailable: 'Giros Disponibles',
    spin: 'GIRAR',
    noSpins: 'Sin Giros',
    claimPrize: '¡Reclamar Premio!',
    challengeExpired: 'Desafío Expirado',
    challengeComplete: '¡Desafío Completado!',
    earned: 'ganado',
    comboText: 'COMBO',
    mysteryBox: 'Caja Misteriosa',
    openBox: 'Abrir',
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

    // Onboarding
    welcomeMessage: '¡Bienvenido a ZenFlow!',
    featureMood: 'Seguimiento del estado de ánimo',
    featureMoodDescription: 'Registra tu estado de ánimo todos los días',
    featureHabits: 'Hábitos',
    featureHabitsDescription: 'Crea y rastrea hábitos saludables',
    featureFocus: 'Sesiones de enfoque',
    featureFocusDescription: 'Mantén el enfoque con el temporizador Pomodoro',
    privacyNote: 'Tus datos se almacenan localmente y están protegidos',
    install: 'Instalar aplicación',
    installDescription: 'Instala ZenFlow en tu pantalla de inicio',
    onboardingMoodTitle: '¿Cómo te sientes?',
    onboardingMoodDescription: 'Rastrea tu estado de ánimo diariamente',
    onboardingHabitsTitle: 'Crea tus primeros hábitos',
    onboardingHabitsDescription: 'Comienza con pequeños pasos',
    onboardingRemindersTitle: 'Recordatorios',
    onboardingRemindersDescription: 'Recibe recordatorios para tus hábitos',
    enableReminders: 'Activar recordatorios',
    morning: 'Mañana',
    afternoon: 'Tarde',
    evening: 'Noche',
    close: 'Cerrar',
    skip: 'Omitir',
    getStarted: 'Comenzar',
    next: 'Siguiente',
    remindersActive: 'Recordatorios activos',
    greatChoice: '¡Buena elección!',
    habitsSelected: 'hábitos seleccionados',

    // Welcome Tutorial
    tutorialWelcomeTitle: 'Bienvenido a ZenFlow',
    tutorialWelcomeSubtitle: 'Tu compañero personal de bienestar',
    tutorialWelcomeDesc: 'Una aplicación diseñada para ayudarte a mantener el enfoque, crear hábitos saludables y sentirte mejor cada día.',
    tutorialBrainTitle: 'Diseñado para tu cerebro',
    tutorialBrainSubtitle: '¿Tienes TDAH o simplemente te cuesta concentrarte?',
    tutorialBrainDesc: 'ZenFlow utiliza técnicas respaldadas por la ciencia para ayudarte a gestionar la atención, el tiempo y la energía. No necesitas diagnóstico – si te cuesta concentrarte, esta app es para ti.',
    tutorialFeaturesTitle: 'Qué puedes hacer',
    tutorialFeaturesSubtitle: 'Herramientas simples, gran impacto',
    tutorialFeaturesDesc: 'Rastrea tu progreso y gana impulso:',
    tutorialFeature1: 'Rastrea el estado de ánimo y energía diaria',
    tutorialFeature2: 'Construye hábitos paso a paso',
    tutorialFeature3: 'Sesiones de enfoque con sonidos ambientales',
    tutorialFeature4: 'Diario de gratitud',
    tutorialMoodTitle: 'Entiéndete a ti mismo',
    tutorialMoodSubtitle: 'Rastrea estados de ánimo para encontrar patrones',
    tutorialMoodDesc: 'Los registros diarios rápidos te ayudan a notar qué afecta tu energía y enfoque. Con el tiempo, te entenderás mejor.',
    tutorialFocusTitle: 'Modo de enfoque profundo',
    tutorialFocusSubtitle: 'Bloquea distracciones, haz las cosas',
    tutorialFocusDesc: 'Usa la técnica Pomodoro con sonidos ambientales relajantes. Perfecto para trabajo, estudio o proyectos creativos.',
    tutorialDayClockTitle: 'Tu día de un vistazo',
    tutorialDayClockSubtitle: 'Medidor visual de energía para cerebros con TDAH',
    tutorialDayClockDesc: 'Ve tu día como un círculo con zonas de mañana, tarde y noche. ¡Observa cómo crece tu energía al completar actividades!',
    tutorialDayClockFeature1: '⚡ El medidor de energía se llena con el progreso',
    tutorialDayClockFeature2: '😊 La mascota reacciona a tus logros',
    tutorialDayClockFeature3: '🎯 Rastrea todas las actividades en un lugar',
    tutorialDayClockFeature4: '🏆 ¡Alcanza 100% para el Día Perfecto!',
    tutorialMoodThemeTitle: 'La app se adapta a ti',
    tutorialMoodThemeSubtitle: 'El diseño cambia con tu estado de ánimo',
    tutorialMoodThemeDesc: 'Cuando te sientes genial, la app celebra con colores vibrantes. Cuando estás mal, se vuelve tranquila y reconfortante.',
    tutorialMoodThemeFeature1: '😄 Genial: Púrpura vibrante y dorado',
    tutorialMoodThemeFeature2: '🙂 Buen humor: Verdes cálidos',
    tutorialMoodThemeFeature3: '😔 Mal humor: Azules calmantes',
    tutorialMoodThemeFeature4: '😢 Tiempos difíciles: Diseño suave y minimalista',
    tutorialReadyTitle: '¿Listo para empezar?',
    tutorialReadySubtitle: 'Tu viaje comienza ahora',
    tutorialReadyDesc: 'Empieza pequeño – solo registra cómo te sientes hoy. ¡Cada paso cuenta!',
    tutorialStart: '¡Vamos!',

    // Weekly Report
    weeklyReport: 'Informe semanal',
    incredibleWeek: '¡Semana increíble!',
    pathToMastery: '¡Estás en el camino hacia la maestría!',
    greatWork: '¡Gran trabajo!',
    keepMomentum: '¡Mantén el impulso!',
    goodProgress: '¡Buen progreso!',
    everyStepCounts: '¡Cada paso cuenta!',
    newWeekOpportunities: '¡Nueva semana - Nuevas oportunidades!',
    startSmall: '¡Comienza poco a poco, avanza!',
    bestDay: 'Mejor día',
    continueBtn: 'Continuar',

    // Streak Celebration
    dayStreak: 'días seguidos',
    keepItUp: '¡Sigue así!',

    // Inner World Garden
    myCompanion: 'Mi Compañero',
    missedYou: '¡te extrañó!',
    welcomeBack: 'Bienvenido de vuelta a tu jardín',
    warmth: 'Calidez',
    energy: 'Energía',
    wisdom: 'Sabiduría',
    companionStreak: '¡Días seguidos!',
    chooseCompanion: 'Elige Compañero',
    levelUpHint: '¡Completa actividades para ganar XP y subir de nivel!',
    pet: 'Acariciar',
    feed: 'Alimentar',
    talk: 'Hablar',
    happiness: 'Felicidad',
    satiety: 'Saciedad',
    gardenEmpty: 'Nuevo Comienzo',
    gardenSprouting: 'Brotando',
    gardenGrowing: 'Creciendo',
    gardenFlourishing: 'Floreciendo',
    gardenMagical: 'Mágico',
    gardenLegendary: 'Legendario',

    // Companion Notifications
    companionMissesYou: '¡te extraña! 💕',
    companionWantsToPlay: '¡quiere pasar tiempo contigo!',
    companionWaiting: 'te espera en el jardín 🌱',
    companionProud: '¡está orgulloso de ti! ⭐',
    companionCheersYou: '¡te anima! 💪',
    companionQuickMood: '¿Cómo te sientes? ¡Toca! 😊',

    // Garden / My World
    myWorld: 'Mi mundo',
    plants: 'Plantas',
    creatures: 'Criaturas',
    level: 'Nivel',

    // Streak Banner
    startStreak: '¡Empieza tu racha hoy!',
    legendaryStreak: '¡Racha legendaria!',
    amazingStreak: '¡Increíble!',
    goodStart: '¡Gran comienzo!',
    todayActivities: 'Hoy',

    // Companion
    companionPet: 'Acariciar',
    companionFeed: 'Alimentar',
    companionTalk: 'Hablar',
    companionHappiness: 'Felicidad',
    companionHunger: 'Saciedad',

    // New Companion System
    companionHungryCanFeed: '🥺 Tengo hambre... ¿Me alimentas?',
    companionHungryNoTreats: '🥺 Tengo hambre... ¡Haz actividades para ganar golosinas!',
    companionStreakLegend: '🏆 ¡{streak} días! ¡Eres una leyenda!',
    companionStreakGood: '🔥 ¡{streak} días! ¡Sigue así!',
    companionAskMood: '💜 ¿Cómo te sientes hoy?',
    companionAskHabits: '🎯 ¡Hora de hábitos!',
    companionAskFocus: '🧠 ¿Listo para enfocarte?',
    companionAskGratitude: '💖 ¿Por qué estás agradecido?',
    companionAllDone: '🏆 ¡Día perfecto! ¡Eres increíble!',
    companionHappy: '💕 ¡Te quiero!',
    companionMorning: '☀️ ¡Buenos días!',
    companionAfternoon: '🌤️ ¿Cómo va tu día?',
    companionEvening: '🌙 ¡Buenas noches!',
    companionNight: '💤 Zzz...',
    companionLevelUp: '🎉 ¡Subiste de nivel! ¡Ahora nivel {level}!',
    companionNeedsFood: '¡Tu compañero tiene hambre!',
    petReaction1: '💕 *ronroneo*',
    petReaction2: '✨ ¡Qué bien se siente!',
    petReaction3: '😊 ¡Gracias!',
    petReaction4: '💖 ¡Te quiero!',
    feedReaction1: '🍪 ¡Delicioso!',
    feedReaction2: '😋 ¡Riquísimo!',
    feedReaction3: '✨ ¡Gracias!',
    feedReaction4: '💪 ¡Energía!',
    feedNotEnough: '🍪 Necesitas {needed} golosinas, tienes {have}',
    free: 'Gratis',
    fullness: 'Saciedad',
    earnTreatsHint: '¡Completa actividades para ganar golosinas para tu compañero!',

    // Seasonal Tree System
    myTree: 'Mi Árbol',
    touch: 'Tocar',
    water: 'Regar',
    waterLevel: 'Nivel de agua',
    growth: 'Crecimiento',
    stage: 'Etapa',
    treeThirstyCanWater: '💧 El árbol necesita agua...',
    treeThirstyNoTreats: '🥀 Sediento... ¡Haz actividades para ganar golosinas!',
    treeStreakLegend: '🌟 ¡{streak} días! ¡El árbol brilla!',
    treeStreakGood: '✨ ¡{streak} días! ¡Creciendo fuerte!',
    treeMaxStage: '🌳 ¡Un magnífico gran árbol!',
    treeStage4: '🌲 ¡Un hermoso árbol maduro!',
    treeStage3: '🌿 ¡Creciendo en un arbolito fuerte!',
    treeStage2: '🌱 ¡Un brote joven alcanzando la luz!',
    treeStage1: '🌰 ¡Una pequeña semilla llena de potencial!',
    treeHappy: '💚 ¡El árbol está floreciendo!',
    treeSeason: '{emoji} ¡Hermosa {season}!',
    treeStageUp: '🎉 ¡Evolucionó a {stage}!',
    treeMissedYou: '¡Tu árbol te extrañó!',
    treeNeedsWater: '¡El árbol necesita agua!',
    waterDecayHint: 'El nivel de agua baja -2% por hora',
    seasonTreeHint: '¡El árbol cambia con las estaciones!',
    xpToNextStage: '{xp} XP para {stage}',
    touchReaction1: '✨ *susurro de hojas*',
    touchReaction2: '🍃 ¡Las hojas bailan!',
    touchReaction3: '💚 ¡Se siente vivo!',
    touchReaction4: '🌿 ¡Creciendo más fuerte!',
    waterReaction1: '💧 *absorbe agua*',
    waterReaction2: '🌊 ¡Refrescante!',
    waterReaction3: '💦 ¡Gracias!',
    waterReaction4: '✨ ¡Creciendo!',
    waterNotEnough: '🍪 Necesitas {needed} golosinas, tienes {have}',

    // Rest Mode
    restDayTitle: 'Día de descanso',
    restDayMessage: 'Descansa, tu racha está segura',
    restDayButton: 'Día de descanso',
    restDayCancel: 'Quiero registrar de todos modos',
    daysSaved: 'días conservados',
    restDaySupportive: 'Mañana continuamos juntos 💚',

    // Task Momentum
    taskMomentum: 'Tareas',
    taskMomentumDesc: 'Priorización amigable para TDAH',
    tasksInARow: 'tareas seguidas',
    taskNamePlaceholder: 'Nombre de la tarea...',
    durationMinutes: 'Duración (minutos)',
    interestLevel: 'Interés (1-10)',
    markAsUrgent: 'Marcar como urgente',
    urgent: 'Urgente',
    addTask: 'Añadir',
    topRecommendedTasks: 'Top 3 tareas recomendadas',
    quickWins: 'Victorias rápidas (menos de 2 min)',
    allTasks: 'Todas las tareas',
    noTasksYet: 'Sin tareas todavía',
    addFirstTaskMessage: '¡Añade tu primera tarea para empezar!',
    addFirstTask: 'Añadir primera tarea',
    adhdTaskTips: 'Consejos para TDAH',
    taskTip1: 'Empieza con victorias rápidas (2-5 min)',
    taskTip2: 'Gana impulso con completados consecutivos',
    taskTip3: 'Las tareas interesantes dan más dopamina',
    taskTip4: 'Urgente + corto = combo perfecto',
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
    howAreYouNow: 'Wie geht es dir jetzt?',
    moodToday: 'Stimmung heute',
    moodHistory: 'Tagesverlauf',
    moodRecorded: 'Stimmung aufgezeichnet!',
    moodNotes: 'Stimmungsnotizen',
    todayProgress: 'Heutiger Fortschritt',
    completed: 'Erledigt!',
    updateMood: 'Aktualisieren',
    great: 'Super',
    good: 'Gut',
    okay: 'Okay',
    bad: 'Schlecht',
    terrible: 'Schrecklich',
    addNote: 'Notiz hinzufügen (optional)...',
    saveMood: 'Stimmung speichern',
    startHere: 'Starte hier',
    tapToStart: 'Tippe auf ein Emoji, um deinen Tag zu beginnen',
    moodPrompt: 'Was hat das beeinflusst?',
    moodTagsTitle: 'Tags',
    moodTagPlaceholder: 'Tag hinzufügen...',
    moodTagAdd: 'Hinzufügen',
    moodTagFilter: 'Nach Tag filtern',
    allTags: 'Alle Tags',
    tagWork: 'Arbeit',
    tagFamily: 'Familie',
    tagHealth: 'Gesundheit',
    tagSleep: 'Schlaf',
    tagMoney: 'Geld',
    tagWeather: 'Wetter',
    moodPatternsTitle: 'Stimmungs-Muster',
    moodBestDay: 'Bester Wochentag',
    moodFocusComparison: 'Stimmung vs Fokus',
    moodFocusWith: 'Mit Fokus-Sessions',
    moodFocusWithout: 'Ohne Fokus',
    moodHabitCorrelations: 'Gewohnheiten vs Stimmung',
    moodNoData: 'Nicht genug Daten',
    editMood: 'Stimmung bearbeiten',
    changeMood: 'Stimmung ändern',
    changeMoodConfirmTitle: 'Stimmung ändern?',
    changeMoodConfirmMessage: 'Bist du sicher, dass du deine Stimmung ändern möchtest?',
    moodChanged: 'Stimmung aktualisiert!',
    confirm: 'Ändern',
    dailyProgress: 'Tagesfortschritt',
    continueProgress: 'Fortfahren',
    dayTimeline: 'Dein Tag',
    dayComplete: 'des Tages',
    perfectDay: 'Perfekter Tag!',
    startYourDay: 'Starte deinen Tag! 🌅',
    keepGoing: 'Weiter so! Du machst das toll 💪',
    almostThere: 'Fast geschafft! 🚀',
    soClose: 'So nah an der Perfektion! ⭐',
    legendaryDay: 'LEGENDÄRER TAG! 🏆🔥✨',

    // Schedule Timeline
    scheduleTitle: 'Dein Zeitplan',
    scheduleAddEvent: 'Ereignis hinzufügen',
    scheduleEmpty: 'Keine Ereignisse geplant. Tippe auf + um hinzuzufügen!',
    scheduleEmptyDay: 'Keine Ereignisse für diesen Tag',
    scheduleStart: 'Start',
    scheduleEnd: 'Ende',
    scheduleAdd: 'Zum Zeitplan hinzufügen',
    scheduleCustomTitle: 'Eigener Titel (optional)',
    scheduleWork: 'Arbeit',
    scheduleMeal: 'Mahlzeit',
    scheduleRest: 'Ruhe',
    scheduleExercise: 'Sport',
    scheduleStudy: 'Lernen',
    scheduleMeeting: 'Meeting',
    scheduleNote: 'Notiz (optional)',
    scheduleNotePlaceholder: 'Details oder Erinnerungen hinzufügen...',

    // Time Awareness (ADHD time blindness helper)
    timeUntilEndOfDay: 'Bis Tagesende',
    timeIn: 'in',
    timePassed: 'Zeit vergangen',
    timeNow: 'Jetzt!',
    hoursShort: 'h',
    minutesShort: 'm',
    night: 'Nacht',

    // AI Insights
    aiInsights: 'KI-Einblicke',
    aiInsight: 'KI-Einblick',
    personalizedForYou: 'Personalisiert für dich',
    insightsNeedMoreData: 'Notiere deine Stimmung eine Woche lang, um personalisierte Einblicke freizuschalten!',
    daysLogged: 'Tage notiert',
    showMore: 'Zeige',
    moreInsights: 'weitere Einblicke',
    hideInsights: 'Einblicke ausblenden',

    // Onboarding Hints
    hintFirstMoodTitle: 'Wie fühlst du dich?',
    hintFirstMoodDesc: 'Beginne den Tag mit einer Stimmungsnotiz. Es dauert nur 5 Sekunden und hilft dir, dich besser zu verstehen!',
    hintFirstMoodAction: 'Stimmung notieren',
    hintFirstHabitTitle: 'Erstelle deine erste Gewohnheit',
    hintFirstHabitDesc: 'Kleine Gewohnheiten führen zu großen Veränderungen. Versuche etwas Einfaches wie "Wasser trinken".',
    hintFirstHabitAction: 'Gewohnheit hinzufügen',
    hintFirstFocusTitle: 'Bereit dich zu fokussieren?',
    hintFirstFocusDesc: 'Nutze den Fokus-Timer mit beruhigenden Klängen. Starte mit nur 25 Minuten!',
    hintFirstFocusAction: 'Fokus starten',
    hintFirstGratitudeTitle: 'Übe Dankbarkeit',
    hintFirstGratitudeDesc: 'Schreibe eine Sache auf, für die du dankbar bist. Es ist ein starker Stimmungsaufheller!',
    hintFirstGratitudeAction: 'Dankbarkeit hinzufügen',
    hintScheduleTipTitle: 'Plane deinen Tag',
    hintScheduleTipDesc: 'Nutze die Zeitleiste, um deinen Tag auf einen Blick zu sehen. Füge Ereignisse hinzu!',
    hintScheduleTipAction: 'Zeitleiste ansehen',

    habits: 'Gewohnheiten',
    habitName: 'Name der Gewohnheit...',
    icon: 'Symbol',
    color: 'Farbe',
    addHabit: 'Gewohnheit hinzufügen',
    addFirstHabit: 'Füge deine erste Gewohnheit hinzu! ✨',
    completedTimes: 'Abgeschlossen',
    habitNameHint: 'Gib einen Namen ein, um hinzuzufügen.',
    habitType: 'Gewohnheitstyp',
    habitTypeDaily: 'Täglich',
    habitTypeWeekly: 'Wochenziel',
    habitTypeFrequency: 'Alle N Tage',
    habitTypeReduce: 'Reduzieren (Limit)',
    habitWeeklyGoal: 'Wochenziel (Mal)',
    habitFrequencyInterval: 'Intervall (Tage)',
    habitReduceLimit: 'Tageslimit',
    habitStrictStreak: 'Strenge Serie',
    habitGraceDays: 'Gnadentage pro Woche',
    habitWeeklyProgress: 'Diese Woche',
    habitEvery: 'Alle',
    habitReduceProgress: 'Heute',
    noHabitsToday: 'Keine Gewohnheiten heute.',
    habitsOther: 'Andere Gewohnheiten',
    habitTypeContinuous: 'Kontinuierlich (aufhören)',
    habitTypeScheduled: 'Geplant',
    habitTypeMultiple: 'Mehrmals täglich',
    habitDailyTarget: 'Tagesziel',
    habitStartDate: 'Startdatum',
    habitReminders: 'Erinnerungen',
    habitAddReminder: 'Erinnerung hinzufügen',
    habitReminderTime: 'Zeit',
    habitReminderDays: 'Wochentage',
    habitReminderEnabled: 'Aktiviert',
    habitRemindersPerHabit: 'Erinnerungen werden jetzt individuell für jede Gewohnheit konfiguriert. Fügen Sie Erinnerungen beim Erstellen oder Bearbeiten von Gewohnheiten hinzu.',
    perHabitRemindersTitle: 'Erinnerungen pro Gewohnheit',
    perHabitRemindersDesc: 'Jede Gewohnheit kann ihre eigenen benutzerdefinierten Erinnerungszeiten haben. Legen Sie diese beim Erstellen einer neuen Gewohnheit oder beim Bearbeiten einer bestehenden fest.',
    quickAdd: 'Schnell hinzufügen',
    createCustomHabit: 'Eigene Gewohnheit erstellen',
    streak: 'Serie',

    // Habit Frequency
    habitFrequency: 'Häufigkeit',
    habitFrequencyOnce: 'Einmalig',
    habitFrequencyDaily: 'Täglich',
    habitFrequencyWeekly: 'Wöchentlich',
    habitFrequencyCustom: 'Benutzerdefiniert',
    habitFrequencySelectDays: 'Tage Auswählen',
    habitDurationRequired: 'Erfordert Dauer?',
    habitTargetDuration: 'Zieldauer (Minuten)',
    habitDurationMinutes: 'Minuten',

    // Focus timer
    focus: 'Fokus',
    breakTime: 'Pause',
    todayMinutes: 'Min heute',
    concentrate: 'Konzentriere dich',
    takeRest: 'Mach eine Pause',
    focusPreset25: '25/5',
    focusPreset50: '50/10',
    focusPresetCustom: 'Benutzerdefiniert',
    focusLabelPrompt: 'Worauf konzentrierst du dich?',
    focusLabelPlaceholder: 'z. B. Bericht, Lernen, Projekt...',
    focusCustomWork: 'Arbeit (Min)',
    focusCustomBreak: 'Pause (Min)',
    focusReflectionTitle: 'Reflexion',
    focusReflectionQuestion: 'Wie war die Session?',
    focusReflectionSkip: 'Überspringen',
    focusReflectionSave: 'Speichern',

    // Breathing
    breathingTitle: 'Atmung',
    breathingSubtitle: 'Beruhige deinen Geist',
    breathingBox: 'Box-Atmung',
    breathingBoxDesc: 'Gleiche Phasen für Fokus',
    breathing478: '4-7-8 Entspannung',
    breathing478Desc: 'Tiefe Beruhigung',
    breathingEnergize: 'Energetisierend',
    breathingEnergizeDesc: 'Schneller Energieschub',
    breathingSleep: 'Schlafvorbereitung',
    breathingSleepDesc: 'Langsames Ausatmen',
    breatheIn: 'Einatmen',
    breatheOut: 'Ausatmen',
    hold: 'Halten',
    cycles: 'Zyklen',
    cycle: 'Zyklus',
    effectCalming: 'Beruhigend',
    effectFocusing: 'Fokus',
    effectEnergizing: 'Energie',
    effectSleeping: 'Schlaf',
    startBreathing: 'Starten',
    breathingComplete: 'Gut gemacht!',
    breathingCompleteMsg: 'Du hast die Atemübung abgeschlossen',
    breathingAgain: 'Nochmal',
    pause: 'Pause',
    resume: 'Fortsetzen',
    gratitude: 'Dankbarkeit',
    today: 'heute',
    tomorrow: 'morgen',
    scheduleDate: 'Datum',
    whatAreYouGratefulFor: 'Wofür bist du heute dankbar?',
    iAmGratefulFor: 'Ich bin dankbar für...',
    save: 'Speichern',
    cancel: 'Abbrechen',
    recentEntries: 'Letzte Einträge',
    gratitudeTemplate1: 'Heute bin ich dankbar für...',
    gratitudeTemplate2: 'Ein guter Moment heute...',
    gratitudeTemplate3: 'Ich schätze an mir...',
    gratitudeLimit: 'Bis zu 3 Punkte pro Tag',
    gratitudeMemoryJar: 'Erinnerungsglas',
    thisWeek: 'Diese Woche',
    statistics: 'Statistiken',
    monthlyOverview: 'Monatsübersicht',
    statsRange: 'Zeitraum',
    statsRangeWeek: 'Woche',
    statsRangeMonth: 'Monat',
    statsRangeAll: 'Alle Zeit',
    statsRangeApply: 'Anwenden',
    calendarTitle: 'Kalender',
    calendarYear: 'Jahr',
    calendarSelectDay: 'Tag auswählen',
    calendarPrevMonth: 'Vorheriger Monat',
    calendarNextMonth: 'Nächster Monat',
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
    moodHeatmap: 'Stimmungs-Heatmap',
    topHabit: 'Beste Gewohnheit',
    completedTimes2: 'Mal',
    profile: 'Profil',
    yourName: 'Dein Name',
    nameSaved: 'Name gespeichert',
    notifications: 'Benachrichtigungen',
    notificationsComingSoon: 'Benachrichtigungen werden in zukünftigen Updates verfügbar sein.',
    data: 'Daten',
    exportData: 'Daten exportieren',
    importData: 'Daten importieren',
    importMode: 'Importmodus',
    importMerge: 'Zusammenführen',
    importReplace: 'Ersetzen',
    exportSuccess: 'Export bereit.',
    exportError: 'Export fehlgeschlagen.',
    importSuccess: 'Import abgeschlossen.',
    importError: 'Dateiimport fehlgeschlagen.',
    importedItems: 'Hinzugefügt',
    importAdded: 'hinzugefügt',
    importUpdated: 'aktualisiert',
    importSkipped: 'übersprungen',
    comingSoon: 'bald verfügbar',
    resetAllData: 'Alle Daten zurücksetzen',
    privacyTitle: 'Privacy',
    privacyDescription: 'Your data stays on device. No hidden tracking.',
    privacyNoTracking: 'No tracking',
    privacyNoTrackingHint: 'We do not collect behavioral data.',
    privacyAnalytics: 'Analytics',
    privacyAnalyticsHint: 'Hilft, die App zu verbessern. Du kannst es deaktivieren.',
    privacyPolicy: 'Datenschutzerklaerung',
    termsOfService: 'Nutzungsbedingungen',

    // GDPR Consent
    consentTitle: 'Datenschutzeinstellungen',
    consentDescription: 'Wir respektieren deine Privatsphäre. Anonyme Analysen erlauben, um die App zu verbessern?',
    consentAnalyticsTitle: 'Anonyme Analysen',
    consentAnalyticsDesc: 'Nur Nutzungsmuster. Keine persönlichen Daten. Du kannst dies jederzeit in den Einstellungen ändern.',
    consentAccept: 'Erlauben',
    consentDecline: 'Nein danke',
    consentFooter: 'Du kannst dies jederzeit unter Einstellungen > Datenschutz ändern',

    installApp: 'App installieren',
    installAppDescription: 'Installiere ZenFlow für schnelleren Start und Offline-Zugriff.',
    installBannerTitle: 'ZenFlow installieren',
    installBannerBody: 'Schnellerer Start und Offline-Zugriff durch Installation der App.',
    installNow: 'Installieren',
    installLater: 'Später',
    appInstalled: 'App installiert',
    appInstalledDescription: 'ZenFlow ist auf deinem Gerät installiert.',
    remindersTitle: 'Erinnerungen',
    remindersDescription: 'Gentle reminders to keep you on track.',
    moodReminder: 'Mood check-in time',
    habitReminder: 'Habit reminder time',
    focusReminder: 'Focus nudge time',
    quietHours: 'Quiet hours',
    reminderDays: 'Days of week',
    selectedHabits: 'Habits to remind',
    noHabitsYet: 'No habits yet.',
    reminderMoodTitle: 'Mood check-in',
    reminderMoodBody: 'Take 30 seconds to log how you feel.',
    reminderHabitTitle: 'Habit reminder',
    reminderHabitBody: 'Time to check your habits:',
    reminderFocusTitle: 'Focus nudge',
    reminderFocusBody: 'Ready for a focused session?',
    reminderDismiss: 'Dismiss',
    notificationPermissionTitle: 'Stay on Track',
    notificationPermissionDescription: 'Get gentle reminders to track your mood, complete habits, and take focus breaks. Notifications help you build healthy routines.',
    notificationFeature1Title: 'Daily Mood Reminders',
    notificationFeature1Desc: 'Check in with yourself every day',
    notificationFeature2Title: 'Habit Tracking',
    notificationFeature2Desc: 'Stay consistent with your goals',
    notificationFeature3Title: 'Focus Sessions',
    notificationFeature3Desc: 'Get reminded to take productive breaks',
    notificationAllow: 'Enable Notifications',
    notificationDeny: 'Maybe Later',
    notificationPrivacyNote: 'You can change this anytime in Settings. Notifications are local and private.',
    onboardingStep: 'Step',
    onboardingValueTitle: 'Track mood + habits in 30 seconds a day',
    onboardingValueBody: 'Quick check-ins, zero clutter, fully private.',
    onboardingStart: 'Start in 30 sec',
    onboardingExplore: 'Explore',
    onboardingGoalTitle: 'Pick your focus',
    onboardingGoalLessStress: 'Less stress',
    onboardingGoalLessStressDesc: 'Calm and gentle habits',
    onboardingGoalMoreEnergy: 'More energy',
    onboardingGoalMoreEnergyDesc: 'Sleep, movement, hydration',
    onboardingGoalBetterRoutine: 'Better routine',
    onboardingGoalBetterRoutineDesc: 'Stability and rhythm',
    onboardingContinue: 'Continue',
    onboardingCheckinTitle: 'Quick check-in',
    onboardingHabitsPrompt: 'Choose two habits',
    onboardingPickTwo: 'Pick up to two',
    onboardingReminderTitle: 'Enable reminders',
    onboardingReminderBody: 'Choose a time that fits you. No spam.',
    onboardingMorning: 'Morning',
    onboardingEvening: 'Evening',
    onboardingEnable: 'Enable',
    onboardingSkip: 'Skip for now',
    onboardingHabitBreathing: 'Breathing',
    onboardingHabitEveningWalk: 'Evening walk',
    onboardingHabitStretch: 'Stretch',
    onboardingHabitJournaling: 'Journaling',
    onboardingHabitWater: 'Water',
    onboardingHabitSunlight: 'Sunlight',
    onboardingHabitMovement: 'Movement',
    onboardingHabitSleepOnTime: 'Sleep on time',
    onboardingHabitMorningPlan: 'Morning plan',
    onboardingHabitRead: 'Read 10 min',
    onboardingHabitNoScreens: 'No late screens',
    onboardingHabitDailyReview: 'Daily review',
    account: 'Account',
    accountDescription: 'Sign in by email to sync progress across devices.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Send magic link',
    continueWithGoogle: 'Continue with Google',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    syncNow: 'Sync now',
    cloudSyncDisabled: 'Cloud sync disabled.',
    deleteAccount: 'Konto löschen',
    deleteAccountConfirm: 'Konto löschen?',
    deleteAccountWarning: 'Dabei werden Cloud-Daten und der Zugriff auf das Konto entfernt.',
    deleteAccountSuccess: 'Konto gelöscht.',
    deleteAccountError: 'Konto konnte nicht gelöscht werden.',
    deleteAccountLink: 'Konto/Daten löschen',
    authEmailSent: 'Login link sent to your email.',
    authSignedOut: 'Signed out.',
    authError: 'Failed to send link.',
    authNotConfigured: 'Supabase not configured.',
    syncSuccess: 'Sync complete.',
    syncPulled: 'Cloud data restored.',
    syncPushed: 'Cloud updated.',
    syncError: 'Sync failed.',
    authGateTitle: 'Sign in',
    authGateBody: 'Sign in by email to save progress and sync across devices.',
    authGateContinue: 'Continue without account',
    errorBoundaryTitle: 'Something went wrong',
    errorBoundaryBody: 'Try reloading the app or export a debug report.',
    errorBoundaryExport: 'Export debug report',
    errorBoundaryReload: 'Reload app',
    pushTitle: 'Push notifications',
    pushEnable: 'Enable push',
    pushDisable: 'Disable push',
    pushTest: 'Test push',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Test notification.',
    pushTestSent: 'Test sent.',
    pushTestError: 'Failed to send test.',
    pushNowMood: 'Push: mood',
    pushNowHabit: 'Push: habits',
    pushNowFocus: 'Push: focus',
    pushEnabled: 'Push enabled.',
    pushDisabled: 'Push disabled.',
    pushError: 'Failed to enable push.',
    pushNeedsAccount: 'Sign in to enable push.',
    pushPermissionDenied: 'Notification permission denied.',
    areYouSure: 'Bist du sicher?',
    cannotBeUndone: 'Diese Aktion kann nicht rückgängig gemacht werden.',
    delete: 'Löschen',
    shareAchievements: 'Fortschritt teilen',
    shareTitle: 'Mein Fortschritt bei ZenFlow',
    shareText: '{streak} Tage in Folge! {habits} Gewohnheiten abgeschlossen, {focus} Minuten Fokus.',
    shareButton: 'Teilen',
    shareDownload: 'Bild herunterladen',
    shareDownloading: 'Wird heruntergeladen...',
    shareCopyLink: 'Link kopieren',
    shareCopied: 'Kopiert!',
    sharePrivacyNote: 'Keine persönlichen Daten werden geteilt. Nur deine Fortschrittszusammenfassung.',
    shareStreak: 'Tage in Folge',
    shareHabits: 'Gewohnheiten',
    shareFocus: 'Minuten',
    shareGratitude: 'Dankbarkeiten',
    shareFooter: 'Verfolge deine Gewohnheiten, Stimmung und Fokus',
    myProgress: 'Mein Fortschritt',
    shareSquare: 'Beitrag 1:1',
    shareStory: 'Story 9:16',
    shareFormatHint: '📱 Story-Format für Instagram/TikTok • Beitragsformat für Feeds',
    challengesTitle: 'Herausforderungen & Abzeichen',
    challengesSubtitle: 'Nimm Herausforderungen an und verdiene Abzeichen',
    activeChallenges: 'Aktiv',
    availableChallenges: 'Verfügbar',
    badges: 'Abzeichen',
    noChallengesActive: 'Keine aktiven Herausforderungen',
    noChallengesActiveHint: 'Starte eine Herausforderung, um deinen Fortschritt zu verfolgen',
    progress: 'Fortschritt',
    reward: 'Belohnung',
    target: 'Ziel',
    startChallenge: 'Herausforderung starten',
    challengeActive: 'Aktiv',
    requirement: 'Anforderung',
    challengeTypeStreak: 'Streak',
    challengeTypeFocus: 'Fokus',
    challengeTypeGratitude: 'Dankbarkeit',
    challengeTypeTotal: 'Gesamt',
    hyperfocusMode: 'Hyperfokus-Modus',
    hyperfocusStart: 'Starten',
    hyperfocusPause: 'Pause',
    hyperfocusResume: 'Fortsetzen',
    hyperfocusExit: 'Beenden',
    hyperfocusReady: 'Bereit für Hyperfokus?',
    hyperfocusFocusing: 'In der Zone...',
    hyperfocusPaused: 'Pausiert',
    hyperfocusTimeLeft: 'übrig',
    hyperfocusBreathe: 'Atmen...',
    hyperfocusBreathDesc: 'Einatmen 4s • Ausatmen 4s',
    hyperfocusEmergencyConfirm: 'Möchten Sie die Sitzung pausieren? Ohne Schuldgefühle! 💜',
    hyperfocusAmbientSound: 'Umgebungsgeräusch',
    hyperfocusSoundNone: 'Keins',
    hyperfocusSoundWhiteNoise: 'Weißes Rauschen',
    hyperfocusSoundRain: 'Regen',
    hyperfocusSoundOcean: 'Ozean',
    hyperfocusSoundForest: 'Wald',
    hyperfocusSoundCoffee: 'Café',
    hyperfocusSoundFireplace: 'Kamin',
    hyperfocusSoundVariants: 'Klangvarianten',
    hyperfocusShowVariants: 'Varianten anzeigen',
    hyperfocusHideVariants: 'Varianten ausblenden',
    hyperfocusTip: 'Tipp',
    hyperfocusTipText: 'Alle 25 Minuten gibt es eine kurze Atempause. Das hilft, Burnout zu vermeiden!',
    hyperfocusPauseMsg: 'Drücke Play zum Fortfahren',

    // Widget Settings
    widgetSettings: 'Widget-Einstellungen',
    widgetSettingsDesc: 'Widgets für deinen Startbildschirm konfigurieren',
    widgetPreview: 'Vorschau',
    widgetSetup: 'Einrichtung',
    widgetInfo: 'Widgets werden automatisch aktualisiert',
    widgetInfoDesc: 'Widget-Daten werden synchronisiert, wenn du Gewohnheiten aktualisierst, Fokus-Sitzungen abschließt oder neue Abzeichen erhältst.',
    widgetStatus: 'Widget-Status',
    widgetPlatform: 'Plattform',
    widgetWeb: 'Web (Widgets nicht verfügbar)',
    widgetSupport: 'Widget-Unterstützung',
    widgetAvailable: 'Verfügbar',
    widgetComingSoon: 'Demnächst',
    widgetSetupiOS: 'Widget auf iOS einrichten',
    widgetSetupAndroid: 'Widget auf Android einrichten',
    widgetStep1iOS: 'Lange auf den Startbildschirm drücken, bis die Symbole wackeln',
    widgetStep2iOS: 'Tippe auf "+" in der oberen linken Ecke',
    widgetStep3iOS: 'Finde "ZenFlow" in der App-Liste',
    widgetStep4iOS: 'Wähle die Widget-Größe (klein, mittel oder groß)',
    widgetStep5iOS: 'Tippe auf "Widget hinzufügen"',
    widgetStep1Android: 'Lange auf eine leere Stelle des Startbildschirms drücken',
    widgetStep2Android: 'Tippe auf "Widgets" im Menü',
    widgetStep3Android: 'Finde "ZenFlow" in der App-Liste',
    widgetStep4Android: 'Ziehe das Widget auf deinen Startbildschirm',
    widgetWebWarning: 'Widgets in der Web-Version nicht verfügbar',
    widgetWebWarningDesc: 'Widgets funktionieren nur auf mobilen Geräten (iOS und Android). Installiere die mobile App, um Widgets zu nutzen.',
    widgetWebTip: 'Die Web-Version zeigt Widget-Vorschauen, damit du sehen kannst, wie sie auf dem Handy aussehen werden.',
    widgetFeatures: 'Widget-Funktionen',
    widgetFeature1: 'Aktuelle Streak-Tage anzeigen',
    widgetFeature2: 'Heutiger Gewohnheiten-Fortschritt',
    widgetFeature3: 'Fokus-Sitzungs-Minuten',
    widgetFeature4: 'Zuletzt erhaltenes Abzeichen',
    widgetFeature5: 'Gewohnheitsliste mit Abschlussstatus',
    widgetSmall: 'Kleines Widget',
    widgetMedium: 'Mittleres Widget',
    widgetLarge: 'Großes Widget',
    widgetNoData: 'Keine Widget-Daten verfügbar',
    todayHabits: 'Heutige Gewohnheiten',
    lastBadge: 'Letztes Abzeichen',
    done: 'erledigt',

    dopamineSettings: 'Dopamine Dashboard',
    dopamineSettingsDesc: 'Passe dein Feedback-Erlebnis an',
    dopamineIntensity: 'Intensitätsstufe',
    dopamineMinimal: 'Minimal',
    dopamineNormal: 'Normal',
    dopamineADHD: 'ADHS',
    dopamineMinimalDesc: 'Ruhige, ablenkungsfreie Erfahrung',
    dopamineNormalDesc: 'Ausgewogenes Feedback und Motivation',
    dopamineADHDDesc: 'Maximales Dopamin! Alle Effekte aktiviert 🎉',
    dopamineCustomize: 'Feineinstellungen',
    dopamineAnimations: 'Animationen',
    dopamineAnimationsDesc: 'Sanfte Übergänge und Effekte',
    dopamineSounds: 'Sounds',
    dopamineSoundsDesc: 'Erfolgs-Sounds und Audio-Feedback',
    dopamineHaptics: 'Haptik',
    dopamineHapticsDesc: 'Vibrations-Feedback (nur mobil)',
    dopamineConfetti: 'Konfetti',
    dopamineConfettiDesc: 'Feiere abgeschlossene Gewohnheiten',
    dopamineStreakFire: 'Streak-Feuer',
    dopamineStreakFireDesc: 'Animiertes Feuer für Streaks',
    dopamineTip: 'ADHS-Tipp',
    dopamineTipText: 'ADHS-Gehirne brauchen mehr Dopamin! Probiere den ADHS-Modus für maximale Motivation. Du kannst jederzeit einzelne Einstellungen anpassen.',
    dopamineSave: 'Speichern & Schließen',
    dailyRewards: 'Tägliche Belohnungen',
    loginStreak: 'Login-Serie',
    day: 'Tag',
    claim: 'Abholen!',
    claimed: 'Abgeholt',
    streakBonus: 'Serien-Bonus',
    dailyRewardsTip: 'Komm jeden Tag für bessere Belohnungen!',
    spinWheel: 'Dreh das Rad!',
    spinsAvailable: 'Drehungen verfügbar',
    spin: 'DREHEN',
    noSpins: 'Keine Drehungen',
    claimPrize: 'Preis abholen!',
    challengeExpired: 'Herausforderung abgelaufen',
    challengeComplete: 'Herausforderung abgeschlossen!',
    earned: 'verdient',
    comboText: 'KOMBO',
    mysteryBox: 'Überraschungsbox',
    openBox: 'Öffnen',
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

    // Onboarding
    welcomeMessage: 'Willkommen bei ZenFlow!',
    featureMood: 'Stimmungsverfolgung',
    featureMoodDescription: 'Verfolge deine Stimmung jeden Tag',
    featureHabits: 'Gewohnheiten',
    featureHabitsDescription: 'Erstelle und verfolge gesunde Gewohnheiten',
    featureFocus: 'Fokus-Sitzungen',
    featureFocusDescription: 'Bleib konzentriert mit dem Pomodoro-Timer',
    privacyNote: 'Deine Daten werden lokal gespeichert und sind geschützt',
    install: 'App installieren',
    installDescription: 'Installiere ZenFlow auf deinem Startbildschirm',
    onboardingMoodTitle: 'Wie fühlst du dich?',
    onboardingMoodDescription: 'Verfolge deine Stimmung täglich',
    onboardingHabitsTitle: 'Erstelle deine ersten Gewohnheiten',
    onboardingHabitsDescription: 'Beginne mit kleinen Schritten',
    onboardingRemindersTitle: 'Erinnerungen',
    onboardingRemindersDescription: 'Erhalte Erinnerungen für deine Gewohnheiten',
    enableReminders: 'Erinnerungen aktivieren',
    morning: 'Morgen',
    afternoon: 'Nachmittag',
    evening: 'Abend',
    close: 'Schließen',
    skip: 'Überspringen',
    getStarted: 'Loslegen',
    next: 'Weiter',
    remindersActive: 'Erinnerungen aktiv',
    greatChoice: 'Gute Wahl!',
    habitsSelected: 'Gewohnheiten ausgewählt',

    // Welcome Tutorial
    tutorialWelcomeTitle: 'Willkommen bei ZenFlow',
    tutorialWelcomeSubtitle: 'Dein persönlicher Wellness-Begleiter',
    tutorialWelcomeDesc: 'Eine App, die dir hilft, fokussiert zu bleiben, gesunde Gewohnheiten aufzubauen und dich jeden Tag besser zu fühlen.',
    tutorialBrainTitle: 'Für dein Gehirn entwickelt',
    tutorialBrainSubtitle: 'Ob du ADHS hast oder einfach Schwierigkeiten mit dem Fokus',
    tutorialBrainDesc: 'ZenFlow verwendet wissenschaftlich fundierte Techniken, um Aufmerksamkeit, Zeit und Energie zu managen. Keine Diagnose nötig – wenn du Schwierigkeiten hast, dich zu konzentrieren, ist diese App für dich.',
    tutorialFeaturesTitle: 'Was du tun kannst',
    tutorialFeaturesSubtitle: 'Einfache Tools, große Wirkung',
    tutorialFeaturesDesc: 'Verfolge deinen Fortschritt und gewinne Schwung:',
    tutorialFeature1: 'Tägliche Stimmung und Energie verfolgen',
    tutorialFeature2: 'Gewohnheiten Schritt für Schritt aufbauen',
    tutorialFeature3: 'Fokus-Sitzungen mit Umgebungsgeräuschen',
    tutorialFeature4: 'Dankbarkeitstagebuch',
    tutorialMoodTitle: 'Verstehe dich selbst',
    tutorialMoodSubtitle: 'Verfolge Stimmungen, um Muster zu finden',
    tutorialMoodDesc: 'Schnelle tägliche Check-ins helfen dir zu bemerken, was deine Energie und deinen Fokus beeinflusst. Mit der Zeit wirst du dich besser verstehen.',
    tutorialFocusTitle: 'Tiefenfokus-Modus',
    tutorialFocusSubtitle: 'Ablenkungen blockieren, Dinge erledigen',
    tutorialFocusDesc: 'Nutze die Pomodoro-Technik mit beruhigenden Umgebungsgeräuschen. Perfekt für Arbeit, Studium oder kreative Projekte.',
    tutorialDayClockTitle: 'Dein Tag auf einen Blick',
    tutorialDayClockSubtitle: 'Visuelles Energiemeter für ADHS-Gehirne',
    tutorialDayClockDesc: 'Sieh deinen Tag als Kreis mit Morgen-, Nachmittag- und Abendzonen. Beobachte, wie deine Energie mit jeder Aktivität wächst!',
    tutorialDayClockFeature1: '⚡ Energiemeter füllt sich mit Fortschritt',
    tutorialDayClockFeature2: '😊 Maskottchen reagiert auf deine Erfolge',
    tutorialDayClockFeature3: '🎯 Verfolge alle Aktivitäten an einem Ort',
    tutorialDayClockFeature4: '🏆 Erreiche 100% für den Perfekten Tag!',
    tutorialMoodThemeTitle: 'Die App passt sich dir an',
    tutorialMoodThemeSubtitle: 'Design ändert sich mit deiner Stimmung',
    tutorialMoodThemeDesc: 'Wenn du dich großartig fühlst, feiert die App mit lebhaften Farben. Wenn du traurig bist, wird sie ruhig und unterstützend.',
    tutorialMoodThemeFeature1: '😄 Tolle Stimmung: Lebhaftes Lila & Gold',
    tutorialMoodThemeFeature2: '🙂 Gute Stimmung: Warme Grüntöne',
    tutorialMoodThemeFeature3: '😔 Schlechte Stimmung: Beruhigendes Blau',
    tutorialMoodThemeFeature4: '😢 Schwere Zeiten: Sanftes, minimales Design',
    tutorialReadyTitle: 'Bereit anzufangen?',
    tutorialReadySubtitle: 'Deine Reise beginnt jetzt',
    tutorialReadyDesc: 'Fang klein an – notiere einfach, wie du dich heute fühlst. Jeder Schritt zählt!',
    tutorialStart: 'Los geht\'s!',

    // Weekly Report
    weeklyReport: 'Wochenbericht',
    incredibleWeek: 'Unglaubliche Woche!',
    pathToMastery: 'Du bist auf dem Weg zur Meisterschaft!',
    greatWork: 'Großartige Arbeit!',
    keepMomentum: 'Halte den Schwung!',
    goodProgress: 'Guter Fortschritt!',
    everyStepCounts: 'Jeder Schritt zählt!',
    newWeekOpportunities: 'Neue Woche - Neue Möglichkeiten!',
    startSmall: 'Fang klein an, geh vorwärts!',
    bestDay: 'Bester Tag',
    continueBtn: 'Weiter',

    // Streak Celebration
    dayStreak: 'Tage Serie',
    keepItUp: 'Weiter so!',

    // Inner World Garden
    myCompanion: 'Mein Begleiter',
    missedYou: 'hat dich vermisst!',
    welcomeBack: 'Willkommen zurück in deinem Garten',
    warmth: 'Wärme',
    energy: 'Energie',
    wisdom: 'Weisheit',
    companionStreak: 'Tage am Stück!',
    chooseCompanion: 'Begleiter wählen',
    levelUpHint: 'Schließe Aktivitäten ab, um XP zu verdienen und aufzusteigen!',
    pet: 'Streicheln',
    feed: 'Füttern',
    talk: 'Sprechen',
    happiness: 'Glück',
    satiety: 'Sättigung',
    gardenEmpty: 'Neuer Anfang',
    gardenSprouting: 'Keimend',
    gardenGrowing: 'Wachsend',
    gardenFlourishing: 'Blühend',
    gardenMagical: 'Magisch',
    gardenLegendary: 'Legendär',

    // Companion Notifications
    companionMissesYou: 'vermisst dich! 💕',
    companionWantsToPlay: 'möchte Zeit mit dir verbringen!',
    companionWaiting: 'wartet im Garten auf dich 🌱',
    companionProud: 'ist stolz auf dich! ⭐',
    companionCheersYou: 'feuert dich an! 💪',
    companionQuickMood: 'Wie geht es dir? Tippe! 😊',

    // Garden / My World
    myWorld: 'Meine Welt',
    plants: 'Pflanzen',
    creatures: 'Kreaturen',
    level: 'Stufe',

    // Streak Banner
    startStreak: 'Starte heute deine Serie!',
    legendaryStreak: 'Legendäre Serie!',
    amazingStreak: 'Erstaunlich!',
    goodStart: 'Toller Start!',
    todayActivities: 'Heute',

    // Companion
    companionPet: 'Streicheln',
    companionFeed: 'Füttern',
    companionTalk: 'Sprechen',
    companionHappiness: 'Glück',
    companionHunger: 'Sättigung',

    // New Companion System
    companionHungryCanFeed: '🥺 Ich habe Hunger... Fütterst du mich?',
    companionHungryNoTreats: '🥺 Ich habe Hunger... Mach Aktivitäten um Leckerlis zu verdienen!',
    companionStreakLegend: '🏆 {streak} Tage! Du bist eine Legende!',
    companionStreakGood: '🔥 {streak} Tage! Weiter so!',
    companionAskMood: '💜 Wie fühlst du dich heute?',
    companionAskHabits: '🎯 Zeit für Gewohnheiten!',
    companionAskFocus: '🧠 Bereit dich zu konzentrieren?',
    companionAskGratitude: '💖 Wofür bist du dankbar?',
    companionAllDone: '🏆 Perfekter Tag! Du bist großartig!',
    companionHappy: '💕 Ich liebe dich!',
    companionMorning: '☀️ Guten Morgen!',
    companionAfternoon: '🌤️ Wie läuft dein Tag?',
    companionEvening: '🌙 Guten Abend!',
    companionNight: '💤 Zzz...',
    companionLevelUp: '🎉 Level up! Jetzt Level {level}!',
    companionNeedsFood: 'Dein Begleiter hat Hunger!',
    petReaction1: '💕 *schnurr*',
    petReaction2: '✨ Das fühlt sich gut an!',
    petReaction3: '😊 Danke!',
    petReaction4: '💖 Hab dich lieb!',
    feedReaction1: '🍪 Lecker!',
    feedReaction2: '😋 Köstlich!',
    feedReaction3: '✨ Danke!',
    feedReaction4: '💪 Energie!',
    feedNotEnough: '🍪 Brauche {needed} Leckerlis, habe {have}',
    free: 'Kostenlos',
    fullness: 'Sättigung',
    earnTreatsHint: 'Mach Aktivitäten um Leckerlis für deinen Begleiter zu verdienen!',

    // Seasonal Tree System
    myTree: 'Mein Baum',
    touch: 'Berühren',
    water: 'Gießen',
    waterLevel: 'Wasserstand',
    growth: 'Wachstum',
    stage: 'Stufe',
    treeThirstyCanWater: '💧 Der Baum braucht Wasser...',
    treeThirstyNoTreats: '🥀 Durstig... Mach Aktivitäten um Leckerlis zu verdienen!',
    treeStreakLegend: '🌟 {streak} Tage! Der Baum leuchtet!',
    treeStreakGood: '✨ {streak} Tage! Wächst stark!',
    treeMaxStage: '🌳 Ein prächtiger großer Baum!',
    treeStage4: '🌲 Ein schöner ausgewachsener Baum!',
    treeStage3: '🌿 Wächst zu einem starken Bäumchen!',
    treeStage2: '🌱 Ein junger Spross der nach Licht greift!',
    treeStage1: '🌰 Ein kleiner Samen voller Potenzial!',
    treeHappy: '💚 Der Baum gedeiht!',
    treeSeason: '{emoji} Schöner {season}!',
    treeStageUp: '🎉 Entwickelt zu {stage}!',
    treeMissedYou: 'Dein Baum hat dich vermisst!',
    treeNeedsWater: 'Der Baum braucht Wasser!',
    waterDecayHint: 'Wasserstand sinkt -2% pro Stunde',
    seasonTreeHint: 'Der Baum verändert sich mit den Jahreszeiten!',
    xpToNextStage: '{xp} XP bis {stage}',
    touchReaction1: '✨ *Blätter rascheln*',
    touchReaction2: '🍃 Die Blätter tanzen!',
    touchReaction3: '💚 Fühlt sich lebendig an!',
    touchReaction4: '🌿 Werde stärker!',
    waterReaction1: '💧 *nimmt Wasser auf*',
    waterReaction2: '🌊 Erfrischend!',
    waterReaction3: '💦 Danke!',
    waterReaction4: '✨ Wachse!',
    waterNotEnough: '🍪 Brauche {needed} Leckerlis, habe {have}',

    // Rest Mode
    restDayTitle: 'Ruhetag',
    restDayMessage: 'Ruh dich aus, dein Streak ist sicher',
    restDayButton: 'Ruhetag',
    restDayCancel: 'Ich möchte trotzdem eintragen',
    daysSaved: 'Tage gespeichert',
    restDaySupportive: 'Morgen machen wir zusammen weiter 💚',

    // Task Momentum
    taskMomentum: 'Aufgaben',
    taskMomentumDesc: 'ADHS-freundliche Priorisierung',
    tasksInARow: 'Aufgaben hintereinander',
    taskNamePlaceholder: 'Aufgabenname...',
    durationMinutes: 'Dauer (Minuten)',
    interestLevel: 'Interesse (1-10)',
    markAsUrgent: 'Als dringend markieren',
    urgent: 'Dringend',
    addTask: 'Hinzufügen',
    topRecommendedTasks: 'Top 3 empfohlene Aufgaben',
    quickWins: 'Schnelle Erfolge (unter 2 Min)',
    allTasks: 'Alle Aufgaben',
    noTasksYet: 'Noch keine Aufgaben',
    addFirstTaskMessage: 'Füge deine erste Aufgabe hinzu!',
    addFirstTask: 'Erste Aufgabe hinzufügen',
    adhdTaskTips: 'ADHS Aufgaben-Tipps',
    taskTip1: 'Beginne mit schnellen Erfolgen (2-5 Min)',
    taskTip2: 'Baue Momentum durch aufeinanderfolgende Abschlüsse',
    taskTip3: 'Interessante Aufgaben geben mehr Dopamin',
    taskTip4: 'Dringend + kurz = perfekte Kombination',
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
    howAreYouNow: 'Comment allez-vous maintenant?',
    moodToday: 'Humeur aujourd\'hui',
    moodHistory: 'Historique du jour',
    moodRecorded: 'Humeur enregistrée!',
    moodNotes: 'Notes d\'humeur',
    todayProgress: "Progrès d'aujourd'hui",
    completed: 'Terminé!',
    updateMood: 'Mettre à jour',
    great: 'Super',
    good: 'Bien',
    okay: 'Correct',
    bad: 'Mal',
    terrible: 'Terrible',
    addNote: 'Ajouter une note (optionnel)...',
    saveMood: 'Sauvegarder l\'humeur',
    startHere: 'Commencez ici',
    tapToStart: 'Appuyez sur un emoji pour commencer votre journée',
    moodPrompt: 'Qu\'est-ce qui a influencé votre humeur ?',
    moodTagsTitle: 'Tags',
    moodTagPlaceholder: 'Ajouter un tag...',
    moodTagAdd: 'Ajouter',
    moodTagFilter: 'Filtrer par tag',
    allTags: 'Tous les tags',
    tagWork: 'Travail',
    tagFamily: 'Famille',
    tagHealth: 'Santé',
    tagSleep: 'Sommeil',
    tagMoney: 'Argent',
    tagWeather: 'Météo',
    moodPatternsTitle: 'Tendances d’humeur',
    moodBestDay: 'Meilleur jour de la semaine',
    moodFocusComparison: 'Humeur et focus',
    moodFocusWith: 'Avec sessions de focus',
    moodFocusWithout: 'Sans focus',
    moodHabitCorrelations: 'Habitudes et humeur',
    moodNoData: 'Pas assez de données',
    editMood: 'Modifier l\'humeur',
    changeMood: 'Changer l\'humeur',
    changeMoodConfirmTitle: 'Changer l\'humeur ?',
    changeMoodConfirmMessage: 'Êtes-vous sûr de vouloir changer votre humeur ?',
    moodChanged: 'Humeur mise à jour !',
    confirm: 'Changer',
    dailyProgress: 'Progression quotidienne',
    continueProgress: 'Continuer',
    dayTimeline: 'Ta journée',
    dayComplete: 'de la journée',
    perfectDay: 'Journée parfaite !',
    startYourDay: 'Commence ta journée ! 🌅',
    keepGoing: 'Continue ! Tu fais du super boulot 💪',
    almostThere: 'Presque là ! 🚀',
    soClose: 'Si proche de la perfection ! ⭐',
    legendaryDay: 'JOURNÉE LÉGENDAIRE ! 🏆🔥✨',

    // Schedule Timeline
    scheduleTitle: 'Votre Emploi du Temps',
    scheduleAddEvent: 'Ajouter un Événement',
    scheduleEmpty: 'Aucun événement prévu. Appuyez sur + pour ajouter !',
    scheduleEmptyDay: 'Aucun événement pour ce jour',
    scheduleStart: 'Début',
    scheduleEnd: 'Fin',
    scheduleAdd: "Ajouter à l'emploi du temps",
    scheduleCustomTitle: 'Titre personnalisé (optionnel)',
    scheduleWork: 'Travail',
    scheduleMeal: 'Repas',
    scheduleRest: 'Repos',
    scheduleExercise: 'Exercice',
    scheduleStudy: 'Études',
    scheduleMeeting: 'Réunion',
    scheduleNote: 'Note (optionnel)',
    scheduleNotePlaceholder: 'Ajouter des détails ou des rappels...',

    // Time Awareness (ADHD time blindness helper)
    timeUntilEndOfDay: 'Jusqu\'à la fin de journée',
    timeIn: 'dans',
    timePassed: 'Temps écoulé',
    timeNow: 'Maintenant!',
    hoursShort: 'h',
    minutesShort: 'm',
    night: 'Nuit',

    // AI Insights
    aiInsights: 'Analyses IA',
    aiInsight: 'Insight IA',
    personalizedForYou: 'Personnalisé pour vous',
    insightsNeedMoreData: 'Notez votre humeur pendant une semaine pour débloquer des insights personnalisés!',
    daysLogged: 'jours notés',
    showMore: 'Afficher',
    moreInsights: 'plus d\'insights',
    hideInsights: 'Masquer les insights',

    // Onboarding Hints
    hintFirstMoodTitle: 'Comment vous sentez-vous ?',
    hintFirstMoodDesc: "Commencez la journée en notant votre humeur. Ça ne prend que 5 secondes et vous aide à mieux vous comprendre !",
    hintFirstMoodAction: 'Noter humeur',
    hintFirstHabitTitle: 'Créez votre première habitude',
    hintFirstHabitDesc: 'Les petites habitudes mènent à de grands changements. Essayez quelque chose de simple comme "Boire de l\'eau".',
    hintFirstHabitAction: 'Ajouter habitude',
    hintFirstFocusTitle: 'Prêt à vous concentrer ?',
    hintFirstFocusDesc: 'Utilisez le minuteur de focus avec des sons apaisants. Commencez par 25 minutes !',
    hintFirstFocusAction: 'Démarrer focus',
    hintFirstGratitudeTitle: 'Pratiquez la gratitude',
    hintFirstGratitudeDesc: "Écrivez une chose pour laquelle vous êtes reconnaissant. C'est un puissant booster d'humeur !",
    hintFirstGratitudeAction: 'Ajouter gratitude',
    hintScheduleTipTitle: 'Planifiez votre journée',
    hintScheduleTipDesc: "Utilisez la timeline pour voir votre journée d'un coup d'œil. Ajoutez des événements !",
    hintScheduleTipAction: 'Voir timeline',

    habits: 'Habitudes',
    habitName: 'Nom de l\'habitude...',
    icon: 'Icône',
    color: 'Couleur',
    addHabit: 'Ajouter une habitude',
    addFirstHabit: 'Ajoutez votre première habitude! ✨',
    completedTimes: 'Complété',
    habitNameHint: 'Entrez un nom pour ajouter.',
    habitType: 'Type d’habitude',
    habitTypeDaily: 'Quotidienne',
    habitTypeWeekly: 'Objectif hebdo',
    habitTypeFrequency: 'Tous les N jours',
    habitTypeReduce: 'Réduire (limite)',
    habitWeeklyGoal: 'Objectif hebdo (fois)',
    habitFrequencyInterval: 'Intervalle (jours)',
    habitReduceLimit: 'Limite quotidienne',
    habitStrictStreak: 'Série stricte',
    habitGraceDays: 'Jours de grâce par semaine',
    habitWeeklyProgress: 'Cette semaine',
    habitEvery: 'Tous les',
    habitReduceProgress: 'Aujourd\'hui',
    noHabitsToday: 'Pas d\'habitudes aujourd\'hui.',
    habitsOther: 'Autres habitudes',
    habitTypeContinuous: 'Continu (arrêter)',
    habitTypeScheduled: 'Planifié',
    habitTypeMultiple: 'Plusieurs fois par jour',
    habitDailyTarget: 'Objectif quotidien',
    habitStartDate: 'Date de début',
    habitReminders: 'Rappels',
    habitAddReminder: 'Ajouter un rappel',
    habitReminderTime: 'Heure',
    habitReminderDays: 'Jours de la semaine',
    habitReminderEnabled: 'Activé',
    habitRemindersPerHabit: 'Les rappels sont maintenant configurés individuellement pour chaque habitude. Ajoutez des rappels lors de la création ou de la modification des habitudes.',
    perHabitRemindersTitle: 'Rappels par Habitude',
    perHabitRemindersDesc: 'Chaque habitude peut avoir ses propres horaires de rappel personnalisés. Configurez-les lors de la création d\'une nouvelle habitude ou de la modification d\'une habitude existante.',
    quickAdd: 'Ajout rapide',
    createCustomHabit: 'Créer une habitude personnalisée',
    streak: 'série',

    // Habit Frequency
    habitFrequency: 'Fréquence',
    habitFrequencyOnce: 'Une fois',
    habitFrequencyDaily: 'Quotidien',
    habitFrequencyWeekly: 'Hebdomadaire',
    habitFrequencyCustom: 'Personnalisé',
    habitFrequencySelectDays: 'Sélectionner les Jours',
    habitDurationRequired: 'Nécessite une Durée?',
    habitTargetDuration: 'Durée Cible (minutes)',
    habitDurationMinutes: 'minutes',

    // Focus timer
    focus: 'Focus',
    breakTime: 'Pause',
    todayMinutes: 'min aujourd\'hui',
    concentrate: 'Concentrez-vous',
    takeRest: 'Reposez-vous',
    focusPreset25: '25/5',
    focusPreset50: '50/10',
    focusPresetCustom: 'Personnalisé',
    focusLabelPrompt: 'Sur quoi vous concentrez-vous ?',
    focusLabelPlaceholder: 'Ex. : Rapport, Étude, Projet...',
    focusCustomWork: 'Travail (min)',
    focusCustomBreak: 'Pause (min)',
    focusReflectionTitle: 'Réflexion',
    focusReflectionQuestion: 'Comment s\'est passée la session ?',
    focusReflectionSkip: 'Passer',
    focusReflectionSave: 'Sauvegarder',

    // Breathing
    breathingTitle: 'Respiration',
    breathingSubtitle: 'Apaise ton esprit',
    breathingBox: 'Respiration carrée',
    breathingBoxDesc: 'Phases égales pour focus',
    breathing478: '4-7-8 Relaxant',
    breathing478Desc: 'Calme profond',
    breathingEnergize: 'Énergisant',
    breathingEnergizeDesc: 'Boost d\'énergie',
    breathingSleep: 'Préparation au sommeil',
    breathingSleepDesc: 'Expiration lente',
    breatheIn: 'Inspire',
    breatheOut: 'Expire',
    hold: 'Retiens',
    cycles: 'cycles',
    cycle: 'Cycle',
    effectCalming: 'Calmant',
    effectFocusing: 'Focus',
    effectEnergizing: 'Énergie',
    effectSleeping: 'Sommeil',
    startBreathing: 'Commencer',
    breathingComplete: 'Bien joué!',
    breathingCompleteMsg: 'Tu as terminé l\'exercice de respiration',
    breathingAgain: 'Encore',
    pause: 'Pause',
    resume: 'Reprendre',
    gratitude: 'Gratitude',
    today: 'aujourd\'hui',
    tomorrow: 'demain',
    scheduleDate: 'Date',
    whatAreYouGratefulFor: 'Pour quoi êtes-vous reconnaissant aujourd\'hui?',
    iAmGratefulFor: 'Je suis reconnaissant pour...',
    save: 'Sauvegarder',
    cancel: 'Annuler',
    recentEntries: 'Entrées récentes',
    gratitudeTemplate1: 'Aujourd\'hui je suis reconnaissant pour...',
    gratitudeTemplate2: 'Un bon moment aujourd\'hui...',
    gratitudeTemplate3: 'J\'apprécie en moi...',
    gratitudeLimit: 'Jusqu\'à 3 points par jour',
    gratitudeMemoryJar: 'Bocal à souvenirs',
    thisWeek: 'Cette semaine',
    statistics: 'Statistiques',
    monthlyOverview: 'Aperçu mensuel',
    statsRange: 'Période',
    statsRangeWeek: 'Semaine',
    statsRangeMonth: 'Mois',
    statsRangeAll: 'Tout le temps',
    statsRangeApply: 'Appliquer',
    calendarTitle: 'Calendrier',
    calendarYear: 'Année',
    calendarSelectDay: 'Choisir un jour',
    calendarPrevMonth: 'Mois précédent',
    calendarNextMonth: 'Mois suivant',
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
    moodHeatmap: 'Calendrier d\'humeur',
    topHabit: 'Meilleure habitude',
    completedTimes2: 'fois',
    profile: 'Profil',
    yourName: 'Votre nom',
    nameSaved: 'Nom enregistré',
    notifications: 'Notifications',
    notificationsComingSoon: 'Les notifications seront disponibles dans les prochaines mises à jour.',
    data: 'Données',
    exportData: 'Exporter les données',
    importData: 'Importer les données',
    importMode: 'Mode d\'importation',
    importMerge: 'Fusionner',
    importReplace: 'Remplacer',
    exportSuccess: 'Export prêt.',
    exportError: 'Échec de l\'export.',
    importSuccess: 'Import terminé.',
    importError: 'Échec de l\'import.',
    importedItems: 'Ajouté',
    importAdded: 'ajouté',
    importUpdated: 'mis à jour',
    importSkipped: 'ignoré',
    comingSoon: 'bientôt',
    resetAllData: 'Réinitialiser toutes les données',
    privacyTitle: 'Privacy',
    privacyDescription: 'Your data stays on device. No hidden tracking.',
    privacyNoTracking: 'No tracking',
    privacyNoTrackingHint: 'We do not collect behavioral data.',
    privacyAnalytics: 'Analytics',
    privacyAnalyticsHint: 'Aide a ameliorer l\'app. Vous pouvez le desactiver.',
    privacyPolicy: 'Politique de confidentialite',
    termsOfService: 'Conditions d\'utilisation',

    // GDPR Consent
    consentTitle: 'Paramètres de confidentialité',
    consentDescription: 'Nous respectons votre vie privée. Autoriser les analyses anonymes pour améliorer l\'app ?',
    consentAnalyticsTitle: 'Analyses anonymes',
    consentAnalyticsDesc: 'Uniquement les habitudes d\'utilisation. Pas de données personnelles. Modifiable dans les paramètres.',
    consentAccept: 'Autoriser',
    consentDecline: 'Non merci',
    consentFooter: 'Vous pouvez modifier cela à tout moment dans Paramètres > Confidentialité',

    installApp: 'Installer l\'app',
    installAppDescription: 'Installez ZenFlow pour un lancement plus rapide et un accès hors ligne.',
    installBannerTitle: 'Installer ZenFlow',
    installBannerBody: 'Obtenez un lancement plus rapide et un accès hors ligne en installant l\'app.',
    installNow: 'Installer',
    installLater: 'Plus tard',
    appInstalled: 'App installée',
    appInstalledDescription: 'ZenFlow est installé sur votre appareil.',
    remindersTitle: 'Rappels',
    remindersDescription: 'Gentle reminders to keep you on track.',
    moodReminder: 'Mood check-in time',
    habitReminder: 'Habit reminder time',
    focusReminder: 'Focus nudge time',
    quietHours: 'Quiet hours',
    reminderDays: 'Days of week',
    selectedHabits: 'Habits to remind',
    noHabitsYet: 'No habits yet.',
    reminderMoodTitle: 'Mood check-in',
    reminderMoodBody: 'Take 30 seconds to log how you feel.',
    reminderHabitTitle: 'Habit reminder',
    reminderHabitBody: 'Time to check your habits:',
    reminderFocusTitle: 'Focus nudge',
    reminderFocusBody: 'Ready for a focused session?',
    reminderDismiss: 'Dismiss',
    notificationPermissionTitle: 'Stay on Track',
    notificationPermissionDescription: 'Get gentle reminders to track your mood, complete habits, and take focus breaks. Notifications help you build healthy routines.',
    notificationFeature1Title: 'Daily Mood Reminders',
    notificationFeature1Desc: 'Check in with yourself every day',
    notificationFeature2Title: 'Habit Tracking',
    notificationFeature2Desc: 'Stay consistent with your goals',
    notificationFeature3Title: 'Focus Sessions',
    notificationFeature3Desc: 'Get reminded to take productive breaks',
    notificationAllow: 'Enable Notifications',
    notificationDeny: 'Maybe Later',
    notificationPrivacyNote: 'You can change this anytime in Settings. Notifications are local and private.',
    onboardingStep: 'Step',
    onboardingValueTitle: 'Track mood + habits in 30 seconds a day',
    onboardingValueBody: 'Quick check-ins, zero clutter, fully private.',
    onboardingStart: 'Start in 30 sec',
    onboardingExplore: 'Explore',
    onboardingGoalTitle: 'Pick your focus',
    onboardingGoalLessStress: 'Less stress',
    onboardingGoalLessStressDesc: 'Calm and gentle habits',
    onboardingGoalMoreEnergy: 'More energy',
    onboardingGoalMoreEnergyDesc: 'Sleep, movement, hydration',
    onboardingGoalBetterRoutine: 'Better routine',
    onboardingGoalBetterRoutineDesc: 'Stability and rhythm',
    onboardingContinue: 'Continue',
    onboardingCheckinTitle: 'Quick check-in',
    onboardingHabitsPrompt: 'Choose two habits',
    onboardingPickTwo: 'Pick up to two',
    onboardingReminderTitle: 'Enable reminders',
    onboardingReminderBody: 'Choose a time that fits you. No spam.',
    onboardingMorning: 'Morning',
    onboardingEvening: 'Evening',
    onboardingEnable: 'Enable',
    onboardingSkip: 'Skip for now',
    onboardingHabitBreathing: 'Breathing',
    onboardingHabitEveningWalk: 'Evening walk',
    onboardingHabitStretch: 'Stretch',
    onboardingHabitJournaling: 'Journaling',
    onboardingHabitWater: 'Water',
    onboardingHabitSunlight: 'Sunlight',
    onboardingHabitMovement: 'Movement',
    onboardingHabitSleepOnTime: 'Sleep on time',
    onboardingHabitMorningPlan: 'Morning plan',
    onboardingHabitRead: 'Read 10 min',
    onboardingHabitNoScreens: 'No late screens',
    onboardingHabitDailyReview: 'Daily review',
    account: 'Account',
    accountDescription: 'Sign in by email to sync progress across devices.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Send magic link',
    continueWithGoogle: 'Continue with Google',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    syncNow: 'Sync now',
    cloudSyncDisabled: 'Cloud sync disabled.',
    deleteAccount: 'Supprimer le compte',
    deleteAccountConfirm: 'Supprimer votre compte ?',
    deleteAccountWarning: 'Cela supprimera les données cloud et l’accès au compte.',
    deleteAccountSuccess: 'Compte supprimé.',
    deleteAccountError: 'Impossible de supprimer le compte.',
    deleteAccountLink: 'Supprimer le compte/données',
    authEmailSent: 'Login link sent to your email.',
    authSignedOut: 'Signed out.',
    authError: 'Failed to send link.',
    authNotConfigured: 'Supabase not configured.',
    syncSuccess: 'Sync complete.',
    syncPulled: 'Cloud data restored.',
    syncPushed: 'Cloud updated.',
    syncError: 'Sync failed.',
    authGateTitle: 'Sign in',
    authGateBody: 'Sign in by email to save progress and sync across devices.',
    authGateContinue: 'Continue without account',
    errorBoundaryTitle: 'Something went wrong',
    errorBoundaryBody: 'Try reloading the app or export a debug report.',
    errorBoundaryExport: 'Export debug report',
    errorBoundaryReload: 'Reload app',
    pushTitle: 'Push notifications',
    pushEnable: 'Enable push',
    pushDisable: 'Disable push',
    pushTest: 'Test push',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Test notification.',
    pushTestSent: 'Test sent.',
    pushTestError: 'Failed to send test.',
    pushNowMood: 'Push: mood',
    pushNowHabit: 'Push: habits',
    pushNowFocus: 'Push: focus',
    pushEnabled: 'Push enabled.',
    pushDisabled: 'Push disabled.',
    pushError: 'Failed to enable push.',
    pushNeedsAccount: 'Sign in to enable push.',
    pushPermissionDenied: 'Notification permission denied.',
    areYouSure: 'Êtes-vous sûr?',
    cannotBeUndone: 'Cette action ne peut pas être annulée.',
    delete: 'Supprimer',
    shareAchievements: 'Partager vos progrès',
    shareTitle: 'Mes progrès sur ZenFlow',
    shareText: '{streak} jours d\'affilée! {habits} habitudes complétées, {focus} minutes de concentration.',
    shareButton: 'Partager',
    shareDownload: 'Télécharger l\'image',
    shareDownloading: 'Téléchargement...',
    shareCopyLink: 'Copier le lien',
    shareCopied: 'Copié!',
    sharePrivacyNote: 'Aucune donnée personnelle n\'est partagée. Seulement votre résumé de progrès.',
    shareStreak: 'Jours d\'affilée',
    shareHabits: 'Habitudes',
    shareFocus: 'Minutes',
    shareGratitude: 'Gratitudes',
    shareFooter: 'Suivez vos habitudes, humeur et concentration',
    myProgress: 'Mes progrès',
    shareSquare: 'Post 1:1',
    shareStory: 'Story 9:16',
    shareFormatHint: '📱 Format story pour Instagram/TikTok • Format post pour les fils',
    challengesTitle: 'Défis et badges',
    challengesSubtitle: 'Relève des défis et gagne des badges',
    activeChallenges: 'Actifs',
    availableChallenges: 'Disponibles',
    badges: 'Badges',
    noChallengesActive: 'Aucun défi actif',
    noChallengesActiveHint: 'Commence un défi pour suivre ta progression',
    progress: 'Progression',
    reward: 'Récompense',
    target: 'Objectif',
    startChallenge: 'Commencer le défi',
    challengeActive: 'Actif',
    requirement: 'Exigence',
    challengeTypeStreak: 'Série',
    challengeTypeFocus: 'Focus',
    challengeTypeGratitude: 'Gratitude',
    challengeTypeTotal: 'Total',
    hyperfocusMode: 'Mode Hyperfocus',
    hyperfocusStart: 'Commencer',
    hyperfocusPause: 'Pause',
    hyperfocusResume: 'Reprendre',
    hyperfocusExit: 'Quitter',
    hyperfocusReady: 'Prêt pour l\'hyperfocus?',
    hyperfocusFocusing: 'Dans la zone...',
    hyperfocusPaused: 'En pause',
    hyperfocusTimeLeft: 'restant',
    hyperfocusBreathe: 'Respirez...',
    hyperfocusBreathDesc: 'Inspirez 4s • Expirez 4s',
    hyperfocusEmergencyConfirm: 'Voulez-vous mettre en pause la session? Sans culpabilité! 💜',
    hyperfocusAmbientSound: 'Son Ambiant',
    hyperfocusSoundNone: 'Aucun',
    hyperfocusSoundWhiteNoise: 'Bruit Blanc',
    hyperfocusSoundRain: 'Pluie',
    hyperfocusSoundOcean: 'Océan',
    hyperfocusSoundForest: 'Forêt',
    hyperfocusSoundCoffee: 'Café',
    hyperfocusSoundFireplace: 'Cheminée',
    hyperfocusSoundVariants: 'Variantes de Son',
    hyperfocusShowVariants: 'Afficher les variantes',
    hyperfocusHideVariants: 'Masquer les variantes',
    hyperfocusTip: 'Astuce',
    hyperfocusTipText: 'Toutes les 25 minutes, il y aura une courte pause respiratoire. Cela aide à prévenir l\'épuisement!',
    hyperfocusPauseMsg: 'Appuyez sur Play pour continuer',

    // Widget Settings
    widgetSettings: 'Paramètres des Widgets',
    widgetSettingsDesc: 'Configurez les widgets pour votre écran d\'accueil',
    widgetPreview: 'Aperçu',
    widgetSetup: 'Installation',
    widgetInfo: 'Les widgets se mettent à jour automatiquement',
    widgetInfoDesc: 'Les données des widgets se synchronisent chaque fois que vous mettez à jour vos habitudes, terminez des sessions de concentration ou obtenez de nouveaux badges.',
    widgetStatus: 'Statut des Widgets',
    widgetPlatform: 'Plateforme',
    widgetWeb: 'Web (widgets non disponibles)',
    widgetSupport: 'Support des Widgets',
    widgetAvailable: 'Disponibles',
    widgetComingSoon: 'Bientôt',
    widgetSetupiOS: 'Installation du Widget sur iOS',
    widgetSetupAndroid: 'Installation du Widget sur Android',
    widgetStep1iOS: 'Appuyez longuement sur l\'écran d\'accueil jusqu\'à ce que les icônes tremblent',
    widgetStep2iOS: 'Appuyez sur "+" dans le coin supérieur gauche',
    widgetStep3iOS: 'Trouvez "ZenFlow" dans la liste des apps',
    widgetStep4iOS: 'Choisissez la taille du widget (petit, moyen ou grand)',
    widgetStep5iOS: 'Appuyez sur "Ajouter le widget"',
    widgetStep1Android: 'Appuyez longuement sur un espace vide de l\'écran d\'accueil',
    widgetStep2Android: 'Appuyez sur "Widgets" dans le menu',
    widgetStep3Android: 'Trouvez "ZenFlow" dans la liste des apps',
    widgetStep4Android: 'Faites glisser le widget sur votre écran d\'accueil',
    widgetWebWarning: 'Widgets non disponibles dans la version web',
    widgetWebWarningDesc: 'Les widgets fonctionnent uniquement sur les appareils mobiles (iOS et Android). Installez l\'application mobile pour utiliser les widgets.',
    widgetWebTip: 'La version web affiche des aperçus de widgets pour que vous puissiez voir à quoi ils ressembleront sur mobile.',
    widgetFeatures: 'Fonctionnalités des Widgets',
    widgetFeature1: 'Afficher les jours de série actuelle',
    widgetFeature2: 'Progression des habitudes d\'aujourd\'hui',
    widgetFeature3: 'Minutes de sessions de concentration',
    widgetFeature4: 'Dernier badge obtenu',
    widgetFeature5: 'Liste d\'habitudes avec statut de complétion',
    widgetSmall: 'Petit Widget',
    widgetMedium: 'Widget Moyen',
    widgetLarge: 'Grand Widget',
    widgetNoData: 'Aucune donnée de widget disponible',
    todayHabits: 'Habitudes d\'Aujourd\'hui',
    lastBadge: 'Dernier Badge',
    done: 'fait',

    dopamineSettings: 'Dopamine Dashboard',
    dopamineSettingsDesc: 'Personnalisez votre expérience de retour',
    dopamineIntensity: 'Niveau d\'intensité',
    dopamineMinimal: 'Minimal',
    dopamineNormal: 'Normal',
    dopamineADHD: 'TDAH',
    dopamineMinimalDesc: 'Expérience calme sans distractions',
    dopamineNormalDesc: 'Retour et motivation équilibrés',
    dopamineADHDDesc: 'Maximum de dopamine! Tous les effets activés 🎉',
    dopamineCustomize: 'Réglages fins',
    dopamineAnimations: 'Animations',
    dopamineAnimationsDesc: 'Transitions et effets fluides',
    dopamineSounds: 'Sons',
    dopamineSoundsDesc: 'Sons de succès et retour audio',
    dopamineHaptics: 'Haptique',
    dopamineHapticsDesc: 'Retour par vibration (mobile uniquement)',
    dopamineConfetti: 'Confettis',
    dopamineConfettiDesc: 'Célébrez les habitudes complétées',
    dopamineStreakFire: 'Feu de série',
    dopamineStreakFireDesc: 'Feu animé pour les séries',
    dopamineTip: 'Astuce TDAH',
    dopamineTipText: 'Les cerveaux TDAH ont besoin de plus de dopamine! Essayez le mode TDAH pour une motivation maximale. Vous pouvez toujours ajuster les paramètres individuels.',
    dopamineSave: 'Enregistrer et fermer',
    dailyRewards: 'Récompenses Quotidiennes',
    loginStreak: 'Jours Consécutifs',
    day: 'Jour',
    claim: 'Réclamer!',
    claimed: 'Réclamé',
    streakBonus: 'Bonus de Série',
    dailyRewardsTip: 'Revenez chaque jour pour de meilleures récompenses!',
    spinWheel: 'Tournez la Roue!',
    spinsAvailable: 'Tours Disponibles',
    spin: 'TOURNER',
    noSpins: 'Plus de Tours',
    claimPrize: 'Réclamer le Prix!',
    challengeExpired: 'Défi Expiré',
    challengeComplete: 'Défi Terminé!',
    earned: 'gagné',
    comboText: 'COMBO',
    mysteryBox: 'Boîte Mystère',
    openBox: 'Ouvrir',
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

    // Onboarding
    welcomeMessage: 'Bienvenue sur ZenFlow!',
    featureMood: 'Suivi de l\'humeur',
    featureMoodDescription: 'Suivez votre humeur chaque jour',
    featureHabits: 'Habitudes',
    featureHabitsDescription: 'Créez et suivez des habitudes saines',
    featureFocus: 'Sessions de concentration',
    featureFocusDescription: 'Restez concentré avec le minuteur Pomodoro',
    privacyNote: 'Vos données sont stockées localement et protégées',
    install: 'Installer l\'application',
    installDescription: 'Installez ZenFlow sur votre écran d\'accueil',
    onboardingMoodTitle: 'Comment vous sentez-vous?',
    onboardingMoodDescription: 'Suivez votre humeur quotidiennement',
    onboardingHabitsTitle: 'Créez vos premières habitudes',
    onboardingHabitsDescription: 'Commencez par de petits pas',
    onboardingRemindersTitle: 'Rappels',
    onboardingRemindersDescription: 'Recevez des rappels pour vos habitudes',
    enableReminders: 'Activer les rappels',
    morning: 'Matin',
    afternoon: 'Après-midi',
    evening: 'Soir',
    close: 'Fermer',
    skip: 'Passer',
    getStarted: 'Commencer',
    next: 'Suivant',
    remindersActive: 'Rappels actifs',
    greatChoice: 'Bon choix!',
    habitsSelected: 'habitudes sélectionnées',

    // Welcome Tutorial
    tutorialWelcomeTitle: 'Bienvenue sur ZenFlow',
    tutorialWelcomeSubtitle: 'Votre compagnon de bien-être personnel',
    tutorialWelcomeDesc: 'Une application conçue pour vous aider à rester concentré, créer des habitudes saines et vous sentir mieux chaque jour.',
    tutorialBrainTitle: 'Conçu pour votre cerveau',
    tutorialBrainSubtitle: 'Que vous ayez un TDAH ou des difficultés à vous concentrer',
    tutorialBrainDesc: 'ZenFlow utilise des techniques scientifiques pour gérer l\'attention, le temps et l\'énergie. Pas besoin de diagnostic – si vous avez du mal à vous concentrer, cette app est pour vous.',
    tutorialFeaturesTitle: 'Ce que vous pouvez faire',
    tutorialFeaturesSubtitle: 'Outils simples, grand impact',
    tutorialFeaturesDesc: 'Suivez vos progrès et gagnez en élan:',
    tutorialFeature1: 'Suivre l\'humeur et l\'énergie quotidiennes',
    tutorialFeature2: 'Construire des habitudes étape par étape',
    tutorialFeature3: 'Sessions de concentration avec sons ambiants',
    tutorialFeature4: 'Journal de gratitude',
    tutorialMoodTitle: 'Comprenez-vous',
    tutorialMoodSubtitle: 'Suivez les humeurs pour trouver des patterns',
    tutorialMoodDesc: 'Des check-ins quotidiens rapides vous aident à remarquer ce qui affecte votre énergie et votre concentration. Avec le temps, vous vous comprendrez mieux.',
    tutorialFocusTitle: 'Mode concentration profonde',
    tutorialFocusSubtitle: 'Bloquez les distractions, accomplissez des choses',
    tutorialFocusDesc: 'Utilisez la technique Pomodoro avec des sons ambiants apaisants. Parfait pour le travail, les études ou les projets créatifs.',
    tutorialDayClockTitle: 'Votre journée en un coup d\'œil',
    tutorialDayClockSubtitle: 'Compteur d\'énergie visuel pour cerveaux TDAH',
    tutorialDayClockDesc: 'Voyez votre journée comme un cercle avec des zones matin, après-midi et soir. Regardez votre énergie grandir avec chaque activité!',
    tutorialDayClockFeature1: '⚡ Le compteur d\'énergie se remplit avec les progrès',
    tutorialDayClockFeature2: '😊 La mascotte réagit à vos réussites',
    tutorialDayClockFeature3: '🎯 Suivez toutes les activités en un seul endroit',
    tutorialDayClockFeature4: '🏆 Atteignez 100% pour la Journée Parfaite!',
    tutorialMoodThemeTitle: 'L\'app s\'adapte à vous',
    tutorialMoodThemeSubtitle: 'Le design change avec votre humeur',
    tutorialMoodThemeDesc: 'Quand vous vous sentez bien, l\'app célèbre avec des couleurs vibrantes. Quand vous êtes triste, elle devient calme et réconfortante.',
    tutorialMoodThemeFeature1: '😄 Super humeur: Violet vibrant et doré',
    tutorialMoodThemeFeature2: '🙂 Bonne humeur: Verts chaleureux',
    tutorialMoodThemeFeature3: '😔 Mauvaise humeur: Bleus apaisants',
    tutorialMoodThemeFeature4: '😢 Moments difficiles: Design doux et minimal',
    tutorialReadyTitle: 'Prêt à commencer?',
    tutorialReadySubtitle: 'Votre voyage commence maintenant',
    tutorialReadyDesc: 'Commencez petit – notez simplement comment vous vous sentez aujourd\'hui. Chaque pas compte!',
    tutorialStart: 'C\'est parti!',

    // Weekly Report
    weeklyReport: 'Rapport hebdomadaire',
    incredibleWeek: 'Semaine incroyable!',
    pathToMastery: 'Vous êtes sur la voie de la maîtrise!',
    greatWork: 'Excellent travail!',
    keepMomentum: 'Gardez le rythme!',
    goodProgress: 'Bon progrès!',
    everyStepCounts: 'Chaque pas compte!',
    newWeekOpportunities: 'Nouvelle semaine - Nouvelles opportunités!',
    startSmall: 'Commencez petit, avancez!',
    bestDay: 'Meilleur jour',
    continueBtn: 'Continuer',

    // Streak Celebration
    dayStreak: 'jours de suite',
    keepItUp: 'Continue comme ça!',

    // Inner World Garden
    myCompanion: 'Mon Compagnon',
    missedYou: 'tu lui as manqué!',
    welcomeBack: 'Bienvenue dans ton jardin',
    warmth: 'Chaleur',
    energy: 'Énergie',
    wisdom: 'Sagesse',
    companionStreak: 'Jours consécutifs!',
    chooseCompanion: 'Choisir un Compagnon',
    levelUpHint: 'Complète des activités pour gagner des XP et monter de niveau!',
    pet: 'Caresser',
    feed: 'Nourrir',
    talk: 'Parler',
    happiness: 'Bonheur',
    satiety: 'Satiété',
    gardenEmpty: 'Nouveau Départ',
    gardenSprouting: 'Germination',
    gardenGrowing: 'Croissance',
    gardenFlourishing: 'Floraison',
    gardenMagical: 'Magique',
    gardenLegendary: 'Légendaire',

    // Companion Notifications
    companionMissesYou: 'tu lui manques! 💕',
    companionWantsToPlay: 'veut passer du temps avec toi!',
    companionWaiting: 't\'attend dans le jardin 🌱',
    companionProud: 'est fier de toi! ⭐',
    companionCheersYou: 't\'encourage! 💪',
    companionQuickMood: 'Comment tu te sens? Appuie! 😊',

    // Garden / My World
    myWorld: 'Mon monde',
    plants: 'Plantes',
    creatures: 'Créatures',
    level: 'Niveau',

    // Streak Banner
    startStreak: 'Commence ta série aujourd\'hui!',
    legendaryStreak: 'Série légendaire!',
    amazingStreak: 'Incroyable!',
    goodStart: 'Excellent début!',
    todayActivities: 'Aujourd\'hui',

    // Companion
    companionPet: 'Caresser',
    companionFeed: 'Nourrir',
    companionTalk: 'Parler',
    companionHappiness: 'Bonheur',
    companionHunger: 'Satiété',

    // New Companion System
    companionHungryCanFeed: '🥺 J\'ai faim... Tu me nourris?',
    companionHungryNoTreats: '🥺 J\'ai faim... Fais des activités pour gagner des friandises!',
    companionStreakLegend: '🏆 {streak} jours! Tu es une légende!',
    companionStreakGood: '🔥 {streak} jours! Continue comme ça!',
    companionAskMood: '💜 Comment tu te sens aujourd\'hui?',
    companionAskHabits: '🎯 C\'est l\'heure des habitudes!',
    companionAskFocus: '🧠 Prêt à te concentrer?',
    companionAskGratitude: '💖 De quoi es-tu reconnaissant?',
    companionAllDone: '🏆 Journée parfaite! Tu es incroyable!',
    companionHappy: '💕 Je t\'aime!',
    companionMorning: '☀️ Bonjour!',
    companionAfternoon: '🌤️ Comment va ta journée?',
    companionEvening: '🌙 Bonsoir!',
    companionNight: '💤 Zzz...',
    companionLevelUp: '🎉 Niveau supérieur! Maintenant niveau {level}!',
    companionNeedsFood: 'Ton compagnon a faim!',
    petReaction1: '💕 *ronron*',
    petReaction2: '✨ C\'est agréable!',
    petReaction3: '😊 Merci!',
    petReaction4: '💖 Je t\'aime!',
    feedReaction1: '🍪 Miam!',
    feedReaction2: '😋 Délicieux!',
    feedReaction3: '✨ Merci!',
    feedReaction4: '💪 Énergie!',
    feedNotEnough: '🍪 Il faut {needed} friandises, tu en as {have}',
    free: 'Gratuit',
    fullness: 'Satiété',
    earnTreatsHint: 'Fais des activités pour gagner des friandises pour ton compagnon!',

    // Seasonal Tree System
    myTree: 'Mon Arbre',
    touch: 'Toucher',
    water: 'Arroser',
    waterLevel: 'Niveau d\'eau',
    growth: 'Croissance',
    stage: 'Stade',
    treeThirstyCanWater: '💧 L\'arbre a besoin d\'eau...',
    treeThirstyNoTreats: '🥀 Assoiffé... Fais des activités pour gagner des friandises!',
    treeStreakLegend: '🌟 {streak} jours! L\'arbre brille!',
    treeStreakGood: '✨ {streak} jours! Pousse fort!',
    treeMaxStage: '🌳 Un magnifique grand arbre!',
    treeStage4: '🌲 Un bel arbre mature!',
    treeStage3: '🌿 Grandit en un solide arbuste!',
    treeStage2: '🌱 Une jeune pousse qui tend vers la lumière!',
    treeStage1: '🌰 Une petite graine pleine de potentiel!',
    treeHappy: '💚 L\'arbre s\'épanouit!',
    treeSeason: '{emoji} Belle {season}!',
    treeStageUp: '🎉 Évolué en {stage}!',
    treeMissedYou: 'Ton arbre t\'a manqué!',
    treeNeedsWater: 'L\'arbre a besoin d\'eau!',
    waterDecayHint: 'Le niveau d\'eau baisse de -2% par heure',
    seasonTreeHint: 'L\'arbre change avec les saisons!',
    xpToNextStage: '{xp} XP jusqu\'à {stage}',
    touchReaction1: '✨ *bruissement de feuilles*',
    touchReaction2: '🍃 Les feuilles dansent!',
    touchReaction3: '💚 Je me sens vivant!',
    touchReaction4: '🌿 Je deviens plus fort!',
    waterReaction1: '💧 *absorbe l\'eau*',
    waterReaction2: '🌊 Rafraîchissant!',
    waterReaction3: '💦 Merci!',
    waterReaction4: '✨ Je grandis!',
    waterNotEnough: '🍪 Il faut {needed} friandises, tu en as {have}',

    // Rest Mode
    restDayTitle: 'Jour de repos',
    restDayMessage: 'Repose-toi, ta série est en sécurité',
    restDayButton: 'Jour de repos',
    restDayCancel: 'Je veux quand même enregistrer',
    daysSaved: 'jours préservés',
    restDaySupportive: 'On continue ensemble demain 💚',

    // Task Momentum
    taskMomentum: 'Tâches',
    taskMomentumDesc: 'Priorisation adaptée au TDAH',
    tasksInARow: 'tâches de suite',
    taskNamePlaceholder: 'Nom de la tâche...',
    durationMinutes: 'Durée (minutes)',
    interestLevel: 'Intérêt (1-10)',
    markAsUrgent: 'Marquer comme urgent',
    urgent: 'Urgent',
    addTask: 'Ajouter',
    topRecommendedTasks: 'Top 3 tâches recommandées',
    quickWins: 'Victoires rapides (moins de 2 min)',
    allTasks: 'Toutes les tâches',
    noTasksYet: 'Pas encore de tâches',
    addFirstTaskMessage: 'Ajoute ta première tâche pour commencer!',
    addFirstTask: 'Ajouter une tâche',
    adhdTaskTips: 'Conseils TDAH',
    taskTip1: 'Commence par les victoires rapides (2-5 min)',
    taskTip2: 'Gagne en élan avec des complétions consécutives',
    taskTip3: 'Les tâches intéressantes donnent plus de dopamine',
    taskTip4: 'Urgent + court = combo parfait',
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
