import type {
  ChallengeLeaderboard,
  ChallengeMember,
  FriendChallenge,
} from "@/types/challenges";
import type { Language } from "@/i18n/translations";

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "ReflowParticipantCurrent01",
  uk: "УчасникПеревіркиМакета01",
  es: "ParticipanteActualPrueba01",
  de: "AktuelleLayoutTestperson01",
  fr: "ParticipantActuelTest01",
  ja: "現在のレイアウト確認参加者01",
  ar: "مشاركحالياختبارالتدفق01",
  he: "משתתףנוכחיבדיקתפריסה01",
};

const CLOUD_CHALLENGE: FriendChallenge = {
  id: "reflow-cloud-challenge-01",
  code: "ZEN-REFLOW",
  creatorId: "reflow-creator-01",
  habitName: "Reflow challenge",
  habitIcon: "Leaf",
  duration: 365,
  startDate: "2026-01-01",
  endDate: "2027-01-01",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
};

function currentLanguage(): Language {
  const language = document.documentElement.lang as Language;
  return language in LANGUAGE_NAMES ? language : "en";
}

function buildMembers(): ChallengeMember[] {
  const language = currentLanguage();
  return Array.from({ length: 5 }, (_, index) => ({
    id: `reflow-member-${index + 1}`,
    challengeId: CLOUD_CHALLENGE.id,
    userId: `reflow-user-${index + 1}`,
    displayName:
      index === 3 ? LANGUAGE_NAMES[language] : `ReflowProbe${String(index + 1).padStart(2, "0")}`,
    daysCompleted: 365 - index * 37,
    currentStreak: index === 4 ? 0 : 365 - index * 41,
    lastActivityDate: "2026-08-11",
    completed: index === 0 || index === 3,
    completedAt: index === 0 ? "2026-08-10T00:00:00.000Z" : null,
    joinedAt: "2026-01-01T00:00:00.000Z",
    rank: index + 1,
    isCurrentUser: index === 3,
  }));
}

export function isCloudChallengesAvailable(): boolean {
  return true;
}

export async function syncLocalChallengeToCloud(): Promise<FriendChallenge> {
  return CLOUD_CHALLENGE;
}

export async function getChallengeLeaderboard(): Promise<ChallengeLeaderboard> {
  const members = buildMembers();
  return {
    challenge: CLOUD_CHALLENGE,
    members,
    myProgress: members.find((member) => member.isCurrentUser) ?? null,
  };
}

export function subscribeToChallenge(): () => void {
  return () => undefined;
}

export async function updateMyProgress(): Promise<boolean> {
  return true;
}
