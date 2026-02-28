// This file should be auto-generated with: npx supabase gen types typescript
// For now, we define manual types matching our schema.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "owner" | "manager" | "staff";
export type OrderType = "pickup" | "delivery";
export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "link_sent" | "paid" | "refunded";
export type CallStatus = "in_progress" | "completed" | "error" | "voicemail";

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          phone: string | null;
          website_url: string | null;
          timezone: string;
          business_hours: Json;
          delivery_enabled: boolean;
          delivery_radius_miles: number | null;
          delivery_fee: number;
          tax_rate: number;
          retell_agent_id: string | null;
          retell_llm_id: string | null;
          retell_phone_number: string | null;
          retell_phone_number_id: string | null;
          stripe_account_id: string | null;
          is_active: boolean;
          onboarding_completed: boolean;
          pickup_wait_minutes: number;
          delivery_wait_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          id?: string;
          address?: string | null;
          phone?: string | null;
          website_url?: string | null;
          timezone?: string;
          business_hours?: Json;
          delivery_enabled?: boolean;
          delivery_radius_miles?: number | null;
          delivery_fee?: number;
          tax_rate?: number;
          retell_agent_id?: string | null;
          retell_llm_id?: string | null;
          retell_phone_number?: string | null;
          retell_phone_number_id?: string | null;
          stripe_account_id?: string | null;
          is_active?: boolean;
          onboarding_completed?: boolean;
          pickup_wait_minutes?: number;
          delivery_wait_minutes?: number;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          address?: string | null;
          phone?: string | null;
          website_url?: string | null;
          timezone?: string;
          business_hours?: Json;
          delivery_enabled?: boolean;
          delivery_radius_miles?: number | null;
          delivery_fee?: number;
          tax_rate?: number;
          retell_agent_id?: string | null;
          retell_llm_id?: string | null;
          retell_phone_number?: string | null;
          retell_phone_number_id?: string | null;
          stripe_account_id?: string | null;
          is_active?: boolean;
          onboarding_completed?: boolean;
          pickup_wait_minutes?: number;
          delivery_wait_minutes?: number;
        };
      };
      restaurant_members: {
        Row: {
          id: string;
          restaurant_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          restaurant_id: string;
          user_id: string;
          role?: UserRole;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          user_id?: string;
          role?: UserRole;
        };
      };
      menu_categories: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          sort_order: number;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          is_available?: boolean;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          is_available?: boolean;
        };
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          base_price: number;
          is_available: boolean;
          sort_order: number;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          restaurant_id: string;
          name: string;
          base_price: number;
          description?: string | null;
          is_available?: boolean;
          sort_order?: number;
          image_url?: string | null;
        };
        Update: {
          id?: string;
          category_id?: string;
          restaurant_id?: string;
          name?: string;
          description?: string | null;
          base_price?: number;
          is_available?: boolean;
          sort_order?: number;
          image_url?: string | null;
        };
      };
      modifier_groups: {
        Row: {
          id: string;
          menu_item_id: string;
          restaurant_id: string;
          name: string;
          required: boolean;
          min_selections: number;
          max_selections: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          menu_item_id: string;
          restaurant_id: string;
          name: string;
          required?: boolean;
          min_selections?: number;
          max_selections?: number;
          sort_order?: number;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          restaurant_id?: string;
          name?: string;
          required?: boolean;
          min_selections?: number;
          max_selections?: number;
          sort_order?: number;
        };
      };
      modifier_options: {
        Row: {
          id: string;
          modifier_group_id: string;
          name: string;
          price_adjustment: number;
          is_default: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          modifier_group_id: string;
          name: string;
          price_adjustment?: number;
          is_default?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          modifier_group_id?: string;
          name?: string;
          price_adjustment?: number;
          is_default?: boolean;
          sort_order?: number;
        };
      };
      customers: {
        Row: {
          id: string;
          phone: string;
          name: string | null;
          email: string | null;
          default_address: string | null;
          restaurant_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          phone: string;
          restaurant_id: string;
          name?: string | null;
          email?: string | null;
          default_address?: string | null;
        };
        Update: {
          id?: string;
          phone?: string;
          name?: string | null;
          email?: string | null;
          default_address?: string | null;
          restaurant_id?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          restaurant_id: string;
          customer_id: string | null;
          call_id: string | null;
          order_number: number;
          order_type: OrderType;
          status: OrderStatus;
          payment_status: PaymentStatus;
          delivery_address: string | null;
          delivery_notes: string | null;
          subtotal: number;
          tax: number;
          delivery_fee: number;
          total: number;
          stripe_payment_link_id: string | null;
          stripe_payment_link_url: string | null;
          stripe_payment_intent_id: string | null;
          paid_at: string | null;
          estimated_ready_at: string | null;
          confirmed_at: string | null;
          ready_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          order_type: OrderType;
          customer_id?: string | null;
          call_id?: string | null;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          delivery_address?: string | null;
          delivery_notes?: string | null;
          subtotal?: number;
          tax?: number;
          delivery_fee?: number;
          total?: number;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          customer_id?: string | null;
          call_id?: string | null;
          order_type?: OrderType;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          delivery_address?: string | null;
          delivery_notes?: string | null;
          subtotal?: number;
          tax?: number;
          delivery_fee?: number;
          total?: number;
          stripe_payment_link_id?: string | null;
          stripe_payment_link_url?: string | null;
          stripe_payment_intent_id?: string | null;
          paid_at?: string | null;
          estimated_ready_at?: string | null;
          confirmed_at?: string | null;
          ready_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string | null;
          name: string;
          quantity: number;
          unit_price: number;
          modifiers: Json;
          item_total: number;
          special_instructions: string | null;
          created_at: string;
        };
        Insert: {
          order_id: string;
          name: string;
          quantity: number;
          unit_price: number;
          item_total: number;
          menu_item_id?: string | null;
          modifiers?: Json;
          special_instructions?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          menu_item_id?: string | null;
          name?: string;
          quantity?: number;
          unit_price?: number;
          modifiers?: Json;
          item_total?: number;
          special_instructions?: string | null;
        };
      };
      calls: {
        Row: {
          id: string;
          restaurant_id: string;
          retell_call_id: string;
          customer_id: string | null;
          order_id: string | null;
          caller_phone: string | null;
          status: CallStatus;
          started_at: string | null;
          ended_at: string | null;
          duration_ms: number | null;
          transcript: Json | null;
          call_analysis: Json | null;
          recording_url: string | null;
          disconnection_reason: string | null;
          created_at: string;
        };
        Insert: {
          restaurant_id: string;
          retell_call_id: string;
          customer_id?: string | null;
          order_id?: string | null;
          caller_phone?: string | null;
          status?: CallStatus;
          started_at?: string | null;
          ended_at?: string | null;
          duration_ms?: number | null;
          transcript?: Json | null;
          call_analysis?: Json | null;
          recording_url?: string | null;
          disconnection_reason?: string | null;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          retell_call_id?: string;
          customer_id?: string | null;
          order_id?: string | null;
          caller_phone?: string | null;
          status?: CallStatus;
          started_at?: string | null;
          ended_at?: string | null;
          duration_ms?: number | null;
          transcript?: Json | null;
          call_analysis?: Json | null;
          recording_url?: string | null;
          disconnection_reason?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      order_type: OrderType;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      call_status: CallStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
