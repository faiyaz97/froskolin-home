export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      absence_periods: {
        Row: {
          created_at: string;
          created_by: string;
          end_date: string;
          household_id: string;
          id: string;
          member_id: string;
          start_date: string;
          updated_at: string;
          updated_by: string;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          end_date: string;
          household_id: string;
          id?: string;
          member_id: string;
          start_date: string;
          updated_at?: string;
          updated_by: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          end_date?: string;
          household_id?: string;
          id?: string;
          member_id?: string;
          start_date?: string;
          updated_at?: string;
          updated_by?: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "absence_periods_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absence_periods_member_id_household_id_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action_type: string;
          actor_user_id: string | null;
          batch_id: string | null;
          entity_id: string;
          entity_type: string;
          household_id: string;
          id: string;
          new_values: Json | null;
          occurred_at: string;
          previous_values: Json | null;
          summary: string;
        };
        Insert: {
          action_type: string;
          actor_user_id?: string | null;
          batch_id?: string | null;
          entity_id: string;
          entity_type: string;
          household_id: string;
          id?: string;
          new_values?: Json | null;
          occurred_at?: string;
          previous_values?: Json | null;
          summary: string;
        };
        Update: {
          action_type?: string;
          actor_user_id?: string | null;
          batch_id?: string | null;
          entity_id?: string;
          entity_type?: string;
          household_id?: string;
          id?: string;
          new_values?: Json | null;
          occurred_at?: string;
          previous_values?: Json | null;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_documents: {
        Row: {
          byte_count: number;
          confidence: Json | null;
          created_at: string;
          detected_mime: string;
          evidence: Json | null;
          extraction: Json | null;
          extraction_schema_version: string | null;
          gemini_consent_at: string | null;
          household_id: string;
          id: string;
          model: string | null;
          object_deleted_at: string | null;
          page_count: number | null;
          provider: string | null;
          sanitized_error: string | null;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploader_user_id: string;
        };
        Insert: {
          byte_count: number;
          confidence?: Json | null;
          created_at?: string;
          detected_mime: string;
          evidence?: Json | null;
          extraction?: Json | null;
          extraction_schema_version?: string | null;
          gemini_consent_at?: string | null;
          household_id: string;
          id?: string;
          model?: string | null;
          object_deleted_at?: string | null;
          page_count?: number | null;
          provider?: string | null;
          sanitized_error?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at?: string;
          uploader_user_id: string;
        };
        Update: {
          byte_count?: number;
          confidence?: Json | null;
          created_at?: string;
          detected_mime?: string;
          evidence?: Json | null;
          extraction?: Json | null;
          extraction_schema_version?: string | null;
          gemini_consent_at?: string | null;
          household_id?: string;
          id?: string;
          model?: string | null;
          object_deleted_at?: string | null;
          page_count?: number | null;
          provider?: string | null;
          sanitized_error?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path?: string;
          updated_at?: string;
          uploader_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_documents_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_attachments: {
        Row: {
          byte_count: number;
          created_at: string;
          detected_mime: string;
          expense_id: string;
          household_id: string;
          id: string;
          original_file_name: string;
          removed_at: string | null;
          storage_path: string;
          uploader_user_id: string;
        };
        Insert: {
          byte_count: number;
          created_at?: string;
          detected_mime: string;
          expense_id: string;
          household_id: string;
          id?: string;
          original_file_name: string;
          removed_at?: string | null;
          storage_path: string;
          uploader_user_id: string;
        };
        Update: {
          byte_count?: number;
          created_at?: string;
          detected_mime?: string;
          expense_id?: string;
          household_id?: string;
          id?: string;
          original_file_name?: string;
          removed_at?: string | null;
          storage_path?: string;
          uploader_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_attachments_expense_id_household_id_fkey";
            columns: ["expense_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "expense_attachments_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_shares: {
        Row: {
          allocation_order: number;
          created_at: string;
          expense_id: string;
          fixed_share_cents: number | null;
          household_id: string;
          member_id: string;
          presence_days: number | null;
          share_cents: number;
          variable_share_cents: number | null;
        };
        Insert: {
          allocation_order: number;
          created_at?: string;
          expense_id: string;
          fixed_share_cents?: number | null;
          household_id: string;
          member_id: string;
          presence_days?: number | null;
          share_cents: number;
          variable_share_cents?: number | null;
        };
        Update: {
          allocation_order?: number;
          created_at?: string;
          expense_id?: string;
          fixed_share_cents?: number | null;
          household_id?: string;
          member_id?: string;
          presence_days?: number | null;
          share_cents?: number;
          variable_share_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "expense_shares_expense_id_household_id_fkey";
            columns: ["expense_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "expense_shares_member_id_household_id_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      expenses: {
        Row: {
          created_at: string;
          created_by: string;
          currency: string;
          expense_date: string;
          household_id: string;
          id: string;
          kind: Database["public"]["Enums"]["expense_kind"];
          occurrence_date: string | null;
          paid_by_landlord: boolean;
          payer_member_id: string | null;
          recurring_rule_id: string | null;
          split_config: Json;
          split_method: Database["public"]["Enums"]["split_method"];
          title: string;
          total_cents: number;
          updated_at: string;
          updated_by: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          currency: string;
          expense_date: string;
          household_id: string;
          id?: string;
          kind?: Database["public"]["Enums"]["expense_kind"];
          occurrence_date?: string | null;
          paid_by_landlord?: boolean;
          payer_member_id?: string | null;
          recurring_rule_id?: string | null;
          split_config?: Json;
          split_method: Database["public"]["Enums"]["split_method"];
          title: string;
          total_cents: number;
          updated_at?: string;
          updated_by: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          currency?: string;
          expense_date?: string;
          household_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["expense_kind"];
          occurrence_date?: string | null;
          paid_by_landlord?: boolean;
          payer_member_id?: string | null;
          recurring_rule_id?: string | null;
          split_config?: Json;
          split_method?: Database["public"]["Enums"]["split_method"];
          title?: string;
          total_cents?: number;
          updated_at?: string;
          updated_by?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_payer_member_id_household_id_fkey";
            columns: ["payer_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "expenses_recurring_rule_id_household_id_fkey";
            columns: ["recurring_rule_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "recurring_expense_rules";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      household_members: {
        Row: {
          avatar_color: string | null;
          created_at: string;
          display_name: string;
          display_name_normalized: string | null;
          household_id: string;
          id: string;
          joined_at: string;
          removed_at: string | null;
          removed_by: string | null;
          role: Database["public"]["Enums"]["member_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_color?: string | null;
          created_at?: string;
          display_name: string;
          display_name_normalized?: string | null;
          household_id: string;
          id?: string;
          joined_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_color?: string | null;
          created_at?: string;
          display_name?: string;
          display_name_normalized?: string | null;
          household_id?: string;
          id?: string;
          joined_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          access_code_digest: string;
          archived_at: string | null;
          created_at: string;
          created_by: string;
          default_currency: string;
          house_code: string;
          id: string;
          join_pin_digest: string | null;
          joining_enabled: boolean;
          landlord_enabled: boolean;
          locale: string;
          name: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          access_code_digest: string;
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          default_currency?: string;
          house_code: string;
          id?: string;
          join_pin_digest?: string | null;
          joining_enabled?: boolean;
          landlord_enabled?: boolean;
          locale?: string;
          name: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          access_code_digest?: string;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          default_currency?: string;
          house_code?: string;
          id?: string;
          join_pin_digest?: string | null;
          joining_enabled?: boolean;
          landlord_enabled?: boolean;
          locale?: string;
          name?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      landlord_payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          created_by: string;
          expense_id: string;
          household_id: string;
          id: string;
          member_id: string;
          payment_date: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          created_by: string;
          expense_id: string;
          household_id: string;
          id?: string;
          member_id: string;
          payment_date: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          created_by?: string;
          expense_id?: string;
          household_id?: string;
          id?: string;
          member_id?: string;
          payment_date?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "landlord_payments_expense_id_household_id_fkey";
            columns: ["expense_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "landlord_payments_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "landlord_payments_member_id_household_id_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_user_id: string | null;
          audit_event_id: string;
          created_at: string;
          event_type: string;
          household_id: string;
          id: string;
          message: string;
          read_at: string | null;
          recipient_user_id: string;
          related_entity_id: string;
          related_entity_type: string;
        };
        Insert: {
          actor_user_id?: string | null;
          audit_event_id: string;
          created_at?: string;
          event_type: string;
          household_id: string;
          id?: string;
          message: string;
          read_at?: string | null;
          recipient_user_id: string;
          related_entity_id: string;
          related_entity_type: string;
        };
        Update: {
          actor_user_id?: string | null;
          audit_event_id?: string;
          created_at?: string;
          event_type?: string;
          household_id?: string;
          id?: string;
          message?: string;
          read_at?: string | null;
          recipient_user_id?: string;
          related_entity_id?: string;
          related_entity_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_audit_event_id_fkey";
            columns: ["audit_event_id"];
            isOneToOne: false;
            referencedRelation: "audit_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          locale: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          locale?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          locale?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_expense_rules: {
        Row: {
          active: boolean;
          amount_cents: number;
          anchor_date: string;
          archived_at: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          end_date: string | null;
          frequency: string;
          household_id: string;
          id: string;
          next_due_date: string;
          paid_by_landlord: boolean;
          payer_member_id: string | null;
          split_config: Json;
          split_method: Database["public"]["Enums"]["split_method"];
          title: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          active?: boolean;
          amount_cents: number;
          anchor_date: string;
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          currency: string;
          end_date?: string | null;
          frequency?: string;
          household_id: string;
          id?: string;
          next_due_date: string;
          paid_by_landlord?: boolean;
          payer_member_id?: string | null;
          split_config: Json;
          split_method: Database["public"]["Enums"]["split_method"];
          title: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          active?: boolean;
          amount_cents?: number;
          anchor_date?: string;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          end_date?: string | null;
          frequency?: string;
          household_id?: string;
          id?: string;
          next_due_date?: string;
          paid_by_landlord?: boolean;
          payer_member_id?: string | null;
          split_config?: Json;
          split_method?: Database["public"]["Enums"]["split_method"];
          title?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_expense_rules_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_expense_rules_payer_member_id_household_id_fkey";
            columns: ["payer_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      settlements: {
        Row: {
          amount_cents: number;
          created_at: string;
          created_by: string;
          currency: string;
          household_id: string;
          id: string;
          note: string | null;
          paying_member_id: string;
          receiving_member_id: string;
          settlement_date: string;
          updated_at: string;
          updated_by: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          created_by: string;
          currency: string;
          household_id: string;
          id?: string;
          note?: string | null;
          paying_member_id: string;
          receiving_member_id: string;
          settlement_date: string;
          updated_at?: string;
          updated_by: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          created_by?: string;
          currency?: string;
          household_id?: string;
          id?: string;
          note?: string | null;
          paying_member_id?: string;
          receiving_member_id?: string;
          settlement_date?: string;
          updated_at?: string;
          updated_by?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_paying_member_id_household_id_fkey";
            columns: ["paying_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "settlements_receiving_member_id_household_id_fkey";
            columns: ["receiving_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      utility_bills: {
        Row: {
          bill_document_id: string | null;
          classification_note: string | null;
          consumption_amount: number | null;
          consumption_unit: string | null;
          created_at: string;
          expense_id: string;
          fixed_cents: number;
          household_id: string;
          issue_date: string | null;
          service_end_date: string;
          service_start_date: string;
          supplier: string | null;
          total_cents: number;
          updated_at: string;
          utility_type: Database["public"]["Enums"]["utility_type"];
          variable_cents: number;
          variable_split_mode: Database["public"]["Enums"]["variable_split_mode"];
        };
        Insert: {
          bill_document_id?: string | null;
          classification_note?: string | null;
          consumption_amount?: number | null;
          consumption_unit?: string | null;
          created_at?: string;
          expense_id: string;
          fixed_cents: number;
          household_id: string;
          issue_date?: string | null;
          service_end_date: string;
          service_start_date: string;
          supplier?: string | null;
          total_cents: number;
          updated_at?: string;
          utility_type: Database["public"]["Enums"]["utility_type"];
          variable_cents: number;
          variable_split_mode?: Database["public"]["Enums"]["variable_split_mode"];
        };
        Update: {
          bill_document_id?: string | null;
          classification_note?: string | null;
          consumption_amount?: number | null;
          consumption_unit?: string | null;
          created_at?: string;
          expense_id?: string;
          fixed_cents?: number;
          household_id?: string;
          issue_date?: string | null;
          service_end_date?: string;
          service_start_date?: string;
          supplier?: string | null;
          total_cents?: number;
          updated_at?: string;
          utility_type?: Database["public"]["Enums"]["utility_type"];
          variable_cents?: number;
          variable_split_mode?: Database["public"]["Enums"]["variable_split_mode"];
        };
        Relationships: [
          {
            foreignKeyName: "utility_bills_bill_document_id_fkey";
            columns: ["bill_document_id"];
            isOneToOne: false;
            referencedRelation: "bill_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "utility_bills_bill_document_id_household_id_fkey";
            columns: ["bill_document_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "bill_documents";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "utility_bills_expense_id_household_id_fkey";
            columns: ["expense_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
    };
    Views: {
      household_balances: {
        Row: {
          currency: string | null;
          household_id: string | null;
          member_id: string | null;
          net_cents: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_expense_with_landlord_support: {
        Args: {
          p_actor_user_id: string;
          p_currency: string;
          p_expense_date: string;
          p_household_id: string;
          p_kind: Database["public"]["Enums"]["expense_kind"];
          p_occurrence_date?: string;
          p_paid_by_landlord: boolean;
          p_payer_member_id: string;
          p_recurring_rule_id?: string;
          p_shares: Json;
          p_split_config: Json;
          p_split_method: Database["public"]["Enums"]["split_method"];
          p_title: string;
          p_total_cents: number;
        };
        Returns: string;
      };
      create_expense_with_shares: {
        Args: {
          p_actor_user_id: string;
          p_currency: string;
          p_expense_date: string;
          p_household_id: string;
          p_kind: Database["public"]["Enums"]["expense_kind"];
          p_occurrence_date?: string;
          p_payer_member_id: string;
          p_recurring_rule_id?: string;
          p_shares: Json;
          p_split_config: Json;
          p_split_method: Database["public"]["Enums"]["split_method"];
          p_title: string;
          p_total_cents: number;
        };
        Returns: string;
      };
      create_household_with_owner: {
        Args: {
          p_access_code_digest: string;
          p_avatar_color: string;
          p_default_currency: string;
          p_display_name: string;
          p_encrypted_join_pin: string;
          p_house_code: string;
          p_join_pin_digest: string;
          p_locale: string;
          p_name: string;
          p_timezone: string;
        };
        Returns: string;
      };
      create_utility_bill_with_landlord_support: {
        Args: {
          p_actor_user_id?: string;
          p_bill_document_id?: string;
          p_classification_note?: string;
          p_consumption_amount?: number;
          p_consumption_unit?: string;
          p_currency: string;
          p_expense_date: string;
          p_fixed_cents: number;
          p_household_id: string;
          p_issue_date: string;
          p_paid_by_landlord: boolean;
          p_payer_member_id: string;
          p_service_end_date: string;
          p_service_start_date: string;
          p_shares: Json;
          p_split_config: Json;
          p_supplier: string;
          p_title: string;
          p_total_cents: number;
          p_utility_type: Database["public"]["Enums"]["utility_type"];
          p_variable_cents: number;
          p_variable_split_mode?: Database["public"]["Enums"]["variable_split_mode"];
        };
        Returns: string;
      };
      create_utility_bill_with_shares: {
        Args: {
          p_actor_user_id?: string;
          p_bill_document_id?: string;
          p_classification_note?: string;
          p_consumption_amount?: number;
          p_consumption_unit?: string;
          p_currency: string;
          p_expense_date: string;
          p_fixed_cents: number;
          p_household_id: string;
          p_issue_date: string;
          p_payer_member_id: string;
          p_service_end_date: string;
          p_service_start_date: string;
          p_shares: Json;
          p_split_config: Json;
          p_supplier: string;
          p_title: string;
          p_total_cents: number;
          p_utility_type: Database["public"]["Enums"]["utility_type"];
          p_variable_cents: number;
          p_variable_split_mode?: Database["public"]["Enums"]["variable_split_mode"];
        };
        Returns: string;
      };
      get_household_join_pin_secret: {
        Args: { p_household_id: string };
        Returns: string;
      };
      record_landlord_payment: {
        Args: {
          p_actor_user_id: string;
          p_amount_cents: number;
          p_expense_id: string;
          p_household_id: string;
          p_mark_as_paid: boolean;
          p_payment_date: string;
        };
        Returns: string;
      };
      record_settlement: {
        Args: {
          p_actor_user_id?: string;
          p_amount_cents: number;
          p_currency: string;
          p_household_id: string;
          p_note?: string;
          p_paying_member_id: string;
          p_receiving_member_id: string;
          p_settlement_date: string;
        };
        Returns: string;
      };
      reopen_landlord_bill: {
        Args: {
          p_actor_user_id: string;
          p_expense_id: string;
          p_household_id: string;
        };
        Returns: number;
      };
      replace_absences_and_utility_shares: {
        Args: {
          p_actor_user_id: string;
          p_expected_absences: Json;
          p_household_id: string;
          p_member_id: string;
          p_ranges: Json;
          p_utility_updates: Json;
        };
        Returns: undefined;
      };
      replace_expense_with_landlord_support: {
        Args: {
          p_actor_user_id: string;
          p_currency: string;
          p_expense_date: string;
          p_expense_id: string;
          p_paid_by_landlord: boolean;
          p_payer_member_id: string;
          p_shares: Json;
          p_split_config: Json;
          p_split_method: Database["public"]["Enums"]["split_method"];
          p_title: string;
          p_total_cents: number;
        };
        Returns: undefined;
      };
      replace_expense_with_shares: {
        Args: {
          p_actor_user_id: string;
          p_currency: string;
          p_expense_date: string;
          p_expense_id: string;
          p_payer_member_id: string;
          p_shares: Json;
          p_split_config: Json;
          p_split_method: Database["public"]["Enums"]["split_method"];
          p_title: string;
          p_total_cents: number;
        };
        Returns: undefined;
      };
      replace_utility_bill_with_landlord_support: {
        Args: {
          p_actor_user_id?: string;
          p_bill_document_id?: string;
          p_classification_note?: string;
          p_consumption_amount?: number;
          p_consumption_unit?: string;
          p_currency: string;
          p_expense_date: string;
          p_expense_id: string;
          p_fixed_cents: number;
          p_issue_date: string;
          p_paid_by_landlord: boolean;
          p_payer_member_id: string;
          p_service_end_date: string;
          p_service_start_date: string;
          p_shares: Json;
          p_split_config: Json;
          p_supplier: string;
          p_title: string;
          p_total_cents: number;
          p_utility_type: Database["public"]["Enums"]["utility_type"];
          p_variable_cents: number;
          p_variable_split_mode?: Database["public"]["Enums"]["variable_split_mode"];
        };
        Returns: undefined;
      };
      replace_utility_bill_with_shares: {
        Args: {
          p_actor_user_id?: string;
          p_classification_note?: string;
          p_consumption_amount?: number;
          p_consumption_unit?: string;
          p_currency: string;
          p_expense_date: string;
          p_expense_id: string;
          p_fixed_cents: number;
          p_issue_date: string;
          p_payer_member_id: string;
          p_service_end_date: string;
          p_service_start_date: string;
          p_shares: Json;
          p_split_config: Json;
          p_supplier: string;
          p_title: string;
          p_total_cents: number;
          p_utility_type: Database["public"]["Enums"]["utility_type"];
          p_variable_cents: number;
          p_variable_split_mode?: Database["public"]["Enums"]["variable_split_mode"];
        };
        Returns: undefined;
      };
      service_add_household_member_with_avatar: {
        Args: {
          p_display_name: string;
          p_household_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      service_create_recurring_occurrence: {
        Args: {
          p_next_due_date: string;
          p_occurrence_date: string;
          p_rule_id: string;
          p_shares: Json;
        };
        Returns: string;
      };
      service_get_auth_alias: { Args: { p_user_id: string }; Returns: string };
      service_put_auth_alias: {
        Args: { p_email_alias: string; p_user_id: string };
        Returns: undefined;
      };
      service_record_pin_reset: {
        Args: {
          p_actor_user_id: string;
          p_household_id: string;
          p_member_id: string;
        };
        Returns: string;
      };
      update_household_access: {
        Args: {
          p_access_code_digest: string;
          p_encrypted_join_pin: string;
          p_house_code: string;
          p_household_id: string;
          p_join_pin_digest: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      document_status: "uploaded" | "extracting" | "ready" | "failed" | "confirmed";
      expense_kind: "manual" | "utility" | "recurring";
      member_role: "owner" | "member";
      split_method: "equal" | "exact" | "percentage" | "utility";
      utility_type: "electricity" | "gas" | "water" | "internet" | "other";
      variable_split_mode: "occupancy" | "equal_zero_presence_fallback";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      document_status: ["uploaded", "extracting", "ready", "failed", "confirmed"],
      expense_kind: ["manual", "utility", "recurring"],
      member_role: ["owner", "member"],
      split_method: ["equal", "exact", "percentage", "utility"],
      utility_type: ["electricity", "gas", "water", "internet", "other"],
      variable_split_mode: ["occupancy", "equal_zero_presence_fallback"],
    },
  },
} as const;
