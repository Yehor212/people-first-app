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

  // Mindfulness v1.5.0
  needInspiration: string;
  journalPrompt: string;
  dailyPrompt: string;
  usePrompt: string;
  shufflePrompt: string;
  mindfulMoment: string;
  takeAMoment: string;
  withNote: string;
  whatsMakingYouFeel: string;
  emotionSaved: string;
  treat: string;
  moodGood: string;
  moodOkay: string;
  moodNotGreat: string;

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
  // Insight texts
  insightBestDayTitle: string;
  insightBestDayDesc: string;
  insightBestTimeTitle: string;
  insightBestTimeDesc: string;
  insightHabitBoostsTitle: string;
  insightHabitBoostsDesc: string;
  insightFocusMoodTitle: string;
  insightFocusMoodDesc: string;
  insightGratitudeMoodTitle: string;
  insightGratitudeMoodDesc: string;
  insightMoodUpTitle: string;
  insightMoodUpDesc: string;
  insightMoodDownTitle: string;
  insightMoodDownDesc: string;
  insightHighConsistencyTitle: string;
  insightHighConsistencyDesc: string;
  insightLowConsistencyTitle: string;
  insightLowConsistencyDesc: string;

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
  // v1.4.0: Habit reminders and schedule
  addReminder: string;
  noReminders: string;
  habitEventExplanation: string;
  habitDurationMinutes: string;

  // Focus timer
  focus: string;
  breakTime: string;
  autoScheduled: string;
  taskEventExplanation: string;
  yourTasksNow: string;
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
  toLevel: string;
  unlockedPercent: string;
  all: string;
  unlocked: string;
  locked: string;
  unlockedOn: string;
  hiddenAchievement: string;
  hidden: string;
  noAchievementsYet: string;
  startUsingZenFlow: string;
  achievementUnlocked: string;
  userLevel: string;
  focusSession: string;
  // TimeHelper
  timeBlindnessHelper: string;
  visualTimeAwareness: string;
  hoursMinutesLeft: string;
  minutesLeft: string;
  timesUp: string;
  youllFinishAt: string;
  nMinutes: string;
  pingEveryMinutes: string;
  audioPings: string;
  testSound: string;
  soundOn: string;
  soundOff: string;
  startTimer: string;
  pauseTimer: string;
  resetTimer: string;
  adhdTimeManagement: string;
  adhdTip1: string;
  adhdTip2: string;
  adhdTip3: string;
  adhdTip4: string;
  currentStreak: string;
  daysInRow: string;
  totalFocus: string;
  allTime: string;
  habitsCompleted: string;
  totalTimes: string;
  moodDistribution: string;
  moodHeatmap: string;
  activityHeatmap: string;
  less: string;
  more: string;
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
  exportCSV: string;
  exportPDF: string;
  importSuccess: string;
  importError: string;
  importedItems: string;
  importAdded: string;
  importUpdated: string;
  importSkipped: string;
  textTooLong: string;
  invalidInput: string;
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
  // App Updates (v1.4.1)
  checkForUpdates: string;
  checkingForUpdates: string;
  appUpToDate: string;
  openGooglePlay: string;
  updateCheckFailed: string;
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
  deleteAccountTypeConfirm: string;
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

  // v1.2.0 Appearance
  appearance: string;
  oledDarkMode: string;
  oledDarkModeHint: string;

  // What's New Modal
  whatsNewTitle: string;
  whatsNewVersion: string;
  whatsNewGotIt: string;

  // Accessibility
  skipToContent: string;

  // v1.1.1 Settings Redesign
  settingsCloudSyncTitle: string;
  settingsCloudSyncDescription: string;
  settingsCloudSyncEnabled: string;
  settingsCloudSyncDisabledByUser: string;
  settingsExportTitle: string;
  settingsExportDescription: string;
  settingsImportTitle: string;
  settingsImportMergeTooltip: string;
  settingsImportReplaceTooltip: string;
  settingsImportReplaceConfirm: string;
  // Import validation (v1.4.1)
  invalidFileType: string;
  fileTooLarge: string;
  importConfirm: string;
  invalidBackupFormat: string;
  settingsWhatsNewTitle: string;
  settingsWhatsNewLeaderboards: string;
  settingsWhatsNewLeaderboardsDesc: string;
  settingsWhatsNewSpotify: string;
  settingsWhatsNewSpotifyDesc: string;
  settingsWhatsNewChallenges: string;
  settingsWhatsNewChallengesDesc: string;
  settingsWhatsNewDigest: string;
  settingsWhatsNewDigestDesc: string;
  settingsWhatsNewSecurity: string;
  settingsWhatsNewSecurityDesc: string;
  settingsWhatsNewGotIt: string;
  // v1.5.8 What's New
  settingsWhatsNewFeatureToggles: string;
  settingsWhatsNewFeatureTogglesDesc: string;
  settingsWhatsNewBugFixes158: string;
  settingsWhatsNewBugFixes158Desc: string;
  settingsWhatsNewUIImprovements: string;
  settingsWhatsNewUIImprovementsDesc: string;
  settingsSectionAccount: string;
  settingsSectionData: string;

  // Weekly Digest (v1.3.0)
  weeklyDigestTitle: string;
  weeklyDigestDescription: string;
  weeklyDigestEnabled: string;

  // Changelog (v1.3.0)
  changelogTitle: string;
  changelogExpandAll: string;
  changelogCollapseAll: string;
  changelogEmpty: string;
  changelogAdded: string;
  changelogFixed: string;
  changelogChanged: string;
  changelogRemoved: string;

  // Settings Groups (v1.3.0)
  settingsGroupProfile: string;
  settingsGroupNotifications: string;
  settingsGroupData: string;
  settingsGroupAccount: string;
  settingsGroupAbout: string;

  // Feature Toggles / Modules (v1.5.8)
  settingsGroupModules: string;
  settingsModulesDescription: string;
  settingsModuleMood: string;
  settingsModuleMoodDesc: string;
  settingsModuleHabits: string;
  settingsModuleHabitsDesc: string;
  settingsModuleFocus: string;
  settingsModuleFocusDesc: string;
  settingsModuleBreathing: string;
  settingsModuleBreathingDesc: string;
  settingsModuleGratitude: string;
  settingsModuleGratitudeDesc: string;
  settingsModuleQuests: string;
  settingsModuleQuestsDesc: string;
  settingsModuleTasks: string;
  settingsModuleTasksDesc: string;
  settingsModuleChallenges: string;
  settingsModuleChallengesDesc: string;
  settingsModuleAICoach: string;
  settingsModuleAICoachDesc: string;
  settingsModuleGarden: string;
  settingsModuleGardenDesc: string;
  settingsModuleCoreLocked: string;
  settingsModuleUnlockHint: string;

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
  shareDialogTitle: string;
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
  shareFailed: string;
  shareAchievement30: string;
  shareAchievement14: string;
  shareAchievement7: string;
  shareAchievement3: string;
  shareAchievementStart: string;
  shareSubtext30: string;
  shareSubtext14: string;
  shareSubtext7: string;
  shareSubtext3: string;
  shareSubtextStart: string;
  dismiss: string;

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

  // Friend Challenges
  friendChallenges: string;
  createChallenge: string;
  challengeDescription: string;
  challengeYourFriends: string;
  challengeDuration: string;
  challengeCreated: string;
  challengeDetails: string;
  shareToInvite: string;
  trackWithFriends: string;
  challengeCode: string;
  yourProgress: string;
  daysLeft: string;
  dayChallenge: string;
  challengeCompleted: string;
  noChallenges: string;
  createChallengePrompt: string;
  completedChallenges: string;
  expiredChallenges: string;
  youCreated: string;
  createdBy: string;
  confirmDeleteChallenge: string;
  challengeInvite: string;
  challengeJoinPrompt: string;
  challengeShareTip: string;

  // Friend Challenges - Join
  joinChallenge: string;
  enterChallengeCode: string;
  invalidChallengeCode: string;
  enterCodeToJoin: string;
  joinChallengeHint: string;
  joining: string;
  join: string;

  // Friend Challenges v2 - Motivational messages
  challengeWon: string;
  catchUp: string;
  aheadOfSchedule: string;
  daysPassed: string;
  daysCompleted: string;
  daysRemaining: string;

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
  onboardingAgeTitle: string;
  onboardingAgeDesc: string;
  onboardingAgeConfirm: string;
  onboardingAgeNote: string;
  healthConnectAgeDesc: string;
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
  tutorialFeature2b: string;
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
  weeklyStory: string;
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
  // Weekly Story translations (ProgressStoriesViewer)
  storyAverageMoodScore: string;
  storyCompletionRate: string;
  storyTopHabit: string;
  storyCompletions: string;
  storyPerfectDays: string;
  storyAvgSession: string;
  storyLongestSession: string;
  storyMostFocusedOn: string;
  storyTrackYourJourney: string;
  storyTapLeft: string;
  storyTapCenter: string;
  storyTapRight: string;
  generating: string;

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

  // Completed sections (collapsible)
  expand: string;
  collapse: string;
  moodRecordedShort: string;
  habitsCompletedShort: string;
  focusCompletedShort: string;
  gratitudeAddedShort: string;

  // All complete celebration
  allComplete: string;
  allCompleteMessage: string;
  allCompleteSupportive: string;
  allCompleteLegend: string;
  allCompleteAmazing: string;
  allCompleteGreat: string;
  allCompleteNice: string;
  daysStreak: string;
  restDaySupportive: string;
  restDayCooldown: string;
  restDayAvailableIn: string;

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

  // Header Quick Actions
  tasks: string;
  quests: string;
  challenges: string;
  openTasks: string;
  openQuests: string;
  openChallenges: string;

  // QuestsPanel UI
  randomQuests: string;
  questsPanelSubtitle: string;
  adhdEngagementSystem: string;
  adhdEngagementDesc: string;
  dailyQuest: string;
  weeklyQuest: string;
  bonusQuest: string;
  newQuest: string;
  limitedTime: string;
  generate: string;
  noQuestAvailable: string;
  noBonusQuestAvailable: string;
  bonusQuestsHint: string;
  questProgress: string;
  questExpired: string;
  questType: string;
  questTips: string;
  questTipDaily: string;
  questTipWeekly: string;
  questTipBonus: string;
  questTipExpire: string;

  // Missing companion key
  companionHungry: string;

  // Missing common actions
  back: string;
  start: string;
  stop: string;

  // Celebrations (missing)
  allHabitsComplete: string;
  amazingWork: string;

  // 404 page
  pageNotFound: string;
  goHome: string;

  // Insights
  insightsTitle: string;
  insightsNotEnoughData: string;
  insightsNoPatterns: string;
  insightsHelpTitle: string;
  insightsHelp1: string;
  insightsHelp2: string;
  insightsHelp3: string;
  insightsDismiss: string;
  insightsShowMore: string;
  insightsShowLess: string;
  insightsDismissedCount: string;
  insightsMoodEntries: string;
  insightsHabitCount: string;
  insightsFocusSessions: string;

  // Weekly Insights (v1.5.0)
  weeklyInsights: string;
  weeklyInsightsNotEnoughData: string;
  comparedToLastWeek: string;
  recommendations: string;
  avgMood: string;
  week: string;
  // Recommendation translations
  recLowMoodTitle: string;
  recLowMoodDesc: string;
  recLowMoodAction: string;
  recHabitDeclineTitle: string;
  recHabitDeclineDesc: string;
  recHabitDeclineAction: string;
  recLowFocusTitle: string;
  recLowFocusDesc: string;
  recLowFocusAction: string;
  recGreatProgressTitle: string;
  recGreatProgressDesc: string;
  recBestDayTitle: string;
  recBestDayDesc: string;
  recGratitudeTitle: string;
  recGratitudeDesc: string;
  recGratitudeAction: string;
  recPerfectWeekTitle: string;
  recPerfectWeekDesc: string;
  recTopHabitTitle: string;
  recTopHabitDesc: string;

  // Smart Reminders (v1.5.0)
  smartReminders: string;
  smartRemindersNotEnoughData: string;
  smartRemindersOptimized: string;
  smartRemindersDescription: string;
  suggestions: string;
  highConfidence: string;
  mediumConfidence: string;
  lowConfidence: string;
  apply: string;
  habitRemindersOptimal: string;
  patternBased: string;

  // Sync status (additional)
  syncOffline: string;
  syncSyncing: string;
  syncLastSync: string;
  syncReady: string;
  syncBackup: string;
  syncReminders: string;
  syncChallenges: string;
  syncTasks: string;
  syncInnerWorld: string;
  syncBadges: string;

  // Progressive Onboarding
  onboardingTryNow: string;
  onboardingGotIt: string;
  onboardingNext: string;

  // Re-engagement (Welcome Back Modal)
  reengageTitle: string;
  reengageSubtitle: string;
  reengageStreakBroken: string;
  reengageStreakProtected: string;
  reengageStreakBrokenMsg: string;
  reengageStreakProtectedMsg: string;
  reengageBestHabits: string;
  reengageSuccessRate: string;
  reengageQuickMood: string;
  reengageMoodLogged: string;
  reengageContinue: string;

  // Trends View (Long-term Analytics)
  trendsTitle: string;
  trendsAvgMood: string;
  trendsHabitRate: string;
  trendsFocusTime: string;
  trendsMoodChart: string;
  trendsHabitChart: string;
  trendsFocusChart: string;
  trendsTotalFocus: string;
  trendsInsightHint: string;
  trendsInsightHintDesc: string;

  // Health Connect (v1.2.0)
  healthConnect: string;
  healthConnectDescription: string;
  healthConnectLoading: string;
  healthConnectNotAvailable: string;
  healthConnectUpdateRequired: string;
  mindfulness: string;
  sleep: string;
  steps: string;
  stepsLabel: string;
  grantPermissions: string;
  todayHealth: string;
  syncFocusSessions: string;
  syncFocusSessionsHint: string;
  openHealthConnect: string;
  refresh: string;
  permissions: string;

  // Quest Templates (for randomQuests.ts)
  questMorningMomentum: string;
  questMorningMomentumDesc: string;
  questHabitMaster: string;
  questHabitMasterDesc: string;
  questSpeedDemon: string;
  questSpeedDemonDesc: string;
  questFocusFlow: string;
  questFocusFlowDesc: string;
  questDeepWork: string;
  questDeepWorkDesc: string;
  questHyperfocusHero: string;
  questHyperfocusHeroDesc: string;
  questStreakKeeper: string;
  questStreakKeeperDesc: string;
  questConsistencyKing: string;
  questConsistencyKingDesc: string;
  questGratitudeSprint: string;
  questGratitudeSprintDesc: string;
  questThankfulHeart: string;
  questThankfulHeartDesc: string;
  questLightningRound: string;
  questLightningRoundDesc: string;
  questWeeklyWarrior: string;
  questWeeklyWarriorDesc: string;

  onboardingGetStarted: string;
  onboardingWelcomeTitle: string;
  onboardingWelcomeDescription: string;
  onboardingDay1Title: string;
  onboardingDay1Description: string;
  onboardingGradualTitle: string;
  onboardingGradualDescription: string;
  onboardingDayProgress: string;
  onboardingFeaturesUnlocked: string;
  onboardingNextUnlock: string;

  // Feature Unlock Messages
  onboardingfocusTimerUnlockTitle: string;
  onboardingfocusTimerUnlockSubtitle: string;
  onboardingfocusTimerDescription: string;
  onboardingxpUnlockTitle: string;
  onboardingxpUnlockSubtitle: string;
  onboardingxpDescription: string;
  onboardingquestsUnlockTitle: string;
  onboardingquestsUnlockSubtitle: string;
  onboardingquestsDescription: string;
  onboardingcompanionUnlockTitle: string;
  onboardingcompanionUnlockSubtitle: string;
  onboardingcompanionDescription: string;
  onboardingtasksUnlockTitle: string;
  onboardingtasksUnlockSubtitle: string;
  onboardingtasksDescription: string;
  onboardingchallengesUnlockTitle: string;
  onboardingchallengesUnlockSubtitle: string;
  onboardingchallengesDescription: string;

  // Feedback System
  feedbackTitle: string;
  feedbackSubtitle: string;
  feedbackCategoryBug: string;
  feedbackCategoryFeature: string;
  feedbackCategoryOther: string;
  feedbackMessagePlaceholder: string;
  feedbackEmailPlaceholder: string;
  feedbackSubmit: string;
  feedbackSuccess: string;
  feedbackError: string;
  feedbackSending: string;
  sendFeedback: string;

  // App Rating
  rateAppTitle: string;
  rateAppSubtitle: string;
  rateAppButton: string;
  rateAppLater: string;

  // App Updates
  updateAvailable: string;
  updateDescription: string;
  updateDescriptionCritical: string;
  updateNow: string;
  updateAvailableFor: string;  // Uses {days} placeholder

  // Lock Screen Quick Actions (v1.2.0)
  quickActions: string;
  quickActionsDescription: string;
  quickActionsEnabled: string;
  quickActionsDisabled: string;
  quickActionLogMood: string;
  quickActionStartFocus: string;
  quickActionViewHabits: string;

  // Notification Sounds (v1.2.0)
  notificationSound: string;
  notificationSoundDescription: string;
  soundDefault: string;
  soundDefaultDesc: string;
  soundGentle: string;
  soundGentleDesc: string;
  soundChime: string;
  soundChimeDesc: string;
  soundSilent: string;
  soundSilentDesc: string;
  testNotification: string;
  testNotificationHint: string;

  // Insight Card Details (v1.3.0)
  insightConfidence: string;
  insightDataPoints: string;
  insightAvgMoodWith: string;
  insightAvgMoodWithout: string;
  insightSampleDays: string;
  insightBestActivity: string;
  insightPeakTime: string;
  insightAvgDuration: string;
  insightSessions: string;
  insightTagOccurrences: string;
  insightMoodWithTag: string;
  insightMoodWithoutTag: string;
  insightDisclaimer: string;
  times: string;

  // Stats Empty States (v1.3.0)
  noMoodDataYet: string;
  noEmotionDataYet: string;

  // XP Display
  xp: string;

  // AI Coach
  aiCoachTitle: string;
  aiCoachSubtitle: string;
  aiCoachWelcome: string;
  aiCoachPlaceholder: string;
  aiCoachQuick1: string;
  aiCoachQuick2: string;
  aiCoachQuick3: string;
  clearHistory: string;
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

    // Mindfulness v1.5.0
    needInspiration: 'Нужно вдохновение?',
    journalPrompt: 'Промпт',
    dailyPrompt: 'Промпт дня',
    usePrompt: 'Использовать этот промпт',
    shufflePrompt: 'Другой промпт',
    mindfulMoment: 'Момент осознанности',
    takeAMoment: 'Сделай паузу...',
    withNote: 'с заметкой',
    whatsMakingYouFeel: 'Что вызывает это чувство?',
    emotionSaved: 'Эмоция сохранена',
    treat: 'лакомство',
    moodGood: 'Хорошо',
    moodOkay: 'Нормально',
    moodNotGreat: 'Не очень',

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
    // Insight texts
    insightBestDayTitle: '{day} — ваш лучший день!',
    insightBestDayDesc: 'Ваше настроение обычно лучше по {day}м. Планируйте важные дела на этот день.',
    insightBestTimeTitle: 'Вы сияете ярче {period}',
    insightBestTimeDesc: 'Ваше настроение обычно лучше {period}. Планируйте сложные задачи на это время!',
    insightHabitBoostsTitle: '«{habit}» поднимает настроение!',
    insightHabitBoostsDesc: 'Когда вы выполняете «{habit}», настроение на {percent}% лучше. Так держать!',
    insightFocusMoodTitle: 'Фокус = Лучшее настроение!',
    insightFocusMoodDesc: 'В дни с фокус-сессиями настроение на {percent}% лучше. Глубокая работа окупается!',
    insightGratitudeMoodTitle: 'Благодарность поднимает настроение!',
    insightGratitudeMoodDesc: 'Дни с записями благодарности показывают на {percent}% лучшее настроение. Продолжайте практиковать!',
    insightMoodUpTitle: 'Ваше настроение улучшается!',
    insightMoodUpDesc: 'Среднее настроение на этой неделе на {percent}% лучше, чем на прошлой. Вы молодец!',
    insightMoodDownTitle: 'Давайте поднимем настроение!',
    insightMoodDownDesc: 'Настроение немного снизилось. Попробуйте сосредоточиться на привычках, которые обычно вас радуют.',
    insightHighConsistencyTitle: 'Потрясающая последовательность!',
    insightHighConsistencyDesc: 'Вы записывали настроение {days} из последних 14 дней. Это мощное самопознание!',
    insightLowConsistencyTitle: 'Создайте привычку записей',
    insightLowConsistencyDesc: 'Попробуйте записывать настроение в одно и то же время каждый день. Регулярность помогает выявлять закономерности!',

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
    // v1.4.0: Habit reminders and schedule
    addReminder: 'Добавить',
    noReminders: 'Нет напоминаний',
    habitEventExplanation: 'Это событие из привычки. Измените привычку для редактирования.',
    habitDurationMinutes: 'минут',

    focus: 'Фокус',
    breakTime: 'Перерыв',
    autoScheduled: 'Авто-расписание',
    taskEventExplanation: 'Этот блок создан автоматически из ваших задач. Выполните задачу, чтобы удалить его.',
    yourTasksNow: 'Ваши задачи на сейчас',
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
    toLevel: 'До уровня',
    unlockedPercent: 'Разблокировано {percent}%',
    all: 'Все',
    unlocked: 'Открытые',
    locked: 'Закрытые',
    unlockedOn: 'Разблокировано {date}',
    hiddenAchievement: '???',
    hidden: 'Скрыто',
    noAchievementsYet: 'Пока нет достижений',
    startUsingZenFlow: 'Начните использовать ZenFlow, чтобы разблокировать достижения!',
    achievementUnlocked: 'Достижение разблокировано!',
    userLevel: 'Уровень',
    focusSession: 'Сессия фокуса',
    // TimeHelper
    timeBlindnessHelper: 'Помощник осознания времени',
    visualTimeAwareness: 'Визуальное отслеживание времени для СДВГ',
    hoursMinutesLeft: '{hours}ч {mins}м осталось',
    minutesLeft: '{mins}м осталось',
    timesUp: 'Время вышло!',
    youllFinishAt: '🎯 Вы закончите в:',
    nMinutes: '{n} минут',
    pingEveryMinutes: 'Сигнал каждые (минут)',
    audioPings: 'Звуковые сигналы',
    testSound: '🔊 Тест',
    soundOn: 'Вкл',
    soundOff: 'Выкл',
    startTimer: 'Запустить таймер',
    pauseTimer: 'Пауза',
    resetTimer: 'Сброс',
    adhdTimeManagement: 'Управление временем при СДВГ',
    adhdTip1: 'Звуковые сигналы помогают отслеживать время',
    adhdTip2: 'Визуальный обратный отсчёт снижает тревогу',
    adhdTip3: 'Прогноз завершения = лучшее планирование',
    adhdTip4: 'Смена цвета предупреждает о нехватке времени',
    currentStreak: 'Текущая серия',
    daysInRow: 'Дней подряд',
    totalFocus: 'Всего фокуса',
    allTime: 'За все время',
    habitsCompleted: 'Привычки выполнены',
    totalTimes: 'Всего раз',
    moodDistribution: 'Распределение настроения',
    moodHeatmap: 'Календарь настроения',
    activityHeatmap: 'Обзор активности',
    less: 'Меньше',
    more: 'Больше',
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
    exportCSV: 'Экспорт CSV',
    exportPDF: 'Экспорт PDF',
    importSuccess: 'Импорт завершён.',
    importError: 'Не удалось импортировать файл.',
    importedItems: 'Добавлено',
    importAdded: 'добавлено',
    importUpdated: 'обновлено',
    importSkipped: 'пропущено',
    textTooLong: 'Текст слишком длинный (максимум 2000 символов)',
    invalidInput: 'Проверьте введённые данные',
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

    // v1.2.0 Appearance
    appearance: 'Внешний вид',
    oledDarkMode: 'OLED тёмная тема',
    oledDarkModeHint: 'Чисто чёрная тема для OLED экранов. Экономит батарею.',

    // What's New Modal
    whatsNewTitle: 'Что нового',
    whatsNewVersion: 'Версия',
    whatsNewGotIt: 'Понятно!',

    // Accessibility
    skipToContent: 'Перейти к содержимому',

    // v1.1.1 Settings Redesign
    settingsCloudSyncTitle: 'Включить облачную синхронизацию',
    settingsCloudSyncDescription: 'Синхронизируйте данные между устройствами',
    settingsCloudSyncEnabled: 'Облачная синхронизация включена',
    settingsCloudSyncDisabledByUser: 'Синхронизация отключена',
    settingsExportTitle: 'Экспорт резервной копии',
    settingsExportDescription: 'Сохраните все данные в файл',
    settingsImportTitle: 'Импорт резервной копии',
    settingsImportMergeTooltip: 'Импортированные данные будут добавлены к существующим. Дубликаты пропускаются.',
    settingsImportReplaceTooltip: '⚠️ Все текущие данные будут удалены и заменены импортированными',
    settingsImportReplaceConfirm: 'Введите "REPLACE" для подтверждения удаления всех данных',
    // Import validation (v1.4.1)
    invalidFileType: 'Неверный тип файла. Требуется JSON.',
    fileTooLarge: 'Файл слишком большой (макс. 10 МБ)',
    importConfirm: 'Подтвердить импорт',
    invalidBackupFormat: 'Неверный формат резервной копии',
    settingsWhatsNewTitle: 'Что нового в v1.5.8',
    settingsWhatsNewLeaderboards: 'Таблицы лидеров',
    settingsWhatsNewLeaderboardsDesc: 'Соревнуйтесь анонимно с другими',
    settingsWhatsNewSpotify: 'Интеграция Spotify',
    settingsWhatsNewSpotifyDesc: 'Автовоспроизведение музыки во время фокусировки',
    settingsWhatsNewChallenges: 'Челленджи с друзьями',
    settingsWhatsNewChallengesDesc: 'Приглашайте друзей вырабатывать привычки вместе',
    settingsWhatsNewDigest: 'Еженедельный дайджест',
    settingsWhatsNewDigestDesc: 'Получайте отчёты о прогрессе на email',
    settingsWhatsNewSecurity: 'Улучшенная безопасность',
    settingsWhatsNewSecurityDesc: 'Лучшая защита данных и приватности',
    settingsWhatsNewGotIt: 'Понятно!',
    // v1.5.8 What's New
    settingsWhatsNewFeatureToggles: 'Переключатели модулей',
    settingsWhatsNewFeatureTogglesDesc: 'Включайте/выключайте модули в Настройках',
    settingsWhatsNewBugFixes158: 'Исправления багов',
    settingsWhatsNewBugFixes158Desc: 'Исправлены проблемы синхронизации и стабильности',
    settingsWhatsNewUIImprovements: 'Улучшения интерфейса',
    settingsWhatsNewUIImprovementsDesc: 'Улучшенные переключатели и организация настроек',
    settingsSectionAccount: 'Аккаунт и облако',
    settingsSectionData: 'Данные и резервное копирование',

    // Weekly Digest (v1.3.0)
    weeklyDigestTitle: 'Еженедельный отчёт',
    weeklyDigestDescription: 'Получайте сводку привычек, фокуса и настроения каждое воскресенье.',
    weeklyDigestEnabled: 'Отчёты приходят на вашу почту',

    // Changelog
    changelogTitle: 'История обновлений',
    changelogExpandAll: 'Развернуть все',
    changelogCollapseAll: 'Свернуть все',
    changelogEmpty: 'История обновлений недоступна',
    changelogAdded: 'Добавлено',
    changelogFixed: 'Исправлено',
    changelogChanged: 'Изменено',
    changelogRemoved: 'Удалено',

    // Settings Groups (v1.3.0)
    settingsGroupProfile: 'Профиль и оформление',
    settingsGroupNotifications: 'Уведомления',
    settingsGroupData: 'Данные и приватность',
    settingsGroupAccount: 'Аккаунт',
    settingsGroupAbout: 'О приложении',

    // Feature Toggles / Modules (v1.5.8)
    settingsGroupModules: 'Модули',
    settingsModulesDescription: 'Включайте и выключайте функции приложения',
    settingsModuleMood: 'Трекер настроения',
    settingsModuleMoodDesc: 'Основная функция — всегда включена',
    settingsModuleHabits: 'Привычки',
    settingsModuleHabitsDesc: 'Основная функция — всегда включена',
    settingsModuleFocus: 'Таймер фокуса',
    settingsModuleFocusDesc: 'Техника Помодоро и глубокая работа',
    settingsModuleBreathing: 'Дыхательные упражнения',
    settingsModuleBreathingDesc: 'Техники расслабления и медитации',
    settingsModuleGratitude: 'Журнал благодарности',
    settingsModuleGratitudeDesc: 'Записывайте, за что вы благодарны',
    settingsModuleQuests: 'Квесты',
    settingsModuleQuestsDesc: 'Ежедневные задания и награды',
    settingsModuleTasks: 'Задачи',
    settingsModuleTasksDesc: 'Список дел и управление задачами',
    settingsModuleChallenges: 'Челленджи',
    settingsModuleChallengesDesc: 'Испытания и достижения',
    settingsModuleAICoach: 'AI Коуч',
    settingsModuleAICoachDesc: 'Персональный помощник с ИИ',
    settingsModuleGarden: 'Мой сад',
    settingsModuleGardenDesc: 'Виртуальный сад и компаньон',
    settingsModuleCoreLocked: 'Основной модуль',
    settingsModuleUnlockHint: 'Разблокируется по мере прогресса',

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
    // App Updates (v1.4.1)
    checkForUpdates: 'Проверить обновления',
    checkingForUpdates: 'Проверка обновлений...',
    appUpToDate: 'У вас последняя версия',
    openGooglePlay: 'Открыть Google Play',
    updateCheckFailed: 'Не удалось проверить обновления',
    remindersTitle: 'Напоминания',
    remindersDescription: 'Мягкие напоминания, чтобы не сбиваться с курса.',
    moodReminder: 'Время для отметки настроения',
    habitReminder: 'Время напоминаний о привычках',
    focusReminder: 'Время фокус-сессии',
    quietHours: 'Тихие часы',
    reminderDays: 'Дни недели',
    selectedHabits: 'Привычки для напоминаний',
    noHabitsYet: 'Пока нет привычек.',
    reminderMoodTitle: 'Эй, как ты? 💭',
    reminderMoodBody: '30 секунд — и мозг скажет спасибо! Как настроение?',
    reminderHabitTitle: 'Привычка-малышка ждёт! ✨',
    reminderHabitBody: 'Маленький шаг = большая победа. Погнали?',
    reminderFocusTitle: 'Время для фокуса! 🎯',
    reminderFocusBody: 'Всего 25 минут и ты герой. Включаем режим бога?',
    reminderDismiss: 'Не сейчас',
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
    deleteAccountTypeConfirm: 'Введите DELETE для подтверждения:',
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
    shareDialogTitle: 'Поделитесь своим прогрессом',
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
    shareFailed: 'Не удалось поделиться. Попробуйте снова.',
    shareAchievement30: 'Легенда!',
    shareAchievement14: 'Неудержимый!',
    shareAchievement7: 'В огне!',
    shareAchievement3: 'Восходящая звезда!',
    shareAchievementStart: 'Только начал!',
    shareSubtext30: 'Мастер 30+ дней',
    shareSubtext14: 'Воин 14+ дней',
    shareSubtext7: 'Серия 7+ дней',
    shareSubtext3: 'Серия 3+ дня',
    shareSubtextStart: 'Строю привычки',
    dismiss: 'Закрыть',
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

    // Friend Challenges
    friendChallenges: 'Вызовы друзьям',
    createChallenge: 'Создать вызов',
    challengeDescription: 'Бросьте вызов друзьям и формируйте привычки вместе',
    challengeYourFriends: 'Бросьте вызов друзьям!',
    challengeDuration: 'Длительность вызова',
    challengeCreated: 'Вызов создан!',
    challengeDetails: 'Детали вызова',
    shareToInvite: 'Поделитесь, чтобы пригласить друзей!',
    trackWithFriends: 'Отслеживайте вызовы с друзьями',
    challengeCode: 'Код вызова',
    yourProgress: 'Ваш прогресс',
    daysLeft: 'дней осталось',
    dayChallenge: 'дневной вызов',
    challengeCompleted: 'Вызов выполнен!',
    noChallenges: 'Пока нет вызовов',
    createChallengePrompt: 'Создайте вызов из любой привычки!',
    completedChallenges: 'Завершённые',
    expiredChallenges: 'Истёкшие',
    youCreated: 'Вы создали',
    createdBy: 'Создал',
    confirmDeleteChallenge: 'Удалить этот вызов?',
    challengeInvite: 'Присоединяйся к моему вызову!',
    challengeJoinPrompt: 'Присоединяйся ко мне в ZenFlow!',
    challengeShareTip: 'После создания вы сможете поделиться вызовом с друзьями.',

    // Friend Challenges - Join
    joinChallenge: 'Присоединиться',
    enterChallengeCode: 'Введите код от друга',
    invalidChallengeCode: 'Неверный код. Формат: ZEN-XXXXXX',
    enterCodeToJoin: 'Введите код вызова, чтобы присоединиться',
    joinChallengeHint: 'Попросите друга поделиться кодом вызова',
    joining: 'Присоединяемся...',
    join: 'Присоединиться',

    // Friend Challenges v2
    challengeWon: '🎉 Потрясающе! Вы завершили испытание!',
    catchUp: '💪 Вы можете догнать! Каждый день важен!',
    aheadOfSchedule: '⭐ Отличный темп! Вы опережаете график!',
    daysPassed: 'Дней прошло',
    daysCompleted: 'Выполнено',
    daysRemaining: 'Осталось',

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
    onboardingAgeTitle: 'Добро пожаловать в ZenFlow',
    onboardingAgeDesc: 'Это приложение предназначено для пользователей от 13 лет и старше',
    onboardingAgeConfirm: 'Мне есть 13 лет',
    onboardingAgeNote: 'Продолжая, вы подтверждаете, что вам есть 13 лет',
    healthConnectAgeDesc: 'Функции Health Connect требуют подтверждения возраста 13+ для ответственного использования данных о здоровье.',
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
    tutorialFeature2b: '✨ Настраивайте иконки, цвета и цели!',
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
    weeklyStory: 'История недели',
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
    // Weekly Story translations (ProgressStoriesViewer)
    storyAverageMoodScore: 'средняя оценка настроения',
    storyCompletionRate: 'выполнение',
    storyTopHabit: 'Топ привычка',
    storyCompletions: 'выполнений',
    storyPerfectDays: 'идеальных дней на этой неделе',
    storyAvgSession: 'сред. сессия',
    storyLongestSession: 'самая долгая',
    storyMostFocusedOn: 'Больше всего фокус на:',
    storyTrackYourJourney: 'Отслеживайте свой путь с',
    storyTapLeft: '← Влево',
    storyTapCenter: 'Центр - пауза',
    storyTapRight: 'Вправо →',
    generating: 'Генерация...',

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
    // Companion Notifications
    companionMissesYou: 'Эй! Я тут соскучился! 💕',
    companionWantsToPlay: 'Давай заглянем ко мне? Тут весело! 🎉',
    companionWaiting: 'Жду тебя! Есть кое-что интересное 🌱',
    companionProud: 'ТЫ МОЛОДЕЦ! Я в восторге! ⭐',
    companionCheersYou: 'Вперёд! Ты можешь! 💪',
    companionQuickMood: 'Псс! Как дела? Тыкни сюда! 😊',

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

    // Completed sections
    expand: 'Развернуть',
    collapse: 'Свернуть',
    moodRecordedShort: 'Настроение записано',
    habitsCompletedShort: 'Привычки выполнены',
    focusCompletedShort: 'Фокус завершён',
    gratitudeAddedShort: 'Благодарность записана',

    // All complete celebration
    allComplete: 'Всё выполнено!',
    allCompleteMessage: 'Вы выполнили все активности на сегодня',
    allCompleteSupportive: 'Увидимся завтра!',
    allCompleteLegend: 'Легендарный день!',
    allCompleteAmazing: 'Потрясающе!',
    allCompleteGreat: 'Отличная работа!',
    allCompleteNice: 'Хорошая работа!',
    daysStreak: 'дней подряд',
    restDaySupportive: 'Завтра продолжим вместе 💚',
    restDayCooldown: 'День отдыха уже был недавно',
    restDayAvailableIn: 'Доступен через',

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

    // Header Quick Actions
    tasks: 'Задачи',
    quests: 'Квесты',
    challenges: 'Вызовы',
    openTasks: 'Открыть задачи',
    openQuests: 'Открыть квесты',
    openChallenges: 'Открыть вызовы',

    // QuestsPanel UI
    randomQuests: 'Случайные квесты',
    questsPanelSubtitle: 'Выполняйте квесты для бонусного XP и эксклюзивных значков',
    adhdEngagementSystem: 'Система вовлечённости СДВГ',
    adhdEngagementDesc: 'Квесты дают разнообразие и неожиданные награды — идеально для СДВГ-мозга, который жаждет новизны!',
    dailyQuest: 'Ежедневный квест',
    weeklyQuest: 'Еженедельный квест',
    bonusQuest: 'Бонусный квест',
    newQuest: 'Новый квест',
    limitedTime: 'Ограниченное время',
    generate: 'Создать',
    noQuestAvailable: 'Квест недоступен',
    noBonusQuestAvailable: 'Бонусный квест недоступен',
    bonusQuestsHint: 'Бонусные квесты появляются случайно или могут быть созданы вручную',
    questProgress: 'Прогресс:',
    questExpired: 'Истёк',
    questType: 'Квест',
    questTips: 'Советы по квестам',
    questTipDaily: 'Ежедневные квесты обновляются каждые 24 часа',
    questTipWeekly: 'Еженедельные квесты дают 3x XP',
    questTipBonus: 'Бонусные квесты редки и дают 5x XP',
    questTipExpire: 'Завершите квесты до истечения срока!',

    // Companion
    companionHungry: 'Я голодный... Покорми меня?',

    // Common actions
    back: 'Назад',
    start: 'Начать',
    stop: 'Стоп',

    // Celebrations
    allHabitsComplete: 'Все привычки выполнены!',
    amazingWork: 'Отличная работа сегодня!',

    // 404 page
    pageNotFound: 'Страница не найдена',
    goHome: 'На главную',

    // Insights
    insightsTitle: 'Персональные Инсайты',
    insightsNotEnoughData: 'Продолжайте отслеживать настроение, привычки и фокус в течение недели, чтобы получить персонализированные инсайты о ваших паттернах.',
    insightsNoPatterns: 'Пока не обнаружено сильных паттернов. Продолжайте отслеживание, чтобы узнать, что работает лучше всего для вас!',
    insightsHelpTitle: 'Об Инсайтах',
    insightsHelp1: 'Инсайты генерируются из ваших данных с помощью статистического анализа.',
    insightsHelp2: 'Весь анализ происходит локально на вашем устройстве - ваши данные никуда не передаются.',
    insightsHelp3: 'Паттерны с более высокой уверенностью показываются первыми.',
    insightsDismiss: 'Скрыть',
    insightsShowMore: 'Показать больше',
    insightsShowLess: 'Показать меньше',
    insightsDismissedCount: 'Скрыто инсайтов',
    insightsMoodEntries: 'записей настроения',
    insightsHabitCount: 'привычка',
    insightsFocusSessions: 'фокус-сессий',

    // Weekly Insights (v1.5.0)
    weeklyInsights: 'Инсайты недели',
    weeklyInsightsNotEnoughData: 'Отслеживайте прогресс на этой неделе, чтобы получить персонализированные инсайты и рекомендации.',
    comparedToLastWeek: 'По сравнению с прошлой неделей',
    recommendations: 'Рекомендации',
    avgMood: 'Ср. настр.',
    week: 'Неделя',
    // Recommendation translations
    recLowMoodTitle: 'Настроение требует внимания',
    recLowMoodDesc: 'Ваше настроение на этой неделе было ниже обычного. Попробуйте занятия, которые обычно поднимают вам настроение.',
    recLowMoodAction: 'Попробуйте 5-минутное дыхательное упражнение',
    recHabitDeclineTitle: 'Привычки снизились',
    recHabitDeclineDesc: 'Выполнение привычек снизилось по сравнению с прошлой неделей. Начните с малого, чтобы восстановить импульс.',
    recHabitDeclineAction: 'Сфокусируйтесь на одной привычке сегодня',
    recLowFocusTitle: 'Увеличьте время фокуса',
    recLowFocusDesc: 'На этой неделе было мало сессий фокусировки. Даже короткие сессии помогают выработать привычку.',
    recLowFocusAction: 'Попробуйте 10-минутную сессию фокуса',
    recGreatProgressTitle: 'Вы на подъёме!',
    recGreatProgressDesc: 'Ваш прогресс улучшается по сравнению с прошлой неделей. Так держать!',
    recBestDayTitle: 'Это был ваш лучший день',
    recBestDayDesc: 'Попробуйте понять, что сделало этот день особенным, и повторить эти условия.',
    recGratitudeTitle: 'Практикуйте благодарность',
    recGratitudeDesc: 'Записывание того, за что вы благодарны, может значительно улучшить настроение со временем.',
    recGratitudeAction: 'Добавьте запись благодарности сегодня',
    recPerfectWeekTitle: 'Потрясающая стабильность!',
    recPerfectWeekDesc: 'Вы выполнили большинство привычек на этой неделе. Вы формируете крепкие привычки!',
    recTopHabitTitle: 'Продолжайте эту привычку',
    recTopHabitDesc: 'Это одна из ваших самых стабильных привычек. Она способствует вашему благополучию.',

    // Smart Reminders
    smartReminders: 'Умные напоминания',
    smartRemindersNotEnoughData: 'Продолжайте использовать приложение, чтобы получить персонализированные рекомендации по напоминаниям.',
    smartRemindersOptimized: 'Ваше время напоминаний оптимально! Отличная работа.',
    smartRemindersDescription: 'Персональные рекомендации на основе ваших паттернов',
    suggestions: 'предложений',
    highConfidence: 'Высокая уверенность',
    mediumConfidence: 'Средняя',
    lowConfidence: 'Предложение',
    apply: 'Применить',
    habitRemindersOptimal: 'Оптимальное время привычек',
    patternBased: 'По паттерну',

    // Sync status
    syncOffline: 'Оффлайн',
    syncSyncing: 'Синхронизация',
    syncLastSync: 'Синхронизировано',
    syncReady: 'Готово к синхронизации',
    syncBackup: 'данных',
    syncReminders: 'напоминаний',
    syncChallenges: 'челленджей',
    syncTasks: 'задач',
    syncInnerWorld: 'прогресса',
    syncBadges: 'достижений',

    // Progressive Onboarding
    onboardingTryNow: 'Попробовать',
    onboardingGotIt: 'Понятно!',
    onboardingNext: 'Далее',
    onboardingGetStarted: 'Начать!',
    onboardingWelcomeTitle: 'Добро пожаловать в ZenFlow! 🌱',
    onboardingWelcomeDescription: 'Мы рады помочь вам создать лучшие привычки и понять, что работает именно для ВАШЕГО мозга.',
    onboardingDay1Title: 'Начнём просто',
    onboardingDay1Description: 'Сегодня мы сосредоточимся только на двух вещах: отслеживании настроения и создании первой привычки. Ничего сложного.',
    onboardingGradualTitle: 'Больше функций открывается постепенно',
    onboardingGradualDescription: 'В течение следующих 4 дней вы откроете новые функции по мере прогресса. Никакой перегрузки информацией!',
    onboardingDayProgress: 'День {day} из {maxDay}',
    onboardingFeaturesUnlocked: 'функций',
    onboardingNextUnlock: 'Следующая разблокировка',

    // Feature Unlocks
    onboardingfocusTimerUnlockTitle: '🎯 Таймер Фокуса Открыт!',
    onboardingfocusTimerUnlockSubtitle: 'Отличный прогресс!',
    onboardingfocusTimerDescription: 'Используйте таймер Pomodoro для глубокой концентрации. Установите 25 минут, сфокусируйтесь на одной задаче, затем сделайте перерыв. Идеально для ADHD мозга!',
    onboardingxpUnlockTitle: '✨ Система XP Открыта!',
    onboardingxpUnlockSubtitle: 'Время для gamification!',
    onboardingxpDescription: 'Зарабатывайте опыт за выполнение привычек, фокус-сессии и отслеживание настроения. Повышайте уровень и открывайте новые достижения!',
    onboardingquestsUnlockTitle: '🎮 Квесты Открыты!',
    onboardingquestsUnlockSubtitle: 'Новые вызовы!',
    onboardingquestsDescription: 'Ежедневные и еженедельные квесты добавляют разнообразия в вашу рутину. Выполняйте их для бонусных наград!',
    onboardingcompanionUnlockTitle: '💚 Компаньон Открыт!',
    onboardingcompanionUnlockSubtitle: 'Встречайте вашего помощника!',
    onboardingcompanionDescription: 'Ваш виртуальный компаньон растёт вместе с вами, празднует победы и поддерживает в трудные дни. Выбирайте из 5 типов!',
    onboardingtasksUnlockTitle: '📝 Задачи Открыты!',
    onboardingtasksUnlockSubtitle: 'Полный доступ!',
    onboardingtasksDescription: 'Task Momentum помогает приоритизировать задачи специально для ADHD. Система рекомендует, что делать дальше, основываясь на срочности и вашей энергии.',
    onboardingchallengesUnlockTitle: '🏆 Челленджи Открыты!',
    onboardingchallengesUnlockSubtitle: 'Полный доступ!',
    onboardingchallengesDescription: 'Участвуйте в долгосрочных челленджах для развития навыков. Отслеживайте прогресс и зарабатывайте эксклюзивные значки!',

    // Re-engagement (Welcome Back Modal)
    reengageTitle: 'С возвращением!',
    reengageSubtitle: 'Вы отсутствовали {days} дней',
    reengageStreakBroken: 'Статус серии',
    reengageStreakProtected: 'Серия защищена!',
    reengageStreakBrokenMsg: 'Ваша серия была сброшена, но вы можете начать заново сегодня! Предыдущая серия: {streak} дней.',
    reengageStreakProtectedMsg: 'Ваша серия в {streak} дней сохранена! Продолжайте!',
    reengageBestHabits: 'Ваши лучшие привычки',
    reengageSuccessRate: 'успех',
    reengageQuickMood: 'Как вы себя чувствуете?',
    reengageMoodLogged: 'Настроение записано!',
    reengageContinue: 'Продолжить!',

    // Trends View (Long-term Analytics)
    trendsTitle: 'Ваши Тренды',
    trendsAvgMood: 'Средн. Настр.',
    trendsHabitRate: 'Привычки',
    trendsFocusTime: 'Фокус',
    trendsMoodChart: 'Настроение Со Временем',
    trendsHabitChart: 'Выполнение Привычек',
    trendsFocusChart: 'Время Фокуса',
    trendsTotalFocus: 'Всего',
    trendsInsightHint: 'Хотите персональные инсайты?',
    trendsInsightHintDesc: 'Проверьте панель Инсайтов на главной для обнаружения паттернов в ваших данных.',

    // Health Connect (v1.2.0)
    healthConnect: 'Health Connect',
    healthConnectDescription: 'Синхронизация с Google Health Connect',
    healthConnectLoading: 'Проверка Health Connect...',
    healthConnectNotAvailable: 'Недоступно на этом устройстве',
    healthConnectUpdateRequired: 'Обновите приложение Health Connect',
    mindfulness: 'Осознанность',
    sleep: 'Сон',
    steps: 'Шаги',
    stepsLabel: 'шагов',
    grantPermissions: 'Предоставить разрешения',
    todayHealth: 'Здоровье сегодня',
    syncFocusSessions: 'Синхронизировать фокус-сессии',
    syncFocusSessionsHint: 'Сохранять фокус-сессии как осознанность в Health Connect',
    openHealthConnect: 'Открыть Health Connect',
    refresh: 'Обновить',
    permissions: 'Разрешения',

    // Quest Templates (для randomQuests.ts)
    questMorningMomentum: 'Утренний Импульс',
    questMorningMomentumDesc: 'Выполните 3 привычки до 12:00',
    questHabitMaster: 'Мастер Привычек',
    questHabitMasterDesc: 'Выполните 5 привычек сегодня',
    questSpeedDemon: 'Скоростной Демон',
    questSpeedDemonDesc: 'Выполните 3 привычки за 30 минут',
    questFocusFlow: 'Поток Фокуса',
    questFocusFlowDesc: '30 минут фокуса без перерывов',
    questDeepWork: 'Глубокая Работа',
    questDeepWorkDesc: '60 минут сосредоточенной работы',
    questHyperfocusHero: 'Герой Гиперфокуса',
    questHyperfocusHeroDesc: '90 минут в режиме Гиперфокуса',
    questStreakKeeper: 'Хранитель Серии',
    questStreakKeeperDesc: 'Поддерживайте серию 7 дней',
    questConsistencyKing: 'Король Постоянства',
    questConsistencyKingDesc: 'Поддерживайте серию 14 дней',
    questGratitudeSprint: 'Спринт Благодарности',
    questGratitudeSprintDesc: 'Запишите 5 благодарностей за 5 минут',
    questThankfulHeart: 'Благодарное Сердце',
    questThankfulHeartDesc: 'Запишите 10 благодарностей сегодня',
    questLightningRound: 'Молниеносный Раунд',
    questLightningRoundDesc: 'Выполните 5 быстрых задач за 15 минут',
    questWeeklyWarrior: 'Недельный Воин',
    questWeeklyWarriorDesc: 'Выполняйте привычки 7 дней подряд',

    // Feedback System
    feedbackTitle: 'Обратная связь',
    feedbackSubtitle: 'Помогите нам сделать приложение лучше',
    feedbackCategoryBug: 'Сообщить об ошибке',
    feedbackCategoryFeature: 'Предложить функцию',
    feedbackCategoryOther: 'Другое',
    feedbackMessagePlaceholder: 'Опишите вашу проблему или предложение...',
    feedbackEmailPlaceholder: 'Email (необязательно)',
    feedbackSubmit: 'Отправить',
    feedbackSuccess: 'Спасибо за обратную связь!',
    feedbackError: 'Не удалось отправить. Попробуйте позже.',
    feedbackSending: 'Отправка...',
    sendFeedback: 'Написать нам',

    // App Rating
    rateAppTitle: 'Нравится ZenFlow?',
    rateAppSubtitle: 'Оцените нас в Play Store',
    rateAppButton: 'Оценить',
    rateAppLater: 'Позже',

    // App Updates
    updateAvailable: 'Доступно обновление',
    updateDescription: 'Новая версия готова к установке с улучшениями и исправлениями.',
    updateDescriptionCritical: 'Критическое обновление необходимо для продолжения использования приложения.',
    updateNow: 'Обновить сейчас',
    updateAvailableFor: 'Доступно {days} дн.',

    // Lock Screen Quick Actions
    quickActions: 'Быстрые действия',
    quickActionsDescription: 'Показывать уведомление с быстрыми действиями на экране блокировки',
    quickActionsEnabled: 'Быстрые действия включены',
    quickActionsDisabled: 'Быстрые действия отключены',
    quickActionLogMood: 'Записать настроение',
    quickActionStartFocus: 'Начать фокус',
    quickActionViewHabits: 'Привычки',

    // Notification Sounds
    notificationSound: 'Звук уведомлений',
    notificationSoundDescription: 'Выберите звук для напоминаний',
    soundDefault: 'По умолчанию',
    soundDefaultDesc: 'Системный звук уведомления',
    soundGentle: 'Мягкий',
    soundGentleDesc: 'Только вибрация',
    soundChime: 'Короткий',
    soundChimeDesc: 'Короткий тон уведомления',
    soundSilent: 'Тихий',
    soundSilentDesc: 'Без звука и вибрации',
    testNotification: 'Тестовое уведомление',
    testNotificationHint: 'Отправляет тестовое уведомление через 5 секунд для проверки работы.',

    // Insight Card Details
    insightConfidence: 'Уверенность',
    insightDataPoints: 'Точек данных',
    insightAvgMoodWith: 'Среднее настроение с привычкой',
    insightAvgMoodWithout: 'Среднее настроение без привычки',
    insightSampleDays: 'Дней в выборке',
    insightBestActivity: 'Лучшая активность',
    insightPeakTime: 'Пиковое время',
    insightAvgDuration: 'Средняя длительность',
    insightSessions: 'Сессий',
    insightTagOccurrences: 'Вхождений тега',
    insightMoodWithTag: 'Настроение с тегом',
    insightMoodWithoutTag: 'Настроение без тега',
    insightDisclaimer: 'Инсайт основан на ваших данных. Паттерны могут меняться.',
    times: 'раз',

    // Stats Empty States
    noMoodDataYet: 'Нет данных о настроении',
    noEmotionDataYet: 'Нет данных об эмоциях',

    // XP Display
    xp: 'XP',

    // AI Coach
    aiCoachTitle: 'AI Коуч',
    aiCoachSubtitle: 'Твой персональный помощник',
    aiCoachWelcome: 'Привет! Чем я могу помочь?',
    aiCoachPlaceholder: 'Напиши сообщение...',
    aiCoachQuick1: 'Я чувствую стресс',
    aiCoachQuick2: 'Помоги сосредоточиться',
    aiCoachQuick3: 'Нужна мотивация',
    clearHistory: 'Очистить историю',
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

    // Mindfulness v1.5.0
    needInspiration: 'Need inspiration?',
    journalPrompt: 'Prompt',
    dailyPrompt: 'Daily Prompt',
    usePrompt: 'Use this prompt',
    shufflePrompt: 'Get another prompt',
    mindfulMoment: 'Mindful Moment',
    takeAMoment: 'Take a moment...',
    withNote: 'with note',
    whatsMakingYouFeel: 'What\'s making you feel this way?',
    emotionSaved: 'Emotion saved',
    treat: 'treat',
    moodGood: 'Good',
    moodOkay: 'Okay',
    moodNotGreat: 'Not great',

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
    // Insight texts
    insightBestDayTitle: '{day}s are your best!',
    insightBestDayDesc: 'Your mood tends to be highest on {day}s. Consider scheduling important tasks then.',
    insightBestTimeTitle: 'You shine brightest in the {period}',
    insightBestTimeDesc: 'Your mood is typically better during {period} hours. Schedule demanding tasks then!',
    insightHabitBoostsTitle: '"{habit}" boosts your mood!',
    insightHabitBoostsDesc: 'When you complete "{habit}", your mood tends to be {percent}% better. Keep it up!',
    insightFocusMoodTitle: 'Focus time = Better mood!',
    insightFocusMoodDesc: 'On days you do focus sessions, your mood is {percent}% better. Deep work pays off!',
    insightGratitudeMoodTitle: 'Gratitude lifts your mood!',
    insightGratitudeMoodDesc: 'Days with gratitude entries show {percent}% better mood. Keep practicing gratitude!',
    insightMoodUpTitle: 'Your mood is improving!',
    insightMoodUpDesc: 'Your average mood this week is {percent}% better than last week. You\'re doing great!',
    insightMoodDownTitle: 'Let\'s boost your mood!',
    insightMoodDownDesc: 'Your mood has dipped a bit. Try focusing on habits that usually make you feel good.',
    insightHighConsistencyTitle: 'Amazing consistency!',
    insightHighConsistencyDesc: 'You\'ve logged your mood {days} of the last 14 days. This self-awareness is powerful!',
    insightLowConsistencyTitle: 'Build your logging habit',
    insightLowConsistencyDesc: 'Try logging your mood at the same time each day. Consistency helps you spot patterns!',

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
    // v1.4.0: Habit reminders and schedule
    addReminder: 'Add',
    noReminders: 'No reminders set',
    habitEventExplanation: 'This event is from your habit. Edit the habit to change it.',
    habitDurationMinutes: 'minutes',

    focus: 'Focus',
    breakTime: 'Break',
    autoScheduled: 'Auto-scheduled',
    taskEventExplanation: 'This block is auto-generated from your tasks. Complete the task to remove it.',
    yourTasksNow: 'Your tasks now',
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
    toLevel: 'To level',
    unlockedPercent: '{percent}% Unlocked',
    all: 'All',
    unlocked: 'Unlocked',
    locked: 'Locked',
    unlockedOn: 'Unlocked on {date}',
    hiddenAchievement: '???',
    hidden: 'Hidden',
    noAchievementsYet: 'No achievements yet',
    startUsingZenFlow: 'Start using ZenFlow to unlock achievements!',
    achievementUnlocked: 'Achievement Unlocked!',
    userLevel: 'Level',
    focusSession: 'Focus Session',
    // TimeHelper
    timeBlindnessHelper: 'Time Blindness Helper',
    visualTimeAwareness: 'Visual time awareness for ADHD',
    hoursMinutesLeft: '{hours}h {mins}m left',
    minutesLeft: '{mins}m left',
    timesUp: "Time's up!",
    youllFinishAt: "🎯 You'll finish at:",
    nMinutes: '{n} minutes',
    pingEveryMinutes: 'Ping Every (minutes)',
    audioPings: 'Audio Pings',
    testSound: '🔊 Test',
    soundOn: 'On',
    soundOff: 'Off',
    startTimer: 'Start Timer',
    pauseTimer: 'Pause',
    resetTimer: 'Reset',
    adhdTimeManagement: 'ADHD Time Management',
    adhdTip1: 'Audio pings help track time passing',
    adhdTip2: 'Visual countdown reduces anxiety',
    adhdTip3: 'End time prediction = better planning',
    adhdTip4: 'Color changes warn when time is low',
    currentStreak: 'Current streak',
    daysInRow: 'Days in a row',
    totalFocus: 'Total focus',
    allTime: 'All time',
    habitsCompleted: 'Habits completed',
    totalTimes: 'Total times',
    moodDistribution: 'Mood distribution',
    moodHeatmap: 'Mood heatmap',
    activityHeatmap: 'Activity Overview',
    less: 'Less',
    more: 'More',
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
    exportCSV: 'Export CSV',
    exportPDF: 'Export PDF',
    importSuccess: 'Import complete.',
    importError: 'Failed to import file.',
    importedItems: 'Added',
    importAdded: 'added',
    importUpdated: 'updated',
    importSkipped: 'skipped',
    textTooLong: 'Text is too long (max 2000 characters)',
    invalidInput: 'Please check your input',
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

    // v1.2.0 Appearance
    appearance: 'Appearance',
    oledDarkMode: 'OLED Dark Mode',
    oledDarkModeHint: 'Pure black theme for OLED screens. Saves battery.',

    // What's New Modal
    whatsNewTitle: "What's New",
    whatsNewVersion: 'Version',
    whatsNewGotIt: 'Got it!',

    // Accessibility
    skipToContent: 'Skip to main content',

    // v1.1.1 Settings Redesign
    settingsCloudSyncTitle: 'Enable Cloud Sync',
    settingsCloudSyncDescription: 'Sync your data across devices',
    settingsCloudSyncEnabled: 'Cloud sync enabled',
    settingsCloudSyncDisabledByUser: 'Sync disabled',
    settingsExportTitle: 'Export Backup',
    settingsExportDescription: 'Save all your data to a file',
    settingsImportTitle: 'Import Backup',
    settingsImportMergeTooltip: 'Imported data will be added to existing. Duplicates skipped.',
    settingsImportReplaceTooltip: '⚠️ All current data will be deleted and replaced with import',
    settingsImportReplaceConfirm: 'Type "REPLACE" to confirm deletion of all data',
    // Import validation (v1.4.1)
    invalidFileType: 'Invalid file type. JSON required.',
    fileTooLarge: 'File too large (max 10 MB)',
    importConfirm: 'Confirm import',
    invalidBackupFormat: 'Invalid backup format',
    settingsWhatsNewTitle: 'What\'s New in v1.5.8',
    settingsWhatsNewLeaderboards: 'Leaderboards',
    settingsWhatsNewLeaderboardsDesc: 'Compete anonymously with others',
    settingsWhatsNewSpotify: 'Spotify Integration',
    settingsWhatsNewSpotifyDesc: 'Auto-play music during focus sessions',
    settingsWhatsNewChallenges: 'Friend Challenges',
    settingsWhatsNewChallengesDesc: 'Challenge friends to build habits together',
    settingsWhatsNewDigest: 'Weekly Digest',
    settingsWhatsNewDigestDesc: 'Get progress reports in your inbox',
    settingsWhatsNewSecurity: 'Enhanced Security',
    settingsWhatsNewSecurityDesc: 'Better data protection & privacy',
    settingsWhatsNewGotIt: 'Got it!',
    // v1.5.8 What's New
    settingsWhatsNewFeatureToggles: 'Feature Toggles',
    settingsWhatsNewFeatureTogglesDesc: 'Enable/disable modules in Settings',
    settingsWhatsNewBugFixes158: 'Bug Fixes',
    settingsWhatsNewBugFixes158Desc: 'Fixed sync issues and improved stability',
    settingsWhatsNewUIImprovements: 'UI Improvements',
    settingsWhatsNewUIImprovementsDesc: 'Better toggle switches and settings organization',
    settingsSectionAccount: 'Account & Cloud',
    settingsSectionData: 'Data & Backup',

    // Weekly Digest (v1.3.0)
    weeklyDigestTitle: 'Weekly Progress Report',
    weeklyDigestDescription: 'Receive a weekly summary of your habits, focus time, and mood trends every Sunday.',
    weeklyDigestEnabled: 'You\'ll receive reports at your email',

    // Changelog
    changelogTitle: 'Version History',
    changelogExpandAll: 'Expand All',
    changelogCollapseAll: 'Collapse All',
    changelogEmpty: 'No version history available',
    changelogAdded: 'Added',
    changelogFixed: 'Fixed',
    changelogChanged: 'Changed',
    changelogRemoved: 'Removed',

    // Settings Groups (v1.3.0)
    settingsGroupProfile: 'Profile & Appearance',
    settingsGroupNotifications: 'Notifications',
    settingsGroupData: 'Data & Privacy',
    settingsGroupAccount: 'Account',
    settingsGroupAbout: 'About',

    // Feature Toggles / Modules (v1.5.8)
    settingsGroupModules: 'Modules',
    settingsModulesDescription: 'Enable or disable app features',
    settingsModuleMood: 'Mood Tracker',
    settingsModuleMoodDesc: 'Core feature — always enabled',
    settingsModuleHabits: 'Habits',
    settingsModuleHabitsDesc: 'Core feature — always enabled',
    settingsModuleFocus: 'Focus Timer',
    settingsModuleFocusDesc: 'Pomodoro technique and deep work',
    settingsModuleBreathing: 'Breathing Exercises',
    settingsModuleBreathingDesc: 'Relaxation and meditation techniques',
    settingsModuleGratitude: 'Gratitude Journal',
    settingsModuleGratitudeDesc: 'Record what you are thankful for',
    settingsModuleQuests: 'Quests',
    settingsModuleQuestsDesc: 'Daily missions and rewards',
    settingsModuleTasks: 'Tasks',
    settingsModuleTasksDesc: 'To-do list and task management',
    settingsModuleChallenges: 'Challenges',
    settingsModuleChallengesDesc: 'Achievements and challenges',
    settingsModuleAICoach: 'AI Coach',
    settingsModuleAICoachDesc: 'Personal AI assistant',
    settingsModuleGarden: 'My Garden',
    settingsModuleGardenDesc: 'Virtual garden and companion',
    settingsModuleCoreLocked: 'Core module',
    settingsModuleUnlockHint: 'Unlocks as you progress',

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
    // App Updates (v1.4.1)
    checkForUpdates: 'Check for updates',
    checkingForUpdates: 'Checking for updates...',
    appUpToDate: 'You have the latest version',
    openGooglePlay: 'Open Google Play',
    updateCheckFailed: 'Failed to check for updates',
    remindersTitle: 'Reminders',
    remindersDescription: 'Gentle nudges to keep you on track.',
    moodReminder: 'Mood check-in time',
    habitReminder: 'Habit reminder time',
    focusReminder: 'Focus nudge time',
    quietHours: 'Quiet hours',
    reminderDays: 'Days of week',
    selectedHabits: 'Habits to remind',
    noHabitsYet: 'No habits yet.',
    reminderMoodTitle: 'Hey, quick check! 💭',
    reminderMoodBody: '30 seconds to thank your brain. How are you feeling?',
    reminderHabitTitle: 'Tiny habit time! ✨',
    reminderHabitBody: 'Small step = big win. Ready to crush it?',
    reminderFocusTitle: 'Focus power-up! 🎯',
    reminderFocusBody: 'Just 25 mins to hero mode. Let\'s go?',
    reminderDismiss: 'Not now',
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
    deleteAccountTypeConfirm: 'Type DELETE to confirm:',
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
    shareDialogTitle: 'Share your progress',
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
    shareFailed: 'Failed to share. Please try again.',
    shareAchievement30: 'Legendary!',
    shareAchievement14: 'Unstoppable!',
    shareAchievement7: 'On Fire!',
    shareAchievement3: 'Rising Star!',
    shareAchievementStart: 'Just Started!',
    shareSubtext30: '30+ Day Master',
    shareSubtext14: '14+ Day Warrior',
    shareSubtext7: '7+ Day Streak',
    shareSubtext3: '3+ Day Streak',
    shareSubtextStart: 'Building Habits',
    dismiss: 'Dismiss',
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

    // Friend Challenges
    friendChallenges: 'Friend Challenges',
    createChallenge: 'Create Challenge',
    challengeDescription: 'Challenge friends to build habits together',
    challengeYourFriends: 'Challenge your friends to this habit!',
    challengeDuration: 'Challenge Duration',
    challengeCreated: 'Challenge Created!',
    challengeDetails: 'Challenge Details',
    shareToInvite: 'Share to invite friends!',
    trackWithFriends: 'Track your challenges with friends',
    challengeCode: 'Challenge Code',
    yourProgress: 'Your Progress',
    daysLeft: 'days left',
    dayChallenge: 'day challenge',
    challengeCompleted: 'Challenge Complete!',
    noChallenges: 'No challenges yet',
    createChallengePrompt: 'Create a challenge from any habit!',
    completedChallenges: 'Completed',
    expiredChallenges: 'Expired',
    youCreated: 'You created this',
    createdBy: 'Created by',
    confirmDeleteChallenge: 'Delete this challenge?',
    challengeInvite: 'Join my challenge!',
    challengeJoinPrompt: 'Join me on ZenFlow!',
    challengeShareTip: "You'll be able to share this challenge with friends after creating it.",

    // Friend Challenges - Join
    joinChallenge: 'Join Challenge',
    enterChallengeCode: 'Enter the code from your friend',
    invalidChallengeCode: 'Invalid code. Format: ZEN-XXXXXX',
    enterCodeToJoin: 'Enter a challenge code to join your friends',
    joinChallengeHint: 'Ask your friend to share their challenge code with you',
    joining: 'Joining...',
    join: 'Join',

    // Friend Challenges v2
    challengeWon: '🎉 Amazing! You completed the challenge!',
    catchUp: '💪 You can catch up! Every day counts!',
    aheadOfSchedule: '⭐ Great pace! You\'re ahead of schedule!',
    daysPassed: 'Days Passed',
    daysCompleted: 'Completed',
    daysRemaining: 'Remaining',

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
    onboardingAgeTitle: 'Welcome to ZenFlow',
    onboardingAgeDesc: 'This app is designed for users aged 13 and older',
    onboardingAgeConfirm: 'I am 13 years or older',
    onboardingAgeNote: 'By continuing, you confirm that you are 13 years of age or older',
    healthConnectAgeDesc: 'Health Connect features require you to be 13 years or older to use health data responsibly.',
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
    tutorialFeature2b: '✨ Customize icons, colors & goals!',
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
    weeklyStory: 'Weekly Story',
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
    // Weekly Story translations (ProgressStoriesViewer)
    storyAverageMoodScore: 'average mood score',
    storyCompletionRate: 'completion rate',
    storyTopHabit: 'Top habit',
    storyCompletions: 'completions',
    storyPerfectDays: 'perfect days this week',
    storyAvgSession: 'avg session',
    storyLongestSession: 'longest',
    storyMostFocusedOn: 'Most focused on:',
    storyTrackYourJourney: 'Track your journey with',
    storyTapLeft: '← Tap left',
    storyTapCenter: 'Tap center to pause',
    storyTapRight: 'Tap right →',
    generating: 'Generating...',

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
    // Companion Notifications
    companionMissesYou: 'Hey! I missed you! 💕',
    companionWantsToPlay: 'Wanna hang out? It\'s fun here! 🎉',
    companionWaiting: 'Waiting for you! Got something cool 🌱',
    companionProud: 'YOU\'RE AMAZING! So proud! ⭐',
    companionCheersYou: 'Go go go! You got this! 💪',
    companionQuickMood: 'Psst! How\'s it going? Tap here! 😊',

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

    // Completed sections
    expand: 'Expand',
    collapse: 'Collapse',
    moodRecordedShort: 'Mood recorded',
    habitsCompletedShort: 'Habits done',
    focusCompletedShort: 'Focus complete',
    gratitudeAddedShort: 'Gratitude added',

    // All complete celebration
    allComplete: 'All done!',
    allCompleteMessage: 'You\'ve completed all activities for today',
    allCompleteSupportive: 'See you tomorrow!',
    allCompleteLegend: 'Legendary day!',
    allCompleteAmazing: 'Amazing work!',
    allCompleteGreat: 'Great job!',
    allCompleteNice: 'Nice work!',
    daysStreak: 'days streak',
    restDaySupportive: "We'll continue together tomorrow 💚",
    restDayCooldown: 'Rest day was used recently',
    restDayAvailableIn: 'Available in',

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

    // Header Quick Actions
    tasks: 'Tasks',
    quests: 'Quests',
    challenges: 'Challenges',
    openTasks: 'Open Tasks',
    openQuests: 'Open Quests',
    openChallenges: 'Open Challenges',

    // QuestsPanel UI
    randomQuests: 'Random Quests',
    questsPanelSubtitle: 'Complete quests for bonus XP and exclusive badges',
    adhdEngagementSystem: 'ADHD Engagement System',
    adhdEngagementDesc: 'Quests provide variety and unexpected rewards - perfect for ADHD brains that crave novelty!',
    dailyQuest: 'Daily Quest',
    weeklyQuest: 'Weekly Quest',
    bonusQuest: 'Bonus Quest',
    newQuest: 'New Quest',
    limitedTime: 'Limited Time',
    generate: 'Generate',
    noQuestAvailable: 'No quest available',
    noBonusQuestAvailable: 'No bonus quest available',
    bonusQuestsHint: 'Bonus quests appear randomly or can be generated manually',
    questProgress: 'Progress:',
    questExpired: 'Expired',
    questType: 'Quest',
    questTips: 'Quest Tips',
    questTipDaily: 'Daily quests reset every 24 hours',
    questTipWeekly: 'Weekly quests offer 3x XP rewards',
    questTipBonus: 'Bonus quests are rare with 5x XP',
    questTipExpire: 'Complete quests before they expire!',

    // Companion
    companionHungry: "I'm hungry... Feed me?",

    // Common actions
    back: 'Back',
    start: 'Start',
    stop: 'Stop',

    // Celebrations
    allHabitsComplete: 'All Habits Done!',
    amazingWork: 'Amazing work today!',

    // 404 page
    pageNotFound: 'Page not found',
    goHome: 'Go Home',

    // Insights
    insightsTitle: 'Personal Insights',
    insightsNotEnoughData: 'Keep tracking your mood, habits, and focus for a week to unlock personalized insights about your patterns.',
    insightsNoPatterns: 'No strong patterns detected yet. Keep tracking consistently to discover what works best for you!',
    insightsHelpTitle: 'About Insights',
    insightsHelp1: 'Insights are generated from your personal data using statistical analysis.',
    insightsHelp2: 'All analysis happens locally on your device - your data never leaves.',
    insightsHelp3: 'Patterns with higher confidence are shown first.',
    insightsDismiss: 'Dismiss',
    insightsShowMore: 'Show more',
    insightsShowLess: 'Show less',
    insightsDismissedCount: 'insights dismissed',
    insightsMoodEntries: 'mood entries',
    insightsHabitCount: 'habit',
    insightsFocusSessions: 'focus sessions',

    // Weekly Insights (v1.5.0)
    weeklyInsights: 'Weekly Insights',
    weeklyInsightsNotEnoughData: 'Track your progress this week to unlock personalized insights and recommendations.',
    comparedToLastWeek: 'Compared to last week',
    recommendations: 'Recommendations',
    avgMood: 'Avg Mood',
    week: 'Week',
    // Recommendation translations
    recLowMoodTitle: 'Mood needs attention',
    recLowMoodDesc: 'Your mood this week has been lower than usual. Consider activities that usually lift your spirits.',
    recLowMoodAction: 'Try a quick 5-minute breathing exercise',
    recHabitDeclineTitle: 'Habit consistency dropped',
    recHabitDeclineDesc: 'Your habit completion is down from last week. Start small to rebuild momentum.',
    recHabitDeclineAction: 'Focus on just one habit today',
    recLowFocusTitle: 'Boost your focus time',
    recLowFocusDesc: 'You\'ve had limited focus sessions this week. Even short sessions help build the habit.',
    recLowFocusAction: 'Try a 10-minute focus session',
    recGreatProgressTitle: 'You\'re on a roll!',
    recGreatProgressDesc: 'Your overall progress is improving compared to last week. Keep up the momentum!',
    recBestDayTitle: 'This was your best day',
    recBestDayDesc: 'Try to identify what made this day special and replicate those conditions.',
    recGratitudeTitle: 'Practice gratitude',
    recGratitudeDesc: 'Writing down things you\'re grateful for can significantly improve your mood over time.',
    recGratitudeAction: 'Add a gratitude entry today',
    recPerfectWeekTitle: 'Amazing consistency!',
    recPerfectWeekDesc: 'You completed most of your habits this week. You\'re building strong routines!',
    recTopHabitTitle: 'Keep up this habit',
    recTopHabitDesc: 'This is one of your most consistent habits. It\'s likely contributing to your well-being.',

    // Smart Reminders
    smartReminders: 'Smart Reminders',
    smartRemindersNotEnoughData: 'Keep using the app to unlock personalized reminder suggestions based on your patterns.',
    smartRemindersOptimized: 'Your reminder times are well optimized! Keep up the great work.',
    smartRemindersDescription: 'Personalized suggestions based on your usage patterns',
    suggestions: 'suggestions',
    highConfidence: 'High confidence',
    mediumConfidence: 'Medium',
    lowConfidence: 'Suggestion',
    apply: 'Apply',
    habitRemindersOptimal: 'Optimal habit times',
    patternBased: 'Pattern',

    // Sync status
    syncOffline: 'Offline',
    syncSyncing: 'Syncing',
    syncLastSync: 'Synced',
    syncReady: 'Ready to sync',
    syncBackup: 'backup',
    syncReminders: 'reminders',
    syncChallenges: 'challenges',
    syncTasks: 'tasks',
    syncInnerWorld: 'progress',
    syncBadges: 'badges',

    // Progressive Onboarding
    onboardingTryNow: 'Try it now',
    onboardingGotIt: 'Got it!',
    onboardingNext: 'Next',
    onboardingGetStarted: "Let's start!",
    onboardingWelcomeTitle: 'Welcome to ZenFlow! 🌱',
    onboardingWelcomeDescription: "We're excited to help you build better habits and understand what works for YOUR brain.",
    onboardingDay1Title: "Let's start simple",
    onboardingDay1Description: "For today, we'll focus on just two things: tracking your mood and creating your first habit. Nothing overwhelming.",
    onboardingGradualTitle: 'More features unlock gradually',
    onboardingGradualDescription: "Over the next 4 days, you'll discover new features as you progress. No information overload!",
    onboardingDayProgress: 'Day {day} of {maxDay}',
    onboardingFeaturesUnlocked: 'features',
    onboardingNextUnlock: 'Next unlock',

    // Feature Unlocks
    onboardingfocusTimerUnlockTitle: '🎯 Focus Timer Unlocked!',
    onboardingfocusTimerUnlockSubtitle: 'Great progress!',
    onboardingfocusTimerDescription: 'Use the Pomodoro timer for deep concentration. Set 25 minutes, focus on one task, then take a break. Perfect for ADHD brains!',
    onboardingxpUnlockTitle: '✨ XP System Unlocked!',
    onboardingxpUnlockSubtitle: 'Time for gamification!',
    onboardingxpDescription: 'Earn experience for completing habits, focus sessions, and mood tracking. Level up and unlock new achievements!',
    onboardingquestsUnlockTitle: '🎮 Quests Unlocked!',
    onboardingquestsUnlockSubtitle: 'New challenges!',
    onboardingquestsDescription: 'Daily and weekly quests add variety to your routine. Complete them for bonus rewards!',
    onboardingcompanionUnlockTitle: '💚 Companion Unlocked!',
    onboardingcompanionUnlockSubtitle: 'Meet your helper!',
    onboardingcompanionDescription: 'Your virtual companion grows with you, celebrates wins, and supports you through tough days. Choose from 5 types!',
    onboardingtasksUnlockTitle: '📝 Tasks Unlocked!',
    onboardingtasksUnlockSubtitle: 'Full access!',
    onboardingtasksDescription: 'Task Momentum helps prioritize tasks specifically for ADHD. The system recommends what to do next based on urgency and your energy.',
    onboardingchallengesUnlockTitle: '🏆 Challenges Unlocked!',
    onboardingchallengesUnlockSubtitle: 'Full access!',
    onboardingchallengesDescription: 'Join long-term challenges to develop skills. Track progress and earn exclusive badges!',

    // Re-engagement (Welcome Back Modal)
    reengageTitle: 'Welcome Back!',
    reengageSubtitle: "You've been away for {days} days",
    reengageStreakBroken: 'Streak Status',
    reengageStreakProtected: 'Streak Protected!',
    reengageStreakBrokenMsg: 'Your streak was reset, but you can start fresh today! Previous streak: {streak} days.',
    reengageStreakProtectedMsg: 'Your {streak}-day streak is safe! Keep going!',
    reengageBestHabits: 'Your Best Habits',
    reengageSuccessRate: 'success',
    reengageQuickMood: 'How are you feeling?',
    reengageMoodLogged: 'Mood logged!',
    reengageContinue: "Let's continue!",

    // Trends View (Long-term Analytics)
    trendsTitle: 'Your Trends',
    trendsAvgMood: 'Avg Mood',
    trendsHabitRate: 'Habit Rate',
    trendsFocusTime: 'Focus',
    trendsMoodChart: 'Mood Over Time',
    trendsHabitChart: 'Habit Completion',
    trendsFocusChart: 'Focus Time',
    trendsTotalFocus: 'Total',
    trendsInsightHint: 'Want personalized insights?',
    trendsInsightHintDesc: 'Check the Insights panel on the home tab to discover patterns in your data.',

    // Health Connect (v1.2.0)
    healthConnect: 'Health Connect',
    healthConnectDescription: 'Sync with Google Health Connect',
    healthConnectLoading: 'Checking Health Connect...',
    healthConnectNotAvailable: 'Not available on this device',
    healthConnectUpdateRequired: 'Please update Health Connect app',
    mindfulness: 'Mindfulness',
    sleep: 'Sleep',
    steps: 'Steps',
    stepsLabel: 'steps',
    grantPermissions: 'Grant Permissions',
    todayHealth: "Today's Health",
    syncFocusSessions: 'Sync Focus Sessions',
    syncFocusSessionsHint: 'Save focus sessions as mindfulness in Health Connect',
    openHealthConnect: 'Open Health Connect',
    refresh: 'Refresh',
    permissions: 'Permissions',

    // Quest Templates (for randomQuests.ts)
    questMorningMomentum: 'Morning Momentum',
    questMorningMomentumDesc: 'Complete 3 habits before 12:00',
    questHabitMaster: 'Habit Master',
    questHabitMasterDesc: 'Complete 5 habits today',
    questSpeedDemon: 'Speed Demon',
    questSpeedDemonDesc: 'Complete 3 habits in 30 minutes',
    questFocusFlow: 'Focus Flow',
    questFocusFlowDesc: '30 minutes of focus without breaks',
    questDeepWork: 'Deep Work',
    questDeepWorkDesc: '60 minutes of focused work',
    questHyperfocusHero: 'Hyperfocus Hero',
    questHyperfocusHeroDesc: '90 minutes in Hyperfocus Mode',
    questStreakKeeper: 'Streak Keeper',
    questStreakKeeperDesc: 'Maintain your streak for 7 days',
    questConsistencyKing: 'Consistency King',
    questConsistencyKingDesc: 'Maintain your streak for 14 days',
    questGratitudeSprint: 'Gratitude Sprint',
    questGratitudeSprintDesc: 'Write 5 gratitudes in 5 minutes',
    questThankfulHeart: 'Thankful Heart',
    questThankfulHeartDesc: 'Write 10 gratitudes today',
    questLightningRound: 'Lightning Round',
    questLightningRoundDesc: 'Complete 5 quick tasks in 15 minutes',
    questWeeklyWarrior: 'Weekly Warrior',
    questWeeklyWarriorDesc: 'Complete habits 7 days in a row',

    // Feedback System
    feedbackTitle: 'Send Feedback',
    feedbackSubtitle: 'Help us improve the app',
    feedbackCategoryBug: 'Report Bug',
    feedbackCategoryFeature: 'Request Feature',
    feedbackCategoryOther: 'Other',
    feedbackMessagePlaceholder: 'Describe your issue or suggestion...',
    feedbackEmailPlaceholder: 'Email (optional)',
    feedbackSubmit: 'Submit',
    feedbackSuccess: 'Thank you for your feedback!',
    feedbackError: 'Failed to send. Please try again.',
    feedbackSending: 'Sending...',
    sendFeedback: 'Send Feedback',

    // App Rating
    rateAppTitle: 'Enjoying ZenFlow?',
    rateAppSubtitle: 'Rate us on Play Store',
    rateAppButton: 'Rate Now',
    rateAppLater: 'Later',

    // App Updates
    updateAvailable: 'Update Available',
    updateDescription: 'A new version is ready to install with improvements and fixes.',
    updateDescriptionCritical: 'A critical update is required to continue using the app.',
    updateNow: 'Update Now',
    updateAvailableFor: 'Available for {days} days',

    // Lock Screen Quick Actions
    quickActions: 'Quick Actions',
    quickActionsDescription: 'Show notification with quick actions on lock screen',
    quickActionsEnabled: 'Quick actions enabled',
    quickActionsDisabled: 'Quick actions disabled',
    quickActionLogMood: 'Log Mood',
    quickActionStartFocus: 'Start Focus',
    quickActionViewHabits: 'View Habits',

    // Notification Sounds
    notificationSound: 'Notification Sound',
    notificationSoundDescription: 'Choose sound for reminders',
    soundDefault: 'Default',
    soundDefaultDesc: 'System notification sound',
    soundGentle: 'Gentle',
    soundGentleDesc: 'Vibration only',
    soundChime: 'Chime',
    soundChimeDesc: 'Short notification tone',
    soundSilent: 'Silent',
    soundSilentDesc: 'No sound or vibration',
    testNotification: 'Test Notification',
    testNotificationHint: 'Sends a test notification in 5 seconds to verify notifications work.',

    // Insight Card Details
    insightConfidence: 'Confidence',
    insightDataPoints: 'Data points',
    insightAvgMoodWith: 'Avg mood with habit',
    insightAvgMoodWithout: 'Avg mood without habit',
    insightSampleDays: 'Sample days',
    insightBestActivity: 'Best activity',
    insightPeakTime: 'Peak time',
    insightAvgDuration: 'Avg duration',
    insightSessions: 'Sessions',
    insightTagOccurrences: 'Tag occurrences',
    insightMoodWithTag: 'Mood with tag',
    insightMoodWithoutTag: 'Mood without tag',
    insightDisclaimer: 'This insight is based on your data. Patterns may change over time.',
    times: 'times',

    // Stats Empty States
    noMoodDataYet: 'No mood data yet',
    noEmotionDataYet: 'No emotion data yet',

    // XP Display
    xp: 'XP',

    // AI Coach
    aiCoachTitle: 'AI Coach',
    aiCoachSubtitle: 'Your personal wellness guide',
    aiCoachWelcome: 'Hi! How can I help you today?',
    aiCoachPlaceholder: 'Type a message...',
    aiCoachQuick1: "I'm feeling stressed",
    aiCoachQuick2: 'Help me focus',
    aiCoachQuick3: 'Need motivation',
    clearHistory: 'Clear history',
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

    // Mindfulness v1.5.0
    needInspiration: 'Потрібне натхнення?',
    journalPrompt: 'Промпт',
    dailyPrompt: 'Промпт дня',
    usePrompt: 'Використати цей промпт',
    shufflePrompt: 'Інший промпт',
    mindfulMoment: 'Момент усвідомленості',
    takeAMoment: 'Зроби паузу...',
    withNote: 'з нотаткою',
    whatsMakingYouFeel: 'Що викликає це почуття?',
    emotionSaved: 'Емоцію збережено',
    treat: 'смаколик',
    moodGood: 'Добре',
    moodOkay: 'Нормально',
    moodNotGreat: 'Не дуже',

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
    // Insight texts
    insightBestDayTitle: '{day} — ваш найкращий день!',
    insightBestDayDesc: 'Ваш настрій зазвичай кращий у {day}. Плануйте важливі справи на цей день.',
    insightBestTimeTitle: 'Ви сяєте найяскравіше {period}',
    insightBestTimeDesc: 'Ваш настрій зазвичай кращий {period}. Плануйте складні завдання на цей час!',
    insightHabitBoostsTitle: '«{habit}» піднімає настрій!',
    insightHabitBoostsDesc: 'Коли ви виконуєте «{habit}», настрій на {percent}% кращий. Так тримати!',
    insightFocusMoodTitle: 'Фокус = Кращий настрій!',
    insightFocusMoodDesc: 'У дні з фокус-сесіями настрій на {percent}% кращий. Глибока робота окупається!',
    insightGratitudeMoodTitle: 'Вдячність піднімає настрій!',
    insightGratitudeMoodDesc: 'Дні з записами вдячності показують на {percent}% кращий настрій. Продовжуйте практикувати!',
    insightMoodUpTitle: 'Ваш настрій покращується!',
    insightMoodUpDesc: 'Середній настрій цього тижня на {percent}% кращий, ніж минулого. Ви молодець!',
    insightMoodDownTitle: 'Давайте піднімемо настрій!',
    insightMoodDownDesc: 'Настрій трохи знизився. Спробуйте зосередитися на звичках, які зазвичай вас радують.',
    insightHighConsistencyTitle: 'Чудова послідовність!',
    insightHighConsistencyDesc: 'Ви записували настрій {days} з останніх 14 днів. Це потужне самопізнання!',
    insightLowConsistencyTitle: 'Створіть звичку записів',
    insightLowConsistencyDesc: 'Спробуйте записувати настрій в один і той самий час щодня. Регулярність допомагає виявляти закономірності!',

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
    // v1.4.0: Habit reminders and schedule
    addReminder: 'Додати',
    noReminders: 'Немає нагадувань',
    habitEventExplanation: 'Ця подія зі звички. Відредагуйте звичку, щоб змінити.',
    habitDurationMinutes: 'хвилин',

    focus: 'Фокус',
    breakTime: 'Перерва',
    autoScheduled: 'Авто-розклад',
    taskEventExplanation: 'Цей блок створено автоматично з ваших завдань. Виконайте завдання, щоб видалити його.',
    yourTasksNow: 'Ваші завдання зараз',
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
    toLevel: 'До рівня',
    unlockedPercent: 'Розблоковано {percent}%',
    all: 'Усі',
    unlocked: 'Відкриті',
    locked: 'Закриті',
    unlockedOn: 'Розблоковано {date}',
    hiddenAchievement: '???',
    hidden: 'Приховано',
    noAchievementsYet: 'Поки немає досягнень',
    startUsingZenFlow: 'Почніть користуватися ZenFlow, щоб розблокувати досягнення!',
    achievementUnlocked: 'Досягнення розблоковано!',
    userLevel: 'Рівень',
    focusSession: 'Сесія фокусування',
    // TimeHelper
    timeBlindnessHelper: 'Помічник усвідомлення часу',
    visualTimeAwareness: 'Візуальне відстеження часу для СДУГ',
    hoursMinutesLeft: '{hours}год {mins}хв залишилось',
    minutesLeft: '{mins}хв залишилось',
    timesUp: 'Час вийшов!',
    youllFinishAt: '🎯 Ви закінчите о:',
    nMinutes: '{n} хвилин',
    pingEveryMinutes: 'Сигнал кожні (хвилин)',
    audioPings: 'Звукові сигнали',
    testSound: '🔊 Тест',
    soundOn: 'Увімк',
    soundOff: 'Вимк',
    startTimer: 'Запустити таймер',
    pauseTimer: 'Пауза',
    resetTimer: 'Скинути',
    adhdTimeManagement: 'Керування часом при СДУГ',
    adhdTip1: 'Звукові сигнали допомагають відстежувати час',
    adhdTip2: 'Візуальний відлік зменшує тривогу',
    adhdTip3: 'Прогноз завершення = краще планування',
    adhdTip4: 'Зміна кольору попереджає про брак часу',
    currentStreak: 'Поточна серія',
    daysInRow: 'Днів поспіль',
    totalFocus: 'Всього фокусу',
    allTime: 'За весь час',
    habitsCompleted: 'Звички виконані',
    totalTimes: 'Всього разів',
    moodDistribution: 'Розподіл настрою',
    moodHeatmap: 'Календар настрою',
    activityHeatmap: 'Огляд активності',
    less: 'Менше',
    more: 'Більше',
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
    exportCSV: 'Експорт CSV',
    exportPDF: 'Експорт PDF',
    importSuccess: 'Імпорт завершено.',
    importError: 'Не вдалося імпортувати файл.',
    importedItems: 'Додано',
    importAdded: 'додано',
    importUpdated: 'оновлено',
    importSkipped: 'пропущено',
    textTooLong: 'Текст занадто довгий (максимум 2000 символів)',
    invalidInput: 'Перевірте введені дані',
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

    // v1.2.0 Appearance
    appearance: 'Зовнішній вигляд',
    oledDarkMode: 'OLED темна тема',
    oledDarkModeHint: 'Чисто чорна тема для OLED екранів. Економить батарею.',

    // What's New Modal
    whatsNewTitle: 'Що нового',
    whatsNewVersion: 'Версія',
    whatsNewGotIt: 'Зрозуміло!',

    // Accessibility
    skipToContent: 'Перейти до вмісту',

    // v1.1.1 Settings Redesign
    settingsCloudSyncTitle: 'Увімкнути хмарну синхронізацію',
    settingsCloudSyncDescription: 'Синхронізуйте дані між пристроями',
    settingsCloudSyncEnabled: 'Хмарна синхронізація увімкнена',
    settingsCloudSyncDisabledByUser: 'Синхронізація вимкнена',
    settingsExportTitle: 'Експорт резервної копії',
    settingsExportDescription: 'Збережіть усі дані у файл',
    settingsImportTitle: 'Імпорт резервної копії',
    settingsImportMergeTooltip: 'Імпортовані дані будуть додані до існуючих. Дублікати пропускаються.',
    settingsImportReplaceTooltip: '⚠️ Усі поточні дані будуть видалені та замінені імпортованими',
    settingsImportReplaceConfirm: 'Введіть "REPLACE" для підтвердження видалення всіх даних',
    // Import validation (v1.4.1)
    invalidFileType: 'Невірний тип файлу. Потрібен JSON.',
    fileTooLarge: 'Файл завеликий (макс. 10 МБ)',
    importConfirm: 'Підтвердити імпорт',
    invalidBackupFormat: 'Невірний формат резервної копії',
    settingsWhatsNewTitle: 'Що нового в v1.5.8',
    settingsWhatsNewLeaderboards: 'Таблиці лідерів',
    settingsWhatsNewLeaderboardsDesc: 'Змагайтеся анонімно з іншими',
    settingsWhatsNewSpotify: 'Інтеграція Spotify',
    settingsWhatsNewSpotifyDesc: 'Автовідтворення музики під час фокусування',
    settingsWhatsNewChallenges: 'Виклики з друзями',
    settingsWhatsNewChallengesDesc: 'Запрошуйте друзів виробляти звички разом',
    settingsWhatsNewDigest: 'Щотижневий дайджест',
    settingsWhatsNewDigestDesc: 'Отримуйте звіти про прогрес на email',
    settingsWhatsNewSecurity: 'Покращена безпека',
    settingsWhatsNewSecurityDesc: 'Кращий захист даних та приватності',
    settingsWhatsNewGotIt: 'Зрозуміло!',
    // v1.5.8 What's New
    settingsWhatsNewFeatureToggles: 'Перемикачі модулів',
    settingsWhatsNewFeatureTogglesDesc: 'Вмикайте/вимикайте модулі в Налаштуваннях',
    settingsWhatsNewBugFixes158: 'Виправлення помилок',
    settingsWhatsNewBugFixes158Desc: 'Виправлено проблеми синхронізації та стабільності',
    settingsWhatsNewUIImprovements: 'Покращення інтерфейсу',
    settingsWhatsNewUIImprovementsDesc: 'Покращені перемикачі та організація налаштувань',
    settingsSectionAccount: 'Акаунт і хмара',
    settingsSectionData: 'Дані та резервне копіювання',

    // Weekly Digest (v1.3.0)
    weeklyDigestTitle: 'Щотижневий звіт',
    weeklyDigestDescription: 'Отримуйте підсумок звичок, фокусу та настрою щонеділі.',
    weeklyDigestEnabled: 'Звіти надходять на вашу пошту',

    // Changelog
    changelogTitle: 'Історія оновлень',
    changelogExpandAll: 'Розгорнути все',
    changelogCollapseAll: 'Згорнути все',
    changelogEmpty: 'Історія оновлень недоступна',
    changelogAdded: 'Додано',
    changelogFixed: 'Виправлено',
    changelogChanged: 'Змінено',
    changelogRemoved: 'Видалено',

    // Settings Groups (v1.3.0)
    settingsGroupProfile: 'Профіль і оформлення',
    settingsGroupNotifications: 'Сповіщення',
    settingsGroupData: 'Дані та приватність',
    settingsGroupAccount: 'Акаунт',
    settingsGroupAbout: 'Про додаток',

    // Feature Toggles / Modules (v1.5.8)
    settingsGroupModules: 'Модулі',
    settingsModulesDescription: 'Вмикайте та вимикайте функції додатку',
    settingsModuleMood: 'Трекер настрою',
    settingsModuleMoodDesc: 'Основна функція — завжди увімкнена',
    settingsModuleHabits: 'Звички',
    settingsModuleHabitsDesc: 'Основна функція — завжди увімкнена',
    settingsModuleFocus: 'Таймер фокусу',
    settingsModuleFocusDesc: 'Техніка Помодоро та глибока робота',
    settingsModuleBreathing: 'Дихальні вправи',
    settingsModuleBreathingDesc: 'Техніки розслаблення та медитації',
    settingsModuleGratitude: 'Журнал вдячності',
    settingsModuleGratitudeDesc: 'Записуйте, за що ви вдячні',
    settingsModuleQuests: 'Квести',
    settingsModuleQuestsDesc: 'Щоденні завдання та нагороди',
    settingsModuleTasks: 'Завдання',
    settingsModuleTasksDesc: 'Список справ та управління завданнями',
    settingsModuleChallenges: 'Челенджі',
    settingsModuleChallengesDesc: 'Досягнення та випробування',
    settingsModuleAICoach: 'AI Коуч',
    settingsModuleAICoachDesc: 'Персональний помічник з ШІ',
    settingsModuleGarden: 'Мій сад',
    settingsModuleGardenDesc: 'Віртуальний сад та компаньйон',
    settingsModuleCoreLocked: 'Основний модуль',
    settingsModuleUnlockHint: 'Розблоковується в міру прогресу',

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
    // App Updates (v1.4.1)
    checkForUpdates: 'Перевірити оновлення',
    checkingForUpdates: 'Перевірка оновлень...',
    appUpToDate: 'У вас найновіша версія',
    openGooglePlay: 'Відкрити Google Play',
    updateCheckFailed: 'Не вдалося перевірити оновлення',
    remindersTitle: 'Нагадування',
    remindersDescription: 'Дружні нагадування, щоб підтримувати тебе.',
    moodReminder: 'Час перевірки настрою',
    habitReminder: 'Час нагадування про звички',
    focusReminder: 'Час нагадування про фокус',
    quietHours: 'Тихі години',
    reminderDays: 'Дні тижня',
    selectedHabits: 'Звички для нагадування',
    noHabitsYet: 'Поки немає звичок.',
    reminderMoodTitle: 'Гей, як справи? 💭',
    reminderMoodBody: '30 секунд — і мозок скаже дякую! Як настрій?',
    reminderHabitTitle: 'Час для звички! ✨',
    reminderHabitBody: 'Маленький крок = велика перемога. Погнали?',
    reminderFocusTitle: 'Час фокусу! 🎯',
    reminderFocusBody: 'Всього 25 хвилин і ти герой. Включаємо?',
    reminderDismiss: 'Не зараз',
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
    accountDescription: 'Увійдіть через email для синхронізації прогресу між пристроями.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Надіслати посилання для входу',
    continueWithGoogle: 'Продовжити через Google',
    signedInAs: 'Ви увійшли як',
    signOut: 'Вийти',
    syncNow: 'Синхронізувати зараз',
    cloudSyncDisabled: 'Синхронізація з хмарою вимкнена.',
    deleteAccount: 'Видалити акаунт',
    deleteAccountConfirm: 'Видалити акаунт?',
    deleteAccountTypeConfirm: 'Введіть DELETE для підтвердження:',
    deleteAccountWarning: 'Буде видалено хмарні дані та доступ до акаунту.',
    deleteAccountSuccess: 'Акаунт видалено.',
    deleteAccountError: 'Не вдалося видалити акаунт.',
    deleteAccountLink: 'Як видалити акаунт і дані',
    authEmailSent: 'Посилання для входу надіслано на вашу пошту.',
    authSignedOut: 'Ви вийшли.',
    authError: 'Не вдалося надіслати посилання.',
    authNotConfigured: 'Supabase не налаштовано.',
    syncSuccess: 'Синхронізація завершена.',
    syncPulled: 'Хмарні дані відновлено.',
    syncPushed: 'Хмара оновлена.',
    syncError: 'Синхронізація не вдалася.',
    authGateTitle: 'Вхід',
    authGateBody: 'Увійдіть через email, щоб зберегти прогрес та синхронізувати між пристроями.',
    authGateContinue: 'Продовжити без акаунта',
    errorBoundaryTitle: 'Щось пішло не так',
    errorBoundaryBody: 'Спробуйте перезавантажити додаток або експортувати звіт про помилку.',
    errorBoundaryExport: 'Експортувати звіт',
    errorBoundaryReload: 'Перезавантажити',
    pushTitle: 'Push-сповіщення',
    pushEnable: 'Увімкнути push',
    pushDisable: 'Вимкнути push',
    pushTest: 'Тестове сповіщення',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Тестове повідомлення.',
    pushTestSent: 'Тест надіслано.',
    pushTestError: 'Не вдалося надіслати тест.',
    pushNowMood: 'Push: настрій',
    pushNowHabit: 'Push: звички',
    pushNowFocus: 'Push: фокус',
    pushEnabled: 'Push увімкнено.',
    pushDisabled: 'Push вимкнено.',
    pushError: 'Не вдалося увімкнути push.',
    pushNeedsAccount: 'Увійдіть, щоб увімкнути push.',
    pushPermissionDenied: 'Дозвіл на сповіщення відхилено.',
    areYouSure: 'Ви впевнені?',
    cannotBeUndone: 'Цю дію не можна скасувати.',
    delete: 'Видалити',
    shareAchievements: 'Поділитися прогресом',
    shareDialogTitle: 'Поділіться своїм прогресом',
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
    shareFailed: 'Не вдалося поділитися. Спробуйте ще раз.',
    shareAchievement30: 'Легенда!',
    shareAchievement14: 'Незупинний!',
    shareAchievement7: 'У вогні!',
    shareAchievement3: 'Зірка, що сходить!',
    shareAchievementStart: 'Тільки почав!',
    shareSubtext30: 'Майстер 30+ днів',
    shareSubtext14: 'Воїн 14+ днів',
    shareSubtext7: 'Серія 7+ днів',
    shareSubtext3: 'Серія 3+ дні',
    shareSubtextStart: 'Будую звички',
    dismiss: 'Закрити',
    challengesTitle: 'Виклики та нагороди',
    challengesSubtitle: 'Приймайте виклики та заробляйте бейджі',
    activeChallenges: 'Активні',
    availableChallenges: 'Доступні',
    badges: 'Нагороди',
    noChallengesActive: 'Немає активних викликів',
    noChallengesActiveHint: 'Почніть виклик, щоб відстежувати свій прогрес',
    progress: 'Прогрес',
    reward: 'Нагорода',
    target: 'Ціль',
    startChallenge: 'Почати виклик',
    challengeActive: 'Активний',
    requirement: 'Вимога',
    challengeTypeStreak: 'Стрік',
    challengeTypeFocus: 'Фокус',
    challengeTypeGratitude: 'Вдячність',
    challengeTypeTotal: 'Всього',

    // Friend Challenges
    friendChallenges: 'Виклики друзям',
    createChallenge: 'Створити виклик',
    challengeDescription: 'Киньте виклик друзям і формуйте звички разом',
    challengeYourFriends: 'Киньте виклик друзям!',
    challengeDuration: 'Тривалість виклику',
    challengeCreated: 'Виклик створено!',
    challengeDetails: 'Деталі виклику',
    shareToInvite: 'Поділіться, щоб запросити друзів!',
    trackWithFriends: 'Відстежуйте виклики з друзями',
    challengeCode: 'Код виклику',
    yourProgress: 'Ваш прогрес',
    daysLeft: 'днів залишилось',
    dayChallenge: 'денний виклик',
    challengeCompleted: 'Виклик виконано!',
    noChallenges: 'Поки немає викликів',
    createChallengePrompt: 'Створіть виклик з будь-якої звички!',
    completedChallenges: 'Завершені',
    expiredChallenges: 'Прострочені',
    youCreated: 'Ви створили',
    createdBy: 'Створив',
    confirmDeleteChallenge: 'Видалити цей виклик?',
    challengeInvite: 'Приєднуйся до мого виклику!',
    challengeJoinPrompt: 'Приєднуйся до мене в ZenFlow!',
    challengeShareTip: 'Після створення ви зможете поділитися викликом з друзями.',

    // Friend Challenges - Join
    joinChallenge: 'Приєднатися',
    enterChallengeCode: 'Введіть код від друга',
    invalidChallengeCode: 'Невірний код. Формат: ZEN-XXXXXX',
    enterCodeToJoin: 'Введіть код виклику, щоб приєднатися',
    joinChallengeHint: 'Попросіть друга поділитися кодом виклику',
    joining: 'Приєднуємося...',
    join: 'Приєднатися',

    // Friend Challenges v2
    challengeWon: '🎉 Чудово! Ви завершили випробування!',
    catchUp: '💪 Ви можете наздогнати! Кожен день важливий!',
    aheadOfSchedule: '⭐ Чудовий темп! Ви випереджаєте графік!',
    daysPassed: 'Днів пройшло',
    daysCompleted: 'Виконано',
    daysRemaining: 'Залишилось',

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
    onboardingAgeTitle: 'Ласкаво просимо до ZenFlow',
    onboardingAgeDesc: 'Цей додаток призначений для користувачів від 13 років і старше',
    onboardingAgeConfirm: 'Мені є 13 років',
    onboardingAgeNote: 'Продовжуючи, ви підтверджуєте, що вам є 13 років',
    healthConnectAgeDesc: 'Функції Health Connect вимагають підтвердження віку 13+ для відповідального використання даних про здоров\'я.',
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
    tutorialFeature2b: '✨ Налаштовуйте іконки, кольори та цілі!',
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
    weeklyStory: 'Історія тижня',
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
    // Weekly Story translations (ProgressStoriesViewer)
    storyAverageMoodScore: 'середня оцінка настрою',
    storyCompletionRate: 'виконання',
    storyTopHabit: 'Топ звичка',
    storyCompletions: 'виконань',
    storyPerfectDays: 'ідеальних днів цього тижня',
    storyAvgSession: 'сер. сесія',
    storyLongestSession: 'найдовша',
    storyMostFocusedOn: 'Найбільше фокус на:',
    storyTrackYourJourney: 'Відстежуйте свій шлях з',
    storyTapLeft: '← Вліво',
    storyTapCenter: 'Центр - пауза',
    storyTapRight: 'Вправо →',
    generating: 'Генерація...',

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
    // Companion Notifications
    companionMissesYou: 'Гей! Я сумую за тобою! 💕',
    companionWantsToPlay: 'Заходь до мене! Тут весело! 🎉',
    companionWaiting: 'Чекаю на тебе! Є щось цікаве 🌱',
    companionProud: 'ТИ МОЛОДЕЦЬ! Я в захваті! ⭐',
    companionCheersYou: 'Вперед! Ти зможеш! 💪',
    companionQuickMood: 'Псст! Як справи? Тицьни сюди! 😊',

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

    // Completed sections
    expand: 'Розгорнути',
    collapse: 'Згорнути',
    moodRecordedShort: 'Настрій записано',
    habitsCompletedShort: 'Звички виконані',
    focusCompletedShort: 'Фокус завершено',
    gratitudeAddedShort: 'Подяку записано',

    // All complete celebration
    allComplete: 'Все виконано!',
    allCompleteMessage: 'Ви виконали всі активності на сьогодні',
    allCompleteSupportive: 'До завтра!',
    allCompleteLegend: 'Легендарний день!',
    allCompleteAmazing: 'Вражаюче!',
    allCompleteGreat: 'Чудова робота!',
    allCompleteNice: 'Гарна робота!',
    daysStreak: 'днів поспіль',
    restDaySupportive: 'Завтра продовжимо разом 💚',
    restDayCooldown: 'День відпочинку вже був нещодавно',
    restDayAvailableIn: 'Доступний через',

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

    // Header Quick Actions
    tasks: 'Задачі',
    quests: 'Квести',
    challenges: 'Виклики',
    openTasks: 'Відкрити задачі',
    openQuests: 'Відкрити квести',
    openChallenges: 'Відкрити виклики',

    // QuestsPanel UI
    randomQuests: 'Випадкові квести',
    questsPanelSubtitle: 'Виконуйте квести для бонусного XP та ексклюзивних значків',
    adhdEngagementSystem: 'Система залучення СДУГ',
    adhdEngagementDesc: 'Квести дають різноманітність та несподівані нагороди — ідеально для СДУГ-мозку, який прагне новизни!',
    dailyQuest: 'Щоденний квест',
    weeklyQuest: 'Щотижневий квест',
    bonusQuest: 'Бонусний квест',
    newQuest: 'Новий квест',
    limitedTime: 'Обмежений час',
    generate: 'Створити',
    noQuestAvailable: 'Квест недоступний',
    noBonusQuestAvailable: 'Бонусний квест недоступний',
    bonusQuestsHint: 'Бонусні квести з\'являються випадково або можуть бути створені вручну',
    questProgress: 'Прогрес:',
    questExpired: 'Закінчився',
    questType: 'Квест',
    questTips: 'Поради щодо квестів',
    questTipDaily: 'Щоденні квести оновлюються кожні 24 години',
    questTipWeekly: 'Щотижневі квести дають 3x XP',
    questTipBonus: 'Бонусні квести рідкісні та дають 5x XP',
    questTipExpire: 'Завершіть квести до закінчення терміну!',

    // Companion
    companionHungry: 'Я голодний... Погодуй мене?',

    // Common actions
    back: 'Назад',
    start: 'Почати',
    stop: 'Стоп',

    // Celebrations
    allHabitsComplete: 'Всі звички виконані!',
    amazingWork: 'Чудова робота сьогодні!',

    // 404 page
    pageNotFound: 'Сторінку не знайдено',
    goHome: 'На головну',

    // Insights
    insightsTitle: 'Персональні Аналітика',
    insightsNotEnoughData: 'Продовжуйте відстежувати настрій, звички та фокус протягом тижня, щоб отримати персоналізовані інсайти про ваші патерни.',
    insightsNoPatterns: 'Поки не виявлено сильних патернів. Продовжуйте відстеження, щоб дізнатися, що працює найкраще для вас!',
    insightsHelpTitle: 'Про Аналітика',
    insightsHelp1: 'Аналітика генеруються з ваших даних за допомогою статистичного аналізу.',
    insightsHelp2: 'Весь аналіз відбувається локально на вашому пристрої - ваші дані нікуди не передаються.',
    insightsHelp3: 'Патерни з вищою впевненістю показуються першими.',
    insightsDismiss: 'Приховати',
    insightsShowMore: 'Показати більше',
    insightsShowLess: 'Показати менше',
    insightsDismissedCount: 'Приховано інсайтів',
    insightsMoodEntries: 'записів настрою',
    insightsHabitCount: 'звичка',
    insightsFocusSessions: 'фокус-сесій',

    // Weekly Insights (v1.5.0)
    weeklyInsights: 'Інсайти тижня',
    weeklyInsightsNotEnoughData: 'Відстежуйте прогрес цього тижня, щоб отримати персоналізовані інсайти та рекомендації.',
    comparedToLastWeek: 'Порівняно з минулим тижнем',
    recommendations: 'Рекомендації',
    avgMood: 'Сер. настрій',
    week: 'Тиждень',
    // Recommendation translations
    recLowMoodTitle: 'Настрій потребує уваги',
    recLowMoodDesc: 'Ваш настрій цього тижня був нижчим за звичайний. Спробуйте заняття, які зазвичай піднімають вам настрій.',
    recLowMoodAction: 'Спробуйте 5-хвилинну дихальну вправу',
    recHabitDeclineTitle: 'Звички знизились',
    recHabitDeclineDesc: 'Виконання звичок знизилось порівняно з минулим тижнем. Почніть з малого, щоб відновити імпульс.',
    recHabitDeclineAction: 'Сфокусуйтесь на одній звичці сьогодні',
    recLowFocusTitle: 'Збільшіть час фокусу',
    recLowFocusDesc: 'Цього тижня було мало сесій фокусування. Навіть короткі сесії допомагають виробити звичку.',
    recLowFocusAction: 'Спробуйте 10-хвилинну сесію фокусу',
    recGreatProgressTitle: 'Ви на підйомі!',
    recGreatProgressDesc: 'Ваш прогрес покращується порівняно з минулим тижнем. Так тримати!',
    recBestDayTitle: 'Це був ваш найкращий день',
    recBestDayDesc: 'Спробуйте зрозуміти, що зробило цей день особливим, і повторити ці умови.',
    recGratitudeTitle: 'Практикуйте вдячність',
    recGratitudeDesc: 'Записування того, за що ви вдячні, може значно покращити настрій з часом.',
    recGratitudeAction: 'Додайте запис вдячності сьогодні',
    recPerfectWeekTitle: 'Неймовірна стабільність!',
    recPerfectWeekDesc: 'Ви виконали більшість звичок цього тижня. Ви формуєте міцні звички!',
    recTopHabitTitle: 'Продовжуйте цю звичку',
    recTopHabitDesc: 'Це одна з ваших найстабільніших звичок. Вона сприяє вашому благополуччю.',

    // Smart Reminders
    smartReminders: 'Розумні нагадування',
    smartRemindersNotEnoughData: 'Продовжуйте користуватися додатком, щоб отримати персоналізовані рекомендації щодо нагадувань.',
    smartRemindersOptimized: 'Час ваших нагадувань оптимальний! Чудова робота.',
    smartRemindersDescription: 'Персоналізовані пропозиції на основі ваших патернів',
    suggestions: 'пропозицій',
    highConfidence: 'Висока впевненість',
    mediumConfidence: 'Середня',
    lowConfidence: 'Пропозиція',
    apply: 'Застосувати',
    habitRemindersOptimal: 'Оптимальний час звичок',
    patternBased: 'За патерном',

    // Sync status
    syncOffline: 'Офлайн',
    syncSyncing: 'Синхронізація',
    syncLastSync: 'Синхронізовано',
    syncReady: 'Готово до синхронізації',
    syncBackup: 'даних',
    syncReminders: 'нагадувань',
    syncChallenges: 'викликів',
    syncTasks: 'завдань',
    syncInnerWorld: 'прогресу',
    syncBadges: 'досягнень',

    // Progressive Onboarding
    onboardingTryNow: 'Спробувати',
    onboardingGotIt: 'Зрозуміло!',
    onboardingNext: 'Далі',
    onboardingGetStarted: 'Почати!',
    onboardingWelcomeTitle: 'Ласкаво просимо до ZenFlow! 🌱',
    onboardingWelcomeDescription: 'Ми раді допомогти вам створити кращі звички та зрозуміти, що працює саме для ВАШОГО мозку.',
    onboardingDay1Title: 'Почнемо просто',
    onboardingDay1Description: 'Сьогодні ми зосередимося лише на двох речах: відстежуванні настрою та створенні першої звички. Нічого складного.',
    onboardingGradualTitle: 'Більше функцій відкривається поступово',
    onboardingGradualDescription: 'Протягом наступних 4 днів ви відкриєте нові функції в міру прогресу. Ніякого перевантаження інформацією!',
    onboardingDayProgress: 'День {day} з {maxDay}',
    onboardingFeaturesUnlocked: 'функцій',
    onboardingNextUnlock: 'Наступне відкриття',

    // Feature Unlocks
    onboardingfocusTimerUnlockTitle: '🎯 Таймер Фокусу Відкрито!',
    onboardingfocusTimerUnlockSubtitle: 'Чудовий прогрес!',
    onboardingfocusTimerDescription: 'Використовуйте таймер Pomodoro для глибокої концентрації. Встановіть 25 хвилин, сфокусуйтеся на одному завданні, потім зробіть перерву. Ідеально для ADHD мозку!',
    onboardingxpUnlockTitle: '✨ Система XP Відкрита!',
    onboardingxpUnlockSubtitle: 'Час для gamification!',
    onboardingxpDescription: 'Заробляйте досвід за виконання звичок, фокус-сесії та відстеження настрою. Підвищуйте рівень та відкривайте нові досягнення!',
    onboardingquestsUnlockTitle: '🎮 Квести Відкриті!',
    onboardingquestsUnlockSubtitle: 'Нові виклики!',
    onboardingquestsDescription: 'Щоденні та щотижневі квести додають різноманітності у вашу рутину. Виконуйте їх для бонусних нагород!',
    onboardingcompanionUnlockTitle: '💚 Компаньйон Відкрито!',
    onboardingcompanionUnlockSubtitle: 'Зустрічайте вашого помічника!',
    onboardingcompanionDescription: 'Ваш віртуальний компаньйон росте разом з вами, святкує перемоги та підтримує у важкі дні. Обирайте з 5 типів!',
    onboardingtasksUnlockTitle: '📝 Завдання Відкриті!',
    onboardingtasksUnlockSubtitle: 'Повний доступ!',
    onboardingtasksDescription: 'Task Momentum допомагає пріоритизувати завдання спеціально для ADHD. Система рекомендує, що робити далі, базуючись на терміновості та вашій енергії.',
    onboardingchallengesUnlockTitle: '🏆 Виклики Відкриті!',
    onboardingchallengesUnlockSubtitle: 'Повний доступ!',
    onboardingchallengesDescription: 'Беріть участь у довгострокових викликах для розвитку навичок. Відстежуйте прогрес та заробляйте ексклюзивні значки!',

    // Re-engagement (Welcome Back Modal)
    reengageTitle: 'З поверненням!',
    reengageSubtitle: 'Ви були відсутні {days} днів',
    reengageStreakBroken: 'Статус серії',
    reengageStreakProtected: 'Серія захищена!',
    reengageStreakBrokenMsg: 'Вашу серію було скинуто, але ви можете почати заново сьогодні! Попередня серія: {streak} днів.',
    reengageStreakProtectedMsg: 'Ваша серія в {streak} днів збережена! Продовжуйте!',
    reengageBestHabits: 'Ваші найкращі звички',
    reengageSuccessRate: 'успіх',
    reengageQuickMood: 'Як ви себе почуваєте?',
    reengageMoodLogged: 'Настрій записано!',
    reengageContinue: 'Продовжити!',

    // Trends View (Long-term Analytics)
    trendsTitle: 'Ваші Тенденції',
    trendsAvgMood: 'Серед. Настрій',
    trendsHabitRate: 'Звички',
    trendsFocusTime: 'Фокус',
    trendsMoodChart: 'Настрій З Часом',
    trendsHabitChart: 'Виконання Звичок',
    trendsFocusChart: 'Час Фокуса',
    trendsTotalFocus: 'Всього',
    trendsInsightHint: 'Хочете персональні інсайти?',
    trendsInsightHintDesc: 'Перевірте панель Інсайтів на головній для виявлення патернів у ваших даних.',

    // Health Connect (v1.2.0)
    healthConnect: 'Health Connect',
    healthConnectDescription: 'Синхронізація з Google Health Connect',
    healthConnectLoading: 'Перевірка Health Connect...',
    healthConnectNotAvailable: 'Недоступно на цьому пристрої',
    healthConnectUpdateRequired: 'Оновіть додаток Health Connect',
    mindfulness: 'Усвідомленість',
    sleep: 'Сон',
    steps: 'Кроки',
    stepsLabel: 'кроків',
    grantPermissions: 'Надати дозволи',
    todayHealth: 'Здоров\'я сьогодні',
    syncFocusSessions: 'Синхронізувати фокус-сесії',
    syncFocusSessionsHint: 'Зберігати фокус-сесії як усвідомленість у Health Connect',
    openHealthConnect: 'Відкрити Health Connect',
    refresh: 'Оновити',
    permissions: 'Дозволи',

    // Quest Templates (для randomQuests.ts)
    questMorningMomentum: 'Ранковий Імпульс',
    questMorningMomentumDesc: 'Виконайте 3 звички до 12:00',
    questHabitMaster: 'Майстер Звичок',
    questHabitMasterDesc: 'Виконайте 5 звичок сьогодні',
    questSpeedDemon: 'Швидкісний Демон',
    questSpeedDemonDesc: 'Виконайте 3 звички за 30 хвилин',
    questFocusFlow: 'Потік Фокусу',
    questFocusFlowDesc: '30 хвилин фокусу без перерв',
    questDeepWork: 'Глибока Робота',
    questDeepWorkDesc: '60 хвилин зосередженої роботи',
    questHyperfocusHero: 'Герой Гіперфокусу',
    questHyperfocusHeroDesc: '90 хвилин у режимі Гіперфокусу',
    questStreakKeeper: 'Хранитель Серії',
    questStreakKeeperDesc: 'Підтримуйте серію 7 днів',
    questConsistencyKing: 'Король Постійності',
    questConsistencyKingDesc: 'Підтримуйте серію 14 днів',
    questGratitudeSprint: 'Спринт Вдячності',
    questGratitudeSprintDesc: 'Запишіть 5 подяк за 5 хвилин',
    questThankfulHeart: 'Вдячне Серце',
    questThankfulHeartDesc: 'Запишіть 10 подяк сьогодні',
    questLightningRound: 'Блискавичний Раунд',
    questLightningRoundDesc: 'Виконайте 5 швидких завдань за 15 хвилин',
    questWeeklyWarrior: 'Тижневий Воїн',
    questWeeklyWarriorDesc: 'Виконуйте звички 7 днів поспіль',

    // Feedback System
    feedbackTitle: 'Зворотний зв\'язок',
    feedbackSubtitle: 'Допоможіть нам покращити додаток',
    feedbackCategoryBug: 'Повідомити про помилку',
    feedbackCategoryFeature: 'Запропонувати функцію',
    feedbackCategoryOther: 'Інше',
    feedbackMessagePlaceholder: 'Опишіть вашу проблему або пропозицію...',
    feedbackEmailPlaceholder: 'Email (необов\'язково)',
    feedbackSubmit: 'Надіслати',
    feedbackSuccess: 'Дякуємо за зворотний зв\'язок!',
    feedbackError: 'Не вдалося надіслати. Спробуйте пізніше.',
    feedbackSending: 'Надсилання...',
    sendFeedback: 'Написати нам',

    // App Rating
    rateAppTitle: 'Подобається ZenFlow?',
    rateAppSubtitle: 'Оцініть нас у Play Store',
    rateAppButton: 'Оцінити',
    rateAppLater: 'Пізніше',

    // App Updates
    updateAvailable: 'Доступне оновлення',
    updateDescription: 'Нова версія готова до встановлення з покращеннями та виправленнями.',
    updateDescriptionCritical: 'Критичне оновлення необхідне для продовження використання додатку.',
    updateNow: 'Оновити зараз',
    updateAvailableFor: 'Доступно {days} дн.',

    // Lock Screen Quick Actions
    quickActions: 'Швидкі дії',
    quickActionsDescription: 'Показувати сповіщення з швидкими діями на екрані блокування',
    quickActionsEnabled: 'Швидкі дії увімкнено',
    quickActionsDisabled: 'Швидкі дії вимкнено',
    quickActionLogMood: 'Записати настрій',
    quickActionStartFocus: 'Почати фокус',
    quickActionViewHabits: 'Звички',

    // Notification Sounds
    notificationSound: 'Звук сповіщень',
    notificationSoundDescription: 'Оберіть звук для нагадувань',
    soundDefault: 'За замовчуванням',
    soundDefaultDesc: 'Системний звук сповіщення',
    soundGentle: 'М\'який',
    soundGentleDesc: 'Тільки вібрація',
    soundChime: 'Короткий',
    soundChimeDesc: 'Короткий тон сповіщення',
    soundSilent: 'Тихий',
    soundSilentDesc: 'Без звуку та вібрації',
    testNotification: 'Тестове сповіщення',
    testNotificationHint: 'Надсилає тестове сповіщення через 5 секунд для перевірки роботи.',

    // Insight Card Details
    insightConfidence: 'Впевненість',
    insightDataPoints: 'Точок даних',
    insightAvgMoodWith: 'Середній настрій зі звичкою',
    insightAvgMoodWithout: 'Середній настрій без звички',
    insightSampleDays: 'Днів у вибірці',
    insightBestActivity: 'Найкраща активність',
    insightPeakTime: 'Піковий час',
    insightAvgDuration: 'Середня тривалість',
    insightSessions: 'Сесій',
    insightTagOccurrences: 'Входжень тегу',
    insightMoodWithTag: 'Настрій з тегом',
    insightMoodWithoutTag: 'Настрій без тегу',
    insightDisclaimer: 'Інсайт базується на ваших даних. Патерни можуть змінюватися.',
    times: 'разів',

    // Stats Empty States
    noMoodDataYet: 'Немає даних про настрій',
    noEmotionDataYet: 'Немає даних про емоції',

    // XP Display
    xp: 'XP',

    // AI Coach
    aiCoachTitle: 'AI Коуч',
    aiCoachSubtitle: 'Твій персональний помічник',
    aiCoachWelcome: 'Привіт! Чим я можу допомогти?',
    aiCoachPlaceholder: 'Напиши повідомлення...',
    aiCoachQuick1: 'Я відчуваю стрес',
    aiCoachQuick2: 'Допоможи зосередитись',
    aiCoachQuick3: 'Потрібна мотивація',
    clearHistory: 'Очистити історію',
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

    // Mindfulness v1.5.0
    needInspiration: '¿Necesitas inspiración?',
    journalPrompt: 'Pregunta',
    dailyPrompt: 'Pregunta del Día',
    usePrompt: 'Usar esta pregunta',
    shufflePrompt: 'Otra pregunta',
    mindfulMoment: 'Momento de atención plena',
    takeAMoment: 'Tómate un momento...',
    withNote: 'con nota',
    whatsMakingYouFeel: '¿Qué te hace sentir así?',
    emotionSaved: 'Emoción guardada',
    treat: 'premio',
    moodGood: 'Bien',
    moodOkay: 'Normal',
    moodNotGreat: 'No muy bien',

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
    // Insight texts
    insightBestDayTitle: '¡Los {day} son tu mejor día!',
    insightBestDayDesc: 'Tu ánimo suele ser mejor los {day}. Considera programar tareas importantes ese día.',
    insightBestTimeTitle: 'Brillas más por la {period}',
    insightBestTimeDesc: 'Tu ánimo suele ser mejor por la {period}. ¡Programa tareas exigentes para entonces!',
    insightHabitBoostsTitle: '¡"{habit}" mejora tu ánimo!',
    insightHabitBoostsDesc: 'Cuando completas "{habit}", tu ánimo tiende a ser {percent}% mejor. ¡Sigue así!',
    insightFocusMoodTitle: '¡Enfoque = Mejor ánimo!',
    insightFocusMoodDesc: 'Los días con sesiones de enfoque, tu ánimo es {percent}% mejor. ¡El trabajo profundo vale la pena!',
    insightGratitudeMoodTitle: '¡La gratitud mejora tu ánimo!',
    insightGratitudeMoodDesc: 'Los días con entradas de gratitud muestran {percent}% mejor ánimo. ¡Sigue practicando!',
    insightMoodUpTitle: '¡Tu ánimo está mejorando!',
    insightMoodUpDesc: 'Tu ánimo promedio esta semana es {percent}% mejor que la semana pasada. ¡Lo estás haciendo genial!',
    insightMoodDownTitle: '¡Levantemos tu ánimo!',
    insightMoodDownDesc: 'Tu ánimo ha bajado un poco. Intenta enfocarte en hábitos que usualmente te hacen sentir bien.',
    insightHighConsistencyTitle: '¡Consistencia increíble!',
    insightHighConsistencyDesc: 'Has registrado tu ánimo {days} de los últimos 14 días. ¡Esta autoconciencia es poderosa!',
    insightLowConsistencyTitle: 'Construye tu hábito de registro',
    insightLowConsistencyDesc: 'Intenta registrar tu ánimo a la misma hora cada día. ¡La consistencia te ayuda a detectar patrones!',

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
    // v1.4.0: Habit reminders and schedule
    addReminder: 'Añadir',
    noReminders: 'Sin recordatorios',
    habitEventExplanation: 'Este evento es de tu hábito. Edita el hábito para cambiarlo.',
    habitDurationMinutes: 'minutos',

    // Focus timer
    focus: 'Enfoque',
    breakTime: 'Descanso',
    autoScheduled: 'Auto-programado',
    taskEventExplanation: 'Este bloque se genera automáticamente desde tus tareas. Completa la tarea para eliminarlo.',
    yourTasksNow: 'Tus tareas ahora',
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
    toLevel: 'Al nivel',
    unlockedPercent: '{percent}% Desbloqueado',
    all: 'Todos',
    unlocked: 'Desbloqueados',
    locked: 'Bloqueados',
    unlockedOn: 'Desbloqueado el {date}',
    hiddenAchievement: '???',
    hidden: 'Oculto',
    noAchievementsYet: 'Aún no hay logros',
    startUsingZenFlow: '¡Comienza a usar ZenFlow para desbloquear logros!',
    achievementUnlocked: '¡Logro desbloqueado!',
    userLevel: 'Nivel',
    focusSession: 'Sesión de enfoque',
    // TimeHelper
    timeBlindnessHelper: 'Ayuda para la ceguera temporal',
    visualTimeAwareness: 'Conciencia visual del tiempo para TDAH',
    hoursMinutesLeft: '{hours}h {mins}m restantes',
    minutesLeft: '{mins}m restantes',
    timesUp: '¡Se acabó el tiempo!',
    youllFinishAt: '🎯 Terminarás a las:',
    nMinutes: '{n} minutos',
    pingEveryMinutes: 'Señal cada (minutos)',
    audioPings: 'Señales de audio',
    testSound: '🔊 Probar',
    soundOn: 'Activado',
    soundOff: 'Desactivado',
    startTimer: 'Iniciar temporizador',
    pauseTimer: 'Pausar',
    resetTimer: 'Reiniciar',
    adhdTimeManagement: 'Gestión del tiempo con TDAH',
    adhdTip1: 'Las señales de audio ayudan a seguir el tiempo',
    adhdTip2: 'La cuenta regresiva visual reduce la ansiedad',
    adhdTip3: 'Predicción de fin = mejor planificación',
    adhdTip4: 'Los cambios de color avisan cuando queda poco tiempo',
    currentStreak: 'Racha actual',
    daysInRow: 'Días seguidos',
    totalFocus: 'Enfoque total',
    allTime: 'Todo el tiempo',
    habitsCompleted: 'Hábitos completados',
    totalTimes: 'Veces totales',
    moodDistribution: 'Distribución del ánimo',
    moodHeatmap: 'Mapa de ánimo',
    activityHeatmap: 'Resumen de actividad',
    less: 'Menos',
    more: 'Más',
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
    exportCSV: 'Exportar CSV',
    exportPDF: 'Exportar PDF',
    importSuccess: 'Importación completada.',
    importError: 'No se pudo importar el archivo.',
    importedItems: 'Añadido',
    importAdded: 'añadido',
    importUpdated: 'actualizado',
    importSkipped: 'omitido',
    textTooLong: 'El texto es demasiado largo (máximo 2000 caracteres)',
    invalidInput: 'Por favor verifica tu entrada',
    comingSoon: 'próximamente',
    resetAllData: 'Restablecer todos los datos',
    privacyTitle: 'Privacidad',
    privacyDescription: 'Tus datos permanecen en el dispositivo. Sin rastreo oculto.',
    privacyNoTracking: 'Sin rastreo',
    privacyNoTrackingHint: 'No recopilamos datos de comportamiento.',
    privacyAnalytics: 'Analíticas',
    privacyAnalyticsHint: 'Ayuda a mejorar la app. Puedes desactivarlo.',
    privacyPolicy: 'Politica de privacidad',
    termsOfService: 'Terminos del servicio',

    // v1.2.0 Appearance
    appearance: 'Apariencia',
    oledDarkMode: 'Modo oscuro OLED',
    oledDarkModeHint: 'Tema negro puro para pantallas OLED. Ahorra batería.',

    // What's New Modal
    whatsNewTitle: 'Novedades',
    whatsNewVersion: 'Versión',
    whatsNewGotIt: '¡Entendido!',

    // Accessibility
    skipToContent: 'Ir al contenido principal',

    // v1.1.1 Settings Redesign
    settingsCloudSyncTitle: 'Activar sincronización en la nube',
    settingsCloudSyncDescription: 'Sincroniza tus datos entre dispositivos',
    settingsCloudSyncEnabled: 'Sincronización en la nube activada',
    settingsCloudSyncDisabledByUser: 'Sincronización desactivada',
    settingsExportTitle: 'Exportar copia de seguridad',
    settingsExportDescription: 'Guarda todos tus datos en un archivo',
    settingsImportTitle: 'Importar copia de seguridad',
    settingsImportMergeTooltip: 'Los datos importados se agregarán a los existentes. Se omiten duplicados.',
    settingsImportReplaceTooltip: '⚠️ Todos los datos actuales se eliminarán y reemplazarán con la importación',
    settingsImportReplaceConfirm: 'Escribe "REPLACE" para confirmar la eliminación de todos los datos',
    // Import validation (v1.4.1)
    invalidFileType: 'Tipo de archivo inválido. Se requiere JSON.',
    fileTooLarge: 'Archivo demasiado grande (máx. 10 MB)',
    importConfirm: 'Confirmar importación',
    invalidBackupFormat: 'Formato de copia de seguridad inválido',
    settingsWhatsNewTitle: 'Novedades en v1.5.8',
    settingsWhatsNewLeaderboards: 'Tablas de clasificación',
    settingsWhatsNewLeaderboardsDesc: 'Compite anónimamente con otros',
    settingsWhatsNewSpotify: 'Integración Spotify',
    settingsWhatsNewSpotifyDesc: 'Reproducción automática durante sesiones de enfoque',
    settingsWhatsNewChallenges: 'Desafíos con amigos',
    settingsWhatsNewChallengesDesc: 'Desafía a amigos a crear hábitos juntos',
    settingsWhatsNewDigest: 'Resumen semanal',
    settingsWhatsNewDigestDesc: 'Recibe informes de progreso por email',
    settingsWhatsNewSecurity: 'Seguridad mejorada',
    settingsWhatsNewSecurityDesc: 'Mejor protección de datos y privacidad',
    settingsWhatsNewGotIt: '¡Entendido!',
    // v1.5.8 What's New
    settingsWhatsNewFeatureToggles: 'Interruptores de funciones',
    settingsWhatsNewFeatureTogglesDesc: 'Activa/desactiva módulos en Configuración',
    settingsWhatsNewBugFixes158: 'Corrección de errores',
    settingsWhatsNewBugFixes158Desc: 'Problemas de sincronización y estabilidad corregidos',
    settingsWhatsNewUIImprovements: 'Mejoras de interfaz',
    settingsWhatsNewUIImprovementsDesc: 'Mejores interruptores y organización de configuración',
    settingsSectionAccount: 'Cuenta y nube',
    settingsSectionData: 'Datos y copia de seguridad',

    // Weekly Digest (v1.3.0)
    weeklyDigestTitle: 'Informe semanal de progreso',
    weeklyDigestDescription: 'Recibe un resumen semanal de tus hábitos, tiempo de enfoque y tendencias de ánimo cada domingo.',
    weeklyDigestEnabled: 'Recibirás informes en tu correo',

    // Changelog
    changelogTitle: 'Historial de versiones',
    changelogExpandAll: 'Expandir todo',
    changelogCollapseAll: 'Contraer todo',
    changelogEmpty: 'Historial de versiones no disponible',
    changelogAdded: 'Añadido',
    changelogFixed: 'Corregido',
    changelogChanged: 'Cambiado',
    changelogRemoved: 'Eliminado',

    // Settings Groups (v1.3.0)
    settingsGroupProfile: 'Perfil y apariencia',
    settingsGroupNotifications: 'Notificaciones',
    settingsGroupData: 'Datos y privacidad',
    settingsGroupAccount: 'Cuenta',
    settingsGroupAbout: 'Acerca de',

    // Feature Toggles / Modules (v1.5.8)
    settingsGroupModules: 'Módulos',
    settingsModulesDescription: 'Activa o desactiva funciones de la app',
    settingsModuleMood: 'Rastreador de ánimo',
    settingsModuleMoodDesc: 'Función principal — siempre activa',
    settingsModuleHabits: 'Hábitos',
    settingsModuleHabitsDesc: 'Función principal — siempre activa',
    settingsModuleFocus: 'Temporizador de enfoque',
    settingsModuleFocusDesc: 'Técnica Pomodoro y trabajo profundo',
    settingsModuleBreathing: 'Ejercicios de respiración',
    settingsModuleBreathingDesc: 'Técnicas de relajación y meditación',
    settingsModuleGratitude: 'Diario de gratitud',
    settingsModuleGratitudeDesc: 'Registra por lo que estás agradecido',
    settingsModuleQuests: 'Misiones',
    settingsModuleQuestsDesc: 'Misiones diarias y recompensas',
    settingsModuleTasks: 'Tareas',
    settingsModuleTasksDesc: 'Lista de tareas y gestión',
    settingsModuleChallenges: 'Desafíos',
    settingsModuleChallengesDesc: 'Logros y retos',
    settingsModuleAICoach: 'Coach IA',
    settingsModuleAICoachDesc: 'Asistente personal con IA',
    settingsModuleGarden: 'Mi jardín',
    settingsModuleGardenDesc: 'Jardín virtual y compañero',
    settingsModuleCoreLocked: 'Módulo principal',
    settingsModuleUnlockHint: 'Se desbloquea con el progreso',

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
    // App Updates (v1.4.1)
    checkForUpdates: 'Buscar actualizaciones',
    checkingForUpdates: 'Buscando actualizaciones...',
    appUpToDate: 'Tienes la última versión',
    openGooglePlay: 'Abrir Google Play',
    updateCheckFailed: 'Error al buscar actualizaciones',
    remindersTitle: 'Recordatorios',
    remindersDescription: 'Pequeños empujones para mantenerte en camino.',
    moodReminder: 'Hora del estado de ánimo',
    habitReminder: 'Hora de los hábitos',
    focusReminder: 'Hora del enfoque',
    quietHours: 'Horas tranquilas',
    reminderDays: 'Días de la semana',
    selectedHabits: 'Hábitos a recordar',
    noHabitsYet: 'Sin hábitos aún.',
    reminderMoodTitle: '¡Hola! ¿Cómo estás? 💭',
    reminderMoodBody: '30 segundos para agradecer a tu cerebro. ¿Cómo te sientes?',
    reminderHabitTitle: '¡Hora del mini hábito! ✨',
    reminderHabitBody: 'Pequeño paso = gran victoria. ¿Listo?',
    reminderFocusTitle: '¡Poder de enfoque! 🎯',
    reminderFocusBody: 'Solo 25 minutos para modo héroe. ¿Vamos?',
    reminderDismiss: 'Ahora no',
    notificationPermissionTitle: 'Mantente en el camino',
    notificationPermissionDescription: 'Recibe recordatorios suaves para registrar tu estado de ánimo, completar hábitos y tomar descansos de enfoque. Las notificaciones te ayudan a crear rutinas saludables.',
    notificationFeature1Title: 'Recordatorios de estado de ánimo',
    notificationFeature1Desc: 'Haz seguimiento de ti mismo cada día',
    notificationFeature2Title: 'Seguimiento de hábitos',
    notificationFeature2Desc: 'Mantén la constancia con tus metas',
    notificationFeature3Title: 'Sesiones de enfoque',
    notificationFeature3Desc: 'Recibe recordatorios para tomar descansos productivos',
    notificationAllow: 'Activar notificaciones',
    notificationDeny: 'Quizás después',
    notificationPrivacyNote: 'Puedes cambiar esto en cualquier momento en Ajustes. Las notificaciones son locales y privadas.',
    onboardingStep: 'Paso',
    onboardingValueTitle: 'Registra tu ánimo + hábitos en 30 segundos al día',
    onboardingValueBody: 'Check-ins rápidos, sin desorden, totalmente privado.',
    onboardingStart: 'Empezar en 30 seg',
    onboardingExplore: 'Explorar',
    onboardingGoalTitle: 'Elige tu enfoque',
    onboardingGoalLessStress: 'Menos estrés',
    onboardingGoalLessStressDesc: 'Hábitos tranquilos y suaves',
    onboardingGoalMoreEnergy: 'Más energía',
    onboardingGoalMoreEnergyDesc: 'Sueño, movimiento, hidratación',
    onboardingGoalBetterRoutine: 'Mejor rutina',
    onboardingGoalBetterRoutineDesc: 'Estabilidad y ritmo',
    onboardingContinue: 'Continuar',
    onboardingCheckinTitle: 'Check-in rápido',
    onboardingHabitsPrompt: 'Elige dos hábitos',
    onboardingPickTwo: 'Elige hasta dos',
    onboardingReminderTitle: 'Activar recordatorios',
    onboardingReminderBody: 'Elige una hora que te convenga. Sin spam.',
    onboardingMorning: 'Mañana',
    onboardingEvening: 'Noche',
    onboardingEnable: 'Activar',
    onboardingSkip: 'Omitir por ahora',
    onboardingHabitBreathing: 'Respiración',
    onboardingHabitEveningWalk: 'Paseo nocturno',
    onboardingHabitStretch: 'Estiramiento',
    onboardingHabitJournaling: 'Escribir diario',
    onboardingHabitWater: 'Beber agua',
    onboardingHabitSunlight: 'Luz solar',
    onboardingHabitMovement: 'Movimiento',
    onboardingHabitSleepOnTime: 'Dormir a tiempo',
    onboardingHabitMorningPlan: 'Plan matutino',
    onboardingHabitRead: 'Leer 10 min',
    onboardingHabitNoScreens: 'Sin pantallas tarde',
    onboardingHabitDailyReview: 'Revisión diaria',
    account: 'Cuenta',
    accountDescription: 'Inicia sesión con tu email para sincronizar tu progreso entre dispositivos.',
    emailPlaceholder: 'you@email.com',
    sendMagicLink: 'Enviar enlace de acceso',
    continueWithGoogle: 'Continuar con Google',
    signedInAs: 'Conectado como',
    signOut: 'Cerrar sesión',
    syncNow: 'Sincronizar ahora',
    cloudSyncDisabled: 'Sincronización en la nube desactivada.',
    deleteAccount: 'Eliminar cuenta',
    deleteAccountConfirm: '¿Eliminar tu cuenta?',
    deleteAccountTypeConfirm: 'Escribe DELETE para confirmar:',
    deleteAccountWarning: 'Esto eliminará los datos en la nube y el acceso a tu cuenta.',
    deleteAccountSuccess: 'Cuenta eliminada.',
    deleteAccountError: 'No se pudo eliminar la cuenta.',
    deleteAccountLink: 'Cómo eliminar la cuenta/datos',
    authEmailSent: 'Enlace de acceso enviado a tu correo.',
    authSignedOut: 'Sesión cerrada.',
    authError: 'Error al enviar el enlace.',
    authNotConfigured: 'Supabase no configurado.',
    syncSuccess: 'Sincronización completa.',
    syncPulled: 'Datos restaurados desde la nube.',
    syncPushed: 'Nube actualizada.',
    syncError: 'Error de sincronización.',
    authGateTitle: 'Iniciar sesión',
    authGateBody: 'Inicia sesión con tu email para guardar tu progreso y sincronizar entre dispositivos.',
    authGateContinue: 'Continuar sin cuenta',
    errorBoundaryTitle: 'Algo salió mal',
    errorBoundaryBody: 'Intenta recargar la aplicación o exportar un informe de error.',
    errorBoundaryExport: 'Exportar informe de error',
    errorBoundaryReload: 'Recargar aplicación',
    pushTitle: 'Notificaciones push',
    pushEnable: 'Activar push',
    pushDisable: 'Desactivar push',
    pushTest: 'Probar notificación',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Notificación de prueba.',
    pushTestSent: 'Prueba enviada.',
    pushTestError: 'Error al enviar prueba.',
    pushNowMood: 'Push: ánimo',
    pushNowHabit: 'Push: hábitos',
    pushNowFocus: 'Push: enfoque',
    pushEnabled: 'Push activado.',
    pushDisabled: 'Push desactivado.',
    pushError: 'Error al activar push.',
    pushNeedsAccount: 'Inicia sesión para activar push.',
    pushPermissionDenied: 'Permiso de notificaciones denegado.',
    areYouSure: '¿Estás seguro?',
    cannotBeUndone: 'Esta acción no se puede deshacer.',
    delete: 'Eliminar',
    shareAchievements: 'Compartir tu progreso',
    shareDialogTitle: 'Comparte tu progreso',
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
    shareFailed: 'Error al compartir. Inténtalo de nuevo.',
    shareAchievement30: '¡Legendario!',
    shareAchievement14: '¡Imparable!',
    shareAchievement7: '¡En llamas!',
    shareAchievement3: '¡Estrella en ascenso!',
    shareAchievementStart: '¡Recién empezado!',
    shareSubtext30: 'Maestro de 30+ días',
    shareSubtext14: 'Guerrero de 14+ días',
    shareSubtext7: 'Racha de 7+ días',
    shareSubtext3: 'Racha de 3+ días',
    shareSubtextStart: 'Creando hábitos',
    dismiss: 'Cerrar',
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

    // Friend Challenges
    friendChallenges: 'Desafíos de amigos',
    createChallenge: 'Crear desafío',
    challengeDescription: 'Desafía a tus amigos a construir hábitos juntos',
    challengeYourFriends: '¡Desafía a tus amigos con este hábito!',
    challengeDuration: 'Duración del desafío',
    challengeCreated: '¡Desafío creado!',
    challengeDetails: 'Detalles del desafío',
    shareToInvite: '¡Comparte para invitar amigos!',
    trackWithFriends: 'Sigue tus desafíos con amigos',
    challengeCode: 'Código del desafío',
    yourProgress: 'Tu progreso',
    daysLeft: 'días restantes',
    dayChallenge: 'días de desafío',
    challengeCompleted: '¡Desafío completado!',
    noChallenges: 'Aún no hay desafíos',
    createChallengePrompt: '¡Crea un desafío desde cualquier hábito!',
    completedChallenges: 'Completados',
    expiredChallenges: 'Expirados',
    youCreated: 'Tú lo creaste',
    createdBy: 'Creado por',
    confirmDeleteChallenge: '¿Eliminar este desafío?',
    challengeInvite: '¡Únete a mi desafío!',
    challengeJoinPrompt: '¡Únete a mí en ZenFlow!',
    challengeShareTip: 'Podrás compartir este desafío con amigos después de crearlo.',

    // Friend Challenges - Join
    joinChallenge: 'Unirse al desafío',
    enterChallengeCode: 'Introduce el código de tu amigo',
    invalidChallengeCode: 'Código inválido. Formato: ZEN-XXXXXX',
    enterCodeToJoin: 'Introduce un código de desafío para unirte',
    joinChallengeHint: 'Pide a tu amigo que comparta el código del desafío',
    joining: 'Uniéndose...',
    join: 'Unirse',

    // Friend Challenges v2
    challengeWon: '🎉 ¡Increíble! ¡Completaste el desafío!',
    catchUp: '💪 ¡Puedes ponerte al día! ¡Cada día cuenta!',
    aheadOfSchedule: '⭐ ¡Buen ritmo! ¡Vas adelantado!',
    daysPassed: 'Días Pasados',
    daysCompleted: 'Completados',
    daysRemaining: 'Restantes',

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
    onboardingAgeTitle: 'Bienvenido a ZenFlow',
    onboardingAgeDesc: 'Esta aplicación está diseñada para usuarios de 13 años o más',
    onboardingAgeConfirm: 'Tengo 13 años o más',
    onboardingAgeNote: 'Al continuar, confirmas que tienes 13 años o más',
    healthConnectAgeDesc: 'Las funciones de Health Connect requieren que tengas 13 años o más para usar los datos de salud de manera responsable.',
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
    tutorialFeature2b: '✨ ¡Personaliza iconos, colores y metas!',
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
    weeklyStory: 'Historia semanal',
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
    // Weekly Story translations (ProgressStoriesViewer)
    storyAverageMoodScore: 'puntuación media de ánimo',
    storyCompletionRate: 'tasa de finalización',
    storyTopHabit: 'Hábito principal',
    storyCompletions: 'completados',
    storyPerfectDays: 'días perfectos esta semana',
    storyAvgSession: 'sesión prom.',
    storyLongestSession: 'más larga',
    storyMostFocusedOn: 'Más enfocado en:',
    storyTrackYourJourney: 'Sigue tu camino con',
    storyTapLeft: '← Toca izquierda',
    storyTapCenter: 'Toca centro para pausar',
    storyTapRight: 'Toca derecha →',
    generating: 'Generando...',

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
    // Companion Notifications
    companionMissesYou: '¡Hola! ¡Te extraño! 💕',
    companionWantsToPlay: '¿Quieres pasar el rato? ¡Es divertido aquí! 🎉',
    companionWaiting: '¡Te espero! Tengo algo genial 🌱',
    companionProud: '¡ERES INCREÍBLE! ¡Muy orgulloso! ⭐',
    companionCheersYou: '¡Vamos vamos! ¡Tú puedes! 💪',
    companionQuickMood: '¡Psst! ¿Cómo vas? ¡Toca aquí! 😊',

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

    // Completed sections
    expand: 'Expandir',
    collapse: 'Contraer',
    moodRecordedShort: 'Ánimo registrado',
    habitsCompletedShort: 'Hábitos completados',
    focusCompletedShort: 'Enfoque completo',
    gratitudeAddedShort: 'Gratitud añadida',

    // All complete celebration
    allComplete: '¡Todo listo!',
    allCompleteMessage: 'Has completado todas las actividades de hoy',
    allCompleteSupportive: '¡Hasta mañana!',
    allCompleteLegend: '¡Día legendario!',
    allCompleteAmazing: '¡Increíble!',
    allCompleteGreat: '¡Excelente trabajo!',
    allCompleteNice: '¡Buen trabajo!',
    daysStreak: 'días seguidos',
    restDaySupportive: 'Mañana continuamos juntos 💚',
    restDayCooldown: 'El día de descanso ya se usó recientemente',
    restDayAvailableIn: 'Disponible en',

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

    // Header Quick Actions
    tasks: 'Tareas',
    quests: 'Misiones',
    challenges: 'Desafíos',
    openTasks: 'Abrir tareas',
    openQuests: 'Abrir misiones',
    openChallenges: 'Abrir desafíos',

    // QuestsPanel UI
    randomQuests: 'Misiones aleatorias',
    questsPanelSubtitle: 'Completa misiones para XP extra y medallas exclusivas',
    adhdEngagementSystem: 'Sistema de compromiso TDAH',
    adhdEngagementDesc: 'Las misiones ofrecen variedad y recompensas inesperadas - ¡perfecto para cerebros con TDAH que buscan novedad!',
    dailyQuest: 'Misión diaria',
    weeklyQuest: 'Misión semanal',
    bonusQuest: 'Misión bonus',
    newQuest: 'Nueva misión',
    limitedTime: 'Tiempo limitado',
    generate: 'Generar',
    noQuestAvailable: 'Misión no disponible',
    noBonusQuestAvailable: 'Misión bonus no disponible',
    bonusQuestsHint: 'Las misiones bonus aparecen aleatoriamente o pueden generarse manualmente',
    questProgress: 'Progreso:',
    questExpired: 'Expirado',
    questType: 'Misión',
    questTips: 'Consejos de misiones',
    questTipDaily: 'Las misiones diarias se reinician cada 24 horas',
    questTipWeekly: 'Las misiones semanales ofrecen 3x XP',
    questTipBonus: 'Las misiones bonus son raras con 5x XP',
    questTipExpire: '¡Completa las misiones antes de que expiren!',

    // Companion
    companionHungry: 'Tengo hambre... ¿Me das de comer?',

    // Common actions
    back: 'Atrás',
    start: 'Empezar',
    stop: 'Parar',

    // Celebrations
    allHabitsComplete: '¡Todos los hábitos completados!',
    amazingWork: '¡Increíble trabajo hoy!',

    // 404 page
    pageNotFound: 'Página no encontrada',
    goHome: 'Ir al inicio',

    // Insights
    insightsTitle: 'Perspectivas Personales',
    insightsNotEnoughData: 'Sigue rastreando tu estado de ánimo, hábitos y enfoque durante una semana para desbloquear perspectivas personalizadas sobre tus patrones.',
    insightsNoPatterns: 'No se detectaron patrones fuertes todavía. ¡Sigue rastreando consistentemente para descubrir qué funciona mejor para ti!',
    insightsHelpTitle: 'Acerca de las Perspectivas',
    insightsHelp1: 'Las perspectivas se generan a partir de tus datos personales usando análisis estadístico.',
    insightsHelp2: 'Todo el análisis ocurre localmente en tu dispositivo - tus datos nunca salen.',
    insightsHelp3: 'Los patrones con mayor confianza se muestran primero.',
    insightsDismiss: 'Descartar',
    insightsShowMore: 'Mostrar más',
    insightsShowLess: 'Mostrar menos',
    insightsDismissedCount: 'perspectivas descartadas',
    insightsMoodEntries: 'registros de ánimo',
    insightsHabitCount: 'hábito',
    insightsFocusSessions: 'sesiones de enfoque',

    // Weekly Insights (v1.5.0)
    weeklyInsights: 'Insights Semanales',
    weeklyInsightsNotEnoughData: 'Rastrea tu progreso esta semana para desbloquear insights y recomendaciones personalizadas.',
    comparedToLastWeek: 'Comparado con la semana pasada',
    recommendations: 'Recomendaciones',
    avgMood: 'Ánimo prom.',
    week: 'Semana',
    // Recommendation translations
    recLowMoodTitle: 'Tu ánimo necesita atención',
    recLowMoodDesc: 'Tu estado de ánimo esta semana ha sido más bajo de lo habitual. Considera actividades que suelen animarte.',
    recLowMoodAction: 'Prueba un ejercicio de respiración de 5 minutos',
    recHabitDeclineTitle: 'Los hábitos disminuyeron',
    recHabitDeclineDesc: 'El cumplimiento de tus hábitos bajó respecto a la semana pasada. Empieza poco a poco para recuperar el impulso.',
    recHabitDeclineAction: 'Enfócate en un solo hábito hoy',
    recLowFocusTitle: 'Aumenta tu tiempo de enfoque',
    recLowFocusDesc: 'Has tenido pocas sesiones de enfoque esta semana. Incluso las sesiones cortas ayudan a crear el hábito.',
    recLowFocusAction: 'Prueba una sesión de enfoque de 10 minutos',
    recGreatProgressTitle: '¡Vas muy bien!',
    recGreatProgressDesc: 'Tu progreso general está mejorando respecto a la semana pasada. ¡Sigue así!',
    recBestDayTitle: 'Este fue tu mejor día',
    recBestDayDesc: 'Intenta identificar qué hizo especial este día y replica esas condiciones.',
    recGratitudeTitle: 'Practica la gratitud',
    recGratitudeDesc: 'Escribir las cosas por las que estás agradecido puede mejorar significativamente tu ánimo con el tiempo.',
    recGratitudeAction: 'Añade una entrada de gratitud hoy',
    recPerfectWeekTitle: '¡Increíble constancia!',
    recPerfectWeekDesc: 'Completaste la mayoría de tus hábitos esta semana. ¡Estás creando rutinas sólidas!',
    recTopHabitTitle: 'Continúa con este hábito',
    recTopHabitDesc: 'Este es uno de tus hábitos más constantes. Probablemente contribuye a tu bienestar.',

    // Smart Reminders
    smartReminders: 'Recordatorios Inteligentes',
    smartRemindersNotEnoughData: 'Sigue usando la app para desbloquear sugerencias personalizadas basadas en tus patrones.',
    smartRemindersOptimized: '¡Tus horarios de recordatorio están bien optimizados! Sigue así.',
    smartRemindersDescription: 'Sugerencias personalizadas basadas en tus patrones de uso',
    suggestions: 'sugerencias',
    highConfidence: 'Alta confianza',
    mediumConfidence: 'Media',
    lowConfidence: 'Sugerencia',
    apply: 'Aplicar',
    habitRemindersOptimal: 'Horarios óptimos de hábitos',
    patternBased: 'Patrón',

    // Sync status
    syncOffline: 'Sin conexión',
    syncSyncing: 'Sincronizando',
    syncLastSync: 'Sincronizado',
    syncReady: 'Listo para sincronizar',
    syncBackup: 'copia de seguridad',
    syncReminders: 'recordatorios',
    syncChallenges: 'desafíos',
    syncTasks: 'tareas',
    syncInnerWorld: 'progreso',
    syncBadges: 'insignias',

    // Progressive Onboarding
    onboardingTryNow: 'Probar ahora',
    onboardingGotIt: '¡Entendido!',
    onboardingNext: 'Siguiente',
    onboardingGetStarted: '¡Empecemos!',
    onboardingWelcomeTitle: '¡Bienvenido a ZenFlow! 🌱',
    onboardingWelcomeDescription: 'Estamos emocionados de ayudarte a crear mejores hábitos y entender qué funciona para TU cerebro.',
    onboardingDay1Title: 'Empecemos simple',
    onboardingDay1Description: 'Por hoy, nos enfocaremos en solo dos cosas: rastrear tu estado de ánimo y crear tu primer hábito. Nada abrumador.',
    onboardingGradualTitle: 'Más funciones se desbloquean gradualmente',
    onboardingGradualDescription: 'Durante los próximos 4 días, descubrirás nuevas funciones a medida que avances. ¡Sin sobrecarga de información!',
    onboardingDayProgress: 'Día {day} de {maxDay}',
    onboardingFeaturesUnlocked: 'funciones',
    onboardingNextUnlock: 'Próximo desbloqueo',

    // Feature Unlocks
    onboardingfocusTimerUnlockTitle: '🎯 ¡Temporizador de Enfoque Desbloqueado!',
    onboardingfocusTimerUnlockSubtitle: '¡Gran progreso!',
    onboardingfocusTimerDescription: 'Usa el temporizador Pomodoro para una concentración profunda. Establece 25 minutos, enfócate en una tarea, luego toma un descanso. ¡Perfecto para cerebros ADHD!',
    onboardingxpUnlockTitle: '✨ ¡Sistema XP Desbloqueado!',
    onboardingxpUnlockSubtitle: '¡Hora de gamificación!',
    onboardingxpDescription: 'Gana experiencia por completar hábitos, sesiones de enfoque y seguimiento del estado de ánimo. ¡Sube de nivel y desbloquea nuevos logros!',
    onboardingquestsUnlockTitle: '🎮 ¡Misiones Desbloqueadas!',
    onboardingquestsUnlockSubtitle: '¡Nuevos desafíos!',
    onboardingquestsDescription: 'Las misiones diarias y semanales añaden variedad a tu rutina. ¡Complétalas para obtener recompensas adicionales!',
    onboardingcompanionUnlockTitle: '💚 ¡Compañero Desbloqueado!',
    onboardingcompanionUnlockSubtitle: '¡Conoce a tu ayudante!',
    onboardingcompanionDescription: 'Tu compañero virtual crece contigo, celebra tus victorias y te apoya en los días difíciles. ¡Elige entre 5 tipos!',
    onboardingtasksUnlockTitle: '📝 ¡Tareas Desbloqueadas!',
    onboardingtasksUnlockSubtitle: '¡Acceso completo!',
    onboardingtasksDescription: 'Task Momentum ayuda a priorizar tareas específicamente para ADHD. El sistema recomienda qué hacer a continuación según la urgencia y tu energía.',
    onboardingchallengesUnlockTitle: '🏆 ¡Desafíos Desbloqueados!',
    onboardingchallengesUnlockSubtitle: '¡Acceso completo!',
    onboardingchallengesDescription: 'Únete a desafíos a largo plazo para desarrollar habilidades. ¡Rastrea el progreso y gana insignias exclusivas!',

    // Re-engagement (Welcome Back Modal)
    reengageTitle: '¡Bienvenido de vuelta!',
    reengageSubtitle: 'Has estado ausente {days} días',
    reengageStreakBroken: 'Estado de racha',
    reengageStreakProtected: '¡Racha protegida!',
    reengageStreakBrokenMsg: 'Tu racha se reinició, ¡pero puedes empezar de nuevo hoy! Racha anterior: {streak} días.',
    reengageStreakProtectedMsg: '¡Tu racha de {streak} días está a salvo! ¡Sigue adelante!',
    reengageBestHabits: 'Tus mejores hábitos',
    reengageSuccessRate: 'éxito',
    reengageQuickMood: '¿Cómo te sientes?',
    reengageMoodLogged: '¡Estado de ánimo registrado!',
    reengageContinue: '¡Continuar!',

    // Trends View (Long-term Analytics)
    trendsTitle: 'Tus Tendencias',
    trendsAvgMood: 'Ánimo Prom.',
    trendsHabitRate: 'Tasa Hábitos',
    trendsFocusTime: 'Enfoque',
    trendsMoodChart: 'Ánimo Con El Tiempo',
    trendsHabitChart: 'Completitud Hábitos',
    trendsFocusChart: 'Tiempo de Enfoque',
    trendsTotalFocus: 'Total',
    trendsInsightHint: '¿Quieres insights personalizados?',
    trendsInsightHintDesc: 'Consulta el panel de Insights en la pestaña principal para descubrir patrones en tus datos.',

    // Health Connect (v1.2.0)
    healthConnect: 'Health Connect',
    healthConnectDescription: 'Sincronizar con Google Health Connect',
    healthConnectLoading: 'Comprobando Health Connect...',
    healthConnectNotAvailable: 'No disponible en este dispositivo',
    healthConnectUpdateRequired: 'Por favor actualiza la app Health Connect',
    mindfulness: 'Atención plena',
    sleep: 'Sueño',
    steps: 'Pasos',
    stepsLabel: 'pasos',
    grantPermissions: 'Otorgar permisos',
    todayHealth: 'Salud de hoy',
    syncFocusSessions: 'Sincronizar sesiones de enfoque',
    syncFocusSessionsHint: 'Guardar sesiones de enfoque como atención plena en Health Connect',
    openHealthConnect: 'Abrir Health Connect',
    refresh: 'Actualizar',
    permissions: 'Permisos',

    // Quest Templates (para randomQuests.ts)
    questMorningMomentum: 'Impulso Matutino',
    questMorningMomentumDesc: 'Completa 3 hábitos antes de las 12:00',
    questHabitMaster: 'Maestro de Hábitos',
    questHabitMasterDesc: 'Completa 5 hábitos hoy',
    questSpeedDemon: 'Demonio de Velocidad',
    questSpeedDemonDesc: 'Completa 3 hábitos en 30 minutos',
    questFocusFlow: 'Flujo de Enfoque',
    questFocusFlowDesc: '30 minutos de enfoque sin descansos',
    questDeepWork: 'Trabajo Profundo',
    questDeepWorkDesc: '60 minutos de trabajo concentrado',
    questHyperfocusHero: 'Héroe de Hiperenfoque',
    questHyperfocusHeroDesc: '90 minutos en Modo Hiperenfoque',
    questStreakKeeper: 'Guardián de Racha',
    questStreakKeeperDesc: 'Mantén tu racha durante 7 días',
    questConsistencyKing: 'Rey de la Constancia',
    questConsistencyKingDesc: 'Mantén tu racha durante 14 días',
    questGratitudeSprint: 'Sprint de Gratitud',
    questGratitudeSprintDesc: 'Escribe 5 agradecimientos en 5 minutos',
    questThankfulHeart: 'Corazón Agradecido',
    questThankfulHeartDesc: 'Escribe 10 agradecimientos hoy',
    questLightningRound: 'Ronda Relámpago',
    questLightningRoundDesc: 'Completa 5 tareas rápidas en 15 minutos',
    questWeeklyWarrior: 'Guerrero Semanal',
    questWeeklyWarriorDesc: 'Completa hábitos 7 días seguidos',

    // Feedback System
    feedbackTitle: 'Enviar comentarios',
    feedbackSubtitle: 'Ayúdanos a mejorar la app',
    feedbackCategoryBug: 'Reportar error',
    feedbackCategoryFeature: 'Solicitar función',
    feedbackCategoryOther: 'Otro',
    feedbackMessagePlaceholder: 'Describe tu problema o sugerencia...',
    feedbackEmailPlaceholder: 'Email (opcional)',
    feedbackSubmit: 'Enviar',
    feedbackSuccess: '¡Gracias por tus comentarios!',
    feedbackError: 'Error al enviar. Intenta de nuevo.',
    feedbackSending: 'Enviando...',
    sendFeedback: 'Enviar comentarios',

    // App Rating
    rateAppTitle: '¿Te gusta ZenFlow?',
    rateAppSubtitle: 'Califícanos en Play Store',
    rateAppButton: 'Calificar',
    rateAppLater: 'Más tarde',

    // App Updates
    updateAvailable: 'Actualización disponible',
    updateDescription: 'Una nueva versión está lista para instalar con mejoras y correcciones.',
    updateDescriptionCritical: 'Se requiere una actualización crítica para continuar usando la app.',
    updateNow: 'Actualizar ahora',
    updateAvailableFor: 'Disponible hace {days} días',

    // Lock Screen Quick Actions
    quickActions: 'Acciones rápidas',
    quickActionsDescription: 'Mostrar notificación con acciones rápidas en pantalla de bloqueo',
    quickActionsEnabled: 'Acciones rápidas activadas',
    quickActionsDisabled: 'Acciones rápidas desactivadas',
    quickActionLogMood: 'Registrar estado',
    quickActionStartFocus: 'Iniciar enfoque',
    quickActionViewHabits: 'Ver hábitos',

    // Notification Sounds
    notificationSound: 'Sonido de notificación',
    notificationSoundDescription: 'Elige el sonido para recordatorios',
    soundDefault: 'Predeterminado',
    soundDefaultDesc: 'Sonido de notificación del sistema',
    soundGentle: 'Suave',
    soundGentleDesc: 'Solo vibración',
    soundChime: 'Timbre',
    soundChimeDesc: 'Tono de notificación corto',
    soundSilent: 'Silencioso',
    soundSilentDesc: 'Sin sonido ni vibración',
    testNotification: 'Notificación de prueba',
    testNotificationHint: 'Envía una notificación de prueba en 5 segundos para verificar que funcionan.',

    // Insight Card Details
    insightConfidence: 'Confianza',
    insightDataPoints: 'Puntos de datos',
    insightAvgMoodWith: 'Ánimo promedio con hábito',
    insightAvgMoodWithout: 'Ánimo promedio sin hábito',
    insightSampleDays: 'Días de muestra',
    insightBestActivity: 'Mejor actividad',
    insightPeakTime: 'Hora pico',
    insightAvgDuration: 'Duración promedio',
    insightSessions: 'Sesiones',
    insightTagOccurrences: 'Ocurrencias de etiqueta',
    insightMoodWithTag: 'Ánimo con etiqueta',
    insightMoodWithoutTag: 'Ánimo sin etiqueta',
    insightDisclaimer: 'Este insight se basa en tus datos. Los patrones pueden cambiar.',
    times: 'veces',

    // Stats Empty States
    noMoodDataYet: 'Sin datos de ánimo',
    noEmotionDataYet: 'Sin datos de emociones',

    // XP Display
    xp: 'XP',

    // AI Coach
    aiCoachTitle: 'Coach de IA',
    aiCoachSubtitle: 'Tu guía personal de bienestar',
    aiCoachWelcome: '¡Hola! ¿Cómo puedo ayudarte?',
    aiCoachPlaceholder: 'Escribe un mensaje...',
    aiCoachQuick1: 'Me siento estresado',
    aiCoachQuick2: 'Ayúdame a concentrarme',
    aiCoachQuick3: 'Necesito motivación',
    clearHistory: 'Borrar historial',
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

    // Mindfulness v1.5.0
    needInspiration: 'Brauchst du Inspiration?',
    journalPrompt: 'Frage',
    dailyPrompt: 'Tagesfrage',
    usePrompt: 'Diese Frage verwenden',
    shufflePrompt: 'Andere Frage',
    mindfulMoment: 'Achtsamer Moment',
    takeAMoment: 'Nimm dir einen Moment...',
    withNote: 'mit Notiz',
    whatsMakingYouFeel: 'Was lässt dich so fühlen?',
    emotionSaved: 'Emotion gespeichert',
    treat: 'Leckerli',
    moodGood: 'Gut',
    moodOkay: 'Okay',
    moodNotGreat: 'Nicht so gut',

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
    // Insight texts
    insightBestDayTitle: '{day}e sind deine besten Tage!',
    insightBestDayDesc: 'Deine Stimmung ist an {day}en meist am besten. Plane wichtige Aufgaben für diesen Tag.',
    insightBestTimeTitle: 'Du strahlst am hellsten am {period}',
    insightBestTimeDesc: 'Deine Stimmung ist am {period} meist besser. Plane anspruchsvolle Aufgaben für diese Zeit!',
    insightHabitBoostsTitle: '„{habit}" hebt deine Stimmung!',
    insightHabitBoostsDesc: 'Wenn du „{habit}" erledigst, ist deine Stimmung tendenziell {percent}% besser. Weiter so!',
    insightFocusMoodTitle: 'Fokuszeit = Bessere Stimmung!',
    insightFocusMoodDesc: 'An Tagen mit Fokus-Sitzungen ist deine Stimmung {percent}% besser. Tiefe Arbeit zahlt sich aus!',
    insightGratitudeMoodTitle: 'Dankbarkeit hebt deine Stimmung!',
    insightGratitudeMoodDesc: 'Tage mit Dankbarkeitseinträgen zeigen {percent}% bessere Stimmung. Mach weiter so!',
    insightMoodUpTitle: 'Deine Stimmung verbessert sich!',
    insightMoodUpDesc: 'Deine durchschnittliche Stimmung diese Woche ist {percent}% besser als letzte Woche. Du machst das großartig!',
    insightMoodDownTitle: 'Lass uns deine Stimmung heben!',
    insightMoodDownDesc: 'Deine Stimmung ist etwas gesunken. Konzentriere dich auf Gewohnheiten, die dir normalerweise gut tun.',
    insightHighConsistencyTitle: 'Erstaunliche Beständigkeit!',
    insightHighConsistencyDesc: 'Du hast deine Stimmung an {days} der letzten 14 Tage notiert. Dieses Selbstbewusstsein ist mächtig!',
    insightLowConsistencyTitle: 'Baue deine Notier-Gewohnheit auf',
    insightLowConsistencyDesc: 'Versuche, deine Stimmung jeden Tag zur gleichen Zeit zu notieren. Beständigkeit hilft, Muster zu erkennen!',

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
    // v1.4.0: Habit reminders and schedule
    addReminder: 'Hinzufügen',
    noReminders: 'Keine Erinnerungen',
    habitEventExplanation: 'Dieses Ereignis stammt aus deiner Gewohnheit. Bearbeite die Gewohnheit, um es zu ändern.',
    habitDurationMinutes: 'Minuten',

    // Focus timer
    focus: 'Fokus',
    breakTime: 'Pause',
    autoScheduled: 'Auto-geplant',
    taskEventExplanation: 'Dieser Block wird automatisch aus deinen Aufgaben erstellt. Schließe die Aufgabe ab, um ihn zu entfernen.',
    yourTasksNow: 'Deine Aufgaben jetzt',
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
    toLevel: 'Zum Level',
    unlockedPercent: '{percent}% Freigeschaltet',
    all: 'Alle',
    unlocked: 'Freigeschaltet',
    locked: 'Gesperrt',
    unlockedOn: 'Freigeschaltet am {date}',
    hiddenAchievement: '???',
    hidden: 'Versteckt',
    noAchievementsYet: 'Noch keine Erfolge',
    startUsingZenFlow: 'Beginne ZenFlow zu nutzen, um Erfolge freizuschalten!',
    achievementUnlocked: 'Erfolg freigeschaltet!',
    userLevel: 'Stufe',
    focusSession: 'Fokus-Sitzung',
    // TimeHelper
    timeBlindnessHelper: 'Zeitblindheit-Helfer',
    visualTimeAwareness: 'Visuelle Zeitwahrnehmung für ADHS',
    hoursMinutesLeft: '{hours}Std {mins}Min übrig',
    minutesLeft: '{mins}Min übrig',
    timesUp: 'Zeit ist um!',
    youllFinishAt: '🎯 Du wirst fertig um:',
    nMinutes: '{n} Minuten',
    pingEveryMinutes: 'Signal alle (Minuten)',
    audioPings: 'Audio-Signale',
    testSound: '🔊 Test',
    soundOn: 'An',
    soundOff: 'Aus',
    startTimer: 'Timer starten',
    pauseTimer: 'Pause',
    resetTimer: 'Zurücksetzen',
    adhdTimeManagement: 'ADHS Zeitmanagement',
    adhdTip1: 'Audio-Signale helfen, die Zeit zu verfolgen',
    adhdTip2: 'Visueller Countdown reduziert Angst',
    adhdTip3: 'Endzeit-Vorhersage = bessere Planung',
    adhdTip4: 'Farbwechsel warnen bei wenig Zeit',
    currentStreak: 'Aktuelle Serie',
    daysInRow: 'Tage am Stück',
    totalFocus: 'Gesamtfokus',
    allTime: 'Alle Zeit',
    habitsCompleted: 'Gewohnheiten abgeschlossen',
    totalTimes: 'Insgesamt Mal',
    moodDistribution: 'Stimmungsverteilung',
    moodHeatmap: 'Stimmungs-Heatmap',
    activityHeatmap: 'Aktivitätsübersicht',
    less: 'Weniger',
    more: 'Mehr',
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
    exportCSV: 'CSV exportieren',
    exportPDF: 'PDF exportieren',
    importSuccess: 'Import abgeschlossen.',
    importError: 'Dateiimport fehlgeschlagen.',
    importedItems: 'Hinzugefügt',
    importAdded: 'hinzugefügt',
    importUpdated: 'aktualisiert',
    importSkipped: 'übersprungen',
    textTooLong: 'Text ist zu lang (maximal 2000 Zeichen)',
    invalidInput: 'Bitte überprüfen Sie Ihre Eingabe',
    comingSoon: 'bald verfügbar',
    resetAllData: 'Alle Daten zurücksetzen',
    privacyTitle: 'Datenschutz',
    privacyDescription: 'Deine Daten bleiben auf dem Gerät. Kein verstecktes Tracking.',
    privacyNoTracking: 'Kein Tracking',
    privacyNoTrackingHint: 'Wir sammeln keine Verhaltensdaten.',
    privacyAnalytics: 'Analytik',
    privacyAnalyticsHint: 'Hilft, die App zu verbessern. Du kannst es deaktivieren.',
    privacyPolicy: 'Datenschutzerklaerung',
    termsOfService: 'Nutzungsbedingungen',

    // v1.2.0 Appearance
    appearance: 'Darstellung',
    oledDarkMode: 'OLED Dunkelmodus',
    oledDarkModeHint: 'Reines Schwarz für OLED-Bildschirme. Spart Akku.',

    // What's New Modal
    whatsNewTitle: 'Was ist neu',
    whatsNewVersion: 'Version',
    whatsNewGotIt: 'Verstanden!',

    // Accessibility
    skipToContent: 'Zum Hauptinhalt springen',

    // v1.1.1 Settings Redesign
    settingsCloudSyncTitle: 'Cloud-Sync aktivieren',
    settingsCloudSyncDescription: 'Synchronisiere deine Daten über Geräte',
    settingsCloudSyncEnabled: 'Cloud-Synchronisation aktiviert',
    settingsCloudSyncDisabledByUser: 'Synchronisation deaktiviert',
    settingsExportTitle: 'Backup exportieren',
    settingsExportDescription: 'Speichere alle deine Daten in einer Datei',
    settingsImportTitle: 'Backup importieren',
    settingsImportMergeTooltip: 'Importierte Daten werden zu bestehenden hinzugefügt. Duplikate übersprungen.',
    settingsImportReplaceTooltip: '⚠️ Alle aktuellen Daten werden gelöscht und durch Import ersetzt',
    settingsImportReplaceConfirm: 'Gib "REPLACE" ein, um das Löschen aller Daten zu bestätigen',
    // Import validation (v1.4.1)
    invalidFileType: 'Ungültiger Dateityp. JSON erforderlich.',
    fileTooLarge: 'Datei zu groß (max. 10 MB)',
    importConfirm: 'Import bestätigen',
    invalidBackupFormat: 'Ungültiges Backup-Format',
    settingsWhatsNewTitle: 'Was ist neu in v1.5.8',
    settingsWhatsNewLeaderboards: 'Bestenlisten',
    settingsWhatsNewLeaderboardsDesc: 'Anonym mit anderen konkurrieren',
    settingsWhatsNewSpotify: 'Spotify-Integration',
    settingsWhatsNewSpotifyDesc: 'Automatische Musikwiedergabe bei Fokus-Sessions',
    settingsWhatsNewChallenges: 'Freunde-Challenges',
    settingsWhatsNewChallengesDesc: 'Fordere Freunde heraus, gemeinsam Gewohnheiten aufzubauen',
    settingsWhatsNewDigest: 'Wöchentlicher Digest',
    settingsWhatsNewDigestDesc: 'Erhalte Fortschrittsberichte per E-Mail',
    settingsWhatsNewSecurity: 'Verbesserte Sicherheit',
    settingsWhatsNewSecurityDesc: 'Besserer Datenschutz & Privatsphäre',
    settingsWhatsNewGotIt: 'Verstanden!',
    // v1.5.8 What's New
    settingsWhatsNewFeatureToggles: 'Funktions-Schalter',
    settingsWhatsNewFeatureTogglesDesc: 'Module in Einstellungen aktivieren/deaktivieren',
    settingsWhatsNewBugFixes158: 'Fehlerbehebungen',
    settingsWhatsNewBugFixes158Desc: 'Sync-Probleme und Stabilität verbessert',
    settingsWhatsNewUIImprovements: 'UI-Verbesserungen',
    settingsWhatsNewUIImprovementsDesc: 'Bessere Schalter und Einstellungsorganisation',
    settingsSectionAccount: 'Konto & Cloud',
    settingsSectionData: 'Daten & Backup',

    // Weekly Digest (v1.3.0)
    weeklyDigestTitle: 'Wöchentlicher Fortschrittsbericht',
    weeklyDigestDescription: 'Erhalte jeden Sonntag eine Zusammenfassung deiner Gewohnheiten, Fokuszeit und Stimmungstrends.',
    weeklyDigestEnabled: 'Du erhältst Berichte per E-Mail',

    // Changelog
    changelogTitle: 'Versionshistorie',
    changelogExpandAll: 'Alle erweitern',
    changelogCollapseAll: 'Alle einklappen',
    changelogEmpty: 'Keine Versionshistorie verfügbar',
    changelogAdded: 'Hinzugefügt',
    changelogFixed: 'Behoben',
    changelogChanged: 'Geändert',
    changelogRemoved: 'Entfernt',

    // Settings Groups (v1.3.0)
    settingsGroupProfile: 'Profil & Erscheinung',
    settingsGroupNotifications: 'Benachrichtigungen',
    settingsGroupData: 'Daten & Datenschutz',
    settingsGroupAccount: 'Konto',
    settingsGroupAbout: 'Über',

    // Feature Toggles / Modules (v1.5.8)
    settingsGroupModules: 'Module',
    settingsModulesDescription: 'App-Funktionen aktivieren oder deaktivieren',
    settingsModuleMood: 'Stimmungs-Tracker',
    settingsModuleMoodDesc: 'Kernfunktion — immer aktiviert',
    settingsModuleHabits: 'Gewohnheiten',
    settingsModuleHabitsDesc: 'Kernfunktion — immer aktiviert',
    settingsModuleFocus: 'Fokus-Timer',
    settingsModuleFocusDesc: 'Pomodoro-Technik und Deep Work',
    settingsModuleBreathing: 'Atemübungen',
    settingsModuleBreathingDesc: 'Entspannungs- und Meditationstechniken',
    settingsModuleGratitude: 'Dankbarkeits-Tagebuch',
    settingsModuleGratitudeDesc: 'Notiere, wofür du dankbar bist',
    settingsModuleQuests: 'Quests',
    settingsModuleQuestsDesc: 'Tägliche Aufgaben und Belohnungen',
    settingsModuleTasks: 'Aufgaben',
    settingsModuleTasksDesc: 'To-do-Liste und Aufgabenverwaltung',
    settingsModuleChallenges: 'Challenges',
    settingsModuleChallengesDesc: 'Erfolge und Herausforderungen',
    settingsModuleAICoach: 'KI-Coach',
    settingsModuleAICoachDesc: 'Persönlicher KI-Assistent',
    settingsModuleGarden: 'Mein Garten',
    settingsModuleGardenDesc: 'Virtueller Garten und Begleiter',
    settingsModuleCoreLocked: 'Kernmodul',
    settingsModuleUnlockHint: 'Wird mit Fortschritt freigeschaltet',

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
    // App Updates (v1.4.1)
    checkForUpdates: 'Nach Updates suchen',
    checkingForUpdates: 'Suche nach Updates...',
    appUpToDate: 'Du hast die neueste Version',
    openGooglePlay: 'Google Play öffnen',
    updateCheckFailed: 'Update-Prüfung fehlgeschlagen',
    remindersTitle: 'Erinnerungen',
    remindersDescription: 'Sanfte Stupser um dich auf Kurs zu halten.',
    moodReminder: 'Stimmungs-Check Zeit',
    habitReminder: 'Gewohnheits-Erinnerung',
    focusReminder: 'Fokus-Erinnerung',
    quietHours: 'Ruhezeiten',
    reminderDays: 'Wochentage',
    selectedHabits: 'Gewohnheiten erinnern',
    noHabitsYet: 'Noch keine Gewohnheiten.',
    reminderMoodTitle: 'Hey, wie geht\'s? 💭',
    reminderMoodBody: '30 Sekunden für dein Gehirn. Wie fühlst du dich?',
    reminderHabitTitle: 'Mini-Gewohnheit Zeit! ✨',
    reminderHabitBody: 'Kleiner Schritt = großer Sieg. Los geht\'s?',
    reminderFocusTitle: 'Fokus-Power! 🎯',
    reminderFocusBody: 'Nur 25 Minuten zum Helden-Modus. Bereit?',
    reminderDismiss: 'Jetzt nicht',
    notificationPermissionTitle: 'Bleib auf Kurs',
    notificationPermissionDescription: 'Erhalte sanfte Erinnerungen, um deine Stimmung zu erfassen, Gewohnheiten abzuschließen und Fokuspausen einzulegen. Benachrichtigungen helfen dir, gesunde Routinen aufzubauen.',
    notificationFeature1Title: 'Tägliche Stimmungserinnerungen',
    notificationFeature1Desc: 'Checke jeden Tag bei dir selbst ein',
    notificationFeature2Title: 'Gewohnheits-Tracking',
    notificationFeature2Desc: 'Bleib konsequent bei deinen Zielen',
    notificationFeature3Title: 'Fokus-Sitzungen',
    notificationFeature3Desc: 'Werde an produktive Pausen erinnert',
    notificationAllow: 'Benachrichtigungen aktivieren',
    notificationDeny: 'Vielleicht später',
    notificationPrivacyNote: 'Du kannst dies jederzeit in den Einstellungen ändern. Benachrichtigungen sind lokal und privat.',
    onboardingStep: 'Schritt',
    onboardingValueTitle: 'Erfasse Stimmung + Gewohnheiten in 30 Sekunden täglich',
    onboardingValueBody: 'Schnelle Check-ins, kein Chaos, völlig privat.',
    onboardingStart: 'In 30 Sek starten',
    onboardingExplore: 'Erkunden',
    onboardingGoalTitle: 'Wähle deinen Fokus',
    onboardingGoalLessStress: 'Weniger Stress',
    onboardingGoalLessStressDesc: 'Ruhige und sanfte Gewohnheiten',
    onboardingGoalMoreEnergy: 'Mehr Energie',
    onboardingGoalMoreEnergyDesc: 'Schlaf, Bewegung, Flüssigkeit',
    onboardingGoalBetterRoutine: 'Bessere Routine',
    onboardingGoalBetterRoutineDesc: 'Stabilität und Rhythmus',
    onboardingContinue: 'Weiter',
    onboardingCheckinTitle: 'Schneller Check-in',
    onboardingHabitsPrompt: 'Wähle zwei Gewohnheiten',
    onboardingPickTwo: 'Wähle bis zu zwei',
    onboardingReminderTitle: 'Erinnerungen aktivieren',
    onboardingReminderBody: 'Wähle eine Zeit, die dir passt. Kein Spam.',
    onboardingMorning: 'Morgens',
    onboardingEvening: 'Abends',
    onboardingEnable: 'Aktivieren',
    onboardingSkip: 'Jetzt überspringen',
    onboardingHabitBreathing: 'Atmen',
    onboardingHabitEveningWalk: 'Abendspaziergang',
    onboardingHabitStretch: 'Dehnen',
    onboardingHabitJournaling: 'Tagebuch schreiben',
    onboardingHabitWater: 'Wasser trinken',
    onboardingHabitSunlight: 'Sonnenlicht',
    onboardingHabitMovement: 'Bewegung',
    onboardingHabitSleepOnTime: 'Rechtzeitig schlafen',
    onboardingHabitMorningPlan: 'Morgenplanung',
    onboardingHabitRead: '10 Min lesen',
    onboardingHabitNoScreens: 'Keine späten Bildschirme',
    onboardingHabitDailyReview: 'Tägliche Überprüfung',
    account: 'Konto',
    accountDescription: 'Melden Sie sich mit E-Mail an, um Ihren Fortschritt zwischen Geräten zu synchronisieren.',
    emailPlaceholder: 'ihre@email.com',
    sendMagicLink: 'Anmeldelink senden',
    continueWithGoogle: 'Mit Google fortfahren',
    signedInAs: 'Angemeldet als',
    signOut: 'Abmelden',
    syncNow: 'Jetzt synchronisieren',
    cloudSyncDisabled: 'Cloud-Synchronisierung deaktiviert.',
    deleteAccount: 'Konto löschen',
    deleteAccountConfirm: 'Konto löschen?',
    deleteAccountTypeConfirm: 'Geben Sie DELETE zur Bestätigung ein:',
    deleteAccountWarning: 'Dabei werden Cloud-Daten und der Zugriff auf das Konto entfernt.',
    deleteAccountSuccess: 'Konto gelöscht.',
    deleteAccountError: 'Konto konnte nicht gelöscht werden.',
    deleteAccountLink: 'Konto/Daten löschen',
    authEmailSent: 'Anmeldelink wurde an Ihre E-Mail gesendet.',
    authSignedOut: 'Abgemeldet.',
    authError: 'Link konnte nicht gesendet werden.',
    authNotConfigured: 'Supabase nicht konfiguriert.',
    syncSuccess: 'Synchronisierung abgeschlossen.',
    syncPulled: 'Cloud-Daten wiederhergestellt.',
    syncPushed: 'Cloud aktualisiert.',
    syncError: 'Synchronisierung fehlgeschlagen.',
    authGateTitle: 'Anmelden',
    authGateBody: 'Melden Sie sich mit E-Mail an, um Fortschritt zu speichern und zwischen Geräten zu synchronisieren.',
    authGateContinue: 'Ohne Konto fortfahren',
    errorBoundaryTitle: 'Etwas ist schief gelaufen',
    errorBoundaryBody: 'Versuchen Sie die App neu zu laden oder exportieren Sie einen Debug-Bericht.',
    errorBoundaryExport: 'Debug-Bericht exportieren',
    errorBoundaryReload: 'App neu laden',
    pushTitle: 'Push-Benachrichtigungen',
    pushEnable: 'Push aktivieren',
    pushDisable: 'Push deaktivieren',
    pushTest: 'Push testen',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Test-Benachrichtigung.',
    pushTestSent: 'Test gesendet.',
    pushTestError: 'Test konnte nicht gesendet werden.',
    pushNowMood: 'Push: Stimmung',
    pushNowHabit: 'Push: Gewohnheiten',
    pushNowFocus: 'Push: Fokus',
    pushEnabled: 'Push aktiviert.',
    pushDisabled: 'Push deaktiviert.',
    pushError: 'Push konnte nicht aktiviert werden.',
    pushNeedsAccount: 'Melden Sie sich an, um Push zu aktivieren.',
    pushPermissionDenied: 'Benachrichtigungsberechtigung verweigert.',
    areYouSure: 'Bist du sicher?',
    cannotBeUndone: 'Diese Aktion kann nicht rückgängig gemacht werden.',
    delete: 'Löschen',
    shareAchievements: 'Fortschritt teilen',
    shareDialogTitle: 'Teile deinen Fortschritt',
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
    shareFailed: 'Teilen fehlgeschlagen. Bitte erneut versuchen.',
    shareAchievement30: 'Legendär!',
    shareAchievement14: 'Unaufhaltsam!',
    shareAchievement7: 'In Flammen!',
    shareAchievement3: 'Aufsteigender Stern!',
    shareAchievementStart: 'Gerade gestartet!',
    shareSubtext30: '30+ Tage Meister',
    shareSubtext14: '14+ Tage Krieger',
    shareSubtext7: '7+ Tage Serie',
    shareSubtext3: '3+ Tage Serie',
    shareSubtextStart: 'Gewohnheiten aufbauen',
    dismiss: 'Schließen',
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

    // Friend Challenges
    friendChallenges: 'Freundes-Herausforderungen',
    createChallenge: 'Herausforderung erstellen',
    challengeDescription: 'Fordere Freunde heraus, gemeinsam Gewohnheiten aufzubauen',
    challengeYourFriends: 'Fordere deine Freunde zu dieser Gewohnheit heraus!',
    challengeDuration: 'Dauer der Herausforderung',
    challengeCreated: 'Herausforderung erstellt!',
    challengeDetails: 'Details der Herausforderung',
    shareToInvite: 'Teilen, um Freunde einzuladen!',
    trackWithFriends: 'Verfolge deine Herausforderungen mit Freunden',
    challengeCode: 'Herausforderungscode',
    yourProgress: 'Dein Fortschritt',
    daysLeft: 'Tage übrig',
    dayChallenge: 'Tage-Herausforderung',
    challengeCompleted: 'Herausforderung abgeschlossen!',
    noChallenges: 'Noch keine Herausforderungen',
    createChallengePrompt: 'Erstelle eine Herausforderung aus jeder Gewohnheit!',
    completedChallenges: 'Abgeschlossen',
    expiredChallenges: 'Abgelaufen',
    youCreated: 'Du hast erstellt',
    createdBy: 'Erstellt von',
    confirmDeleteChallenge: 'Diese Herausforderung löschen?',
    challengeInvite: 'Nimm an meiner Herausforderung teil!',
    challengeJoinPrompt: 'Mach mit bei ZenFlow!',
    challengeShareTip: 'Du kannst diese Herausforderung nach dem Erstellen mit Freunden teilen.',

    // Friend Challenges - Join
    joinChallenge: 'Herausforderung beitreten',
    enterChallengeCode: 'Gib den Code deines Freundes ein',
    invalidChallengeCode: 'Ungültiger Code. Format: ZEN-XXXXXX',
    enterCodeToJoin: 'Gib einen Code ein, um beizutreten',
    joinChallengeHint: 'Bitte deinen Freund, den Code zu teilen',
    joining: 'Beitritt...',
    join: 'Beitreten',

    // Friend Challenges v2
    challengeWon: '🎉 Fantastisch! Du hast die Herausforderung abgeschlossen!',
    catchUp: '💪 Du kannst aufholen! Jeder Tag zählt!',
    aheadOfSchedule: '⭐ Tolles Tempo! Du bist dem Zeitplan voraus!',
    daysPassed: 'Tage vergangen',
    daysCompleted: 'Abgeschlossen',
    daysRemaining: 'Verbleibend',

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
    onboardingAgeTitle: 'Willkommen bei ZenFlow',
    onboardingAgeDesc: 'Diese App ist für Benutzer ab 13 Jahren gedacht',
    onboardingAgeConfirm: 'Ich bin 13 Jahre oder älter',
    onboardingAgeNote: 'Mit dem Fortfahren bestätigst du, dass du 13 Jahre oder älter bist',
    healthConnectAgeDesc: 'Health Connect-Funktionen erfordern ein Alter von 13 Jahren oder älter für einen verantwortungsvollen Umgang mit Gesundheitsdaten.',
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
    tutorialFeature2b: '✨ Symbole, Farben & Ziele anpassen!',
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
    weeklyStory: 'Wochengeschichte',
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
    // Weekly Story translations (ProgressStoriesViewer)
    storyAverageMoodScore: 'durchschnittliche Stimmung',
    storyCompletionRate: 'Abschlussrate',
    storyTopHabit: 'Top Gewohnheit',
    storyCompletions: 'Abschlüsse',
    storyPerfectDays: 'perfekte Tage diese Woche',
    storyAvgSession: 'Durchschn.',
    storyLongestSession: 'längste',
    storyMostFocusedOn: 'Am meisten fokussiert auf:',
    storyTrackYourJourney: 'Verfolge deine Reise mit',
    storyTapLeft: '← Links tippen',
    storyTapCenter: 'Mitte tippen zum Pausieren',
    storyTapRight: 'Rechts tippen →',
    generating: 'Generieren...',

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
    // Companion Notifications
    companionMissesYou: 'Hey! Ich vermisse dich! 💕',
    companionWantsToPlay: 'Lust vorbeizuschauen? Hier ist\'s lustig! 🎉',
    companionWaiting: 'Ich warte auf dich! Hab was Cooles 🌱',
    companionProud: 'DU BIST SUPER! So stolz! ⭐',
    companionCheersYou: 'Los los los! Du schaffst das! 💪',
    companionQuickMood: 'Psst! Wie läuft\'s? Tipp hier! 😊',

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

    // Completed sections
    expand: 'Erweitern',
    collapse: 'Einklappen',
    moodRecordedShort: 'Stimmung erfasst',
    habitsCompletedShort: 'Gewohnheiten erledigt',
    focusCompletedShort: 'Fokus abgeschlossen',
    gratitudeAddedShort: 'Dankbarkeit hinzugefügt',

    // All complete celebration
    allComplete: 'Alles erledigt!',
    allCompleteMessage: 'Du hast alle Aktivitäten für heute abgeschlossen',
    allCompleteSupportive: 'Bis morgen!',
    allCompleteLegend: 'Legendärer Tag!',
    allCompleteAmazing: 'Unglaublich!',
    allCompleteGreat: 'Tolle Arbeit!',
    allCompleteNice: 'Gute Arbeit!',
    daysStreak: 'Tage in Folge',
    restDaySupportive: 'Morgen machen wir zusammen weiter 💚',
    restDayCooldown: 'Ruhetag wurde kürzlich genutzt',
    restDayAvailableIn: 'Verfügbar in',

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

    // Header Quick Actions
    tasks: 'Aufgaben',
    quests: 'Quests',
    challenges: 'Herausforderungen',
    openTasks: 'Aufgaben öffnen',
    openQuests: 'Quests öffnen',
    openChallenges: 'Herausforderungen öffnen',

    // QuestsPanel UI
    randomQuests: 'Zufällige Quests',
    questsPanelSubtitle: 'Schließe Quests ab für Bonus-XP und exklusive Abzeichen',
    adhdEngagementSystem: 'ADHS-Engagement-System',
    adhdEngagementDesc: 'Quests bieten Abwechslung und unerwartete Belohnungen - perfekt für ADHS-Gehirne, die Neuheit suchen!',
    dailyQuest: 'Täglicher Quest',
    weeklyQuest: 'Wöchentlicher Quest',
    bonusQuest: 'Bonus-Quest',
    newQuest: 'Neuer Quest',
    limitedTime: 'Begrenzte Zeit',
    generate: 'Generieren',
    noQuestAvailable: 'Kein Quest verfügbar',
    noBonusQuestAvailable: 'Kein Bonus-Quest verfügbar',
    bonusQuestsHint: 'Bonus-Quests erscheinen zufällig oder können manuell generiert werden',
    questProgress: 'Fortschritt:',
    questExpired: 'Abgelaufen',
    questType: 'Quest',
    questTips: 'Quest-Tipps',
    questTipDaily: 'Tägliche Quests werden alle 24 Stunden zurückgesetzt',
    questTipWeekly: 'Wöchentliche Quests bieten 3x XP',
    questTipBonus: 'Bonus-Quests sind selten mit 5x XP',
    questTipExpire: 'Schließe Quests ab, bevor sie ablaufen!',

    // Companion
    companionHungry: 'Ich bin hungrig... Fütterst du mich?',

    // Common actions
    back: 'Zurück',
    start: 'Starten',
    stop: 'Stopp',

    // Celebrations
    allHabitsComplete: 'Alle Gewohnheiten erledigt!',
    amazingWork: 'Tolle Arbeit heute!',

    // 404 page
    pageNotFound: 'Seite nicht gefunden',
    goHome: 'Zur Startseite',

    // Insights
    insightsTitle: 'Persönliche Einblicke',
    insightsNotEnoughData: 'Verfolge deine Stimmung, Gewohnheiten und Fokus eine Woche lang, um personalisierte Einblicke in deine Muster freizuschalten.',
    insightsNoPatterns: 'Noch keine starken Muster erkannt. Verfolge weiterhin konsequent, um herauszufinden, was am besten für dich funktioniert!',
    insightsHelpTitle: 'Über Einblicke',
    insightsHelp1: 'Einblicke werden aus deinen persönlichen Daten mithilfe statistischer Analysen generiert.',
    insightsHelp2: 'Die gesamte Analyse erfolgt lokal auf deinem Gerät - deine Daten verlassen es nie.',
    insightsHelp3: 'Muster mit höherer Zuverlässigkeit werden zuerst angezeigt.',
    insightsDismiss: 'Ausblenden',
    insightsShowMore: 'Mehr anzeigen',
    insightsShowLess: 'Weniger anzeigen',
    insightsDismissedCount: 'Einblicke ausgeblendet',
    insightsMoodEntries: 'Stimmungseinträge',
    insightsHabitCount: 'Gewohnheit',
    insightsFocusSessions: 'Fokus-Sitzungen',

    // Weekly Insights (v1.5.0)
    weeklyInsights: 'Wochen-Einblicke',
    weeklyInsightsNotEnoughData: 'Verfolge deinen Fortschritt diese Woche, um personalisierte Einblicke und Empfehlungen freizuschalten.',
    comparedToLastWeek: 'Im Vergleich zur letzten Woche',
    recommendations: 'Empfehlungen',
    avgMood: 'Ø Stimmung',
    week: 'Woche',
    // Recommendation translations
    recLowMoodTitle: 'Stimmung braucht Aufmerksamkeit',
    recLowMoodDesc: 'Deine Stimmung war diese Woche niedriger als gewöhnlich. Versuche Aktivitäten, die dich normalerweise aufheitern.',
    recLowMoodAction: 'Probiere eine 5-minütige Atemübung',
    recHabitDeclineTitle: 'Gewohnheiten sind gesunken',
    recHabitDeclineDesc: 'Deine Gewohnheitserfüllung ist im Vergleich zur letzten Woche gesunken. Fang klein an, um wieder Schwung zu bekommen.',
    recHabitDeclineAction: 'Konzentriere dich heute auf eine Gewohnheit',
    recLowFocusTitle: 'Steigere deine Fokuszeit',
    recLowFocusDesc: 'Du hattest diese Woche wenige Fokus-Sitzungen. Selbst kurze Sitzungen helfen, die Gewohnheit aufzubauen.',
    recLowFocusAction: 'Probiere eine 10-minütige Fokus-Sitzung',
    recGreatProgressTitle: 'Du bist auf dem Vormarsch!',
    recGreatProgressDesc: 'Dein Fortschritt verbessert sich im Vergleich zur letzten Woche. Weiter so!',
    recBestDayTitle: 'Das war dein bester Tag',
    recBestDayDesc: 'Versuche herauszufinden, was diesen Tag besonders gemacht hat, und wiederhole diese Bedingungen.',
    recGratitudeTitle: 'Übe Dankbarkeit',
    recGratitudeDesc: 'Das Aufschreiben von Dingen, für die du dankbar bist, kann deine Stimmung langfristig verbessern.',
    recGratitudeAction: 'Füge heute einen Dankbarkeitseintrag hinzu',
    recPerfectWeekTitle: 'Erstaunliche Beständigkeit!',
    recPerfectWeekDesc: 'Du hast die meisten deiner Gewohnheiten diese Woche erfüllt. Du baust starke Routinen auf!',
    recTopHabitTitle: 'Behalte diese Gewohnheit bei',
    recTopHabitDesc: 'Dies ist eine deiner beständigsten Gewohnheiten. Sie trägt wahrscheinlich zu deinem Wohlbefinden bei.',

    // Smart Reminders
    smartReminders: 'Smarte Erinnerungen',
    smartRemindersNotEnoughData: 'Nutze die App weiter, um personalisierte Erinnerungsvorschläge basierend auf deinen Mustern zu erhalten.',
    smartRemindersOptimized: 'Deine Erinnerungszeiten sind gut optimiert! Weiter so.',
    smartRemindersDescription: 'Personalisierte Vorschläge basierend auf deinen Nutzungsmustern',
    suggestions: 'Vorschläge',
    highConfidence: 'Hohe Sicherheit',
    mediumConfidence: 'Mittel',
    lowConfidence: 'Vorschlag',
    apply: 'Anwenden',
    habitRemindersOptimal: 'Optimale Gewohnheitszeiten',
    patternBased: 'Muster',

    // Sync status
    syncOffline: 'Offline',
    syncSyncing: 'Synchronisierung',
    syncLastSync: 'Synchronisiert',
    syncReady: 'Bereit zur Synchronisierung',
    syncBackup: 'Sicherung',
    syncReminders: 'Erinnerungen',
    syncChallenges: 'Herausforderungen',
    syncTasks: 'Aufgaben',
    syncInnerWorld: 'Fortschritt',
    syncBadges: 'Abzeichen',

    // Progressive Onboarding
    onboardingTryNow: 'Jetzt ausprobieren',
    onboardingGotIt: 'Verstanden!',
    onboardingNext: 'Weiter',
    onboardingGetStarted: 'Los geht\'s!',
    onboardingWelcomeTitle: 'Willkommen bei ZenFlow! 🌱',
    onboardingWelcomeDescription: 'Wir freuen uns, dir zu helfen, bessere Gewohnheiten aufzubauen und zu verstehen, was für DEIN Gehirn funktioniert.',
    onboardingDay1Title: 'Fangen wir einfach an',
    onboardingDay1Description: 'Heute konzentrieren wir uns nur auf zwei Dinge: deine Stimmung verfolgen und deine erste Gewohnheit erstellen. Nichts Überwältigendes.',
    onboardingGradualTitle: 'Mehr Funktionen werden schrittweise freigeschaltet',
    onboardingGradualDescription: 'In den nächsten 4 Tagen wirst du neue Funktionen entdecken, während du Fortschritte machst. Keine Informationsüberflutung!',
    onboardingDayProgress: 'Tag {day} von {maxDay}',
    onboardingFeaturesUnlocked: 'Funktionen',
    onboardingNextUnlock: 'Nächste Freischaltung',

    // Feature Unlocks
    onboardingfocusTimerUnlockTitle: '🎯 Fokus-Timer freigeschaltet!',
    onboardingfocusTimerUnlockSubtitle: 'Toller Fortschritt!',
    onboardingfocusTimerDescription: 'Nutze den Pomodoro-Timer für tiefe Konzentration. Stelle 25 Minuten ein, konzentriere dich auf eine Aufgabe, dann mache eine Pause. Perfekt für ADHD-Gehirne!',
    onboardingxpUnlockTitle: '✨ XP-System freigeschaltet!',
    onboardingxpUnlockSubtitle: 'Zeit für Gamification!',
    onboardingxpDescription: 'Sammle Erfahrung für das Abschließen von Gewohnheiten, Fokus-Sitzungen und Stimmungsaufzeichnung. Steige auf und schalte neue Erfolge frei!',
    onboardingquestsUnlockTitle: '🎮 Quests freigeschaltet!',
    onboardingquestsUnlockSubtitle: 'Neue Herausforderungen!',
    onboardingquestsDescription: 'Tägliche und wöchentliche Quests bringen Abwechslung in deine Routine. Erledige sie für Bonusbelohnungen!',
    onboardingcompanionUnlockTitle: '💚 Begleiter freigeschaltet!',
    onboardingcompanionUnlockSubtitle: 'Lerne deinen Helfer kennen!',
    onboardingcompanionDescription: 'Dein virtueller Begleiter wächst mit dir, feiert Siege und unterstützt dich an schwierigen Tagen. Wähle aus 5 Typen!',
    onboardingtasksUnlockTitle: '📝 Aufgaben freigeschaltet!',
    onboardingtasksUnlockSubtitle: 'Vollzugriff!',
    onboardingtasksDescription: 'Task Momentum hilft, Aufgaben speziell für ADHD zu priorisieren. Das System empfiehlt, was als Nächstes zu tun ist, basierend auf Dringlichkeit und deiner Energie.',
    onboardingchallengesUnlockTitle: '🏆 Herausforderungen freigeschaltet!',
    onboardingchallengesUnlockSubtitle: 'Vollzugriff!',
    onboardingchallengesDescription: 'Nimm an langfristigen Herausforderungen teil, um Fähigkeiten zu entwickeln. Verfolge den Fortschritt und verdiene exklusive Abzeichen!',

    // Re-engagement (Welcome Back Modal)
    reengageTitle: 'Willkommen zurück!',
    reengageSubtitle: 'Du warst {days} Tage abwesend',
    reengageStreakBroken: 'Streak-Status',
    reengageStreakProtected: 'Streak geschützt!',
    reengageStreakBrokenMsg: 'Dein Streak wurde zurückgesetzt, aber du kannst heute neu beginnen! Vorheriger Streak: {streak} Tage.',
    reengageStreakProtectedMsg: 'Dein {streak}-Tage-Streak ist sicher! Weiter so!',
    reengageBestHabits: 'Deine besten Gewohnheiten',
    reengageSuccessRate: 'Erfolg',
    reengageQuickMood: 'Wie fühlst du dich?',
    reengageMoodLogged: 'Stimmung aufgezeichnet!',
    reengageContinue: 'Weiter geht\'s!',

    // Trends View (Long-term Analytics)
    trendsTitle: 'Deine Trends',
    trendsAvgMood: 'Durchschn. Stimmung',
    trendsHabitRate: 'Gewohnheitsrate',
    trendsFocusTime: 'Fokus',
    trendsMoodChart: 'Stimmung im Zeitverlauf',
    trendsHabitChart: 'Gewohnheitsabschluss',
    trendsFocusChart: 'Fokuszeit',
    trendsTotalFocus: 'Gesamt',
    trendsInsightHint: 'Möchtest du personalisierte Insights?',
    trendsInsightHintDesc: 'Schaue dir das Insights-Panel auf der Startseite an, um Muster in deinen Daten zu entdecken.',

    // Health Connect (v1.2.0)
    healthConnect: 'Health Connect',
    healthConnectDescription: 'Mit Google Health Connect synchronisieren',
    healthConnectLoading: 'Health Connect wird überprüft...',
    healthConnectNotAvailable: 'Auf diesem Gerät nicht verfügbar',
    healthConnectUpdateRequired: 'Bitte aktualisiere die Health Connect App',
    mindfulness: 'Achtsamkeit',
    sleep: 'Schlaf',
    steps: 'Schritte',
    stepsLabel: 'Schritte',
    grantPermissions: 'Berechtigungen erteilen',
    todayHealth: 'Gesundheit heute',
    syncFocusSessions: 'Fokus-Sitzungen synchronisieren',
    syncFocusSessionsHint: 'Fokus-Sitzungen als Achtsamkeit in Health Connect speichern',
    openHealthConnect: 'Health Connect öffnen',
    refresh: 'Aktualisieren',
    permissions: 'Berechtigungen',

    // Quest Templates (für randomQuests.ts)
    questMorningMomentum: 'Morgen-Schwung',
    questMorningMomentumDesc: 'Erledige 3 Gewohnheiten vor 12:00 Uhr',
    questHabitMaster: 'Gewohnheitsmeister',
    questHabitMasterDesc: 'Erledige heute 5 Gewohnheiten',
    questSpeedDemon: 'Geschwindigkeitsdämon',
    questSpeedDemonDesc: 'Erledige 3 Gewohnheiten in 30 Minuten',
    questFocusFlow: 'Fokus-Fluss',
    questFocusFlowDesc: '30 Minuten Fokus ohne Pausen',
    questDeepWork: 'Tiefenarbeit',
    questDeepWorkDesc: '60 Minuten konzentrierte Arbeit',
    questHyperfocusHero: 'Hyperfokus-Held',
    questHyperfocusHeroDesc: '90 Minuten im Hyperfokus-Modus',
    questStreakKeeper: 'Streak-Hüter',
    questStreakKeeperDesc: 'Halte deinen Streak 7 Tage lang',
    questConsistencyKing: 'König der Beständigkeit',
    questConsistencyKingDesc: 'Halte deinen Streak 14 Tage lang',
    questGratitudeSprint: 'Dankbarkeits-Sprint',
    questGratitudeSprintDesc: 'Schreibe 5 Dankbarkeiten in 5 Minuten',
    questThankfulHeart: 'Dankbares Herz',
    questThankfulHeartDesc: 'Schreibe heute 10 Dankbarkeiten',
    questLightningRound: 'Blitz-Runde',
    questLightningRoundDesc: 'Erledige 5 schnelle Aufgaben in 15 Minuten',
    questWeeklyWarrior: 'Wöchentlicher Krieger',
    questWeeklyWarriorDesc: 'Erledige 7 Tage lang Gewohnheiten',

    // Feedback System
    feedbackTitle: 'Feedback senden',
    feedbackSubtitle: 'Hilf uns, die App zu verbessern',
    feedbackCategoryBug: 'Fehler melden',
    feedbackCategoryFeature: 'Funktion vorschlagen',
    feedbackCategoryOther: 'Sonstiges',
    feedbackMessagePlaceholder: 'Beschreibe dein Problem oder deinen Vorschlag...',
    feedbackEmailPlaceholder: 'E-Mail (optional)',
    feedbackSubmit: 'Senden',
    feedbackSuccess: 'Danke für dein Feedback!',
    feedbackError: 'Senden fehlgeschlagen. Versuche es erneut.',
    feedbackSending: 'Wird gesendet...',
    sendFeedback: 'Feedback senden',

    // App Rating
    rateAppTitle: 'Gefällt dir ZenFlow?',
    rateAppSubtitle: 'Bewerte uns im Play Store',
    rateAppButton: 'Bewerten',
    rateAppLater: 'Später',

    // App Updates
    updateAvailable: 'Update verfügbar',
    updateDescription: 'Eine neue Version mit Verbesserungen und Fehlerbehebungen ist bereit zur Installation.',
    updateDescriptionCritical: 'Ein kritisches Update ist erforderlich, um die App weiter zu nutzen.',
    updateNow: 'Jetzt aktualisieren',
    updateAvailableFor: 'Seit {days} Tagen verfügbar',

    // Lock Screen Quick Actions
    quickActions: 'Schnellaktionen',
    quickActionsDescription: 'Benachrichtigung mit Schnellaktionen auf dem Sperrbildschirm anzeigen',
    quickActionsEnabled: 'Schnellaktionen aktiviert',
    quickActionsDisabled: 'Schnellaktionen deaktiviert',
    quickActionLogMood: 'Stimmung erfassen',
    quickActionStartFocus: 'Fokus starten',
    quickActionViewHabits: 'Gewohnheiten',

    // Notification Sounds
    notificationSound: 'Benachrichtigungston',
    notificationSoundDescription: 'Wähle den Ton für Erinnerungen',
    soundDefault: 'Standard',
    soundDefaultDesc: 'System-Benachrichtigungston',
    soundGentle: 'Sanft',
    soundGentleDesc: 'Nur Vibration',
    soundChime: 'Klingel',
    soundChimeDesc: 'Kurzer Benachrichtigungston',
    soundSilent: 'Lautlos',
    soundSilentDesc: 'Kein Ton oder Vibration',
    testNotification: 'Testbenachrichtigung',
    testNotificationHint: 'Sendet in 5 Sekunden eine Testbenachrichtigung zur Überprüfung.',

    // Insight Card Details
    insightConfidence: 'Vertrauen',
    insightDataPoints: 'Datenpunkte',
    insightAvgMoodWith: 'Durchschn. Stimmung mit Gewohnheit',
    insightAvgMoodWithout: 'Durchschn. Stimmung ohne Gewohnheit',
    insightSampleDays: 'Stichprobentage',
    insightBestActivity: 'Beste Aktivität',
    insightPeakTime: 'Spitzenzeit',
    insightAvgDuration: 'Durchschn. Dauer',
    insightSessions: 'Sitzungen',
    insightTagOccurrences: 'Tag-Vorkommen',
    insightMoodWithTag: 'Stimmung mit Tag',
    insightMoodWithoutTag: 'Stimmung ohne Tag',
    insightDisclaimer: 'Dieser Einblick basiert auf deinen Daten. Muster können sich ändern.',
    times: 'Mal',

    // Stats Empty States
    noMoodDataYet: 'Noch keine Stimmungsdaten',
    noEmotionDataYet: 'Noch keine Emotionsdaten',

    // XP Display
    xp: 'XP',

    // AI Coach
    aiCoachTitle: 'AI Coach',
    aiCoachSubtitle: 'Dein persönlicher Wellness-Guide',
    aiCoachWelcome: 'Hallo! Wie kann ich dir helfen?',
    aiCoachPlaceholder: 'Nachricht eingeben...',
    aiCoachQuick1: 'Ich fühle mich gestresst',
    aiCoachQuick2: 'Hilf mir, mich zu konzentrieren',
    aiCoachQuick3: 'Motivation gebraucht',
    clearHistory: 'Verlauf löschen',
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

    // Mindfulness v1.5.0
    needInspiration: 'Besoin d\'inspiration?',
    journalPrompt: 'Question',
    dailyPrompt: 'Question du Jour',
    usePrompt: 'Utiliser cette question',
    shufflePrompt: 'Autre question',
    mindfulMoment: 'Moment de pleine conscience',
    takeAMoment: 'Prends un moment...',
    withNote: 'avec note',
    whatsMakingYouFeel: 'Qu\'est-ce qui te fait ressentir cela?',
    emotionSaved: 'Émotion enregistrée',
    treat: 'friandise',
    moodGood: 'Bien',
    moodOkay: 'Correct',
    moodNotGreat: 'Pas très bien',

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
    // Insight texts
    insightBestDayTitle: 'Les {day}s sont vos meilleurs jours !',
    insightBestDayDesc: 'Votre humeur tend à être meilleure les {day}s. Planifiez les tâches importantes ce jour-là.',
    insightBestTimeTitle: 'Vous brillez le plus le {period}',
    insightBestTimeDesc: 'Votre humeur est généralement meilleure le {period}. Planifiez les tâches exigeantes à ce moment !',
    insightHabitBoostsTitle: '« {habit} » améliore votre humeur !',
    insightHabitBoostsDesc: 'Quand vous complétez « {habit} », votre humeur tend à être {percent}% meilleure. Continuez !',
    insightFocusMoodTitle: 'Focus = Meilleure humeur !',
    insightFocusMoodDesc: 'Les jours avec des sessions de focus, votre humeur est {percent}% meilleure. Le travail profond paie !',
    insightGratitudeMoodTitle: 'La gratitude améliore votre humeur !',
    insightGratitudeMoodDesc: 'Les jours avec des entrées de gratitude montrent {percent}% de meilleure humeur. Continuez à pratiquer !',
    insightMoodUpTitle: 'Votre humeur s\'améliore !',
    insightMoodUpDesc: 'Votre humeur moyenne cette semaine est {percent}% meilleure que la semaine dernière. Vous faites du bon travail !',
    insightMoodDownTitle: 'Remontons votre humeur !',
    insightMoodDownDesc: 'Votre humeur a un peu baissé. Essayez de vous concentrer sur les habitudes qui vous font habituellement du bien.',
    insightHighConsistencyTitle: 'Constance incroyable !',
    insightHighConsistencyDesc: 'Vous avez noté votre humeur {days} des 14 derniers jours. Cette conscience de soi est puissante !',
    insightLowConsistencyTitle: 'Construisez votre habitude de notation',
    insightLowConsistencyDesc: 'Essayez de noter votre humeur à la même heure chaque jour. La constance aide à repérer les tendances !',

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
    // v1.4.0: Habit reminders and schedule
    addReminder: 'Ajouter',
    noReminders: 'Aucun rappel',
    habitEventExplanation: 'Cet événement vient de votre habitude. Modifiez l\'habitude pour le changer.',
    habitDurationMinutes: 'minutes',

    // Focus timer
    focus: 'Focus',
    breakTime: 'Pause',
    autoScheduled: 'Auto-planifié',
    taskEventExplanation: 'Ce bloc est généré automatiquement à partir de vos tâches. Terminez la tâche pour le supprimer.',
    yourTasksNow: 'Vos tâches maintenant',
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
    toLevel: 'Au niveau',
    unlockedPercent: '{percent}% Débloqué',
    all: 'Tous',
    unlocked: 'Débloqués',
    locked: 'Verrouillés',
    unlockedOn: 'Débloqué le {date}',
    hiddenAchievement: '???',
    hidden: 'Caché',
    noAchievementsYet: 'Pas encore de réalisations',
    startUsingZenFlow: 'Commencez à utiliser ZenFlow pour débloquer des réalisations !',
    achievementUnlocked: 'Réalisation débloquée !',
    userLevel: 'Niveau',
    focusSession: 'Session de concentration',
    // TimeHelper
    timeBlindnessHelper: 'Aide à la cécité temporelle',
    visualTimeAwareness: 'Conscience visuelle du temps pour TDAH',
    hoursMinutesLeft: '{hours}h {mins}m restantes',
    minutesLeft: '{mins}m restantes',
    timesUp: "C'est l'heure !",
    youllFinishAt: '🎯 Vous finirez à :',
    nMinutes: '{n} minutes',
    pingEveryMinutes: 'Signal toutes les (minutes)',
    audioPings: 'Signaux audio',
    testSound: '🔊 Test',
    soundOn: 'Activé',
    soundOff: 'Désactivé',
    startTimer: 'Démarrer le minuteur',
    pauseTimer: 'Pause',
    resetTimer: 'Réinitialiser',
    adhdTimeManagement: 'Gestion du temps TDAH',
    adhdTip1: 'Les signaux audio aident à suivre le temps',
    adhdTip2: "Le compte à rebours visuel réduit l'anxiété",
    adhdTip3: 'Prédiction de fin = meilleure planification',
    adhdTip4: 'Les changements de couleur avertissent du temps restant',
    currentStreak: 'Série actuelle',
    daysInRow: 'Jours consécutifs',
    totalFocus: 'Focus total',
    allTime: 'Tout le temps',
    habitsCompleted: 'Habitudes complétées',
    totalTimes: 'Fois au total',
    moodDistribution: 'Distribution de l\'humeur',
    moodHeatmap: 'Calendrier d\'humeur',
    activityHeatmap: 'Aperçu de l\'activité',
    less: 'Moins',
    more: 'Plus',
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
    exportCSV: 'Exporter CSV',
    exportPDF: 'Exporter PDF',
    importSuccess: 'Import terminé.',
    importError: 'Échec de l\'import.',
    importedItems: 'Ajouté',
    importAdded: 'ajouté',
    importUpdated: 'mis à jour',
    importSkipped: 'ignoré',
    textTooLong: 'Le texte est trop long (2000 caractères maximum)',
    invalidInput: 'Veuillez vérifier votre saisie',
    comingSoon: 'bientôt',
    resetAllData: 'Réinitialiser toutes les données',
    privacyTitle: 'Confidentialité',
    privacyDescription: 'Tes données restent sur l\'appareil. Pas de suivi caché.',
    privacyNoTracking: 'Pas de suivi',
    privacyNoTrackingHint: 'Nous ne collectons pas de données comportementales.',
    privacyAnalytics: 'Analytiques',
    privacyAnalyticsHint: 'Aide a ameliorer l\'app. Vous pouvez le desactiver.',
    privacyPolicy: 'Politique de confidentialite',
    termsOfService: 'Conditions d\'utilisation',

    // v1.2.0 Appearance
    appearance: 'Apparence',
    oledDarkMode: 'Mode sombre OLED',
    oledDarkModeHint: 'Thème noir pur pour écrans OLED. Économise la batterie.',

    // What's New Modal
    whatsNewTitle: 'Nouveautés',
    whatsNewVersion: 'Version',
    whatsNewGotIt: 'Compris !',

    // Accessibility
    skipToContent: 'Aller au contenu principal',

    // v1.1.1 Settings Redesign
    settingsCloudSyncTitle: 'Activer la synchronisation cloud',
    settingsCloudSyncDescription: 'Synchronisez vos données entre appareils',
    settingsCloudSyncEnabled: 'Synchronisation cloud activée',
    settingsCloudSyncDisabledByUser: 'Synchronisation désactivée',
    settingsExportTitle: 'Exporter la sauvegarde',
    settingsExportDescription: 'Enregistrez toutes vos données dans un fichier',
    settingsImportTitle: 'Importer la sauvegarde',
    settingsImportMergeTooltip: 'Les données importées seront ajoutées aux existantes. Doublons ignorés.',
    settingsImportReplaceTooltip: '⚠️ Toutes les données actuelles seront supprimées et remplacées',
    settingsImportReplaceConfirm: 'Tapez "REPLACE" pour confirmer la suppression de toutes les données',
    // Import validation (v1.4.1)
    invalidFileType: 'Type de fichier invalide. JSON requis.',
    fileTooLarge: 'Fichier trop volumineux (max 10 Mo)',
    importConfirm: 'Confirmer l\'importation',
    invalidBackupFormat: 'Format de sauvegarde invalide',
    settingsWhatsNewTitle: 'Nouveautés dans v1.5.8',
    settingsWhatsNewLeaderboards: 'Classements',
    settingsWhatsNewLeaderboardsDesc: 'Rivalisez anonymement avec les autres',
    settingsWhatsNewSpotify: 'Intégration Spotify',
    settingsWhatsNewSpotifyDesc: 'Lecture automatique pendant les sessions de focus',
    settingsWhatsNewChallenges: 'Défis entre amis',
    settingsWhatsNewChallengesDesc: 'Défiez vos amis à créer des habitudes ensemble',
    settingsWhatsNewDigest: 'Digest hebdomadaire',
    settingsWhatsNewDigestDesc: 'Recevez des rapports de progrès par email',
    settingsWhatsNewSecurity: 'Sécurité améliorée',
    settingsWhatsNewSecurityDesc: 'Meilleure protection des données et confidentialité',
    settingsWhatsNewGotIt: 'Compris !',
    // v1.5.8 What's New
    settingsWhatsNewFeatureToggles: 'Interrupteurs de fonctionnalités',
    settingsWhatsNewFeatureTogglesDesc: 'Activez/désactivez les modules dans Paramètres',
    settingsWhatsNewBugFixes158: 'Corrections de bugs',
    settingsWhatsNewBugFixes158Desc: 'Problèmes de synchronisation et stabilité corrigés',
    settingsWhatsNewUIImprovements: 'Améliorations de l\'interface',
    settingsWhatsNewUIImprovementsDesc: 'Meilleurs interrupteurs et organisation des paramètres',
    settingsSectionAccount: 'Compte et cloud',
    settingsSectionData: 'Données et sauvegarde',

    // Weekly Digest (v1.3.0)
    weeklyDigestTitle: 'Rapport de progression hebdomadaire',
    weeklyDigestDescription: 'Recevez un résumé hebdomadaire de vos habitudes, temps de concentration et tendances d\'humeur chaque dimanche.',
    weeklyDigestEnabled: 'Vous recevrez les rapports par email',

    // Changelog
    changelogTitle: 'Historique des versions',
    changelogExpandAll: 'Tout développer',
    changelogCollapseAll: 'Tout réduire',
    changelogEmpty: 'Aucun historique de versions disponible',
    changelogAdded: 'Ajouté',
    changelogFixed: 'Corrigé',
    changelogChanged: 'Modifié',
    changelogRemoved: 'Supprimé',

    // Settings Groups (v1.3.0)
    settingsGroupProfile: 'Profil et apparence',
    settingsGroupNotifications: 'Notifications',
    settingsGroupData: 'Données et confidentialité',
    settingsGroupAccount: 'Compte',
    settingsGroupAbout: 'À propos',

    // Feature Toggles / Modules (v1.5.8)
    settingsGroupModules: 'Modules',
    settingsModulesDescription: 'Activez ou désactivez les fonctionnalités',
    settingsModuleMood: 'Suivi de l\'humeur',
    settingsModuleMoodDesc: 'Fonction principale — toujours activée',
    settingsModuleHabits: 'Habitudes',
    settingsModuleHabitsDesc: 'Fonction principale — toujours activée',
    settingsModuleFocus: 'Minuterie focus',
    settingsModuleFocusDesc: 'Technique Pomodoro et travail profond',
    settingsModuleBreathing: 'Exercices de respiration',
    settingsModuleBreathingDesc: 'Techniques de relaxation et méditation',
    settingsModuleGratitude: 'Journal de gratitude',
    settingsModuleGratitudeDesc: 'Notez ce pour quoi vous êtes reconnaissant',
    settingsModuleQuests: 'Quêtes',
    settingsModuleQuestsDesc: 'Missions quotidiennes et récompenses',
    settingsModuleTasks: 'Tâches',
    settingsModuleTasksDesc: 'Liste de tâches et gestion',
    settingsModuleChallenges: 'Défis',
    settingsModuleChallengesDesc: 'Réalisations et challenges',
    settingsModuleAICoach: 'Coach IA',
    settingsModuleAICoachDesc: 'Assistant personnel avec IA',
    settingsModuleGarden: 'Mon jardin',
    settingsModuleGardenDesc: 'Jardin virtuel et compagnon',
    settingsModuleCoreLocked: 'Module principal',
    settingsModuleUnlockHint: 'Se débloque avec la progression',

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
    // App Updates (v1.4.1)
    checkForUpdates: 'Vérifier les mises à jour',
    checkingForUpdates: 'Vérification des mises à jour...',
    appUpToDate: 'Vous avez la dernière version',
    openGooglePlay: 'Ouvrir Google Play',
    updateCheckFailed: 'Échec de la vérification',
    remindersTitle: 'Rappels',
    remindersDescription: 'Des petits coups de pouce pour te garder sur la bonne voie.',
    moodReminder: 'Heure du check-in humeur',
    habitReminder: 'Rappel d\'habitude',
    focusReminder: 'Rappel de focus',
    quietHours: 'Heures calmes',
    reminderDays: 'Jours de la semaine',
    selectedHabits: 'Habitudes à rappeler',
    noHabitsYet: 'Pas encore d\'habitudes.',
    reminderMoodTitle: 'Hey, ça va? 💭',
    reminderMoodBody: '30 secondes pour remercier ton cerveau. Comment tu te sens?',
    reminderHabitTitle: 'L\'heure de la mini-habitude! ✨',
    reminderHabitBody: 'Petit pas = grande victoire. On y va?',
    reminderFocusTitle: 'Power focus! 🎯',
    reminderFocusBody: 'Juste 25 min pour le mode héros. C\'est parti?',
    reminderDismiss: 'Pas maintenant',
    notificationPermissionTitle: 'Reste sur la bonne voie',
    notificationPermissionDescription: 'Reçois des rappels doux pour suivre ton humeur, compléter tes habitudes et prendre des pauses de concentration. Les notifications t\'aident à créer des routines saines.',
    notificationFeature1Title: 'Rappels d\'humeur quotidiens',
    notificationFeature1Desc: 'Fais le point avec toi-même chaque jour',
    notificationFeature2Title: 'Suivi des habitudes',
    notificationFeature2Desc: 'Reste constant avec tes objectifs',
    notificationFeature3Title: 'Sessions de concentration',
    notificationFeature3Desc: 'Reçois des rappels pour prendre des pauses productives',
    notificationAllow: 'Activer les notifications',
    notificationDeny: 'Peut-être plus tard',
    notificationPrivacyNote: 'Tu peux changer cela à tout moment dans les Paramètres. Les notifications sont locales et privées.',
    onboardingStep: 'Étape',
    onboardingValueTitle: 'Suis ton humeur + habitudes en 30 secondes par jour',
    onboardingValueBody: 'Check-ins rapides, zéro désordre, totalement privé.',
    onboardingStart: 'Commencer en 30 sec',
    onboardingExplore: 'Explorer',
    onboardingGoalTitle: 'Choisis ton focus',
    onboardingGoalLessStress: 'Moins de stress',
    onboardingGoalLessStressDesc: 'Habitudes calmes et douces',
    onboardingGoalMoreEnergy: 'Plus d\'énergie',
    onboardingGoalMoreEnergyDesc: 'Sommeil, mouvement, hydratation',
    onboardingGoalBetterRoutine: 'Meilleure routine',
    onboardingGoalBetterRoutineDesc: 'Stabilité et rythme',
    onboardingContinue: 'Continuer',
    onboardingCheckinTitle: 'Check-in rapide',
    onboardingHabitsPrompt: 'Choisis deux habitudes',
    onboardingPickTwo: 'Choisis jusqu\'à deux',
    onboardingReminderTitle: 'Activer les rappels',
    onboardingReminderBody: 'Choisis une heure qui te convient. Pas de spam.',
    onboardingMorning: 'Matin',
    onboardingEvening: 'Soir',
    onboardingEnable: 'Activer',
    onboardingSkip: 'Passer pour l\'instant',
    onboardingHabitBreathing: 'Respiration',
    onboardingHabitEveningWalk: 'Promenade du soir',
    onboardingHabitStretch: 'Étirement',
    onboardingHabitJournaling: 'Journalisation',
    onboardingHabitWater: 'Boire de l\'eau',
    onboardingHabitSunlight: 'Lumière du soleil',
    onboardingHabitMovement: 'Mouvement',
    onboardingHabitSleepOnTime: 'Dormir à temps',
    onboardingHabitMorningPlan: 'Plan du matin',
    onboardingHabitRead: 'Lire 10 min',
    onboardingHabitNoScreens: 'Pas d\'écrans tard',
    onboardingHabitDailyReview: 'Bilan quotidien',
    account: 'Compte',
    accountDescription: 'Connectez-vous par e-mail pour synchroniser votre progression entre appareils.',
    emailPlaceholder: 'votre@email.com',
    sendMagicLink: 'Envoyer le lien de connexion',
    continueWithGoogle: 'Continuer avec Google',
    signedInAs: 'Connecté en tant que',
    signOut: 'Se déconnecter',
    syncNow: 'Synchroniser maintenant',
    cloudSyncDisabled: 'Synchronisation cloud désactivée.',
    deleteAccount: 'Supprimer le compte',
    deleteAccountConfirm: 'Supprimer votre compte ?',
    deleteAccountTypeConfirm: 'Tapez DELETE pour confirmer :',
    deleteAccountWarning: 'Cela supprimera les données cloud et l\'accès au compte.',
    deleteAccountSuccess: 'Compte supprimé.',
    deleteAccountError: 'Impossible de supprimer le compte.',
    deleteAccountLink: 'Supprimer le compte/données',
    authEmailSent: 'Lien de connexion envoyé à votre e-mail.',
    authSignedOut: 'Déconnecté.',
    authError: 'Échec de l\'envoi du lien.',
    authNotConfigured: 'Supabase non configuré.',
    syncSuccess: 'Synchronisation terminée.',
    syncPulled: 'Données cloud restaurées.',
    syncPushed: 'Cloud mis à jour.',
    syncError: 'Échec de la synchronisation.',
    authGateTitle: 'Se connecter',
    authGateBody: 'Connectez-vous par e-mail pour sauvegarder votre progression et synchroniser entre appareils.',
    authGateContinue: 'Continuer sans compte',
    errorBoundaryTitle: 'Quelque chose s\'est mal passé',
    errorBoundaryBody: 'Essayez de recharger l\'application ou d\'exporter un rapport de débogage.',
    errorBoundaryExport: 'Exporter le rapport de débogage',
    errorBoundaryReload: 'Recharger l\'application',
    pushTitle: 'Notifications push',
    pushEnable: 'Activer les notifications',
    pushDisable: 'Désactiver les notifications',
    pushTest: 'Tester les notifications',
    pushTestTitle: 'ZenFlow',
    pushTestBody: 'Notification de test.',
    pushTestSent: 'Test envoyé.',
    pushTestError: 'Échec de l\'envoi du test.',
    pushNowMood: 'Push: humeur',
    pushNowHabit: 'Push: habitudes',
    pushNowFocus: 'Push: concentration',
    pushEnabled: 'Notifications activées.',
    pushDisabled: 'Notifications désactivées.',
    pushError: 'Échec de l\'activation des notifications.',
    pushNeedsAccount: 'Connectez-vous pour activer les notifications.',
    pushPermissionDenied: 'Permission de notification refusée.',
    areYouSure: 'Êtes-vous sûr?',
    cannotBeUndone: 'Cette action ne peut pas être annulée.',
    delete: 'Supprimer',
    shareAchievements: 'Partager vos progrès',
    shareDialogTitle: 'Partagez vos progrès',
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
    shareFailed: 'Échec du partage. Veuillez réessayer.',
    shareAchievement30: 'Légendaire!',
    shareAchievement14: 'Inarrêtable!',
    shareAchievement7: 'En feu!',
    shareAchievement3: 'Étoile montante!',
    shareAchievementStart: 'Vient de commencer!',
    shareSubtext30: 'Maître 30+ jours',
    shareSubtext14: 'Guerrier 14+ jours',
    shareSubtext7: 'Série 7+ jours',
    shareSubtext3: 'Série 3+ jours',
    shareSubtextStart: 'Construction d\'habitudes',
    dismiss: 'Fermer',
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

    // Friend Challenges
    friendChallenges: 'Défis entre amis',
    createChallenge: 'Créer un défi',
    challengeDescription: 'Défiez vos amis pour construire des habitudes ensemble',
    challengeYourFriends: 'Défiez vos amis avec cette habitude!',
    challengeDuration: 'Durée du défi',
    challengeCreated: 'Défi créé!',
    challengeDetails: 'Détails du défi',
    shareToInvite: 'Partagez pour inviter des amis!',
    trackWithFriends: 'Suivez vos défis avec des amis',
    challengeCode: 'Code du défi',
    yourProgress: 'Votre progression',
    daysLeft: 'jours restants',
    dayChallenge: 'jours de défi',
    challengeCompleted: 'Défi terminé!',
    noChallenges: 'Pas encore de défis',
    createChallengePrompt: 'Créez un défi à partir de n\'importe quelle habitude!',
    completedChallenges: 'Terminés',
    expiredChallenges: 'Expirés',
    youCreated: 'Vous avez créé',
    createdBy: 'Créé par',
    confirmDeleteChallenge: 'Supprimer ce défi?',
    challengeInvite: 'Rejoins mon défi!',
    challengeJoinPrompt: 'Rejoins-moi sur ZenFlow!',
    challengeShareTip: 'Vous pourrez partager ce défi avec des amis après l\'avoir créé.',

    // Friend Challenges - Join
    joinChallenge: 'Rejoindre le défi',
    enterChallengeCode: 'Entrez le code de votre ami',
    invalidChallengeCode: 'Code invalide. Format: ZEN-XXXXXX',
    enterCodeToJoin: 'Entrez un code de défi pour rejoindre',
    joinChallengeHint: 'Demandez à votre ami de partager le code du défi',
    joining: 'Rejoindre...',
    join: 'Rejoindre',

    // Friend Challenges v2
    challengeWon: '🎉 Incroyable! Tu as terminé le défi!',
    catchUp: '💪 Tu peux rattraper! Chaque jour compte!',
    aheadOfSchedule: '⭐ Super rythme! Tu es en avance!',
    daysPassed: 'Jours passés',
    daysCompleted: 'Complétés',
    daysRemaining: 'Restants',

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
    onboardingAgeTitle: 'Bienvenue sur ZenFlow',
    onboardingAgeDesc: 'Cette application est conçue pour les utilisateurs de 13 ans et plus',
    onboardingAgeConfirm: 'J\'ai 13 ans ou plus',
    onboardingAgeNote: 'En continuant, vous confirmez que vous avez 13 ans ou plus',
    healthConnectAgeDesc: 'Les fonctionnalités Health Connect nécessitent d\'avoir 13 ans ou plus pour utiliser les données de santé de manière responsable.',
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
    tutorialFeature2b: '✨ Personnalisez icônes, couleurs et objectifs!',
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
    weeklyStory: 'Histoire de la semaine',
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
    // Weekly Story translations (ProgressStoriesViewer)
    storyAverageMoodScore: 'score d\'humeur moyen',
    storyCompletionRate: 'taux de complétion',
    storyTopHabit: 'Habitude principale',
    storyCompletions: 'complétées',
    storyPerfectDays: 'jours parfaits cette semaine',
    storyAvgSession: 'session moy.',
    storyLongestSession: 'plus longue',
    storyMostFocusedOn: 'Plus concentré sur:',
    storyTrackYourJourney: 'Suivez votre parcours avec',
    storyTapLeft: '← Appuyez à gauche',
    storyTapCenter: 'Appuyez au centre pour pause',
    storyTapRight: 'Appuyez à droite →',
    generating: 'Génération...',

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
    // Companion Notifications
    companionMissesYou: 'Hey! Tu me manques! 💕',
    companionWantsToPlay: 'Tu veux passer du temps? C\'est cool ici! 🎉',
    companionWaiting: 'Je t\'attends! J\'ai un truc cool 🌱',
    companionProud: 'T\'ES INCROYABLE! Trop fier! ⭐',
    companionCheersYou: 'Allez allez! Tu peux le faire! 💪',
    companionQuickMood: 'Psst! Ça va? Appuie ici! 😊',

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

    // Completed sections
    expand: 'Développer',
    collapse: 'Réduire',
    moodRecordedShort: 'Humeur enregistrée',
    habitsCompletedShort: 'Habitudes complétées',
    focusCompletedShort: 'Focus terminé',
    gratitudeAddedShort: 'Gratitude ajoutée',

    // All complete celebration
    allComplete: 'Tout est fait!',
    allCompleteMessage: 'Vous avez terminé toutes les activités d\'aujourd\'hui',
    allCompleteSupportive: 'À demain!',
    allCompleteLegend: 'Journée légendaire!',
    allCompleteAmazing: 'Incroyable!',
    allCompleteGreat: 'Excellent travail!',
    allCompleteNice: 'Bon travail!',
    daysStreak: 'jours consécutifs',
    restDaySupportive: 'On continue ensemble demain 💚',
    restDayCooldown: 'Le jour de repos a été utilisé récemment',
    restDayAvailableIn: 'Disponible dans',

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

    // Header Quick Actions
    tasks: 'Tâches',
    quests: 'Quêtes',
    challenges: 'Défis',
    openTasks: 'Ouvrir les tâches',
    openQuests: 'Ouvrir les quêtes',
    openChallenges: 'Ouvrir les défis',

    // QuestsPanel UI
    randomQuests: 'Quêtes aléatoires',
    questsPanelSubtitle: 'Complète des quêtes pour des XP bonus et des badges exclusifs',
    adhdEngagementSystem: "Système d'engagement TDAH",
    adhdEngagementDesc: 'Les quêtes offrent variété et récompenses inattendues - parfait pour les cerveaux TDAH en quête de nouveauté!',
    dailyQuest: 'Quête quotidienne',
    weeklyQuest: 'Quête hebdomadaire',
    bonusQuest: 'Quête bonus',
    newQuest: 'Nouvelle quête',
    limitedTime: 'Temps limité',
    generate: 'Générer',
    noQuestAvailable: 'Aucune quête disponible',
    noBonusQuestAvailable: 'Aucune quête bonus disponible',
    bonusQuestsHint: 'Les quêtes bonus apparaissent aléatoirement ou peuvent être générées manuellement',
    questProgress: 'Progrès:',
    questExpired: 'Expiré',
    questType: 'Quête',
    questTips: 'Conseils pour les quêtes',
    questTipDaily: 'Les quêtes quotidiennes se réinitialisent toutes les 24 heures',
    questTipWeekly: 'Les quêtes hebdomadaires offrent 3x XP',
    questTipBonus: 'Les quêtes bonus sont rares avec 5x XP',
    questTipExpire: 'Complète les quêtes avant leur expiration!',

    // Companion
    companionHungry: "J'ai faim... Tu me nourris?",

    // Common actions
    back: 'Retour',
    start: 'Commencer',
    stop: 'Arrêter',

    // Celebrations
    allHabitsComplete: 'Toutes les habitudes terminées!',
    amazingWork: 'Excellent travail aujourd\'hui!',

    // 404 page
    pageNotFound: 'Page non trouvée',
    goHome: 'Accueil',

    // Insights
    insightsTitle: 'Aperçus Personnels',
    insightsNotEnoughData: 'Continue à suivre ton humeur, tes habitudes et ta concentration pendant une semaine pour débloquer des aperçus personnalisés sur tes habitudes.',
    insightsNoPatterns: 'Aucun schéma fort détecté pour le moment. Continue à suivre de manière cohérente pour découvrir ce qui fonctionne le mieux pour toi!',
    insightsHelpTitle: 'À propos des Aperçus',
    insightsHelp1: 'Les aperçus sont générés à partir de tes données personnelles à l\'aide d\'analyses statistiques.',
    insightsHelp2: 'Toute l\'analyse se fait localement sur ton appareil - tes données ne partent jamais.',
    insightsHelp3: 'Les schémas avec une confiance plus élevée sont affichés en premier.',
    insightsDismiss: 'Ignorer',
    insightsShowMore: 'Afficher plus',
    insightsShowLess: 'Afficher moins',
    insightsDismissedCount: 'aperçus ignorés',
    insightsMoodEntries: 'entrées d\'humeur',
    insightsHabitCount: 'habitude',
    insightsFocusSessions: 'sessions de concentration',

    // Weekly Insights (v1.5.0)
    weeklyInsights: 'Insights Hebdomadaires',
    weeklyInsightsNotEnoughData: 'Suivez vos progrès cette semaine pour débloquer des insights et recommandations personnalisés.',
    comparedToLastWeek: 'Par rapport à la semaine dernière',
    recommendations: 'Recommandations',
    avgMood: 'Humeur moy.',
    week: 'Semaine',
    // Recommendation translations
    recLowMoodTitle: 'Humeur à surveiller',
    recLowMoodDesc: 'Votre humeur cette semaine a été plus basse que d\'habitude. Essayez des activités qui vous remontent généralement le moral.',
    recLowMoodAction: 'Essayez un exercice de respiration de 5 minutes',
    recHabitDeclineTitle: 'Habitudes en baisse',
    recHabitDeclineDesc: 'L\'accomplissement de vos habitudes a diminué par rapport à la semaine dernière. Commencez petit pour reprendre l\'élan.',
    recHabitDeclineAction: 'Concentrez-vous sur une seule habitude aujourd\'hui',
    recLowFocusTitle: 'Augmentez votre temps de concentration',
    recLowFocusDesc: 'Vous avez eu peu de sessions de concentration cette semaine. Même les courtes sessions aident à créer l\'habitude.',
    recLowFocusAction: 'Essayez une session de concentration de 10 minutes',
    recGreatProgressTitle: 'Vous êtes en pleine forme !',
    recGreatProgressDesc: 'Votre progression s\'améliore par rapport à la semaine dernière. Continuez comme ça !',
    recBestDayTitle: 'C\'était votre meilleur jour',
    recBestDayDesc: 'Essayez d\'identifier ce qui a rendu cette journée spéciale et reproduisez ces conditions.',
    recGratitudeTitle: 'Pratiquez la gratitude',
    recGratitudeDesc: 'Écrire les choses pour lesquelles vous êtes reconnaissant peut améliorer significativement votre humeur au fil du temps.',
    recGratitudeAction: 'Ajoutez une entrée de gratitude aujourd\'hui',
    recPerfectWeekTitle: 'Constance incroyable !',
    recPerfectWeekDesc: 'Vous avez accompli la plupart de vos habitudes cette semaine. Vous construisez des routines solides !',
    recTopHabitTitle: 'Continuez cette habitude',
    recTopHabitDesc: 'C\'est l\'une de vos habitudes les plus constantes. Elle contribue probablement à votre bien-être.',

    // Smart Reminders
    smartReminders: 'Rappels Intelligents',
    smartRemindersNotEnoughData: 'Continuez à utiliser l\'app pour débloquer des suggestions personnalisées basées sur vos habitudes.',
    smartRemindersOptimized: 'Vos horaires de rappel sont bien optimisés ! Continuez ainsi.',
    smartRemindersDescription: 'Suggestions personnalisées basées sur vos habitudes d\'utilisation',
    suggestions: 'suggestions',
    highConfidence: 'Haute confiance',
    mediumConfidence: 'Moyenne',
    lowConfidence: 'Suggestion',
    apply: 'Appliquer',
    habitRemindersOptimal: 'Horaires optimaux des habitudes',
    patternBased: 'Modèle',

    // Sync status
    syncOffline: 'Hors ligne',
    syncSyncing: 'Synchronisation',
    syncLastSync: 'Synchronisé',
    syncReady: 'Prêt à synchroniser',
    syncBackup: 'sauvegarde',
    syncReminders: 'rappels',
    syncChallenges: 'défis',
    syncTasks: 'tâches',
    syncInnerWorld: 'progrès',
    syncBadges: 'badges',

    // Progressive Onboarding
    onboardingTryNow: 'Essayer maintenant',
    onboardingGotIt: 'Compris!',
    onboardingNext: 'Suivant',
    onboardingGetStarted: 'Commençons!',
    onboardingWelcomeTitle: 'Bienvenue sur ZenFlow! 🌱',
    onboardingWelcomeDescription: 'Nous sommes ravis de t\'aider à créer de meilleures habitudes et à comprendre ce qui fonctionne pour TON cerveau.',
    onboardingDay1Title: 'Commençons simplement',
    onboardingDay1Description: 'Aujourd\'hui, nous nous concentrerons sur deux choses seulement : suivre ton humeur et créer ta première habitude. Rien d\'écrasant.',
    onboardingGradualTitle: 'Plus de fonctionnalités se débloquent progressivement',
    onboardingGradualDescription: 'Au cours des 4 prochains jours, tu découvriras de nouvelles fonctionnalités au fur et à mesure de ta progression. Pas de surcharge d\'informations!',
    onboardingDayProgress: 'Jour {day} sur {maxDay}',
    onboardingFeaturesUnlocked: 'fonctionnalités',
    onboardingNextUnlock: 'Prochain déblocage',

    // Feature Unlocks
    onboardingfocusTimerUnlockTitle: '🎯 Minuteur de Focus Débloqué!',
    onboardingfocusTimerUnlockSubtitle: 'Excellent progrès!',
    onboardingfocusTimerDescription: 'Utilise le minuteur Pomodoro pour une concentration profonde. Règle 25 minutes, concentre-toi sur une tâche, puis fais une pause. Parfait pour les cerveaux ADHD!',
    onboardingxpUnlockTitle: '✨ Système XP Débloqué!',
    onboardingxpUnlockSubtitle: 'C\'est l\'heure de la gamification!',
    onboardingxpDescription: 'Gagne de l\'expérience en complétant des habitudes, des sessions de focus et le suivi de l\'humeur. Monte de niveau et débloque de nouveaux accomplissements!',
    onboardingquestsUnlockTitle: '🎮 Quêtes Débloquées!',
    onboardingquestsUnlockSubtitle: 'Nouveaux défis!',
    onboardingquestsDescription: 'Les quêtes quotidiennes et hebdomadaires ajoutent de la variété à ta routine. Complète-les pour des récompenses bonus!',
    onboardingcompanionUnlockTitle: '💚 Compagnon Débloqué!',
    onboardingcompanionUnlockSubtitle: 'Rencontre ton assistant!',
    onboardingcompanionDescription: 'Ton compagnon virtuel grandit avec toi, célèbre les victoires et te soutient dans les moments difficiles. Choisis parmi 5 types!',
    onboardingtasksUnlockTitle: '📝 Tâches Débloquées!',
    onboardingtasksUnlockSubtitle: 'Accès complet!',
    onboardingtasksDescription: 'Task Momentum aide à prioriser les tâches spécifiquement pour ADHD. Le système recommande quoi faire ensuite en fonction de l\'urgence et de ton énergie.',
    onboardingchallengesUnlockTitle: '🏆 Défis Débloqués!',
    onboardingchallengesUnlockSubtitle: 'Accès complet!',
    onboardingchallengesDescription: 'Participe à des défis à long terme pour développer des compétences. Suis les progrès et gagne des badges exclusifs!',

    // Re-engagement (Welcome Back Modal)
    reengageTitle: 'Bon retour!',
    reengageSubtitle: 'Tu as été absent {days} jours',
    reengageStreakBroken: 'Statut de série',
    reengageStreakProtected: 'Série protégée!',
    reengageStreakBrokenMsg: 'Ta série a été réinitialisée, mais tu peux recommencer aujourd\'hui! Série précédente: {streak} jours.',
    reengageStreakProtectedMsg: 'Ta série de {streak} jours est sûre! Continue!',
    reengageBestHabits: 'Tes meilleures habitudes',
    reengageSuccessRate: 'succès',
    reengageQuickMood: 'Comment te sens-tu?',
    reengageMoodLogged: 'Humeur enregistrée!',
    reengageContinue: 'Continuer!',

    // Trends View (Long-term Analytics)
    trendsTitle: 'Tes Tendances',
    trendsAvgMood: 'Humeur Moy.',
    trendsHabitRate: 'Taux Habitudes',
    trendsFocusTime: 'Focus',
    trendsMoodChart: 'Humeur Au Fil Du Temps',
    trendsHabitChart: 'Achèvement Habitudes',
    trendsFocusChart: 'Temps de Focus',
    trendsTotalFocus: 'Total',
    trendsInsightHint: 'Tu veux des insights personnalisés?',
    trendsInsightHintDesc: 'Consulte le panneau Insights sur l\'onglet principal pour découvrir des motifs dans tes données.',

    // Health Connect (v1.2.0)
    healthConnect: 'Health Connect',
    healthConnectDescription: 'Synchroniser avec Google Health Connect',
    healthConnectLoading: 'Vérification de Health Connect...',
    healthConnectNotAvailable: 'Non disponible sur cet appareil',
    healthConnectUpdateRequired: 'Veuillez mettre à jour l\'app Health Connect',
    mindfulness: 'Pleine conscience',
    sleep: 'Sommeil',
    steps: 'Pas',
    stepsLabel: 'pas',
    grantPermissions: 'Accorder les permissions',
    todayHealth: 'Santé aujourd\'hui',
    syncFocusSessions: 'Synchroniser les sessions focus',
    syncFocusSessionsHint: 'Enregistrer les sessions focus comme pleine conscience dans Health Connect',
    openHealthConnect: 'Ouvrir Health Connect',
    refresh: 'Actualiser',
    permissions: 'Permissions',

    // Quest Templates (pour randomQuests.ts)
    questMorningMomentum: 'Élan Matinal',
    questMorningMomentumDesc: 'Complète 3 habitudes avant 12h00',
    questHabitMaster: 'Maître des Habitudes',
    questHabitMasterDesc: 'Complète 5 habitudes aujourd\'hui',
    questSpeedDemon: 'Démon de Vitesse',
    questSpeedDemonDesc: 'Complète 3 habitudes en 30 minutes',
    questFocusFlow: 'Flux de Concentration',
    questFocusFlowDesc: '30 minutes de concentration sans pause',
    questDeepWork: 'Travail Profond',
    questDeepWorkDesc: '60 minutes de travail concentré',
    questHyperfocusHero: 'Héros d\'Hyperconcentration',
    questHyperfocusHeroDesc: '90 minutes en Mode Hyperconcentration',
    questStreakKeeper: 'Gardien de Série',
    questStreakKeeperDesc: 'Maintiens ta série pendant 7 jours',
    questConsistencyKing: 'Roi de la Constance',
    questConsistencyKingDesc: 'Maintiens ta série pendant 14 jours',
    questGratitudeSprint: 'Sprint de Gratitude',
    questGratitudeSprintDesc: 'Écris 5 gratitudes en 5 minutes',
    questThankfulHeart: 'Cœur Reconnaissant',
    questThankfulHeartDesc: 'Écris 10 gratitudes aujourd\'hui',
    questLightningRound: 'Tour Éclair',
    questLightningRoundDesc: 'Complète 5 tâches rapides en 15 minutes',
    questWeeklyWarrior: 'Guerrier Hebdomadaire',
    questWeeklyWarriorDesc: 'Complète des habitudes 7 jours d\'affilée',

    // Feedback System
    feedbackTitle: 'Envoyer un commentaire',
    feedbackSubtitle: 'Aidez-nous à améliorer l\'application',
    feedbackCategoryBug: 'Signaler un bug',
    feedbackCategoryFeature: 'Suggérer une fonctionnalité',
    feedbackCategoryOther: 'Autre',
    feedbackMessagePlaceholder: 'Décrivez votre problème ou suggestion...',
    feedbackEmailPlaceholder: 'Email (optionnel)',
    feedbackSubmit: 'Envoyer',
    feedbackSuccess: 'Merci pour votre retour !',
    feedbackError: 'Échec de l\'envoi. Veuillez réessayer.',
    feedbackSending: 'Envoi en cours...',
    sendFeedback: 'Nous contacter',

    // App Rating
    rateAppTitle: 'Vous aimez ZenFlow ?',
    rateAppSubtitle: 'Notez-nous sur Play Store',
    rateAppButton: 'Noter',
    rateAppLater: 'Plus tard',

    // App Updates
    updateAvailable: 'Mise à jour disponible',
    updateDescription: 'Une nouvelle version est prête à installer avec des améliorations et corrections.',
    updateDescriptionCritical: 'Une mise à jour critique est requise pour continuer à utiliser l\'application.',
    updateNow: 'Mettre à jour',
    updateAvailableFor: 'Disponible depuis {days} jours',

    // Lock Screen Quick Actions
    quickActions: 'Actions rapides',
    quickActionsDescription: 'Afficher une notification avec des actions rapides sur l\'écran de verrouillage',
    quickActionsEnabled: 'Actions rapides activées',
    quickActionsDisabled: 'Actions rapides désactivées',
    quickActionLogMood: 'Enregistrer humeur',
    quickActionStartFocus: 'Démarrer focus',
    quickActionViewHabits: 'Voir habitudes',

    // Notification Sounds
    notificationSound: 'Son de notification',
    notificationSoundDescription: 'Choisissez le son pour les rappels',
    soundDefault: 'Par défaut',
    soundDefaultDesc: 'Son de notification système',
    soundGentle: 'Doux',
    soundGentleDesc: 'Vibration uniquement',
    soundChime: 'Carillon',
    soundChimeDesc: 'Tonalité de notification courte',
    soundSilent: 'Silencieux',
    soundSilentDesc: 'Pas de son ni de vibration',
    testNotification: 'Notification de test',
    testNotificationHint: 'Envoie une notification de test dans 5 secondes pour vérifier le fonctionnement.',

    // Insight Card Details
    insightConfidence: 'Confiance',
    insightDataPoints: 'Points de données',
    insightAvgMoodWith: 'Humeur moyenne avec habitude',
    insightAvgMoodWithout: 'Humeur moyenne sans habitude',
    insightSampleDays: 'Jours échantillonnés',
    insightBestActivity: 'Meilleure activité',
    insightPeakTime: 'Heure de pointe',
    insightAvgDuration: 'Durée moyenne',
    insightSessions: 'Sessions',
    insightTagOccurrences: 'Occurrences de tag',
    insightMoodWithTag: 'Humeur avec tag',
    insightMoodWithoutTag: 'Humeur sans tag',
    insightDisclaimer: 'Cet aperçu est basé sur vos données. Les tendances peuvent changer.',
    times: 'fois',

    // Stats Empty States
    noMoodDataYet: 'Pas encore de données d\'humeur',
    noEmotionDataYet: 'Pas encore de données d\'émotion',

    // XP Display
    xp: 'XP',

    // AI Coach
    aiCoachTitle: 'Coach IA',
    aiCoachSubtitle: 'Ton guide personnel de bien-être',
    aiCoachWelcome: 'Salut! Comment puis-je t\'aider?',
    aiCoachPlaceholder: 'Écris un message...',
    aiCoachQuick1: 'Je me sens stressé',
    aiCoachQuick2: 'Aide-moi à me concentrer',
    aiCoachQuick3: 'Besoin de motivation',
    clearHistory: 'Effacer l\'historique',
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
