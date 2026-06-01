/**
 * What's New Modal — changelog data
 * Extracted from WhatsNewModal.tsx for TD-20 decomposition
 */

import {
  Sparkles,
  Shield,
  Zap,
  Download,
  Moon,
  RefreshCw,
  MessageSquare,
  ToggleRight,
  Bug,
  Settings,
  Palette,
} from "lucide-react";

export interface ChangelogItem {
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  // Fallback English text
  title: string;
  description: string;
}

const CHANGELOG_ICON_STYLES = {
  purple: { color: "#a855f7" },
  yellow: { color: "#eab308" },
  orange: { color: "#f97316" },
  green: { color: "#22c55e" },
  blue: { color: "#3b82f6" },
  indigo: { color: "#6366f1" },
} as const;

function withAccent(icon: React.ReactNode, accent: keyof typeof CHANGELOG_ICON_STYLES) {
  return (
    <span className="contents" style={CHANGELOG_ICON_STYLES[accent]}>
      {icon}
    </span>
  );
}

// Changelog entries by version — exported for SettingsPanel banner
export const CHANGELOG: Record<string, ChangelogItem[]> = {
  "1.7.2": [
    {
      icon: withAccent(<Palette className="w-5 h-5" aria-hidden="true" />, "purple"),
      titleKey: "whatsNew.valenceOrb.title",
      descriptionKey: "whatsNew.valenceOrb.description",
      title: "State of Mind Redesign",
      description:
        "Beautiful canonical glass orbs that morph with your mood — from pressure lenses to soft blooms.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.visualPolish172.title",
      descriptionKey: "whatsNew.visualPolish172.description",
      title: "Visual Polish",
      description:
        "Premium animations, GPU-optimized rendering, and smoother transitions across the app.",
    },
    {
      icon: withAccent(<Bug className="w-5 h-5" aria-hidden="true" />, "orange"),
      titleKey: "whatsNew.bugFixes172.title",
      descriptionKey: "whatsNew.bugFixes172.description",
      title: "Bug Fixes",
      description:
        "Fixed sync errors, cache issues, and improved overall stability.",
    },
  ],
  "1.7.1": [
    {
      icon: withAccent(<Shield className="w-5 h-5" aria-hidden="true" />, "green"),
      titleKey: "whatsNew.googleOnly.title",
      descriptionKey: "whatsNew.googleOnly.description",
      title: "Google Sign-In Only",
      description:
        "Sign in securely with Google. Email and skip options removed for better account security.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.codeQuality.title",
      descriptionKey: "whatsNew.codeQuality.description",
      title: "Code Quality",
      description:
        "271 code quality warnings fixed to zero. Smoother, more reliable experience.",
    },
  ],
  "1.7.0": [
    {
      icon: withAccent(<Sparkles className="w-5 h-5" aria-hidden="true" />, "purple"),
      titleKey: "whatsNew.animatedTree.title",
      descriptionKey: "whatsNew.animatedTree.description",
      title: "Animated Tree",
      description:
        "Your garden tree now has beautiful seasonal animations with falling petals, leaves, and snowflakes.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.treatsSystem.title",
      descriptionKey: "whatsNew.treatsSystem.description",
      title: "Treats System",
      description:
        "Earn treats from habits, writing, and focus sessions. Use them to water and grow your tree!",
    },
    {
      icon: withAccent(<MessageSquare className="w-5 h-5" aria-hidden="true" />, "blue"),
      titleKey: "whatsNew.personalJournal.title",
      descriptionKey: "whatsNew.personalJournal.description",
      title: "Diary",
      description:
        "Voice notes, premium templates, export, and biometric lock for your private entries.",
    },
    {
      icon: withAccent(<Settings className="w-5 h-5" aria-hidden="true" />, "indigo"),
      titleKey: "whatsNew.settingsRedesign.title",
      descriptionKey: "whatsNew.settingsRedesign.description",
      title: "Redesigned Settings",
      description:
        "Cleaner settings with better import flow, auto-clearing notifications, and improved accessibility.",
    },
    {
      icon: withAccent(<Bug className="w-5 h-5" aria-hidden="true" />, "orange"),
      titleKey: "whatsNew.auditFixes.title",
      descriptionKey: "whatsNew.auditFixes.description",
      title: "Stability & Polish",
      description:
        "200+ bug fixes across all tabs for a smoother, more reliable experience.",
    },
  ],
  "1.6.0": [
    {
      icon: withAccent(<Sparkles className="w-5 h-5" aria-hidden="true" />, "purple"),
      titleKey: "whatsNew.redesign.title",
      descriptionKey: "whatsNew.redesign.description",
      title: "New Design",
      description: "Streamlined 3-tab layout with quick mood logging.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.performance160.title",
      descriptionKey: "whatsNew.performance160.description",
      title: "Faster & Smoother",
      description: "Fixed crashes, improved loading speed and stability.",
    },
    {
      icon: withAccent(<Shield className="w-5 h-5" aria-hidden="true" />, "green"),
      titleKey: "whatsNew.accessibility.title",
      descriptionKey: "whatsNew.accessibility.description",
      title: "Accessibility",
      description: "Better screen reader support and keyboard navigation.",
    },
  ],
  "1.5.7": [
    {
      icon: withAccent(<ToggleRight className="w-5 h-5" aria-hidden="true" />, "purple"),
      titleKey: "whatsNew.featureToggles.title",
      descriptionKey: "whatsNew.featureToggles.description",
      title: "Feature Toggles",
      description: "Choose app modules during onboarding.",
    },
    {
      icon: withAccent(<Shield className="w-5 h-5" aria-hidden="true" />, "green"),
      titleKey: "whatsNew.securityFixes.title",
      descriptionKey: "whatsNew.securityFixes.description",
      title: "Enhanced Security",
      description: "Fixed vulnerabilities and improved data protection.",
    },
    {
      icon: withAccent(<Bug className="w-5 h-5" aria-hidden="true" />, "orange"),
      titleKey: "whatsNew.bugFixes158.title",
      descriptionKey: "whatsNew.bugFixes158.description",
      title: "Bug Fixes",
      description: "Fixed sync issues and improved stability.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.uiImprovements.title",
      descriptionKey: "whatsNew.uiImprovements.description",
      title: "UI Improvements",
      description: "Better toggle switches and settings organization.",
    },
  ],
  "1.3.5": [
    {
      icon: withAccent(<Shield className="w-5 h-5" aria-hidden="true" />, "green"),
      titleKey: "whatsNew.security.title",
      descriptionKey: "whatsNew.security.description",
      title: "Enhanced Security",
      description: "Better data protection & privacy.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.performance.title",
      descriptionKey: "whatsNew.performance.description",
      title: "Improved Stability",
      description: "Fixed sync issues and deadlock prevention.",
    },
    {
      icon: withAccent(<RefreshCw className="w-5 h-5" aria-hidden="true" />, "blue"),
      titleKey: "whatsNew.sync.title",
      descriptionKey: "whatsNew.sync.description",
      title: "Reliable Sync",
      description: "Better cloud synchronization with timeout protection.",
    },
  ],
  "1.3.0": [
    {
      icon: withAccent(<Sparkles className="w-5 h-5" aria-hidden="true" />, "purple"),
      titleKey: "whatsNew.leaderboards.title",
      descriptionKey: "whatsNew.leaderboards.description",
      title: "Leaderboards",
      description: "Compete anonymously with others.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "green"),
      titleKey: "whatsNew.spotify.title",
      descriptionKey: "whatsNew.spotify.description",
      title: "Spotify Integration",
      description: "Auto-play music during focus sessions.",
    },
    {
      icon: withAccent(<RefreshCw className="w-5 h-5" aria-hidden="true" />, "orange"),
      titleKey: "whatsNew.challenges.title",
      descriptionKey: "whatsNew.challenges.description",
      title: "Friend Challenges",
      description: "Challenge friends to build habits together.",
    },
    {
      icon: withAccent(<MessageSquare className="w-5 h-5" aria-hidden="true" />, "blue"),
      titleKey: "whatsNew.digest.title",
      descriptionKey: "whatsNew.digest.description",
      title: "Weekly Digest",
      description: "Get progress reports in your inbox.",
    },
  ],
  "1.2.0": [
    {
      icon: withAccent(<Shield className="w-5 h-5" aria-hidden="true" />, "green"),
      titleKey: "whatsNew.security.title",
      descriptionKey: "whatsNew.security.description",
      title: "Enhanced Security",
      description:
        "Improved data protection and validation to keep your information safe.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.performance.title",
      descriptionKey: "whatsNew.performance.description",
      title: "Better Performance",
      description: "Fixed sync issues and improved app stability.",
    },
    {
      icon: withAccent(<Download className="w-5 h-5" aria-hidden="true" />, "blue"),
      titleKey: "whatsNew.offline.title",
      descriptionKey: "whatsNew.offline.description",
      title: "Offline Support",
      description: "Your data is now saved even without internet connection.",
    },
    {
      icon: withAccent(<Moon className="w-5 h-5" aria-hidden="true" />, "purple"),
      titleKey: "whatsNew.oled.title",
      descriptionKey: "whatsNew.oled.description",
      title: "OLED Dark Mode",
      description: "True black theme for OLED screens saves battery.",
    },
  ],
  "1.2.1": [
    {
      icon: withAccent(<RefreshCw className="w-5 h-5" aria-hidden="true" />, "blue"),
      titleKey: "whatsNew.updateSystem.title",
      descriptionKey: "whatsNew.updateSystem.description",
      title: "Smart Update System",
      description:
        "Get notified about new versions even if installed outside Google Play.",
    },
    {
      icon: withAccent(<MessageSquare className="w-5 h-5" aria-hidden="true" />, "green"),
      titleKey: "whatsNew.feedbackEmail.title",
      descriptionKey: "whatsNew.feedbackEmail.description",
      title: "Improved Feedback",
      description:
        "Your feedback now reaches us faster via email notifications.",
    },
    {
      icon: withAccent(<Zap className="w-5 h-5" aria-hidden="true" />, "yellow"),
      titleKey: "whatsNew.bugFixes.title",
      descriptionKey: "whatsNew.bugFixes.description",
      title: "Bug Fixes",
      description: "Fixed various issues for a smoother experience.",
    },
  ],
};
