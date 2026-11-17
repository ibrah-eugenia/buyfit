/**
 * Types de la base, au format de `supabase gen types typescript`.
 *
 * ⚠️ Écrit à la main d'après supabase/migrations/ tant que Docker n'est pas dispo.
 * À régénérer dès que possible (et à chaque migration) :
 *   npx supabase gen types typescript --local > apps/web/lib/supabase/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      captures: {
        Row: {
          captured_at: string;
          created_at: string;
          id: string;
          image_url: string;
          pin_url: string;
          user_id: string;
        };
        Insert: {
          captured_at?: string;
          created_at?: string;
          id?: string;
          image_url: string;
          pin_url: string;
          user_id: string;
        };
        Update: {
          captured_at?: string;
          created_at?: string;
          id?: string;
          image_url?: string;
          pin_url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "captures_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      merchant_accounts: {
        Row: {
          auth_kind: Database["public"]["Enums"]["merchant_auth_kind"] | null;
          created_at: string;
          domaine: string;
          email: string | null;
          h_browser_profile_id: string | null;
          h_vault_id: string | null;
          h_vault_item_id: string | null;
          id: string;
          last_verified_at: string | null;
          marchand: string;
          statut: Database["public"]["Enums"]["merchant_account_statut"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auth_kind?: Database["public"]["Enums"]["merchant_auth_kind"] | null;
          created_at?: string;
          domaine: string;
          email?: string | null;
          h_browser_profile_id?: string | null;
          h_vault_id?: string | null;
          h_vault_item_id?: string | null;
          id?: string;
          last_verified_at?: string | null;
          marchand: string;
          statut?: Database["public"]["Enums"]["merchant_account_statut"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth_kind?: Database["public"]["Enums"]["merchant_auth_kind"] | null;
          created_at?: string;
          domaine?: string;
          email?: string | null;
          h_browser_profile_id?: string | null;
          h_vault_id?: string | null;
          h_vault_item_id?: string | null;
          id?: string;
          last_verified_at?: string | null;
          marchand?: string;
          statut?: Database["public"]["Enums"]["merchant_account_statut"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_accounts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      orders: {
        Row: {
          agent_view_url: string | null;
          confirmed: boolean;
          created_at: string;
          h_session_id: string | null;
          id: string;
          merchant_account_id: string | null;
          message: string | null;
          product_id: string;
          product_match_id: string | null;
          product_url: string;
          statut: Database["public"]["Enums"]["order_statut"];
          taille: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agent_view_url?: string | null;
          confirmed?: boolean;
          created_at?: string;
          h_session_id?: string | null;
          id?: string;
          merchant_account_id?: string | null;
          message?: string | null;
          product_id: string;
          product_match_id?: string | null;
          product_url: string;
          statut?: Database["public"]["Enums"]["order_statut"];
          taille: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agent_view_url?: string | null;
          confirmed?: boolean;
          created_at?: string;
          h_session_id?: string | null;
          id?: string;
          merchant_account_id?: string | null;
          message?: string | null;
          product_id?: string;
          product_match_id?: string | null;
          product_url?: string;
          statut?: Database["public"]["Enums"]["order_statut"];
          taille?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_merchant_account_id_fkey";
            columns: ["merchant_account_id"];
            isOneToOne: false;
            referencedRelation: "merchant_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_product_match_fk";
            columns: ["product_match_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "product_matches";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      product_matches: {
        Row: {
          capture_id: string;
          created_at: string;
          devise: string;
          external_id: string;
          id: string;
          image_url: string;
          marque: string;
          nom: string;
          prix: number;
          rang: number;
          score: number;
          tailles_disponibles: string[];
          url: string;
          user_id: string;
        };
        Insert: {
          capture_id: string;
          created_at?: string;
          devise: string;
          external_id: string;
          id?: string;
          image_url: string;
          marque: string;
          nom: string;
          prix: number;
          rang?: number;
          score: number;
          tailles_disponibles?: string[];
          url: string;
          user_id: string;
        };
        Update: {
          capture_id?: string;
          created_at?: string;
          devise?: string;
          external_id?: string;
          id?: string;
          image_url?: string;
          marque?: string;
          nom?: string;
          prix?: number;
          rang?: number;
          score?: number;
          tailles_disponibles?: string[];
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_matches_capture_fk";
            columns: ["capture_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "captures";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          budget_max: number;
          created_at: string;
          devise: string;
          marques_preferees: string[];
          mensurations: Json;
          taille: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget_max?: number;
          created_at?: string;
          devise?: string;
          marques_preferees?: string[];
          mensurations?: Json;
          taille?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_max?: number;
          created_at?: string;
          devise?: string;
          marques_preferees?: string[];
          mensurations?: Json;
          taille?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tryons: {
        Row: {
          created_at: string;
          garment_image_url: string;
          id: string;
          latency_ms: number | null;
          product_match_id: string | null;
          result_storage_path: string | null;
          user_id: string;
          user_photo_id: string | null;
        };
        Insert: {
          created_at?: string;
          garment_image_url: string;
          id?: string;
          latency_ms?: number | null;
          product_match_id?: string | null;
          result_storage_path?: string | null;
          user_id: string;
          user_photo_id?: string | null;
        };
        Update: {
          created_at?: string;
          garment_image_url?: string;
          id?: string;
          latency_ms?: number | null;
          product_match_id?: string | null;
          result_storage_path?: string | null;
          user_id?: string;
          user_photo_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tryons_product_match_fk";
            columns: ["product_match_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "product_matches";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "tryons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "tryons_user_photo_id_fkey";
            columns: ["user_photo_id"];
            isOneToOne: false;
            referencedRelation: "user_photos";
            referencedColumns: ["id"];
          },
        ];
      };
      user_photos: {
        Row: {
          created_at: string;
          id: string;
          storage_path: string;
          type: Database["public"]["Enums"]["photo_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          storage_path: string;
          type?: Database["public"]["Enums"]["photo_type"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          storage_path?: string;
          type?: Database["public"]["Enums"]["photo_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_photos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      api_get_user_profile: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      api_save_capture: {
        Args: { p_capture: Json; p_matches: Json; p_user_id: string };
        Returns: Json;
      };
    };
    Enums: {
      merchant_account_statut: "en_attente" | "connecte" | "expire" | "erreur";
      merchant_auth_kind: "vault" | "browser_profile";
      order_statut: "en_attente" | "en_cours" | "confirmation_requise" | "commandee" | "echec";
      photo_type: "face" | "pied";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      merchant_account_statut: ["en_attente", "connecte", "expire", "erreur"],
      merchant_auth_kind: ["vault", "browser_profile"],
      order_statut: ["en_attente", "en_cours", "confirmation_requise", "commandee", "echec"],
      photo_type: ["face", "pied"],
    },
  },
} as const;
