export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          consultation_id: string | null;
          created_at: string;
          id: string;
          message: string;
          organization_id: string;
          project_id: string | null;
          type: string;
        };
        Insert: {
          consultation_id?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          organization_id?: string;
          project_id?: string | null;
          type: string;
        };
        Update: {
          consultation_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          organization_id?: string;
          project_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_consultation_id_organization_id_fkey";
            columns: ["consultation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "consultations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "activity_logs_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      ai_usage: {
        Row: {
          created_at: string;
          duration_ms: number;
          id: number;
          input_tokens: number;
          model: string;
          ok: boolean;
          organization_id: string | null;
          output_tokens: number;
          project_id: string | null;
          task: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number;
          id?: never;
          input_tokens?: number;
          model: string;
          ok: boolean;
          organization_id?: string | null;
          output_tokens?: number;
          project_id?: string | null;
          task: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number;
          id?: never;
          input_tokens?: number;
          model?: string;
          ok?: boolean;
          organization_id?: string | null;
          output_tokens?: number;
          project_id?: string | null;
          task?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      consultation_lines: {
        Row: {
          consultation_id: string;
          id: string;
          organization_id: string;
          position: number;
          project_line_id: string;
        };
        Insert: {
          consultation_id: string;
          id?: string;
          organization_id?: string;
          position?: number;
          project_line_id: string;
        };
        Update: {
          consultation_id?: string;
          id?: string;
          organization_id?: string;
          position?: number;
          project_line_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultation_lines_consultation_id_organization_id_fkey";
            columns: ["consultation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "consultations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "consultation_lines_project_line_id_organization_id_fkey";
            columns: ["project_line_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_lines";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      consultations: {
        Row: {
          attached_document_ids: string[];
          auto_followup: boolean;
          body: string;
          created_at: string;
          created_by: string | null;
          error: string | null;
          followup_count: number;
          id: string;
          include_excel: boolean;
          internet_message_id: string | null;
          last_followup_at: string | null;
          mail_connection_id: string | null;
          organization_id: string;
          project_id: string;
          provider_message_id: string | null;
          provider_thread_id: string | null;
          reference_code: string;
          responded_at: string | null;
          response_due_date: string | null;
          sent_at: string | null;
          status: string;
          subject: string;
          supplier_id: string;
          updated_at: string;
        };
        Insert: {
          attached_document_ids?: string[];
          auto_followup?: boolean;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          followup_count?: number;
          id?: string;
          include_excel?: boolean;
          internet_message_id?: string | null;
          last_followup_at?: string | null;
          mail_connection_id?: string | null;
          organization_id?: string;
          project_id: string;
          provider_message_id?: string | null;
          provider_thread_id?: string | null;
          reference_code: string;
          responded_at?: string | null;
          response_due_date?: string | null;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          supplier_id: string;
          updated_at?: string;
        };
        Update: {
          attached_document_ids?: string[];
          auto_followup?: boolean;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          followup_count?: number;
          id?: string;
          include_excel?: boolean;
          internet_message_id?: string | null;
          last_followup_at?: string | null;
          mail_connection_id?: string | null;
          organization_id?: string;
          project_id?: string;
          provider_message_id?: string | null;
          provider_thread_id?: string | null;
          reference_code?: string;
          responded_at?: string | null;
          response_due_date?: string | null;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          supplier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultations_mail_connection_id_organization_id_fkey";
            columns: ["mail_connection_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "mail_connections";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "consultations_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "consultations_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "consultations_supplier_id_organization_id_fkey";
            columns: ["supplier_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      email_messages: {
        Row: {
          attachments: NonNullable<Json>;
          body_text: string | null;
          consultation_id: string | null;
          created_at: string;
          direction: string;
          from_email: string | null;
          from_name: string | null;
          id: string;
          in_reply_to: string | null;
          internet_message_id: string | null;
          kind: string;
          mail_connection_id: string | null;
          message_at: string;
          organization_id: string;
          project_id: string | null;
          provider_message_id: string;
          provider_thread_id: string | null;
          references_header: string | null;
          subject: string | null;
          to_emails: string[];
        };
        Insert: {
          attachments?: NonNullable<Json>;
          body_text?: string | null;
          consultation_id?: string | null;
          created_at?: string;
          direction: string;
          from_email?: string | null;
          from_name?: string | null;
          id?: string;
          in_reply_to?: string | null;
          internet_message_id?: string | null;
          kind: string;
          mail_connection_id?: string | null;
          message_at?: string;
          organization_id: string;
          project_id?: string | null;
          provider_message_id: string;
          provider_thread_id?: string | null;
          references_header?: string | null;
          subject?: string | null;
          to_emails?: string[];
        };
        Update: {
          attachments?: NonNullable<Json>;
          body_text?: string | null;
          consultation_id?: string | null;
          created_at?: string;
          direction?: string;
          from_email?: string | null;
          from_name?: string | null;
          id?: string;
          in_reply_to?: string | null;
          internet_message_id?: string | null;
          kind?: string;
          mail_connection_id?: string | null;
          message_at?: string;
          organization_id?: string;
          project_id?: string | null;
          provider_message_id?: string;
          provider_thread_id?: string | null;
          references_header?: string | null;
          subject?: string | null;
          to_emails?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "email_messages_consultation_id_organization_id_fkey";
            columns: ["consultation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "consultations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "email_messages_mail_connection_id_organization_id_fkey";
            columns: ["mail_connection_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "mail_connections";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "email_messages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_messages_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "email_messages_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      jobs: {
        Row: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          finished_at: string | null;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          max_attempts: number;
          organization_id: string | null;
          payload: NonNullable<Json>;
          run_after: string;
          status: string;
          type: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          finished_at?: string | null;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          organization_id?: string | null;
          payload?: NonNullable<Json>;
          run_after?: string;
          status?: string;
          type: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          finished_at?: string | null;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          organization_id?: string | null;
          payload?: NonNullable<Json>;
          run_after?: string;
          status?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      mail_connections: {
        Row: {
          access_token_enc: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          last_error: string | null;
          last_polled_at: string | null;
          organization_id: string;
          provider: string;
          refresh_token_enc: string | null;
          scopes: string | null;
          status: string;
          token_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token_enc?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          id?: string;
          last_error?: string | null;
          last_polled_at?: string | null;
          organization_id?: string;
          provider: string;
          refresh_token_enc?: string | null;
          scopes?: string | null;
          status?: string;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_enc?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          last_error?: string | null;
          last_polled_at?: string | null;
          organization_id?: string;
          provider?: string;
          refresh_token_enc?: string | null;
          scopes?: string | null;
          status?: string;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mail_connections_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mail_connections_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      offer_lines: {
        Row: {
          alternative_note: string | null;
          availability: string | null;
          confidence: number | null;
          created_at: string;
          delivery_delay: string | null;
          discount: string | null;
          id: string;
          is_alternative: boolean;
          is_fee: boolean;
          match_method: string | null;
          match_score: number | null;
          match_status: string;
          offer_id: string;
          organization_id: string;
          original: NonNullable<Json>;
          position: number;
          project_line_id: string | null;
          quantity: number | null;
          source: NonNullable<Json>;
          supplier_designation: string | null;
          supplier_reference: string | null;
          total_price: number | null;
          unit: string | null;
          unit_price: number | null;
        };
        Insert: {
          alternative_note?: string | null;
          availability?: string | null;
          confidence?: number | null;
          created_at?: string;
          delivery_delay?: string | null;
          discount?: string | null;
          id?: string;
          is_alternative?: boolean;
          is_fee?: boolean;
          match_method?: string | null;
          match_score?: number | null;
          match_status?: string;
          offer_id: string;
          organization_id?: string;
          original?: NonNullable<Json>;
          position?: number;
          project_line_id?: string | null;
          quantity?: number | null;
          source?: NonNullable<Json>;
          supplier_designation?: string | null;
          supplier_reference?: string | null;
          total_price?: number | null;
          unit?: string | null;
          unit_price?: number | null;
        };
        Update: {
          alternative_note?: string | null;
          availability?: string | null;
          confidence?: number | null;
          created_at?: string;
          delivery_delay?: string | null;
          discount?: string | null;
          id?: string;
          is_alternative?: boolean;
          is_fee?: boolean;
          match_method?: string | null;
          match_score?: number | null;
          match_status?: string;
          offer_id?: string;
          organization_id?: string;
          original?: NonNullable<Json>;
          position?: number;
          project_line_id?: string | null;
          quantity?: number | null;
          source?: NonNullable<Json>;
          supplier_designation?: string | null;
          supplier_reference?: string | null;
          total_price?: number | null;
          unit?: string | null;
          unit_price?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "offer_lines_offer_id_organization_id_fkey";
            columns: ["offer_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "offer_lines_project_line_id_organization_id_fkey";
            columns: ["project_line_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_lines";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      offers: {
        Row: {
          comments: string | null;
          commissioning_included: string;
          confidence: number | null;
          consultation_id: string;
          created_at: string;
          currency: string;
          delivery_cost: number | null;
          delivery_delay: string | null;
          delivery_included: string;
          exclusions: string[];
          extraction: NonNullable<Json>;
          id: string;
          is_current: boolean;
          organization_id: string;
          payment_terms: string | null;
          project_id: string;
          quote_date: string | null;
          quote_reference: string | null;
          reservations: string[];
          source_kind: string | null;
          supplier_id: string;
          supplier_response_id: string | null;
          total_ht: number | null;
          validity_date: string | null;
        };
        Insert: {
          comments?: string | null;
          commissioning_included?: string;
          confidence?: number | null;
          consultation_id: string;
          created_at?: string;
          currency?: string;
          delivery_cost?: number | null;
          delivery_delay?: string | null;
          delivery_included?: string;
          exclusions?: string[];
          extraction?: NonNullable<Json>;
          id?: string;
          is_current?: boolean;
          organization_id?: string;
          payment_terms?: string | null;
          project_id: string;
          quote_date?: string | null;
          quote_reference?: string | null;
          reservations?: string[];
          source_kind?: string | null;
          supplier_id: string;
          supplier_response_id?: string | null;
          total_ht?: number | null;
          validity_date?: string | null;
        };
        Update: {
          comments?: string | null;
          commissioning_included?: string;
          confidence?: number | null;
          consultation_id?: string;
          created_at?: string;
          currency?: string;
          delivery_cost?: number | null;
          delivery_delay?: string | null;
          delivery_included?: string;
          exclusions?: string[];
          extraction?: NonNullable<Json>;
          id?: string;
          is_current?: boolean;
          organization_id?: string;
          payment_terms?: string | null;
          project_id?: string;
          quote_date?: string | null;
          quote_reference?: string | null;
          reservations?: string[];
          source_kind?: string | null;
          supplier_id?: string;
          supplier_response_id?: string | null;
          total_ht?: number | null;
          validity_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "offers_consultation_id_organization_id_fkey";
            columns: ["consultation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "consultations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "offers_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "offers_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "offers_supplier_id_organization_id_fkey";
            columns: ["supplier_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "offers_supplier_response_id_organization_id_fkey";
            columns: ["supplier_response_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "supplier_responses";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      project_documents: {
        Row: {
          created_at: string;
          error: string | null;
          file_name: string;
          id: string;
          kind: string;
          lines_count: number | null;
          mime_type: string | null;
          organization_id: string;
          page_count: number | null;
          project_id: string;
          size_bytes: number;
          status: string;
          storage_path: string;
          text_chars: number | null;
          used_ocr: boolean;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          file_name: string;
          id?: string;
          kind?: string;
          lines_count?: number | null;
          mime_type?: string | null;
          organization_id?: string;
          page_count?: number | null;
          project_id: string;
          size_bytes: number;
          status?: string;
          storage_path: string;
          text_chars?: number | null;
          used_ocr?: boolean;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          file_name?: string;
          id?: string;
          kind?: string;
          lines_count?: number | null;
          mime_type?: string | null;
          organization_id?: string;
          page_count?: number | null;
          project_id?: string;
          size_bytes?: number;
          status?: string;
          storage_path?: string;
          text_chars?: number | null;
          used_ocr?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "project_documents_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      project_lines: {
        Row: {
          category: string | null;
          code: string | null;
          confidence: number | null;
          created_at: string;
          description: string | null;
          designation: string;
          document_id: string | null;
          id: string;
          lot: string | null;
          organization_id: string;
          original: NonNullable<Json>;
          position: number;
          project_id: string;
          quantity: number | null;
          source_document: string | null;
          source_page: number | null;
          source_row: number | null;
          source_sheet: string | null;
          subcontractor_required: boolean;
          supplier_required: boolean;
          unit: string | null;
          updated_at: string;
          user_modified: boolean;
          user_validated: boolean;
        };
        Insert: {
          category?: string | null;
          code?: string | null;
          confidence?: number | null;
          created_at?: string;
          description?: string | null;
          designation: string;
          document_id?: string | null;
          id?: string;
          lot?: string | null;
          organization_id?: string;
          original?: NonNullable<Json>;
          position?: number;
          project_id: string;
          quantity?: number | null;
          source_document?: string | null;
          source_page?: number | null;
          source_row?: number | null;
          source_sheet?: string | null;
          subcontractor_required?: boolean;
          supplier_required?: boolean;
          unit?: string | null;
          updated_at?: string;
          user_modified?: boolean;
          user_validated?: boolean;
        };
        Update: {
          category?: string | null;
          code?: string | null;
          confidence?: number | null;
          created_at?: string;
          description?: string | null;
          designation?: string;
          document_id?: string | null;
          id?: string;
          lot?: string | null;
          organization_id?: string;
          original?: NonNullable<Json>;
          position?: number;
          project_id?: string;
          quantity?: number | null;
          source_document?: string | null;
          source_page?: number | null;
          source_row?: number | null;
          source_sheet?: string | null;
          subcontractor_required?: boolean;
          supplier_required?: boolean;
          unit?: string | null;
          updated_at?: string;
          user_modified?: boolean;
          user_validated?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "project_lines_document_id_organization_id_fkey";
            columns: ["document_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_documents";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "project_lines_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "project_lines_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      projects: {
        Row: {
          analysis_error: string | null;
          analysis_status: string;
          analysis_summary: Json | null;
          client: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          organization_id: string;
          reference: string | null;
          response_deadline: string | null;
          updated_at: string;
        };
        Insert: {
          analysis_error?: string | null;
          analysis_status?: string;
          analysis_summary?: Json | null;
          client?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          organization_id?: string;
          reference?: string | null;
          response_deadline?: string | null;
          updated_at?: string;
        };
        Update: {
          analysis_error?: string | null;
          analysis_status?: string;
          analysis_summary?: Json | null;
          client?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          reference?: string | null;
          response_deadline?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      scheduled_followups: {
        Row: {
          attempt: number;
          consultation_id: string;
          created_at: string;
          due_at: string;
          email_message_id: string | null;
          id: string;
          organization_id: string;
          reason: string | null;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          attempt: number;
          consultation_id: string;
          created_at?: string;
          due_at: string;
          email_message_id?: string | null;
          id?: string;
          organization_id: string;
          reason?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          attempt?: number;
          consultation_id?: string;
          created_at?: string;
          due_at?: string;
          email_message_id?: string | null;
          id?: string;
          organization_id?: string;
          reason?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_followups_consultation_id_organization_id_fkey";
            columns: ["consultation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "consultations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "scheduled_followups_email_message_id_organization_id_fkey";
            columns: ["email_message_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "email_messages";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "scheduled_followups_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_responses: {
        Row: {
          classification: string | null;
          consultation_id: string | null;
          created_at: string;
          email_message_id: string | null;
          error: string | null;
          files: NonNullable<Json>;
          id: string;
          match_method: string | null;
          organization_id: string;
          project_id: string | null;
          received_at: string;
          source: string;
          status: string;
          supplier_id: string | null;
        };
        Insert: {
          classification?: string | null;
          consultation_id?: string | null;
          created_at?: string;
          email_message_id?: string | null;
          error?: string | null;
          files?: NonNullable<Json>;
          id?: string;
          match_method?: string | null;
          organization_id?: string;
          project_id?: string | null;
          received_at?: string;
          source: string;
          status?: string;
          supplier_id?: string | null;
        };
        Update: {
          classification?: string | null;
          consultation_id?: string | null;
          created_at?: string;
          email_message_id?: string | null;
          error?: string | null;
          files?: NonNullable<Json>;
          id?: string;
          match_method?: string | null;
          organization_id?: string;
          project_id?: string | null;
          received_at?: string;
          source?: string;
          status?: string;
          supplier_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_responses_consultation_id_organization_id_fkey";
            columns: ["consultation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "consultations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "supplier_responses_email_message_id_organization_id_fkey";
            columns: ["email_message_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "email_messages";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "supplier_responses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_responses_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "project_overview";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "supplier_responses_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "supplier_responses_supplier_id_organization_id_fkey";
            columns: ["supplier_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      suppliers: {
        Row: {
          categories: string[];
          company_name: string;
          contact_name: string | null;
          created_at: string;
          email: string;
          id: string;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          categories?: string[];
          company_name: string;
          contact_name?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          categories?: string[];
          company_name?: string;
          contact_name?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          organization_id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          organization_id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          organization_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      project_overview: {
        Row: {
          analysis_error: string | null;
          analysis_status: string | null;
          analysis_summary: Json | null;
          awaiting_count: number | null;
          client: string | null;
          closed_at: string | null;
          consultations_count: number | null;
          created_at: string | null;
          created_by: string | null;
          id: string | null;
          name: string | null;
          offers_count: number | null;
          organization_id: string | null;
          reference: string | null;
          responded_count: number | null;
          response_deadline: string | null;
          sent_count: number | null;
          status: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      claim_jobs: {
        Args: { p_limit: number };
        Returns: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          finished_at: string | null;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          max_attempts: number;
          organization_id: string | null;
          payload: NonNullable<Json>;
          run_after: string;
          status: string;
          type: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      configure_tick: {
        Args: { p_secret: string; p_url: string };
        Returns: undefined;
      };
      create_organization: {
        Args: { p_full_name?: string; p_name: string };
        Returns: string;
      };
      current_org_id: { Args: Record<PropertyKey, never>; Returns: string };
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {},
  },
} as const;
