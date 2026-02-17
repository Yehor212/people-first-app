/**
 * What's New Modal — changelog data
 * Extracted from WhatsNewModal.tsx for TD-20 decomposition
 */

import { Sparkles, Shield, Zap, Download, Moon, RefreshCw, MessageSquare, ToggleRight, Bug, Settings } from 'lucide-react';

export interface ChangelogItem {
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  // Fallback English text
  title: string;
  description: string;
}

// Changelog entries by version — exported for SettingsPanel banner
export const CHANGELOG: Record<string, ChangelogItem[]> = {
  '1.7.1': [
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.googleOnly.title',
      descriptionKey: 'whatsNew.googleOnly.description',
      title: 'Google Sign-In Only',
      description: 'Sign in securely with Google. Email and skip options removed for better account security.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.codeQuality.title',
      descriptionKey: 'whatsNew.codeQuality.description',
      title: 'Code Quality',
      description: '271 code quality warnings fixed to zero. Smoother, more reliable experience.',
    },
  ],
  '1.7.0': [
    {
      icon: <Sparkles className="w-5 h-5 text-purple-500" />,
      titleKey: 'whatsNew.animatedTree.title',
      descriptionKey: 'whatsNew.animatedTree.description',
      title: 'Animated Tree',
      description: 'Your garden tree now has beautiful seasonal animations with falling petals, leaves, and snowflakes.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.treatsSystem.title',
      descriptionKey: 'whatsNew.treatsSystem.description',
      title: 'Treats System',
      description: 'Earn treats from habits, writing, and focus sessions. Use them to water and grow your tree!',
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.personalJournal.title',
      descriptionKey: 'whatsNew.personalJournal.description',
      title: 'Diary',
      description: 'Voice notes, premium templates, export, and biometric lock for your private entries.',
    },
    {
      icon: <Settings className="w-5 h-5 text-indigo-500" />,
      titleKey: 'whatsNew.settingsRedesign.title',
      descriptionKey: 'whatsNew.settingsRedesign.description',
      title: 'Redesigned Settings',
      description: 'Cleaner settings with better import flow, auto-clearing notifications, and improved accessibility.',
    },
    {
      icon: <Bug className="w-5 h-5 text-orange-500" />,
      titleKey: 'whatsNew.auditFixes.title',
      descriptionKey: 'whatsNew.auditFixes.description',
      title: 'Stability & Polish',
      description: '200+ bug fixes across all tabs for a smoother, more reliable experience.',
    },
  ],
  '1.6.0': [
    {
      icon: <Sparkles className="w-5 h-5 text-purple-500" />,
      titleKey: 'whatsNew.redesign.title',
      descriptionKey: 'whatsNew.redesign.description',
      title: 'New Design',
      description: 'Streamlined 3-tab layout with quick mood logging.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.performance160.title',
      descriptionKey: 'whatsNew.performance160.description',
      title: 'Faster & Smoother',
      description: 'Fixed crashes, improved loading speed and stability.',
    },
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.accessibility.title',
      descriptionKey: 'whatsNew.accessibility.description',
      title: 'Accessibility',
      description: 'Better screen reader support and keyboard navigation.',
    },
  ],
  '1.5.7': [
    {
      icon: <ToggleRight className="w-5 h-5 text-purple-500" />,
      titleKey: 'whatsNew.featureToggles.title',
      descriptionKey: 'whatsNew.featureToggles.description',
      title: 'Feature Toggles',
      description: 'Enable/disable app modules in Settings.',
    },
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.securityFixes.title',
      descriptionKey: 'whatsNew.securityFixes.description',
      title: 'Enhanced Security',
      description: 'Fixed vulnerabilities and improved data protection.',
    },
    {
      icon: <Bug className="w-5 h-5 text-orange-500" />,
      titleKey: 'whatsNew.bugFixes158.title',
      descriptionKey: 'whatsNew.bugFixes158.description',
      title: 'Bug Fixes',
      description: 'Fixed sync issues and improved stability.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.uiImprovements.title',
      descriptionKey: 'whatsNew.uiImprovements.description',
      title: 'UI Improvements',
      description: 'Better toggle switches and settings organization.',
    },
  ],
  '1.3.5': [
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.security.title',
      descriptionKey: 'whatsNew.security.description',
      title: 'Enhanced Security',
      description: 'Better data protection & privacy.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.performance.title',
      descriptionKey: 'whatsNew.performance.description',
      title: 'Improved Stability',
      description: 'Fixed sync issues and deadlock prevention.',
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.sync.title',
      descriptionKey: 'whatsNew.sync.description',
      title: 'Reliable Sync',
      description: 'Better cloud synchronization with timeout protection.',
    },
  ],
  '1.3.0': [
    {
      icon: <Sparkles className="w-5 h-5 text-purple-500" />,
      titleKey: 'whatsNew.leaderboards.title',
      descriptionKey: 'whatsNew.leaderboards.description',
      title: 'Leaderboards',
      description: 'Compete anonymously with others.',
    },
    {
      icon: <Zap className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.spotify.title',
      descriptionKey: 'whatsNew.spotify.description',
      title: 'Spotify Integration',
      description: 'Auto-play music during focus sessions.',
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-orange-500" />,
      titleKey: 'whatsNew.challenges.title',
      descriptionKey: 'whatsNew.challenges.description',
      title: 'Friend Challenges',
      description: 'Challenge friends to build habits together.',
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.digest.title',
      descriptionKey: 'whatsNew.digest.description',
      title: 'Weekly Digest',
      description: 'Get progress reports in your inbox.',
    },
  ],
  '1.2.0': [
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.security.title',
      descriptionKey: 'whatsNew.security.description',
      title: 'Enhanced Security',
      description: 'Improved data protection and validation to keep your information safe.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.performance.title',
      descriptionKey: 'whatsNew.performance.description',
      title: 'Better Performance',
      description: 'Fixed sync issues and improved app stability.',
    },
    {
      icon: <Download className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.offline.title',
      descriptionKey: 'whatsNew.offline.description',
      title: 'Offline Support',
      description: 'Your data is now saved even without internet connection.',
    },
    {
      icon: <Moon className="w-5 h-5 text-purple-500" />,
      titleKey: 'whatsNew.oled.title',
      descriptionKey: 'whatsNew.oled.description',
      title: 'OLED Dark Mode',
      description: 'True black theme for OLED screens saves battery.',
    },
  ],
  '1.2.1': [
    {
      icon: <RefreshCw className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.updateSystem.title',
      descriptionKey: 'whatsNew.updateSystem.description',
      title: 'Smart Update System',
      description: 'Get notified about new versions even if installed outside Google Play.',
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.feedbackEmail.title',
      descriptionKey: 'whatsNew.feedbackEmail.description',
      title: 'Improved Feedback',
      description: 'Your feedback now reaches us faster via email notifications.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.bugFixes.title',
      descriptionKey: 'whatsNew.bugFixes.description',
      title: 'Bug Fixes',
      description: 'Fixed various issues for a smoother experience.',
    },
  ],
};
