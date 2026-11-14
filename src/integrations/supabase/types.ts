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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agency_menu_ai_credentials: {
        Row: {
          api_key: string
          id: string
          last_fallback_at: string | null
          last_fallback_reason: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          id: string
          last_fallback_at?: string | null
          last_fallback_reason?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          id?: string
          last_fallback_at?: string | null
          last_fallback_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      cart_sessions: {
        Row: {
          cart_items: Json
          cart_total: number
          channel: string
          created_at: string
          current_step: string
          exit_page: string | null
          last_active_at: string
          max_step: number
          order_id: string | null
          restaurant_id: string
          session_id: string
          traffic_source: string | null
        }
        Insert: {
          cart_items?: Json
          cart_total?: number
          channel?: string
          created_at?: string
          current_step?: string
          exit_page?: string | null
          last_active_at?: string
          max_step?: number
          order_id?: string | null
          restaurant_id: string
          session_id: string
          traffic_source?: string | null
        }
        Update: {
          cart_items?: Json
          cart_total?: number
          channel?: string
          created_at?: string
          current_step?: string
          exit_page?: string | null
          last_active_at?: string
          max_step?: number
          order_id?: string | null
          restaurant_id?: string
          session_id?: string
          traffic_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_license_billing: {
        Row: {
          amount_ht_cents: number
          created_at: string
          due_on: string | null
          ends_on: string
          id: string
          invoice_reference: string
          license_id: string
          notes: string
          paid_on: string | null
          starts_on: string
          status: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          amount_ht_cents?: number
          created_at?: string
          due_on?: string | null
          ends_on: string
          id?: string
          invoice_reference?: string
          license_id: string
          notes?: string
          paid_on?: string | null
          starts_on: string
          status?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          amount_ht_cents?: number
          created_at?: string
          due_on?: string | null
          ends_on?: string
          id?: string
          invoice_reference?: string
          license_id?: string
          notes?: string
          paid_on?: string | null
          starts_on?: string
          status?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_license_billing_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "kiosk_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_licenses: {
        Row: {
          ends_on: string
          id: string
          kiosk_id: string
          label: string
          notes: string
          restaurant_id: string
          starts_on: string
          status: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          ends_on: string
          id?: string
          kiosk_id: string
          label?: string
          notes?: string
          restaurant_id: string
          starts_on: string
          status?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          ends_on?: string
          id?: string
          kiosk_id?: string
          label?: string
          notes?: string
          restaurant_id?: string
          starts_on?: string
          status?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_licenses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_pin_attempts: {
        Row: {
          attempts: number
          caller_key: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          caller_key: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          caller_key?: string
          window_started_at?: string
        }
        Relationships: []
      }
      menu_stock: {
        Row: {
          item_id: string
          restaurant_id: string
          sold_out: boolean
          updated_at: string
        }
        Insert: {
          item_id: string
          restaurant_id: string
          sold_out?: boolean
          updated_at?: string
        }
        Update: {
          item_id?: string
          restaurant_id?: string
          sold_out?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_stock_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_structure_templates: {
        Row: {
          id: string
          name: string
          restaurant_id: string
          structure: Json
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          restaurant_id: string
          structure?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          restaurant_id?: string
          structure?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_structure_templates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          max_selection: number
          min_selection: number
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_selection?: number
          min_selection?: number
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_selection?: number
          min_selection?: number
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      option_items: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_available?: boolean
          name: string
          price?: number
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notification_deliveries: {
        Row: {
          created_at: string
          id: string
          order_id: string
          recipient_email: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          recipient_email: string
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          recipient_email?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notification_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_print_logs: {
        Row: {
          auto: boolean
          created_at: string
          id: string
          kinds: string
          order_id: string
          reprint: boolean
          restaurant_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          auto?: boolean
          created_at?: string
          id?: string
          kinds: string
          order_id: string
          reprint?: boolean
          restaurant_id: string
          status: string
          user_id?: string | null
        }
        Update: {
          auto?: boolean
          created_at?: string
          id?: string
          kinds?: string
          order_id?: string
          reprint?: boolean
          restaurant_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_print_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_print_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          credit_note_number: string
          data: Json
          id: string
          idempotency_key: string
          order_id: string
          payment_provider: string
          provider_refund_id: string | null
          reason: string
          restaurant_id: string
          seq: number
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          credit_note_number: string
          data: Json
          id?: string
          idempotency_key: string
          order_id: string
          payment_provider: string
          provider_refund_id?: string | null
          reason: string
          restaurant_id: string
          seq: number
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          credit_note_number?: string
          data?: Json
          id?: string
          idempotency_key?: string
          order_id?: string
          payment_provider?: string
          provider_refund_id?: string | null
          reason?: string
          restaurant_id?: string
          seq?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refunds_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accept_deadline: string | null
          address: string | null
          asap: boolean
          billing: Json | null
          cgv_accepted_at: string | null
          cgv_version: string | null
          city: string | null
          confirmation_email_at: string | null
          courier_at: string | null
          courier_name: string | null
          courier_status: string | null
          created_at: string
          currency: string
          customer_name: string
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount: number
          driver_id: string | null
          email: string | null
          first_name: string | null
          id: string
          is_test: boolean
          items: Json
          last_name: string | null
          missed_at: string | null
          mode: string
          notes: string | null
          order_number: number
          payment_method: string
          payment_ref: string | null
          payment_status: string
          phone: string
          platform_fee: number
          pos_created_by: string | null
          pos_discount: Json | null
          pos_error: string | null
          pos_fiscal_hash: string | null
          pos_payments: Json | null
          pos_receipt_number: number | null
          pos_ref: string | null
          pos_request_id: string | null
          pos_session_id: string | null
          pos_status: string | null
          pos_synced_at: string | null
          pos_tender: Json | null
          pos_vat: Json | null
          postal_code: string | null
          promo_code: string | null
          qr_mode: string | null
          received_email_at: string | null
          refund_status: string
          refunded_amount: number
          restaurant_email_at: string | null
          restaurant_id: string
          room_label: string | null
          service_fee: number
          slot: string
          source: string
          source_ref: string | null
          status: string
          subtotal: number
          table_label: string | null
          test_created_at: string | null
          test_created_by: string | null
          total: number
          updated_at: string
          zone_name: string | null
        }
        Insert: {
          accept_deadline?: string | null
          address?: string | null
          asap?: boolean
          billing?: Json | null
          cgv_accepted_at?: string | null
          cgv_version?: string | null
          city?: string | null
          confirmation_email_at?: string | null
          courier_at?: string | null
          courier_name?: string | null
          courier_status?: string | null
          created_at?: string
          currency?: string
          customer_name: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount?: number
          driver_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_test?: boolean
          items: Json
          last_name?: string | null
          missed_at?: string | null
          mode: string
          notes?: string | null
          order_number?: number
          payment_method: string
          payment_ref?: string | null
          payment_status?: string
          phone: string
          platform_fee?: number
          pos_created_by?: string | null
          pos_discount?: Json | null
          pos_error?: string | null
          pos_fiscal_hash?: string | null
          pos_payments?: Json | null
          pos_receipt_number?: number | null
          pos_ref?: string | null
          pos_request_id?: string | null
          pos_session_id?: string | null
          pos_status?: string | null
          pos_synced_at?: string | null
          pos_tender?: Json | null
          pos_vat?: Json | null
          postal_code?: string | null
          promo_code?: string | null
          qr_mode?: string | null
          received_email_at?: string | null
          refund_status?: string
          refunded_amount?: number
          restaurant_email_at?: string | null
          restaurant_id: string
          room_label?: string | null
          service_fee?: number
          slot: string
          source?: string
          source_ref?: string | null
          status?: string
          subtotal: number
          table_label?: string | null
          test_created_at?: string | null
          test_created_by?: string | null
          total: number
          updated_at?: string
          zone_name?: string | null
        }
        Update: {
          accept_deadline?: string | null
          address?: string | null
          asap?: boolean
          billing?: Json | null
          cgv_accepted_at?: string | null
          cgv_version?: string | null
          city?: string | null
          confirmation_email_at?: string | null
          courier_at?: string | null
          courier_name?: string | null
          courier_status?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount?: number
          driver_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_test?: boolean
          items?: Json
          last_name?: string | null
          missed_at?: string | null
          mode?: string
          notes?: string | null
          order_number?: number
          payment_method?: string
          payment_ref?: string | null
          payment_status?: string
          phone?: string
          platform_fee?: number
          pos_created_by?: string | null
          pos_discount?: Json | null
          pos_error?: string | null
          pos_fiscal_hash?: string | null
          pos_payments?: Json | null
          pos_receipt_number?: number | null
          pos_ref?: string | null
          pos_request_id?: string | null
          pos_session_id?: string | null
          pos_status?: string | null
          pos_synced_at?: string | null
          pos_tender?: Json | null
          pos_vat?: Json | null
          postal_code?: string | null
          promo_code?: string | null
          qr_mode?: string | null
          received_email_at?: string | null
          refund_status?: string
          refunded_amount?: number
          restaurant_email_at?: string | null
          restaurant_id?: string
          room_label?: string | null
          service_fee?: number
          slot?: string
          source?: string
          source_ref?: string | null
          status?: string
          subtotal?: number
          table_label?: string | null
          test_created_at?: string | null
          test_created_by?: string | null
          total?: number
          updated_at?: string
          zone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "restaurant_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_cash_events: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          kind: string
          order_id: string | null
          reason: string
          request_id: string
          restaurant_id: string
          session_id: string
          snapshot: Json | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          kind: string
          order_id?: string | null
          reason: string
          request_id: string
          restaurant_id: string
          session_id: string
          snapshot?: Json | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          order_id?: string | null
          reason?: string
          request_id?: string
          restaurant_id?: string
          session_id?: string
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_cash_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_fiscal_archives: {
        Row: {
          content_text: string
          created_at: string
          created_by: string
          hash: string
          id: string
          restaurant_id: string
        }
        Insert: {
          content_text: string
          created_at?: string
          created_by: string
          hash: string
          id?: string
          restaurant_id: string
        }
        Update: {
          content_text?: string
          created_at?: string
          created_by?: string
          hash?: string
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_fiscal_archives_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_fiscal_receipts: {
        Row: {
          created_at: string
          hash: string
          id: string
          order_id: string
          payload_text: string
          previous_hash: string
          restaurant_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          order_id: string
          payload_text: string
          previous_hash: string
          restaurant_id: string
          sequence: number
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          order_id?: string
          payload_text?: string
          previous_hash?: string
          restaurant_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_fiscal_receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_fiscal_receipts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_integrity_heads: {
        Row: {
          event_hash: string
          event_number: number
          legacy_last_number: number
          receipt_hash: string
          receipt_number: number
          restaurant_id: string
          starts_at: string
        }
        Insert: {
          event_hash?: string
          event_number?: number
          legacy_last_number?: number
          receipt_hash?: string
          receipt_number?: number
          restaurant_id: string
          starts_at?: string
        }
        Update: {
          event_hash?: string
          event_number?: number
          legacy_last_number?: number
          receipt_hash?: string
          receipt_number?: number
          restaurant_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_integrity_heads_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_jet: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          hash: string
          id: string
          payload_text: string
          previous_hash: string
          restaurant_id: string
          sequence: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          hash: string
          id?: string
          payload_text: string
          previous_hash: string
          restaurant_id: string
          sequence: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          hash?: string
          id?: string
          payload_text?: string
          previous_hash?: string
          restaurant_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_jet_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_parked_carts: {
        Row: {
          created_at: string
          created_by: string
          draft: Json
          id: string
          label: string
          recalled_at: string | null
          request_id: string
          restaurant_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          draft: Json
          id?: string
          label: string
          recalled_at?: string | null
          request_id: string
          restaurant_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          draft?: Json
          id?: string
          label?: string
          recalled_at?: string | null
          request_id?: string
          restaurant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_parked_carts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_parked_carts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_receipt_counters: {
        Row: {
          last_number: number
          restaurant_id: string
        }
        Insert: {
          last_number?: number
          restaurant_id: string
        }
        Update: {
          last_number?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_receipt_counters_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          counted_cash: number | null
          id: string
          opened_at: string
          opened_by: string
          opening_float: number
          restaurant_id: string
          z_number: number | null
          z_report: Json | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          counted_cash?: number | null
          id?: string
          opened_at?: string
          opened_by: string
          opening_float?: number
          restaurant_id: string
          z_number?: number | null
          z_report?: Json | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          counted_cash?: number | null
          id?: string
          opened_at?: string
          opened_by?: string
          opening_float?: number
          restaurant_id?: string
          z_number?: number | null
          z_report?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          product_id: string
          restaurant_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          product_id: string
          restaurant_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          product_id?: string
          restaurant_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          is_default: boolean
          name: string
          price: number
          product_id: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          is_default?: boolean
          name: string
          price?: number
          product_id: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          is_default?: boolean
          name?: string
          price?: number
          product_id?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          audience: string
          created_at: string
          endpoint: string
          id: string
          last_at: string | null
          last_body: string | null
          last_title: string | null
          last_url: string | null
          order_id: string | null
          restaurant_id: string | null
        }
        Insert: {
          audience?: string
          created_at?: string
          endpoint: string
          id?: string
          last_at?: string | null
          last_body?: string | null
          last_title?: string | null
          last_url?: string | null
          order_id?: string | null
          restaurant_id?: string | null
        }
        Update: {
          audience?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_at?: string | null
          last_body?: string | null
          last_title?: string | null
          last_url?: string | null
          order_id?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          charge_ref: string | null
          charged_amount: number | null
          created_at: string
          customer_name: string
          email: string | null
          id: string
          no_show_fee: number
          notes: string | null
          party_size: number
          payment_method: string | null
          phone: string
          restaurant_id: string
          setup_intent: string | null
          starts_at: string
          status: string
          stripe_customer: string | null
          updated_at: string
        }
        Insert: {
          charge_ref?: string | null
          charged_amount?: number | null
          created_at?: string
          customer_name: string
          email?: string | null
          id?: string
          no_show_fee?: number
          notes?: string | null
          party_size: number
          payment_method?: string | null
          phone: string
          restaurant_id: string
          setup_intent?: string | null
          starts_at: string
          status?: string
          stripe_customer?: string | null
          updated_at?: string
        }
        Update: {
          charge_ref?: string | null
          charged_amount?: number | null
          created_at?: string
          customer_name?: string
          email?: string | null
          id?: string
          no_show_fee?: number
          notes?: string | null
          party_size?: number
          payment_method?: string | null
          phone?: string
          restaurant_id?: string
          setup_intent?: string | null
          starts_at?: string
          status?: string
          stripe_customer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_availability_notifications: {
        Row: {
          audit_id: string
          id: string
          occurred_at: string
          read_at: string | null
          restaurant_id: string
          user_id: string
        }
        Insert: {
          audit_id: string
          id?: string
          occurred_at: string
          read_at?: string | null
          restaurant_id: string
          user_id: string
        }
        Update: {
          audit_id?: string
          id?: string
          occurred_at?: string
          read_at?: string | null
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_availability_notifications_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "restaurant_order_availability_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_availability_notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_campaign_waves: {
        Row: {
          created_at: string
          created_by: string
          error: string | null
          id: string
          payload: Json
          remaining_ids: string[]
          restaurant_id: string
          sent: number
          sent_emails: string[]
          state: string
        }
        Insert: {
          created_at?: string
          created_by: string
          error?: string | null
          id: string
          payload: Json
          remaining_ids?: string[]
          restaurant_id: string
          sent?: number
          sent_emails?: string[]
          state?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          error?: string | null
          id?: string
          payload?: Json
          remaining_ids?: string[]
          restaurant_id?: string
          sent?: number
          sent_emails?: string[]
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_campaign_waves_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          recipients: number
          restaurant_id: string
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          recipients?: number
          restaurant_id: string
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          recipients?: number
          restaurant_id?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_courier_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          restaurant_id: string
          salt: string
          updated_at: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          restaurant_id: string
          salt: string
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          restaurant_id?: string
          salt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_courier_pins_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_customers: {
        Row: {
          consent_at: string | null
          consent_source: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          marketing_consent: boolean
          name: string | null
          notes: string | null
          phone: string | null
          restaurant_id: string
          source: string
          updated_at: string
        }
        Insert: {
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_consent?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_consent?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_deletion_audit: {
        Row: {
          approved_test_cleanup: boolean
          deleted_at: string
          deleted_by: string
          deleted_orders: number
          id: string
          restaurant_id: string
          restaurant_name: string
          restaurant_slug: string
        }
        Insert: {
          approved_test_cleanup?: boolean
          deleted_at?: string
          deleted_by: string
          deleted_orders: number
          id?: string
          restaurant_id: string
          restaurant_name: string
          restaurant_slug: string
        }
        Update: {
          approved_test_cleanup?: boolean
          deleted_at?: string
          deleted_by?: string
          deleted_orders?: number
          id?: string
          restaurant_id?: string
          restaurant_name?: string
          restaurant_slug?: string
        }
        Relationships: []
      }
      restaurant_drivers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          phone: string | null
          restaurant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          restaurant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_invoices: {
        Row: {
          buyer_b2b: Json | null
          buyer_b2b_by: string | null
          buyer_b2b_updated_at: string | null
          created_at: string
          data: Json
          id: string
          issued_at: string
          number: string
          order_id: string
          restaurant_id: string
          seq: number
          year: number | null
        }
        Insert: {
          buyer_b2b?: Json | null
          buyer_b2b_by?: string | null
          buyer_b2b_updated_at?: string | null
          created_at?: string
          data: Json
          id?: string
          issued_at?: string
          number: string
          order_id: string
          restaurant_id: string
          seq: number
          year?: number | null
        }
        Update: {
          buyer_b2b?: Json | null
          buyer_b2b_by?: string | null
          buyer_b2b_updated_at?: string | null
          created_at?: string
          data?: Json
          id?: string
          issued_at?: string
          number?: string
          order_id?: string
          restaurant_id?: string
          seq?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_kiosk_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          restaurant_id: string
          salt: string
          updated_at: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          restaurant_id: string
          salt: string
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          restaurant_id?: string
          salt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_kiosk_pins_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_kitchen_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          restaurant_id: string
          salt: string
          updated_at: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          restaurant_id: string
          salt: string
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          restaurant_id?: string
          salt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_kitchen_pins_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          id: string
          notification_modes: string[] | null
          notification_roles: string[]
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_modes?: string[] | null
          notification_roles?: string[]
          restaurant_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_modes?: string[] | null
          notification_roles?: string[]
          restaurant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_order_availability_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          id: string
          occurred_at: string
          restaurant_id: string
          resume_at: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          id?: string
          occurred_at?: string
          restaurant_id: string
          resume_at?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          id?: string
          occurred_at?: string
          restaurant_id?: string
          resume_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_order_availability_audit_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_payment_providers: {
        Row: {
          credentials: Json
          enabled: boolean
          provider: string
          restaurant_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          credentials?: Json
          enabled?: boolean
          provider: string
          restaurant_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          credentials?: Json
          enabled?: boolean
          provider?: string
          restaurant_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_payment_providers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_pdp_configs: {
        Row: {
          account_id: string
          mandate_signed: boolean
          provider: string
          restaurant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string
          mandate_signed?: boolean
          provider: string
          restaurant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          mandate_signed?: boolean
          provider?: string
          restaurant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_pdp_configs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_pos_connectors: {
        Row: {
          credentials: Json
          provider: string
          restaurant_id: string
          settings: Json
          silent_sync: boolean
          updated_at: string
        }
        Insert: {
          credentials?: Json
          provider?: string
          restaurant_id: string
          settings?: Json
          silent_sync?: boolean
          updated_at?: string
        }
        Update: {
          credentials?: Json
          provider?: string
          restaurant_id?: string
          settings?: Json
          silent_sync?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_pos_connectors_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          min_order: number
          restaurant_id: string
          scope: Json | null
          starts_at: string | null
          updated_at: string
          uses: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind: string
          min_order?: number
          restaurant_id: string
          scope?: Json | null
          starts_at?: string | null
          updated_at?: string
          uses?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          min_order?: number
          restaurant_id?: string
          scope?: Json | null
          starts_at?: string | null
          updated_at?: string
          uses?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_promo_codes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_sms_campaigns: {
        Row: {
          content: string
          created_at: string
          created_by: string
          customer_ids: string[]
          error: string | null
          id: string
          name: string
          remaining_ids: string[]
          restaurant_id: string
          sender: string
          sent: number
          sent_phones: string[]
          skipped: number
          state: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          customer_ids: string[]
          error?: string | null
          id: string
          name: string
          remaining_ids?: string[]
          restaurant_id: string
          sender: string
          sent?: number
          sent_phones?: string[]
          skipped?: number
          state?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          customer_ids?: string[]
          error?: string | null
          id?: string
          name?: string
          remaining_ids?: string[]
          restaurant_id?: string
          sender?: string
          sent?: number
          sent_phones?: string[]
          skipped?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_sms_campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_sms_deliveries: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string | null
          error: string | null
          id: string
          message_id: string | null
          phone: string
          state: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          message_id?: string | null
          phone: string
          state?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          message_id?: string | null
          phone?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_sms_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "restaurant_sms_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_voice_calls: {
        Row: {
          call_id: string
          caller: string | null
          created_at: string
          duration_seconds: number | null
          ended_reason: string | null
          id: string
          order_number: number | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          call_id: string
          caller?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_reason?: string | null
          id?: string
          order_number?: number | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_id?: string
          caller?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_reason?: string | null
          id?: string
          order_number?: number | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_voice_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_voice_channels: {
        Row: {
          calls_count: number
          created_at: string
          enabled: boolean
          last_call_at: string | null
          phone_number: string | null
          restaurant_id: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          calls_count?: number
          created_at?: string
          enabled?: boolean
          last_call_at?: string | null
          phone_number?: string | null
          restaurant_id: string
          updated_at?: string
          webhook_secret: string
        }
        Update: {
          calls_count?: number
          created_at?: string
          enabled?: boolean
          last_call_at?: string | null
          phone_number?: string | null
          restaurant_id?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_voice_channels_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          active: boolean
          address: string | null
          brand: Json
          city: string | null
          config: Json
          created_at: string
          delivery: Json
          email: string | null
          enabled_features: Json
          id: string
          is_vapi_web_enabled: boolean
          legal: Json
          logo_url: string | null
          menu: Json | null
          menu_key: string
          name: string
          opening: Json
          phone: string | null
          slug: string
          sort_order: number
          updated_at: string
          vapi_assistant_id: string | null
          vapi_phone_number: string | null
          vapi_public_key: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          brand?: Json
          city?: string | null
          config?: Json
          created_at?: string
          delivery?: Json
          email?: string | null
          enabled_features?: Json
          id?: string
          is_vapi_web_enabled?: boolean
          legal?: Json
          logo_url?: string | null
          menu?: Json | null
          menu_key: string
          name: string
          opening?: Json
          phone?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          vapi_assistant_id?: string | null
          vapi_phone_number?: string | null
          vapi_public_key?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          brand?: Json
          city?: string | null
          config?: Json
          created_at?: string
          delivery?: Json
          email?: string | null
          enabled_features?: Json
          id?: string
          is_vapi_web_enabled?: boolean
          legal?: Json
          logo_url?: string | null
          menu?: Json | null
          menu_key?: string
          name?: string
          opening?: Json
          phone?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          vapi_assistant_id?: string | null
          vapi_phone_number?: string | null
          vapi_public_key?: string | null
        }
        Relationships: []
      }
      staff_push_deliveries: {
        Row: {
          created_at: string
          device_id: string
          id: string
          order_id: string
          read_at: string | null
          restaurant_id: string
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          order_id: string
          read_at?: string | null
          restaurant_id: string
          title: string
          url: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          order_id?: string
          read_at?: string | null
          restaurant_id?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_push_deliveries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "staff_push_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_push_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_push_deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_push_devices: {
        Row: {
          endpoint: string
          expires_at: string
          id: string
          restaurant_ids: string[]
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          endpoint: string
          expires_at?: string
          id?: string
          restaurant_ids?: string[]
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          endpoint?: string
          expires_at?: string
          id?: string
          restaurant_ids?: string[]
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approved_restaurant_test_cleanup: {
        Args: { _id: string }
        Returns: boolean
      }
      can_access_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      claim_kiosk_pin_attempt: {
        Args: { _caller_key: string }
        Returns: boolean
      }
      close_pos_register: {
        Args: {
          _counted_cash: number
          _restaurant_id: string
          _user_id: string
        }
        Returns: Json
      }
      consume_availability_notifications: {
        Args: never
        Returns: {
          id: string
          occurred_at: string
          restaurant_id: string
          restaurant_name: string
          restaurant_slug: string
        }[]
      }
      delete_agency_restaurant: {
        Args: { _confirmation: string; _id: string }
        Returns: Json
      }
      duplicate_agency_restaurant: {
        Args: {
          _copy_brand: boolean
          _copy_opening: boolean
          _identity: Json
          _menu: Json
          _options: Json
          _source: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_restaurant_manager: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      issue_invoice: {
        Args: { _data: Json; _order_id: string; _restaurant_id: string }
        Returns: {
          buyer_b2b: Json | null
          buyer_b2b_by: string | null
          buyer_b2b_updated_at: string | null
          created_at: string
          data: Json
          id: string
          issued_at: string
          number: string
          order_id: string
          restaurant_id: string
          seq: number
          year: number | null
        }
        SetofOptions: {
          from: "*"
          to: "restaurant_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_order_service: {
        Args: { _now: string; _opening: Json }
        Returns: string
      }
      pos_append_jet: {
        Args: {
          _actor: string
          _details: Json
          _restaurant: string
          _type: string
        }
        Returns: undefined
      }
      pos_integrity_snapshot: { Args: { _restaurant: string }; Returns: Json }
      pos_session_report: {
        Args: { _counted?: number; _session_id: string }
        Returns: Json
      }
      read_restaurant_menu_options: {
        Args: { _restaurant_id: string }
        Returns: Json
      }
      record_refund: {
        Args: {
          _amount: number
          _data: Json
          _key: string
          _order_id: string
          _provider: string
          _provider_refund_id: string
          _reason: string
          _restaurant_id: string
          _user: string
        }
        Returns: {
          amount: number
          created_at: string
          created_by: string | null
          credit_note_number: string
          data: Json
          id: string
          idempotency_key: string
          order_id: string
          payment_provider: string
          provider_refund_id: string | null
          reason: string
          restaurant_id: string
          seq: number
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "order_refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resume_due_order_availability: { Args: never; Returns: number }
      set_orders_paused: {
        Args: { _paused: boolean; _restaurant_id: string }
        Returns: Json
      }
      void_pos_sale: {
        Args: {
          _order_id: string
          _reason: string
          _request_id: string
          _restaurant_id: string
          _user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
