export type Language = 'en' | 'uk' | 'es' | 'de' | 'fr' | 'ja' | 'ar' | 'he';

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
  addToMyWorld: string;

  // Mindfulness v1.5.0
  needInspiration: string;
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

  // Dynamic Insight Templates (v1.6.1 - used by insightsEngine.ts)
  insightMorning: string;
  insightAfternoon: string;
  insightEvening: string;
  insightHabitImprovesMood: string;
  insightHabitImprovesMoodDesc: string;
  insightFocusBestLabel: string;
  insightFocusBestLabelDesc: string;
  insightPeakFocusTime: string;
  insightPeakFocusTimeDesc: string;
  insightBestTimeForHabit: string;
  insightBestTimeForHabitDesc: string;
  insightTagBoostsMood: string;
  insightTagBoostsMoodDesc: string;

  // Module names for OnboardingFlow (v1.6.1)
  moduleFocus: string;
  moduleBreathing: string;
  moduleGratitude: string;
  moduleQuests: string;
  moduleTasks: string;
  moduleChallenges: string;
  moduleGarden: string;
  moduleFocusDesc: string;
  moduleBreathingDesc: string;
  moduleGratitudeDesc: string;
  moduleQuestsDesc: string;
  moduleTasksDesc: string;
  moduleChallengesDesc: string;
  moduleGardenDesc: string;

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
  undo: string;
  edit: string;
  editHabit: string;
  habitUpdated: string;
  saveChanges: string;
  habitCompleted: string;
  habitUnchecked: string;
  habitDeleted: string;
  habitCreated: string;
  habitTypeDailyDesc: string;
  habitTypeMultipleDesc: string;
  habitTypeContinuousDesc: string;
  habitTypeReduceDesc: string;
  habitRestDay: string;
  habitSwipeHint: string;
  habitNameRequired: string;
  confirmDelete: string;
  recentEntries: string;
  gratitudeTemplate1: string;
  gratitudeTemplate2: string;
  gratitudeTemplate3: string;
  gratitudeLimit: string;
  gratitudeMemoryJar: string;
  
  // Weekly calendar
  thisWeek: string;
  thisMonth: string;

  // Personal Goals (Stage 4)
  personalGoals: string;
  goalType: string;
  goalHabit: string;
  goalFocus: string;
  goalMood: string;
  goalStreak: string;
  goalCompleteHabits: string;
  goalFocusTime: string;
  goalMoodAverage: string;
  goalMaintainStreak: string;
  selectHabit: string;
  allHabits: string;
  weekly: string;
  monthly: string;
  addGoal: string;
  noGoalsYet: string;
  setGoalHint: string;
  completedGoals: string;
  claimReward: string;

  // Urgency Alerts (5.1 Predictive)
  urgencyHabitsPending: string;
  urgencyHabitsPendingDesc: string;
  urgencyLastChance: string;
  urgencyLastChanceDesc: string;
  urgencyStreakAtRisk: string;
  urgencyStreakAtRiskDesc: string;
  urgencyPerfectDay: string;
  urgencyPerfectDayDesc: string;
  urgencyTimeLeft: string;
  urgencyPendingCount: string;
  urgencyProtectStreak: string;
  urgencyPerfectDayAwaits: string;
  urgencyCompleteNow: string;

  // Habit Categories (6.3)
  habitCategory: string;
  categoryHealth: string;
  categoryMindfulness: string;
  categoryProductivity: string;
  categorySocial: string;
  categoryCreativity: string;
  categoryFinance: string;
  categorySelfCare: string;
  categoryOther: string;

  // Mind Map Canvas
  uncategorizedHabits: string;
  uncategorizedVerb: string;
  addFirstGoal: string;
  tapToBegin: string;

  // Stats page
  statistics: string;
  monthlyOverview: string;
  statsRange: string;
  statsRangeWeek: string;
  statsRangeMonth: string;
  statsRangeAll: string;
  statsRangeApply: string;
  statsOverview: string;
  statsTrends: string;
  statsCalendar: string;
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
  habitCalendar: string;
  completions: string;
  perfectDays: string;
  avgCompletion: string;
  noHabitsCompleted: string;
  missedHabits: string;
  totalTimes: string;
  moodDistribution: string;
  moodTrend: string;
  habitsTrend: string;
  focusTrend: string;
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
  invalidNameFormat: string;
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
  importConfirmTitle: string;
  importConfirmMessage: string;
  syncing: string;
  signingIn: string;
  signingOut: string;
  deleting: string;
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
  continueWithApple: string;
  continueWithFacebook: string;
  authSigningIn: string;
  signedInAs: string;
  signOut: string;
  syncNow: string;
  cloudSyncDisabled: string;
  sessionExpired: string;
  sessionExpiredMessage: string;
  sessionExpiredSettings: string;
  localDataSafe: string;
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
  modalErrorTitle: string;
  modalErrorBody: string;
  tryAgain: string;
  failedToLoad: string;
  failedToLoadBody: string;
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
  openSourceLicenses: string;
  legalPrivacyDescription: string;
  legalTermsDescription: string;
  legalLicensesDescription: string;
  legalOpenInBrowser: string;
  legalAgreePrefix: string;
  legalAnd: string;

  // v1.2.0 Appearance
  appearance: string;
  oledDarkMode: string;
  oledDarkModeHint: string;

  // v1.6.0 Theme Selector
  themeLabel: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;

  // What's New Modal
  whatsNewTitle: string;
  whatsNewVersion: string;
  whatsNewGotIt: string;
  whatsNew?: {
    googleOnly?: { title: string; description: string };
    codeQuality?: { title: string; description: string };
  };

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
  settingsWhatsNewGotIt: string;
  // v1.5.9 What's New
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

  // Google Calendar
  googleCalendar: string;
  googleCalendarDescription: string;
  googleCalendarEnabled: string;

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

  // Feature Toggles / Modules (v1.5.9)
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

  // Modules Onboarding (v1.6.0)
  modulesOnboardingTitle: string;
  modulesOnboardingSubtitle: string;
  modulesSelected: string;
  coreModulesNote: string;

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

  // Friends Panel
  friends: string;
  yourFriends: string;
  addFriend: string;
  addFriendByCode: string;
  addFriendError: string;
  friendAdded: string;
  friendRemoved: string;
  removeFriend: string;
  friendsSince: string;
  friendCode: string;
  codeCopied: string;
  noFriendsYet: string;
  addFriendsHint: string;
  privacySettings: string;
  shareLevel: string;
  shareActivity: string;
  recentActivity: string;
  friendsRefreshed: string;
  addMeOnZenFlow: string;
  friendCodeJoinPrompt: string;
  justNow: string;
  hoursAgo: string;
  daysAgo: string;
  yesterday: string;

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

  // App Loading
  initializingApp: string;

  // Phone Focus Mode (DND)
  focusModeToggle: string;
  focusModeEnabled: string;
  focusModeDisabled: string;
  focusModePermTitle: string;
  focusModePermDesc: string;
  focusModeOpenSettings: string;
  focusModeRestored: string;
  focusModeError: string;
  focusModeSettingsError: string;

  // Audio Status
  audioLoading: string;
  audioTapToEnable: string;
  audioRetry: string;
  audioError: string;
  muteSound: string;
  unmuteSound: string;

  // Leaderboard
  // Note: weekly/monthly defined above in Personal Goals section
  leaderboard: string;
  leaderboardType: string;
  leaderboardTimeout: string;
  leaderboardLoadError: string;
  leaderboardOptedIn: string;
  leaderboardOptedOut: string;
  showOnLeaderboard: string;
  displayName: string;
  yourRank: string;
  retry: string;
  noParticipants: string;
  beFirst: string;
  best: string;
  nameUpdated: string;

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
  dopamineMoodDrivenUI: string;
  dopamineMoodDrivenUIDesc: string;
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
  // Ad system
  adWatchToEarn: string;
  adWatch: string;
  adRemaining: string;
  innerWorld: string;
  tapToInteract: string;
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

  // Phase 10: Premium Stats Components
  zenScore: string;
  zenScoreExcellent: string;
  zenScoreGood: string;
  zenScoreOkay: string;
  zenScoreNeedsWork: string;
  seeBreakdown: string;
  showLess: string;

  // Mood Weather
  weatherSunny: string;
  weatherPartlyCloudy: string;
  weatherCloudy: string;
  weatherRainy: string;
  weatherStormy: string;
  weatherMessageGreat: string;
  weatherMessageGood: string;
  weatherMessageOkay: string;
  weatherMessageBad: string;
  weatherMessageTerrible: string;
  // Mood Weather v2 — 12 weather moods
  weatherCalm: string;
  weatherHappy: string;
  weatherFocused: string;
  weatherAnxious: string;
  weatherSad: string;
  weatherAngry: string;
  weatherTired: string;
  weatherEnergized: string;
  weatherNeutral: string;
  weatherRadiant: string;
  weatherMelancholy: string;
  weatherMessageCalm: string;
  weatherMessageHappy: string;
  weatherMessageFocused: string;
  weatherMessageAnxious: string;
  weatherMessageSad: string;
  weatherMessageAngry: string;
  weatherMessageTired: string;
  weatherMessageEnergized: string;
  weatherMessageNeutral: string;
  weatherMessageRadiant: string;
  weatherMessageMelancholy: string;
  weatherMessageStormy: string;
  // Mood Weather Calendar
  moodCalendar: string;
  moodCalendarEmpty: string;
  moodCalendarStreak: string;
  moodCalendarMostCommon: string;
  moodCalendarBestDay: string;
  moodCalendarTapDay: string;

  // Week Crystal
  weekCrystal: string;
  crystalExcellentWeek: string;
  crystalGoodWeek: string;
  crystalAverageWeek: string;
  crystalNeedsImprovement: string;
  weekCrystalExpand: string;
  weekCrystalVsLastWeek: string;

  // Radial Dashboard
  tapToSee: string;

  // Ring Detail Sheet (Stats Page interactivity)
  ringDetailMoodDesc: string;
  ringDetailHabitsDesc: string;
  ringDetailFocusDesc: string;
  ringDetailToday: string;
  ringDetailWeekTrend: string;
  ringDetailDayByDay: string;
  ringDetailVsAverage: string;
  stable: string;

  // Weather (MoodWeather expandable)
  weatherForecast: string;
  weatherHistory: string;
  weatherFactors: string;

  // Phase 13: Visual Worlds Stats Components
  hallOfFame: string;
  tapToFlip: string;
  activityOverview: string;
  emotionDistribution: string;
  entries: string;
  active: string;
  empty: string;
  perfect: string;

  // Language
  language: string;
  selectLanguage: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  continue: string;
  autoDetectedLanguage: string;

  // 404 Page
  notFoundMessage: string;
  returnToHome: string;
  
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
  tutorialJournalTitle: string;
  tutorialJournalSubtitle: string;
  tutorialJournalDesc: string;
  tutorialJournalFeature1: string;
  tutorialJournalFeature2: string;
  tutorialJournalFeature3: string;
  tutorialJournalFeature4: string;

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
  storyTotalFocus: string;
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
  diary: string;
  map: string;
  restNeeded: string;
  plants: string;
  creatures: string;
  level: string;

  // Garden Visual UI
  gardenLoading: string;
  gardenEmptyTitle: string;
  gardenEmptyDescription: string;
  gardenTreatsBalance: string;
  gardenPlantFirstSeed: string;
  gardenActionPlant: string;
  gardenActionWater: string;
  gardenActionFeed: string;
  gardenTreats: string;
  gardenScene: string;
  gardenStageEmpty: string;
  gardenStageSprouting: string;
  gardenStageGrowing: string;
  gardenStageFlourishing: string;
  gardenStageMagical: string;
  gardenStageLegendary: string;
  gardenPlants: string;
  gardenGrowth: string;
  gardenPlantedAgo: string;
  gardenWaterPlant: string;
  gardenSpecial: string;
  gardenSource_mood: string;
  gardenSource_habit: string;
  gardenSource_focus: string;
  gardenSource_gratitude: string;
  plantStage_seed: string;
  plantStage_sprout: string;
  plantStage_growing: string;
  plantStage_blooming: string;
  plantStage_magnificent: string;
  plantType_flower: string;
  plantType_tree: string;
  plantType_crystal: string;
  plantType_mushroom: string;
  creatureStage_egg: string;
  creatureStage_baby: string;
  creatureStage_juvenile: string;
  creatureStage_adult: string;
  creatureStage_mythical: string;
  creatureType_butterfly: string;
  creatureType_bird: string;
  creatureType_firefly: string;
  creatureType_spirit: string;
  creatureHappiness: string;
  creatureArrivedAgo: string;
  creatureFeed: string;
  companionLevel: string;
  companionPetAction: string;
  companionFeedAction: string;
  companionMood_sleeping: string;
  companionMood_calm: string;
  companionMood_happy: string;
  companionMood_excited: string;
  companionMood_celebrating: string;
  companionMood_supportive: string;
  dayAgo: string;

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

  touch: string;
  water: string;
  waterLevel: string;
  growth: string;
  stage: string;
  waterDecayHint: string;
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
  challengesCompleted: string;
  completeAllFor: string;

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
  insightsExpand: string;
  insightsCollapse: string;
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

  // Comeback Challenge (Stage 5 Retention)
  comebackChallengeTitle: string;
  comebackChallengeSubtitle: string;
  comebackChallengeGoal: string;
  comebackChallengeTime: string;
  comebackChallengeAccept: string;

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

  mindfulness: string;
  sleep: string;
  steps: string;
  stepsLabel: string;
  grantPermissions: string;
  todayHealth: string;
  syncFocusSessions: string;
  syncFocusSessionsHint: string;
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
  weeklyQuestPrefix: string;
  bonusQuestPrefix: string;
  questCompletedSuffix: string;
  questBadgeDeepFocus: string;
  questBadgeLightningFast: string;

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
  notificationTestSending: string;
  notificationTestNoPermission: string;
  notificationTestSuccess: string;
  notificationTestFailed: string;
  notificationTestError: string;

  // Demo mode
  demoModeEnabled: string;
  demoModeDisabled: string;

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
  noDataYet: string;
  noDataMessage: string;
  startTracking: string;
  noHabitsMessage: string;
  noFocusSessions: string;
  noFocusMessage: string;
  selectTimeRange: string;

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

  // Auth Screen (P0 fix)
  authWelcomeTitle: string;
  authWelcomeSubtitle: string;
  authContinueWith: string;
  authSigningInGoogle: string;
  authNotConfiguredMessage: string;
  authExportDebugInfo: string;
  authOr: string;
  authContinueEmail: string;
  authSkipForNow: string;
  authPrivacyNote: string;
  authSignInTooLong: string;
  authTooManyAttempts: string;
  authSupabaseNotConfigured: string;
  authUnexpectedError: string;
  authGoogleSignInFailed: string;

  // Common UI actions (P0/P1 fix)
  increase: string;
  decrease: string;
  previousMonth: string;
  nextMonth: string;
  goToPreviousPage: string;
  goToNextPage: string;
  pagination: string;
  breadcrumb: string;
  toggleSidebar: string;
  sharePreview: string;
  albumCover: string;
  thanksFeedback: string;
  feedbackFailed: string;
  noVersionHistory: string;
  syncFailedLocal: string;
  // Sync status notifications (P0 Premium Upgrade)
  syncQueueFull: string;
  syncQueueFullDesc: string;
  syncQueueWarning: string;
  syncQueueWarningDesc: string;
  storageError: string;
  storageErrorDesc: string;
  syncTransactionFailed: string;
  syncTransactionFailedDesc: string;
  backgroundSyncFailed: string;
  backgroundSyncFailedDesc: string;
  indexedDBTimeout: string;
  indexedDBTimeoutDesc: string;
  // Database recovery (P0 Premium Upgrade)
  databaseRecoveryTitle: string;
  databaseRecoveryDesc: string;
  databaseRecoveryRestore: string;
  databaseRecoveryStartFresh: string;
  // Update required (P0 chunk load error)
  updateRequiredTitle: string;
  updateRequiredDesc: string;
  updateRequiredRefresh: string;
  imageGenerateFailed: string;
  imageSavedDownloads: string;
  shareFailedDownload: string;
  clipboardCopyFailed: string;
  updateCheckFailedToast: string;
  allActivitiesComplete: string;
  letsStart: string;

  // Spotify Integration (P0 fix)
  spotifyConnect: string;
  spotifyDisconnect: string;
  spotifyNoTrack: string;
  spotifyAutoPlayOn: string;
  spotifyAutoPlayOff: string;
  spotifyOpenApp: string;

  // Pagination (P1 fix)
  paginationPrevious: string;
  paginationNext: string;
  paginationMorePages: string;

  // Dismiss notification
  dismissNotification: string;

  // Day names short (for heatmap)
  dayShortSun: string;
  dayShortMon: string;
  dayShortTue: string;
  dayShortWed: string;
  dayShortThu: string;
  dayShortFri: string;
  dayShortSat: string;

  // Month names short (for heatmap)
  monthShortJan: string;
  monthShortFeb: string;
  monthShortMar: string;
  monthShortApr: string;
  monthShortMay: string;
  monthShortJun: string;
  monthShortJul: string;
  monthShortAug: string;
  monthShortSep: string;
  monthShortOct: string;
  monthShortNov: string;
  monthShortDec: string;

  // Weekly Review (Premium Stats)
  weeklyReview: string;
  thisWeekSummary: string;
  weeklyRecommendationHabits: string;
  weeklyRecommendationFocus: string;
  weeklyRecommendationMood: string;
  weeklyRecommendationGreat: string;
  bestDayWas: string;
  bestDayDesc: string;
  perfectDaysDesc: string;
  forNextWeek: string;
  viewDetails: string;

  // Comeback Challenge (Retention)
  // Note: welcomeBack defined above in Inner World Garden section
  missedYouLong: string;
  missedYouWeek: string;
  letsGetBackOnTrack: string;
  comebackChallenge: string;
  comebackChallengeDesc: string;
  acceptChallenge: string;
  youEarned: string;
  awesome: string;

  // Additional UI keys
  allDone: string;
  authRequired: string;
  average: string;
  calendarSelectMonth: string;
  cloudSyncError: string;
  code: string;
  companionName: string;
  complete: string;
  copied: string;
  copyCode: string;
  copyError: string;
  creating: string;
  dailyBreakdown: string;
  databaseRecoveryStartFreshDesc: string;
  duration: string;
  editName: string;
  expired: string;
  exporting: string;
  feedbackBug: string;
  feedbackFeature: string;
  feedbackInvalidEmail: string;
  feedbackOther: string;
  feedbackPlaceholder: string;
  feedbackSent: string;
  friend: string;
  habit: string;
  habitNamePlaceholder: string;
  imageSaved: string;
  importing: string;
  last7Days: string;
  leaderboardError: string;
  loading: string;
  loadingParticipants: string;
  locale: string;
  logMood: string;
  mainNavigation: string;
  markComplete: string;
  minPerDay: string;
  minuteShort: string;
  mood: string;
  moodBad: string;
  moodGreat: string;
  moodTerrible: string;
  moodUpdated: string;
  noParticipantsYet: string;
  offlineBannerDismiss: string;
  offlineBannerPending: string;
  offlineBannerRetry: string;
  offlineBannerTitle: string;
  optional: string;
  participants: string;
  participantsLocalOnly: string;
  perDay: string;
  period: string;
  play: string;
  preview: string;
  pwaUpdateAvailable: string;
  pwaUpdateButton: string;
  pwaUpdateDescription: string;
  recommendation: string;
  reminders: string;
  remindersToggle: string;
  ringRecommendationFocusHigh: string;
  ringRecommendationFocusLow: string;
  ringRecommendationFocusMid: string;
  ringRecommendationHabitsHigh: string;
  ringRecommendationHabitsLow: string;
  ringRecommendationHabitsMid: string;
  ringRecommendationMoodHigh: string;
  ringRecommendationMoodLow: string;
  ringRecommendationMoodMid: string;
  scheduleEventType: string;
  selectColor: string;
  selectCompanion: string;
  selectIcon: string;
  selectMood: string;
  send: string;
  sending: string;
  settingsSaveFailed: string;
  shareCardDayStreak: string;
  shareCardDays: string;
  shareCardFocus: string;
  shareCardHabits: string;
  shareCardMood: string;
  shareCardMoodGood: string;
  shareCardMoodGreat: string;
  shareCardMoodLow: string;
  shareCardMoodOkay: string;
  shareCardMoodTough: string;
  shareCardNewAchievements: string;
  shareCardStreak: string;
  shareCardTrackHabits: string;
  shareCardWeeklyReview: string;
  shareCopySuccess: string;
  shareDownloadSuccess: string;
  shareError: string;
  shareGenerateError: string;
  shareGeneratingSlow: string;
  shareRetry: string;
  shareSharedSuccess: string;
  sharing: string;
  showMoreRecommendations: string;
  startFocus: string;
  storageWarningMessage: string;
  storageWarningPrivateMode: string;
  storageWarningTitle: string;
  suggestedGoals: string;
  switchToDark: string;
  switchToLight: string;
  syncPending: string;
  toggleTheme: string;
  treats: string;
  trendsTimeRange: string;
  trophyIcon: string;
  updateDescriptionVersion: string;
  viewHabits: string;
  viewProgress: string;
  weekHigh: string;
  weekLow: string;
  weeklyTrend: string;
  you: string;
  zenScoreTapToExpand: string;

  // Journal / Diary
  journalTitle: string;
  journalSubtitle: string;
  journalEmpty: string;
  journalEmptyHint: string;
  journalEmptyQuote: string;
  journalNewEntry: string;
  journalEntries: string;
  journalToday: string;
  journalYesterday: string;
  journalThisWeek: string;
  journalEarlier: string;
  journalEntryTitle: string;
  journalEntryPlaceholder: string;
  journalSave: string;
  journalBack: string;
  journalNext: string;
  journalAdd: string;
  journalDeleteEntry: string;
  journalDeleteConfirm: string;
  journalStickerAdd: string;
  journalPhotoAdd: string;
  journalRemaining: string;
  journalPhotoTake: string;
  journalPhotoChoose: string;
  journalTagPlaceholder: string;
  journalSettings: string;
  journalLocked: string;
  journalUnlock: string;
  journalPasswordSetup: string;
  journalPasswordEnter: string;
  journalPasswordConfirm: string;
  journalPasswordHint: string;
  journalPasswordTooShort: string;
  journalPasswordMismatch: string;
  journalPasswordWrong: string;
  journalPasswordCooldown: string;
  journalPasswordForgot: string;
  journalPasswordRemove: string;
  journalResetViaEmail: string;
  journalResetConfirm: string;
  journalResetSendCode: string;
  journalResetCodeSent: string;
  journalResetCodeSentHint: string;
  journalResetEnterCode: string;
  journalResetVerify: string;
  journalResetSuccess: string;
  journalResetNoAccount: string;
  journalResetCodeWrong: string;
  journalResetSendFailed: string;
  journalResetResend: string;
  journalClose: string;
  journalSearch: string;
  journalNoResults: string;
  journalEdit: string;
  journalUndo: string;
  journalEntryDeleted: string;
  journalCompressing: string;
  journalPhotoError: string;
  journalDraftFound: string;
  journalRestore: string;
  journalDiscardTitle: string;
  journalDiscardMessage: string;
  journalDiscard: string;
  journalKeepWriting: string;
  journalSaveClose: string;
  journalWords: string;
  journalEntrySaved: string;
  journalWritingPrompts: string;
  journalPrompt1: string;
  journalPrompt2: string;
  journalPrompt3: string;
  journalPrompt4: string;
  journalPrompt5: string;
  journalPrompt6: string;
  journalPrompt7: string;
  journalPrompt8: string;
  journalPrompt9: string;
  journalPrompt10: string;
  journalDayStreak: string;
  journalCalendarToday: string;
  journalClearFilters: string;
  journalStickerEmotions: string;
  journalStickerNature: string;
  journalStickerActivities: string;
  journalStickerFood: string;
  journalStickerSymbols: string;
  journalStickerRecent: string;
  journalReminderSubtitle: string;
  journalReminderEnabled: string;
  journalReminderTime: string;
  journalReminderNotifTitle: string;
  journalReminderNotifBody: string;
  journalInactiveBanner: string;
  journalToolbarSticker: string;
  journalToolbarPhoto: string;
  journalToolbarMood: string;
  journalToolbarTags: string;
  journalShare: string;
  journalShareCopied: string;
  journalDraftSaved: string;
  journalDraftBadge: string;
  journalSavedStreak: string;
  journalPrivateMode: string;
  journalPrivateModeHint: string;
  journalTemplateButton: string;
  journalStatsEntries: string;
  journalAudioSaved: string;
  journalAudioError: string;
  journalVoiceNotSupported: string;
  journalAudioMaxReached: string;
  journalDictating: string;
  journalDictateStop: string;
  journalToolbarVoice: string;
  journalToolbarRecord: string;
  journalRecording: string;
  journalAudioMaxDuration: string;
  journalRecordingStop: string;
  journalActionSheetTitle: string;
  journalActionCapture: string;
  journalActionReflect: string;
  journalActionMindful: string;
  journalActionOrganize: string;
  journalBurnButton: string;
  journalBurnTitle: string;
  journalBurnReleased: string;
  journalBurnReleasedMessage: string;
  journalBurnPlaceholder: string;
  journalBurnAction: string;
  journalStyleButton: string;
  journalThemeLabel: string;
  journalFontLabel: string;
  journalFocusLabel: string;
  journalHabitsSection: string;
  journalStatsTitle: string;
  journalStatsEmpty: string;
  journalStatsTotal: string;
  journalStatsTotalWords: string;
  journalStatsStreaks: string;
  journalStatsDays: string;
  journalStatsLongestStreak: string;
  journalStatsThisMonth: string;
  journalStatsAvgPerWeek: string;
  journalStatsMoodDist: string;
  journalStatsMoodTime: string;
  journalStatsFrequency: string;
  journalStatsMostActiveDay: string;
  journalStatsTagCloud: string;
  journalTemplates: string;
  journalTemplateBlank: string;
  journalTemplateBlankDesc: string;
  journalTemplateDailyReflection: string;
  journalTemplateDailyReflectionDesc: string;
  journalTemplateGratitude: string;
  journalTemplateGratitudeDesc: string;
  journalTemplateGoalSetting: string;
  journalTemplateGoalSettingDesc: string;
  journalTemplateFreeWrite: string;
  journalTemplateFreeWriteDesc: string;
  journalTemplateWeeklyReview: string;
  journalTemplateWeeklyReviewDesc: string;
  journalTemplateHighlight: string;
  journalTemplateChallenge: string;
  journalTemplateTomorrow: string;
  journalTemplateGrateful1: string;
  journalTemplateGrateful2: string;
  journalTemplateGrateful3: string;
  journalTemplateCurrentGoal: string;
  journalTemplateProgress: string;
  journalTemplateNextStep: string;
  journalTemplateFreeWritePrompt: string;
  journalTemplateWeekWins: string;
  journalTemplateWeekLessons: string;
  journalTemplateWeekAhead: string;
  journalContinueWriting: string;
  journalStartToday: string;
  journalTodayComplete: string;
  journalWriteToday: string;
  journalProtected: string;
  journalStreak: string;
  journalStartYourStory: string;
  journalResetLinkSent: string;
  journalResetLinkHint: string;
  journalResetCheckEmail: string;
  journalResetWaiting: string;
  journalResetSendLink: string;
  journalPasswordChange: string;
  journalPasswordChangeSuccess: string;
  journalPasswordRemoveConfirm: string;
  journalPasswordOldWrong: string;
  journalPasswordOldEnter: string;
  journalPasswordNewEnter: string;
  journalPasswordChangeConfirm: string;
  journalBiometricEnable: string;
  journalBiometricSubtitle: string;
  journalBiometricUnlock: string;
  journalScreenshotBlock: string;
  journalScreenshotBlockSubtitle: string;
  journalDataSection: string;
  journalExport: string;
  journalImport: string;
  journalImportSuccess: string;
  journalImportDuplicate: string;
  journalImportFailed: string;
  journalExportFormat: string;
  journalExportJSON: string;
  journalExportJSONDesc: string;
  journalExportCSV: string;
  journalExportCSVDesc: string;
  journalExportPDF: string;
  journalExportPDFDesc: string;
  journalExportText: string;
  journalExportTextDesc: string;
  journalExportSuccess: string;
  journalExportFailed: string;

  // Journal filtering
  journalNoMatchingEntries: string;
  journalNoMatchingHint: string;
  journalClearAllFilters: string;
  journalChars: string;
  journalMinRead: string;
  journalQuickMood: string;
  journalQuickMoodSaved: string;

  // Premium Diary (Immersive Mode)
  diaryPremiumEntry: string;
  diaryPremiumHint: string;
  diaryBurnThought: string;
  diaryBurnButton: string;
  diaryBurnReleased: string;
  diaryBurnPlaceholder: string;
  diaryFocusMode: string;
  diaryThemeLight: string;
  diaryThemeDark: string;
  diaryThemeSepia: string;
  diaryThemeForest: string;
  diaryThemeOcean: string;
  diaryThemeSunset: string;
  diaryAtmosphere: string;
  diaryThemeCosmos: string;
  diaryWavyBorder: string;
  diaryFontSans: string;
  diaryFontSerif: string;
  diaryFontHandwriting: string;
  diarySnapshot: string;
  diaryRecord: string;
  diaryFocusRay: string;
  diaryBreathe: string;
  diaryTimeCapsule: string;
  diaryVoice: string;
  diaryFeatures: string;
  diaryMedia: string;
  diaryGameChangers: string;
  diaryFormatHint: string;
  diaryFormatLinkPrompt: string;
}
