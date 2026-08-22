export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_deletion_blocks: {
        Row: {
          blocked_at: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      automation_history_state: {
        Row: {
          all_history_purged_at: number | null
          history_generation: number
          last_sequence: number
          record_revision_version: number
          updated_at: number
          user_id: string
        }
        Insert: {
          all_history_purged_at?: number | null
          history_generation?: number
          last_sequence?: number
          record_revision_version?: number
          updated_at: number
          user_id: string
        }
        Update: {
          all_history_purged_at?: number | null
          history_generation?: number
          last_sequence?: number
          record_revision_version?: number
          updated_at?: number
          user_id?: string
        }
        Relationships: []
      }
      automation_history_tombstones: {
        Row: {
          history_generation: number
          purged_at: number
          purged_transaction_id: string
          server_sequence: number
          user_id: string
        }
        Insert: {
          history_generation: number
          purged_at: number
          purged_transaction_id: string
          server_sequence: number
          user_id: string
        }
        Update: {
          history_generation?: number
          purged_at?: number
          purged_transaction_id?: string
          server_sequence?: number
          user_id?: string
        }
        Relationships: []
      }
      automation_mutations: {
        Row: {
          after_hash: string
          after_revision_token: string | null
          before_hash: string
          before_revision_token: string | null
          entity_id: string
          entity_type: string
          mutation_ordinal: number
          operation: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          after_hash: string
          after_revision_token?: string | null
          before_hash: string
          before_revision_token?: string | null
          entity_id: string
          entity_type: string
          mutation_ordinal: number
          operation: string
          transaction_id: string
          user_id: string
        }
        Update: {
          after_hash?: string
          after_revision_token?: string | null
          before_hash?: string
          before_revision_token?: string | null
          entity_id?: string
          entity_type?: string
          mutation_ordinal?: number
          operation?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_mutations_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "automation_transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      automation_preferences: {
        Row: {
          consent_epoch: string | null
          consented_at: number | null
          enabled: boolean
          enabled_rule_ids: string[]
          focus_habit_id: string | null
          focus_minimum_minutes: number
          planning_habit_mappings: Json
          revoked_at: number | null
          server_revision: number
          updated_at: number
          user_id: string
        }
        Insert: {
          consent_epoch?: string | null
          consented_at?: number | null
          enabled?: boolean
          enabled_rule_ids?: string[]
          focus_habit_id?: string | null
          focus_minimum_minutes?: number
          planning_habit_mappings?: Json
          revoked_at?: number | null
          server_revision?: number
          updated_at: number
          user_id: string
        }
        Update: {
          consent_epoch?: string | null
          consented_at?: number | null
          enabled?: boolean
          enabled_rule_ids?: string[]
          focus_habit_id?: string | null
          focus_minimum_minutes?: number
          planning_habit_mappings?: Json
          revoked_at?: number | null
          server_revision?: number
          updated_at?: number
          user_id?: string
        }
        Relationships: []
      }
      automation_record_revisions: {
        Row: {
          entity_id: string
          entity_type: string
          mutation_generation: number
          record_exists: boolean
          revision_token: string | null
          state_hash: string
          transaction_id: string | null
          updated_at: number
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          mutation_generation: number
          record_exists: boolean
          revision_token?: string | null
          state_hash: string
          transaction_id?: string | null
          updated_at: number
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          mutation_generation?: number
          record_exists?: boolean
          revision_token?: string | null
          state_hash?: string
          transaction_id?: string | null
          updated_at?: number
          user_id?: string
        }
        Relationships: []
      }
      automation_transactions: {
        Row: {
          consent_epoch: string
          created_at: number
          device_id: string
          history_generation: number
          id: string
          revision_ciphertext: string
          rule_id: string
          rule_version: number
          server_sequence: number
          source_id: string
          source_key: string
          source_revision: string
          source_type: string
          status: string
          undo_transaction_id: string | null
          undone_at: number | null
          updated_at: number
          user_id: string
        }
        Insert: {
          consent_epoch: string
          created_at: number
          device_id: string
          history_generation: number
          id: string
          revision_ciphertext: string
          rule_id: string
          rule_version: number
          server_sequence: number
          source_id: string
          source_key: string
          source_revision: string
          source_type: string
          status: string
          undo_transaction_id?: string | null
          undone_at?: number | null
          updated_at: number
          user_id: string
        }
        Update: {
          consent_epoch?: string
          created_at?: number
          device_id?: string
          history_generation?: number
          id?: string
          revision_ciphertext?: string
          rule_id?: string
          rule_version?: number
          server_sequence?: number
          source_id?: string
          source_key?: string
          source_revision?: string
          source_type?: string
          status?: string
          undo_transaction_id?: string | null
          undone_at?: number | null
          updated_at?: number
          user_id?: string
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
      journal_ai_consents: {
        Row: {
          generation: number
          granted_at: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          generation?: number
          granted_at?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          generation?: number
          granted_at?: string | null
          revoked_at?: string | null
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "journal_audio_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "journal_embeddings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          audio_ids: string[]
          bg_intensity: string | null
          bg_pattern: string | null
          content: string
          created_at: number
          date: string
          font: string | null
          font_size: string | null
          habit_snapshot: Json | null
          id: string
          ink_color: string | null
          mood: string | null
          paper_color: string | null
          paper_texture: string | null
          particle_speed: string | null
          photo_ids: string[]
          photo_layout: Json | null
          stickers: string[]
          tags: string[]
          template_id: string | null
          theme: string | null
          title: string
          updated_at: number
          user_id: string
        }
        Insert: {
          audio_ids?: string[]
          bg_intensity?: string | null
          bg_pattern?: string | null
          content?: string
          created_at: number
          date: string
          font?: string | null
          font_size?: string | null
          habit_snapshot?: Json | null
          id: string
          ink_color?: string | null
          mood?: string | null
          paper_color?: string | null
          paper_texture?: string | null
          particle_speed?: string | null
          photo_ids?: string[]
          photo_layout?: Json | null
          stickers?: string[]
          tags?: string[]
          template_id?: string | null
          theme?: string | null
          title?: string
          updated_at: number
          user_id: string
        }
        Update: {
          audio_ids?: string[]
          bg_intensity?: string | null
          bg_pattern?: string | null
          content?: string
          created_at?: number
          date?: string
          font?: string | null
          font_size?: string | null
          habit_snapshot?: Json | null
          id?: string
          ink_color?: string | null
          mood?: string | null
          paper_color?: string | null
          paper_texture?: string | null
          particle_speed?: string | null
          photo_ids?: string[]
          photo_layout?: Json | null
          stickers?: string[]
          tags?: string[]
          template_id?: string | null
          theme?: string | null
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
        Relationships: [
          {
            foreignKeyName: "journal_photos_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          sent_at: string
          type: string
          user_id: string
        }
        Insert: {
          date_key: string
          id?: string
          sent_at?: string
          type: string
          user_id: string
        }
        Update: {
          date_key?: string
          id?: string
          sent_at?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      rag_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string
          embedding: string
          id: string
          indexed_at: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          chunk_index: number
          content: string
          content_hash: string
          embedding: string
          id?: string
          indexed_at?: string
          source: string
          title: string
          updated_at: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string
          embedding?: string
          id?: string
          indexed_at?: string
          source?: string
          title?: string
          updated_at?: string
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
          updated_at: string | null
          user_id: string
        }
        Insert: {
          payload: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string | null
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
          updated_at: string
          user_id: string
          world_data: Json
        }
        Insert: {
          updated_at?: string
          user_id: string
          world_data?: Json
        }
        Update: {
          updated_at?: string
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
          focus_time: string | null
          habit_ids: string[]
          habit_time: string | null
          language: string | null
          mood_time: string | null
          mood_time_afternoon: string | null
          mood_time_evening: string | null
          mood_time_morning: string | null
          quiet_end: string | null
          quiet_start: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          days?: number[]
          enabled?: boolean
          focus_time?: string | null
          habit_ids?: string[]
          habit_time?: string | null
          language?: string | null
          mood_time?: string | null
          mood_time_afternoon?: string | null
          mood_time_evening?: string | null
          mood_time_morning?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          days?: number[]
          enabled?: boolean
          focus_time?: string | null
          habit_ids?: string[]
          habit_time?: string | null
          language?: string | null
          mood_time?: string | null
          mood_time_afternoon?: string | null
          mood_time_evening?: string | null
          mood_time_morning?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string | null
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
      acquire_push_delivery_permit: {
        Args: { p_owner_id: string; p_permit_token: string }
        Returns: {
          lease_epoch: number
          lease_expires_at: string
          owner_id: string
          permit_token: string
          state: string
        }[]
      }
      admit_account_deletion_recovery_attempt: {
        Args: { p_operation_id: string; p_recovery_secret_hash: string }
        Returns: {
          retry_after_seconds: number
          state: string
        }[]
      }
      advance_account_deletion_operation_phase: {
        Args: {
          p_lease_epoch: number
          p_lease_token: string
          p_next_phase: string
          p_operation_id: string
          p_recovery_secret_hash: string
        }
        Returns: boolean
      }
      automation_apply_mutation: {
        Args: { p_mutation: Json; p_owner: string; p_transaction_id: string }
        Returns: undefined
      }
      automation_canonical_json: { Args: { p_value: Json }; Returns: string }
      automation_commit_rejection: {
        Args: {
          p_code: string
          p_history_generation: number
          p_preference_revision: number
          p_transaction_id: string
        }
        Returns: Json
      }
      automation_current_projection: {
        Args: { p_entity_id: string; p_entity_type: string; p_owner: string }
        Returns: Json
      }
      automation_hash_json: { Args: { p_value: Json }; Returns: string }
      automation_now_ms: { Args: never; Returns: number }
      automation_preference_payload: {
        Args: {
          p_preference: Database["public"]["Tables"]["automation_preferences"]["Row"]
        }
        Returns: Json
      }
      automation_source_key: {
        Args: {
          p_consent_epoch: string
          p_owner: string
          p_rule_id: string
          p_rule_version: number
          p_source_id: string
          p_source_revision: string
          p_source_type: string
        }
        Returns: string
      }
      automation_undo_rejection: {
        Args: {
          p_code: string
          p_history_generation: number
          p_transaction_id: string
        }
        Returns: Json
      }
      begin_account_deletion_operation: {
        Args: {
          p_operation_id: string
          p_recovery_secret_hash: string
          p_user_id: string
        }
        Returns: {
          lease_epoch: number
          lease_token: string
          phase: string
          state: string
          user_id: string
        }[]
      }
      calculate_streak: { Args: { p_user_id: string }; Returns: number }
      claim_account_deletion_operation: {
        Args: { p_operation_id: string; p_recovery_secret_hash: string }
        Returns: {
          lease_epoch: number
          lease_token: string
          phase: string
          state: string
          user_id: string
        }[]
      }
      claim_push_install:
        | {
            Args: {
              p_device_id: string
              p_expected_owner_user_id: string
              p_platform?: string
              p_token: string
            }
            Returns: string
          }
        | {
            Args: { p_device_id: string; p_platform?: string; p_token: string }
            Returns: string
          }
      commit_automation_transaction: {
        Args: { p_request: Json }
        Returns: Json
      }
      commit_manual_sync_event: { Args: { p_request: Json }; Returns: Json }
      complete_account_deletion_operation: {
        Args: {
          p_lease_epoch: number
          p_lease_token: string
          p_operation_id: string
          p_recovery_secret_hash: string
        }
        Returns: boolean
      }
      drain_account_push_delivery_permits: {
        Args: {
          p_lease_epoch: number
          p_lease_token: string
          p_operation_id: string
          p_recovery_secret_hash: string
        }
        Returns: boolean
      }
      enforce_account_deletion_api_barrier: { Args: never; Returns: undefined }
      get_automation_history_snapshot: {
        Args: { p_cursor?: Json; p_snapshot_token?: Json }
        Returns: Json
      }
      get_automation_preference: { Args: never; Returns: Json }
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
      grant_journal_ai_consent: {
        Args: { p_expected_generation: number }
        Returns: boolean
      }
      is_journal_entry_payload_current: {
        Args: { p_entry: Json }
        Returns: boolean
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
      match_rag_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          content_hash: string
          id: string
          similarity: number
          source: string
          title: string
          updated_at: string
        }[]
      }
      purge_automation_history: {
        Args: {
          p_all: boolean
          p_device_id: string
          p_operation_id: string
          p_transaction_ids: string[]
        }
        Returns: Json
      }
      release_account_deletion_operation: {
        Args: {
          p_lease_epoch: number
          p_lease_token: string
          p_operation_id: string
          p_recovery_secret_hash: string
        }
        Returns: boolean
      }
      release_push_delivery_permit: {
        Args: {
          p_lease_epoch: number
          p_owner_id: string
          p_permit_token: string
        }
        Returns: boolean
      }
      renew_account_deletion_operation_lease: {
        Args: {
          p_lease_epoch: number
          p_lease_token: string
          p_operation_id: string
          p_recovery_secret_hash: string
        }
        Returns: boolean
      }
      reset_monthly_leaderboard: { Args: never; Returns: undefined }
      reset_weekly_leaderboard: { Args: never; Returns: undefined }
      revoke_automation_preference: { Args: never; Returns: Json }
      revoke_journal_ai_consent: { Args: never; Returns: boolean }
      revoke_push_install:
        | {
            Args: {
              p_device_id: string
              p_expected_owner_user_id: string
              p_token: string
            }
            Returns: number
          }
        | { Args: { p_device_id: string; p_token?: string }; Returns: number }
      set_automation_preference: {
        Args: {
          p_enabled_rule_ids: string[]
          p_expected_server_revision: number
          p_focus_habit_id: string
          p_focus_minimum_minutes: number
          p_planning_habit_mappings: Json
        }
        Returns: Json
      }
      set_automation_preference_with_planning: {
        Args: {
          p_device_id: string
          p_enabled_rule_ids: string[]
          p_expected_server_revision: number
          p_focus_habit_id: string
          p_focus_minimum_minutes: number
          p_planning_blocks: Json
          p_planning_habit_mappings: Json
        }
        Returns: Json
      }
      undo_automation_transaction: { Args: { p_request: Json }; Returns: Json }
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
      upsert_journal_embeddings_if_consented: {
        Args: { p_rows: Json }
        Returns: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

