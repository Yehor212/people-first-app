export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      adhd_state: {
        Row: {
          combo_count: number | null
          combo_expires_at: number | null
          combo_last_action: number | null
          combo_multiplier: number | null
          last_login_date: string | null
          login_streak: number | null
          spin_tokens: number | null
          total_xp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          combo_count?: number | null
          combo_expires_at?: number | null
          combo_last_action?: number | null
          combo_multiplier?: number | null
          last_login_date?: string | null
          login_streak?: number | null
          spin_tokens?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          combo_count?: number | null
          combo_expires_at?: number | null
          combo_last_action?: number | null
          combo_multiplier?: number | null
          last_login_date?: string | null
          login_streak?: number | null
          spin_tokens?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          badge_type: string
          created_at: string | null
          id: string
          unlocked_date: string
          user_id: string
        }
        Insert: {
          badge_type: string
          created_at?: string | null
          id?: string
          unlocked_date: string
          user_id: string
        }
        Update: {
          badge_type?: string
          created_at?: string | null
          id?: string
          unlocked_date?: string
          user_id?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          completed: boolean | null
          completed_date: string | null
          created_at: string | null
          description_en: string | null
          description_ru: string | null
          end_date: string | null
          habit_id: string | null
          icon: string
          id: string
          progress: number | null
          reward: string | null
          start_date: string
          target: number
          title_en: string | null
          title_ru: string | null
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_date?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ru?: string | null
          end_date?: string | null
          habit_id?: string | null
          icon: string
          id?: string
          progress?: number | null
          reward?: string | null
          start_date: string
          target: number
          title_en?: string | null
          title_ru?: string | null
          type: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_date?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ru?: string | null
          end_date?: string | null
          habit_id?: string | null
          icon?: string
          id?: string
          progress?: number | null
          reward?: string | null
          start_date?: string
          target?: number
          title_en?: string | null
          title_ru?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      design_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          killswitch: boolean
          rollout_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          killswitch?: boolean
          rollout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          killswitch?: boolean
          rollout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          first_seen_at: string
          id: string
          label: string
          last_seen_at: string
          platform: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          first_seen_at?: string
          id?: string
          label: string
          last_seen_at?: string
          platform: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          first_seen_at?: string
          id?: string
          label?: string
          last_seen_at?: string
          platform?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          app_version: string | null
          category: string
          created_at: string | null
          device_info: Json | null
          email: string | null
          id: string
          message: string
        }
        Insert: {
          app_version?: string | null
          category: string
          created_at?: string | null
          device_info?: Json | null
          email?: string | null
          id?: string
          message: string
        }
        Update: {
          app_version?: string | null
          category?: string
          created_at?: string | null
          device_info?: Json | null
          email?: string | null
          id?: string
          message?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          completed_at: number
          created_at: string | null
          date: string
          duration: number
          id: string
          label: string | null
          reflection: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at: number
          created_at?: string | null
          date: string
          duration: number
          id?: string
          label?: string | null
          reflection?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: number
          created_at?: string | null
          date?: string
          duration?: number
          id?: string
          label?: string | null
          reflection?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friend_challenge_members: {
        Row: {
          challenge_id: string
          completed: boolean | null
          completed_at: string | null
          current_streak: number | null
          days_completed: number | null
          display_name: string
          id: string
          joined_at: string | null
          last_activity_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean | null
          completed_at?: string | null
          current_streak?: number | null
          days_completed?: number | null
          display_name?: string
          id?: string
          joined_at?: string | null
          last_activity_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean | null
          completed_at?: string | null
          current_streak?: number | null
          days_completed?: number | null
          display_name?: string
          id?: string
          joined_at?: string | null
          last_activity_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_challenge_members_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "friend_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_challenges: {
        Row: {
          code: string
          created_at: string | null
          creator_id: string
          duration: number
          end_date: string
          habit_icon: string
          habit_name: string
          id: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          creator_id: string
          duration: number
          end_date: string
          habit_icon?: string
          habit_name: string
          id?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          creator_id?: string
          duration?: number
          end_date?: string
          habit_icon?: string
          habit_name?: string
          id?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gratitude_entries: {
        Row: {
          created_at: string | null
          date: string
          id: string
          text: string
          timestamp: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          text: string
          timestamp: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          text?: string
          timestamp?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          count: number | null
          created_at: string | null
          date: string
          duration: number | null
          entry_status: string
          entry_value: number | null
          habit_id: string
          habit_type: string
          id: string
          is_complete: boolean
          target_type: string | null
          user_id: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          date: string
          duration?: number | null
          entry_status?: string
          entry_value?: number | null
          habit_id: string
          habit_type?: string
          id?: string
          is_complete?: boolean
          target_type?: string | null
          user_id: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          date?: string
          duration?: number | null
          entry_status?: string
          entry_value?: number | null
          habit_id?: string
          habit_type?: string
          id?: string
          is_complete?: boolean
          target_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_reminders: {
        Row: {
          created_at: string | null
          days: number[] | null
          enabled: boolean | null
          habit_id: string
          id: string
          time: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          days?: number[] | null
          enabled?: boolean | null
          habit_id: string
          id?: string
          time?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          days?: number[] | null
          enabled?: boolean | null
          habit_id?: string
          id?: string
          time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_reminders_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          color: string
          created_at: string | null
          custom_days: number[] | null
          daily_target: number | null
          frequency: string
          icon: string
          id: string
          is_archived: boolean | null
          name: string
          requires_duration: boolean | null
          start_date: string | null
          target_count: number | null
          target_duration: number | null
          template_id: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          custom_days?: number[] | null
          daily_target?: number | null
          frequency?: string
          icon?: string
          id?: string
          is_archived?: boolean | null
          name: string
          requires_duration?: boolean | null
          start_date?: string | null
          target_count?: number | null
          target_duration?: number | null
          template_id?: string | null
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          custom_days?: number[] | null
          daily_target?: number | null
          frequency?: string
          icon?: string
          id?: string
          is_archived?: boolean | null
          name?: string
          requires_duration?: boolean | null
          start_date?: string | null
          target_count?: number | null
          target_duration?: number | null
          template_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      journal_audio: {
        Row: {
          created_at: number
          duration: number
          entry_id: string
          id: string
          mime_type: string
          storage_path: string | null
          storage_url: string | null
          user_id: string
        }
        Insert: {
          created_at: number
          duration?: number
          entry_id: string
          id: string
          mime_type?: string
          storage_path?: string | null
          storage_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: number
          duration?: number
          entry_id?: string
          id?: string
          mime_type?: string
          storage_path?: string | null
          storage_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      journal_embeddings: {
        Row: {
          content_hash: string
          created_at: string
          embedding: string
          entry_id: string
          user_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          embedding: string
          entry_id: string
          user_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          embedding?: string
          entry_id?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          audio_ids: string[]
          content: string
          created_at: number
          date: string
          habit_snapshot: Json | null
          id: string
          mood: string | null
          photo_ids: string[]
          stickers: string[]
          tags: string[]
          template_id: string | null
          title: string
          updated_at: number
          user_id: string
        }
        Insert: {
          audio_ids?: string[]
          content?: string
          created_at: number
          date: string
          habit_snapshot?: Json | null
          id: string
          mood?: string | null
          photo_ids?: string[]
          stickers?: string[]
          tags?: string[]
          template_id?: string | null
          title?: string
          updated_at: number
          user_id: string
        }
        Update: {
          audio_ids?: string[]
          content?: string
          created_at?: number
          date?: string
          habit_snapshot?: Json | null
          id?: string
          mood?: string | null
          photo_ids?: string[]
          stickers?: string[]
          tags?: string[]
          template_id?: string | null
          title?: string
          updated_at?: number
          user_id?: string
        }
        Relationships: []
      }
      journal_photos: {
        Row: {
          created_at: number
          entry_id: string
          height: number
          id: string
          storage_path: string | null
          storage_url: string | null
          user_id: string
          width: number
        }
        Insert: {
          created_at: number
          entry_id: string
          height?: number
          id: string
          storage_path?: string | null
          storage_url?: string | null
          user_id: string
          width?: number
        }
        Update: {
          created_at?: number
          entry_id?: string
          height?: number
          id?: string
          storage_path?: string | null
          storage_url?: string | null
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      leaderboards: {
        Row: {
          all_time_xp: number | null
          created_at: string | null
          current_month: number | null
          current_streak: number | null
          current_week: number | null
          current_year: number | null
          display_name: string | null
          id: string
          longest_streak: number | null
          monthly_xp: number | null
          opt_in: boolean | null
          updated_at: string | null
          user_id: string
          weekly_xp: number | null
        }
        Insert: {
          all_time_xp?: number | null
          created_at?: string | null
          current_month?: number | null
          current_streak?: number | null
          current_week?: number | null
          current_year?: number | null
          display_name?: string | null
          id?: string
          longest_streak?: number | null
          monthly_xp?: number | null
          opt_in?: boolean | null
          updated_at?: string | null
          user_id: string
          weekly_xp?: number | null
        }
        Update: {
          all_time_xp?: number | null
          created_at?: string | null
          current_month?: number | null
          current_streak?: number | null
          current_week?: number | null
          current_year?: number | null
          display_name?: string | null
          id?: string
          longest_streak?: number | null
          monthly_xp?: number | null
          opt_in?: boolean | null
          updated_at?: string | null
          user_id?: string
          weekly_xp?: number | null
        }
        Relationships: []
      }
      moods: {
        Row: {
          contexts: string[] | null
          created_at: string | null
          date: string
          emotion: Json | null
          emotion_tags: string[] | null
          id: string
          log_type: string | null
          mood: string | null
          note: string | null
          tags: string[] | null
          timestamp: number
          updated_at: string | null
          user_id: string
          valence: number | null
        }
        Insert: {
          contexts?: string[] | null
          created_at?: string | null
          date: string
          emotion?: Json | null
          emotion_tags?: string[] | null
          id?: string
          log_type?: string | null
          mood?: string | null
          note?: string | null
          tags?: string[] | null
          timestamp: number
          updated_at?: string | null
          user_id: string
          valence?: number | null
        }
        Update: {
          contexts?: string[] | null
          created_at?: string | null
          date?: string
          emotion?: Json | null
          emotion_tags?: string[] | null
          id?: string
          log_type?: string | null
          mood?: string | null
          note?: string | null
          tags?: string[] | null
          timestamp?: number
          updated_at?: string | null
          user_id?: string
          valence?: number | null
        }
        Relationships: []
      }
      mystery_boxes: {
        Row: {
          created_at: string | null
          icon: string
          id: string
          opened_at: number | null
          rewards: Json | null
          type: string
          unlocked_at: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icon: string
          id?: string
          opened_at?: number | null
          rewards?: Json | null
          type: string
          unlocked_at: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          icon?: string
          id?: string
          opened_at?: number | null
          rewards?: Json | null
          type?: string
          unlocked_at?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          app_version: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          last_active_at: string | null
          preferred_language: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          app_version?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          last_active_at?: string | null
          preferred_language?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          app_version?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          last_active_at?: string | null
          preferred_language?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_logs: {
        Row: {
          date_key: string
          sent_at: string
          type: string
          user_id: string
        }
        Insert: {
          date_key: string
          sent_at?: string
          type: string
          user_id: string
        }
        Update: {
          date_key?: string
          sent_at?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string | null
          id: string
          keys: Json | null
          subscription: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          keys?: Json | null
          subscription: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          keys?: Json | null
          subscription?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_events: {
        Row: {
          created_at: string
          device_id: string
          entity_id: string
          entity_type: string
          id: string
          idempotency_key: string
          op: string
          payload: Json | null
          seq: number
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          device_id: string
          entity_id: string
          entity_type: string
          id?: string
          idempotency_key?: string
          op: string
          payload?: Json | null
          seq?: number
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          device_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          idempotency_key?: string
          op?: string
          payload?: Json | null
          seq?: number
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      sync_seq_counters: {
        Row: {
          last_seq: number
          user_id: string
        }
        Insert: {
          last_seq?: number
          user_id: string
        }
        Update: {
          last_seq?: number
          user_id?: string
        }
        Relationships: []
      }
      sync_tombstones: {
        Row: {
          created_at: string
          deleted_at: string
          deleted_event_id: string | null
          deleted_seq: number
          device_id: string
          entity_id: string
          entity_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at: string
          deleted_event_id?: string | null
          deleted_seq: number
          device_id: string
          entity_id: string
          entity_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string
          deleted_event_id?: string | null
          deleted_seq?: number
          device_id?: string
          entity_id?: string
          entity_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_tombstones_deleted_event_id_fkey"
            columns: ["deleted_event_id"]
            isOneToOne: false
            referencedRelation: "sync_events"
            referencedColumns: ["id"]
          },
        ]
      }
      time_challenges: {
        Row: {
          claimed: boolean | null
          completed: boolean | null
          created_at: string | null
          description: string | null
          expires_at: number
          icon: string
          id: string
          progress: number | null
          reward_spins: number | null
          reward_xp: number
          target: number
          title: string
          type: string
          user_id: string
        }
        Insert: {
          claimed?: boolean | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          expires_at: number
          icon: string
          id?: string
          progress?: number | null
          reward_spins?: number | null
          reward_xp: number
          target: number
          title: string
          type: string
          user_id: string
        }
        Update: {
          claimed?: boolean | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          expires_at?: number
          icon?: string
          id?: string
          progress?: number | null
          reward_spins?: number | null
          reward_xp?: number
          target?: number
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_backups: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          category: string
          created_at: string | null
          description: Json
          icon: string
          id: string
          rarity: string
          requirement: number
          title: Json
          unlocked: boolean | null
          unlocked_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          badge_id: string
          category: string
          created_at?: string | null
          description?: Json
          icon: string
          id?: string
          rarity: string
          requirement: number
          title?: Json
          unlocked?: boolean | null
          unlocked_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string
          category?: string
          created_at?: string | null
          description?: Json
          icon?: string
          id?: string
          rarity?: string
          requirement?: number
          title?: Json
          unlocked?: boolean | null
          unlocked_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          description: Json
          end_date: string | null
          habit_id: string | null
          icon: string
          id: string
          progress: number | null
          reward: string | null
          started_at: string | null
          target: number
          title: Json
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: Json
          end_date?: string | null
          habit_id?: string | null
          icon: string
          id?: string
          progress?: number | null
          reward?: string | null
          started_at?: string | null
          target: number
          title?: Json
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: Json
          end_date?: string | null
          habit_id?: string | null
          icon?: string
          id?: string
          progress?: number | null
          reward?: string | null
          started_at?: string | null
          target?: number
          title?: Json
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_data: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_inner_world: {
        Row: {
          updated_at: string | null
          user_id: string
          world_data: Json
        }
        Insert: {
          updated_at?: string | null
          user_id: string
          world_data: Json
        }
        Update: {
          updated_at?: string | null
          user_id?: string
          world_data?: Json
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_emoji: string | null
          created_at: string | null
          current_streak: number | null
          display_name: string | null
          friend_code: string
          id: string
          level: number | null
          share_activity: boolean | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_emoji?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          friend_code: string
          id?: string
          level?: number | null
          share_activity?: boolean | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_emoji?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          friend_code?: string
          id?: string
          level?: number | null
          share_activity?: boolean | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_quests: {
        Row: {
          category: string
          completed: boolean | null
          condition: Json
          created_at: string | null
          description: string
          expires_at: string
          id: string
          progress: number | null
          quest_id: string
          reward: Json
          title: string
          total: number
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          completed?: boolean | null
          condition: Json
          created_at?: string | null
          description: string
          expires_at: string
          id?: string
          progress?: number | null
          quest_id: string
          reward: Json
          title: string
          total: number
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          completed?: boolean | null
          condition?: Json
          created_at?: string | null
          description?: string
          expires_at?: string
          id?: string
          progress?: number | null
          quest_id?: string
          reward?: Json
          title?: string
          total?: number
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_reminder_settings: {
        Row: {
          days: number[]
          enabled: boolean
          focus_time: string
          habit_ids: string[]
          habit_time: string
          language: string
          mood_time: string
          mood_time_afternoon: string | null
          mood_time_evening: string | null
          mood_time_morning: string | null
          quiet_end: string
          quiet_start: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          days?: number[]
          enabled?: boolean
          focus_time?: string
          habit_ids?: string[]
          habit_time?: string
          language?: string
          mood_time?: string
          mood_time_afternoon?: string | null
          mood_time_evening?: string | null
          mood_time_morning?: string | null
          quiet_end?: string
          quiet_start?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          days?: number[]
          enabled?: boolean
          focus_time?: string
          habit_ids?: string[]
          habit_time?: string
          language?: string
          mood_time?: string
          mood_time_afternoon?: string | null
          mood_time_evening?: string | null
          mood_time_morning?: string | null
          quiet_end?: string
          quiet_start?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          key: string
          updated_at: string | null
          user_id: string
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          user_id: string
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          user_id?: string
          value?: Json | null
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string | null
          current_streak: number | null
          last_activity_date: string | null
          level: number | null
          longest_streak: number | null
          total_saved: number | null
          total_transactions: number | null
          updated_at: string | null
          user_id: string
          xp: number | null
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          last_activity_date?: string | null
          level?: number | null
          longest_streak?: number | null
          total_saved?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          user_id: string
          xp?: number | null
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          last_activity_date?: string | null
          level?: number | null
          longest_streak?: number | null
          total_saved?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          user_id?: string
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          category: string | null
          completed: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimated_minutes: number
          id: string
          name: string
          task_id: string
          updated_at: string | null
          urgent: boolean | null
          user_id: string
          user_rating: number | null
        }
        Insert: {
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes: number
          id?: string
          name: string
          task_id: string
          updated_at?: string | null
          urgent?: boolean | null
          user_id: string
          user_rating?: number | null
        }
        Update: {
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number
          id?: string
          name?: string
          task_id?: string
          updated_at?: string | null
          urgent?: boolean | null
          user_id?: string
          user_rating?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_streak: { Args: { p_user_id: string }; Returns: number }
      get_challenge_leaderboard: {
        Args: { p_challenge_id: string }
        Returns: {
          challenge_id: string
          completed: boolean
          completed_at: string
          current_streak: number
          days_completed: number
          display_name: string
          id: string
          joined_at: string
          last_activity_date: string
          user_id: string
        }[]
      }
      get_user_stats: { Args: { p_user_id: string }; Returns: Json }
      get_user_weekly_summary: {
        Args: { p_week_start?: string }
        Returns: Json
      }
      match_journal_entries: {
        Args: {
          match_count?: number
          match_threshold?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          entry_id: string
          similarity: number
        }[]
      }
      reset_monthly_leaderboard: { Args: never; Returns: undefined }
      reset_weekly_leaderboard: { Args: never; Returns: undefined }
      update_member_progress: {
        Args: {
          p_challenge_id: string
          p_current_streak: number
          p_days_completed: number
          p_user_id: string
        }
        Returns: {
          challenge_id: string
          completed: boolean | null
          completed_at: string | null
          current_streak: number | null
          days_completed: number | null
          display_name: string
          id: string
          joined_at: string | null
          last_activity_date: string | null
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "friend_challenge_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
