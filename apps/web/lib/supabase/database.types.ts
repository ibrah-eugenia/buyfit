// Généré par : npx supabase gen types typescript --remote=evvlrnvbpvecgskstijv
// Ne pas modifier à la main : régénérer après chaque migration (voir docs/data-access.md).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
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
          adresse: Json;
          budget_max: number;
          contact: Json;
          created_at: string;
          daltonisme: Json;
          devise: string;
          genre: string | null;
          marques_preferees: string[];
          mensurations: Json;
          morphologie: Json;
          onboarding_termine: boolean;
          poids_kg: number | null;
          taille: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          adresse?: Json;
          budget_max?: number;
          contact?: Json;
          created_at?: string;
          daltonisme?: Json;
          devise?: string;
          genre?: string | null;
          marques_preferees?: string[];
          mensurations?: Json;
          morphologie?: Json;
          onboarding_termine?: boolean;
          poids_kg?: number | null;
          taille?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          adresse?: Json;
          budget_max?: number;
          contact?: Json;
          created_at?: string;
          daltonisme?: Json;
          devise?: string;
          genre?: string | null;
          marques_preferees?: string[];
          mensurations?: Json;
          morphologie?: Json;
          onboarding_termine?: boolean;
          poids_kg?: number | null;
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
      api_get_user_profile: { Args: { p_user_id: string }; Returns: Json };
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
      merchant_account_statut: ["en_attente", "connecte", "expire", "erreur"],
      merchant_auth_kind: ["vault", "browser_profile"],
      order_statut: ["en_attente", "en_cours", "confirmation_requise", "commandee", "echec"],
      photo_type: ["face", "pied"],
    },
  },
} as const;
