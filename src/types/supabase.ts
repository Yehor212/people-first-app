/**
 * Supabase Database Types
 * Generated from schema for type safety
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          preferred_language: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          timezone?: string;
          updated_at?: string;
        };
      };
      moods: {
        Row: {
          id: string;
          user_id: string;
          mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
          note: string | null;
          tags: string[];
          date: string;
          timestamp: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
          note?: string | null;
          tags?: string[];
          date: string;
          timestamp: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
          note?: string | null;
          tags?: string[];
          date?: string;
          timestamp?: number;
          updated_at?: string;
        };
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          color: string;
          type: 'continuous' | 'daily' | 'scheduled' | 'multiple' | 'reduce';
          frequency: 'once' | 'daily' | 'weekly' | 'custom';
          custom_days: number[];
          requires_duration: boolean;
          target_duration: number | null;
          start_date: string | null;
          daily_target: number;
          target_count: number | null;
          template_id: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          icon?: string;
          color?: string;
          type?: 'continuous' | 'daily' | 'scheduled' | 'multiple' | 'reduce';
          frequency?: 'once' | 'daily' | 'weekly' | 'custom';
          custom_days?: number[];
          requires_duration?: boolean;
          target_duration?: number | null;
          start_date?: string | null;
          daily_target?: number;
          target_count?: number | null;
          template_id?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          icon?: string;
          color?: string;
          type?: 'continuous' | 'daily' | 'scheduled' | 'multiple' | 'reduce';
          frequency?: 'once' | 'daily' | 'weekly' | 'custom';
          custom_days?: number[];
          requires_duration?: boolean;
          target_duration?: number | null;
          start_date?: string | null;
          daily_target?: number;
          target_count?: number | null;
          template_id?: string | null;
          is_archived?: boolean;
          updated_at?: string;
        };
      };
      habit_completions: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          date: string;
          count: number;
          duration: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          date: string;
          count?: number;
          duration?: number | null;
          created_at?: string;
        };
        Update: {
          count?: number;
          duration?: number | null;
        };
      };
      habit_reminders: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          enabled: boolean;
          time: string;
          days: number[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          enabled?: boolean;
          time?: string;
          days?: number[];
          created_at?: string;
        };
        Update: {
          enabled?: boolean;
          time?: string;
          days?: number[];
        };
      };
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          duration: number;
          label: string | null;
          status: 'completed' | 'aborted';
          reflection: number | null;
          date: string;
          completed_at: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          duration: number;
          label?: string | null;
          status?: 'completed' | 'aborted';
          reflection?: number | null;
          date: string;
          completed_at: number;
          created_at?: string;
        };
        Update: {
          duration?: number;
          label?: string | null;
          status?: 'completed' | 'aborted';
          reflection?: number | null;
        };
      };
      gratitude_entries: {
        Row: {
          id: string;
          user_id: string;
          text: string;
          date: string;
          timestamp: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          text: string;
          date: string;
          timestamp: number;
          created_at?: string;
        };
        Update: {
          text?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          weekly_digest_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          weekly_digest_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          weekly_digest_enabled?: boolean;
          updated_at?: string;
        };
      };
      challenges: {
        Row: {
          id: string;
          user_id: string;
          type: 'streak' | 'total' | 'focus' | 'gratitude';
          habit_id: string | null;
          target: number;
          progress: number;
          start_date: string;
          end_date: string | null;
          completed: boolean;
          completed_date: string | null;
          icon: string;
          title_ru: string | null;
          title_en: string | null;
          description_ru: string | null;
          description_en: string | null;
          reward: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'streak' | 'total' | 'focus' | 'gratitude';
          habit_id?: string | null;
          target: number;
          progress?: number;
          start_date: string;
          end_date?: string | null;
          completed?: boolean;
          completed_date?: string | null;
          icon: string;
          title_ru?: string | null;
          title_en?: string | null;
          description_ru?: string | null;
          description_en?: string | null;
          reward?: string | null;
          created_at?: string;
        };
        Update: {
          progress?: number;
          completed?: boolean;
          completed_date?: string | null;
        };
      };
      badges: {
        Row: {
          id: string;
          user_id: string;
          badge_type: string;
          unlocked_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_type: string;
          unlocked_date: string;
          created_at?: string;
        };
        Update: never;
      };
      adhd_state: {
        Row: {
          user_id: string;
          combo_count: number;
          combo_multiplier: number;
          combo_last_action: number | null;
          combo_expires_at: number | null;
          spin_tokens: number;
          login_streak: number;
          last_login_date: string | null;
          total_xp: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          combo_count?: number;
          combo_multiplier?: number;
          combo_last_action?: number | null;
          combo_expires_at?: number | null;
          spin_tokens?: number;
          login_streak?: number;
          last_login_date?: string | null;
          total_xp?: number;
          updated_at?: string;
        };
        Update: {
          combo_count?: number;
          combo_multiplier?: number;
          combo_last_action?: number | null;
          combo_expires_at?: number | null;
          spin_tokens?: number;
          login_streak?: number;
          last_login_date?: string | null;
          total_xp?: number;
          updated_at?: string;
        };
      };
      mystery_boxes: {
        Row: {
          id: string;
          user_id: string;
          type: 'bronze' | 'silver' | 'gold' | 'diamond';
          icon: string;
          unlocked_at: number;
          opened_at: number | null;
          rewards: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'bronze' | 'silver' | 'gold' | 'diamond';
          icon: string;
          unlocked_at: number;
          opened_at?: number | null;
          rewards?: unknown;
          created_at?: string;
        };
        Update: {
          opened_at?: number | null;
          rewards?: unknown;
        };
      };
      time_challenges: {
        Row: {
          id: string;
          user_id: string;
          type: 'flash' | 'hourly' | 'weekend';
          title: string;
          description: string | null;
          icon: string;
          target: number;
          progress: number;
          reward_xp: number;
          reward_spins: number;
          expires_at: number;
          completed: boolean;
          claimed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'flash' | 'hourly' | 'weekend';
          title: string;
          description?: string | null;
          icon: string;
          target: number;
          progress?: number;
          reward_xp: number;
          reward_spins?: number;
          expires_at: number;
          completed?: boolean;
          claimed?: boolean;
          created_at?: string;
        };
        Update: {
          progress?: number;
          completed?: boolean;
          claimed?: boolean;
        };
      };
      user_backups: {
        Row: {
          user_id: string;
          payload: unknown;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          payload: unknown;
          updated_at?: string;
        };
        Update: {
          payload?: unknown;
          updated_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          keys: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          keys: unknown;
          created_at?: string;
        };
        Update: {
          endpoint?: string;
          keys?: unknown;
        };
      };
      // Tasks & Quests cloud sync tables
      user_tasks: {
        Row: {
          user_id: string;
          task_id: string;
          name: string;
          description: string | null;
          urgent: boolean;
          estimated_minutes: number;
          user_rating: number | null;
          completed: boolean;
          due_date: string | null;
          category: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          task_id: string;
          name: string;
          description?: string | null;
          urgent?: boolean;
          estimated_minutes?: number;
          user_rating?: number | null;
          completed?: boolean;
          due_date?: string | null;
          category?: string | null;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          urgent?: boolean;
          estimated_minutes?: number;
          user_rating?: number | null;
          completed?: boolean;
          due_date?: string | null;
          category?: string | null;
          updated_at?: string;
        };
      };
      user_quests: {
        Row: {
          user_id: string;
          quest_id: string;
          type: 'daily' | 'weekly' | 'bonus';
          category: string;
          title: string;
          description: string;
          condition: unknown;
          reward: unknown;
          progress: number;
          total: number;
          completed: boolean;
          expires_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          quest_id: string;
          type: 'daily' | 'weekly' | 'bonus';
          category: string;
          title: string;
          description: string;
          condition: unknown;
          reward: unknown;
          progress?: number;
          total: number;
          completed?: boolean;
          expires_at: string;
          updated_at?: string;
        };
        Update: {
          progress?: number;
          completed?: boolean;
          updated_at?: string;
        };
      };
      user_challenges: {
        Row: {
          user_id: string;
          challenge_id: string;
          type: string;
          title: unknown;
          description: unknown;
          target: number;
          progress: number;
          completed: boolean;
          badge_id: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          challenge_id: string;
          type: string;
          title: unknown;
          description: unknown;
          target: number;
          progress?: number;
          completed?: boolean;
          badge_id?: string | null;
          updated_at?: string;
        };
        Update: {
          progress?: number;
          completed?: boolean;
          updated_at?: string;
        };
      };
      user_badges: {
        Row: {
          user_id: string;
          badge_id: string;
          category: string;
          icon: string;
          title: unknown;
          description: unknown;
          requirement: number;
          unlocked: boolean;
          unlocked_date: string | null;
          rarity: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          badge_id: string;
          category: string;
          icon: string;
          title: unknown;
          description: unknown;
          requirement: number;
          unlocked?: boolean;
          unlocked_date?: string | null;
          rarity: string;
          updated_at?: string;
        };
        Update: {
          unlocked?: boolean;
          unlocked_date?: string | null;
          updated_at?: string;
        };
      };
      user_inner_world: {
        Row: {
          user_id: string;
          world_data: unknown;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          world_data: unknown;
          updated_at?: string;
        };
        Update: {
          world_data?: unknown;
          updated_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          category: 'bug' | 'feature' | 'other';
          message: string;
          email: string | null;
          device_info: unknown;
          app_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: 'bug' | 'feature' | 'other';
          message: string;
          email?: string | null;
          device_info?: unknown;
          app_version?: string;
          created_at?: string;
        };
        Update: never;
      };
    };
    Functions: {
      calculate_streak: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_user_stats: {
        Args: { p_user_id: string };
        Returns: {
          currentStreak: number;
          totalFocusMinutes: number;
          habitsCompleted: number;
          moodEntries: number;
          gratitudeEntries: number;
          totalBadges: number;
        };
      };
    };
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
