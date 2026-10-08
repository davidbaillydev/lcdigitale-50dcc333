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
          customer_name: string
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount: number
          driver_id: string | null
          email: string | null
          id: string
          items: Json
          mode: string
          notes: string | null
          order_number: number
          payment_method: string
          payment_ref: string | null
          payment_status: string
          phone: string
          postal_code: string | null
          promo_code: string | null
          qr_mode: string | null
          refund_status: string
          refunded_amount: number
          restaurant_id: string
          room_label: string | null
          service_fee: number
          slot: string
          source: string
          status: string
          subtotal: number
          table_label: string | null
          total: number
          updated_at: string
          zone_name: string | null
        }
        Insert: {
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
          customer_name: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount?: number
          driver_id?: string | null
          email?: string | null
          id?: string
          items: Json
          mode: string
          notes?: string | null
          order_number?: number
          payment_method: string
          payment_ref?: string | null
          payment_status?: string
          phone: string
          postal_code?: string | null
          promo_code?: string | null
          qr_mode?: string | null
          refund_status?: string
          refunded_amount?: number
          restaurant_id: string
          room_label?: string | null
          service_fee?: number
          slot: string
          source?: string
          status?: string
          subtotal: number
          table_label?: string | null
          total: number
          updated_at?: string
          zone_name?: string | null
        }
        Update: {
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
          customer_name?: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount?: number
          driver_id?: string | null
          email?: string | null
          id?: string
          items?: Json
          mode?: string
          notes?: string | null
          order_number?: number
          payment_method?: string
          payment_ref?: string | null
          payment_status?: string
          phone?: string
          postal_code?: string | null
          promo_code?: string | null
          qr_mode?: string | null
          refund_status?: string
          refunded_amount?: number
          restaurant_id?: string
          room_label?: string | null
          service_fee?: number
          slot?: string
          source?: string
          status?: string
          subtotal?: number
          table_label?: string | null
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
            foreignKeyName: "orders_restaurant_id_fkey"
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
          id: string
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
          id?: string
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
          id?: string
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
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
          updated_at?: string
          vapi_assistant_id?: string | null
          vapi_phone_number?: string | null
          vapi_public_key?: string | null
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
      can_access_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
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
