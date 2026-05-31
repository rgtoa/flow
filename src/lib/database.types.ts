// Manually maintained until `supabase gen types typescript` is run.
// Update this whenever supabase/migrations/ changes.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:    { id: string; username: "rafael"|"thrisha"; display_name: string; theme: "billionaire"|"girly"; currency: "PHP"|"QAR"; created_at: string; updated_at: string };
        Insert: { id: string; username: "rafael"|"thrisha"; display_name: string; theme?: "billionaire"|"girly"; currency?: "PHP"|"QAR" };
        Update: { theme?: "billionaire"|"girly"; currency?: "PHP"|"QAR"; updated_at?: string };
      };
      user_settings: {
        Row:    { user_id: string; setup_done: boolean; start_date: string|null; monthly_income: number; payday: number; last_rollover: string|null; updated_at: string };
        Insert: { user_id: string; setup_done?: boolean; start_date?: string|null; monthly_income?: number; payday?: number; last_rollover?: string|null };
        Update: { setup_done?: boolean; start_date?: string|null; monthly_income?: number; payday?: number; last_rollover?: string|null };
      };
      accounts: {
        Row:    { id: string; user_id: string; account_key: string; name: string; balance: number; account_type: string; is_active: boolean; sort_order: number };
        Insert: { id?: string; user_id: string; account_key: string; name: string; balance?: number; account_type: string; is_active?: boolean; sort_order?: number };
        Update: { name?: string; balance?: number; is_active?: boolean };
      };
      entries: {
        Row:    { id: string; user_id: string; type: string; amount: number; account_key: string|null; to_account_key: string|null; division_ref: string|null; category: string|null; note: string; recurrence: unknown; created_at: string };
        Insert: { id?: string; user_id: string; type: string; amount: number; account_key?: string|null; to_account_key?: string|null; division_ref?: string|null; category?: string|null; note?: string; recurrence: unknown };
        Update: never;
      };
      divisions: {
        Row:    { id: string; user_id: string; name: string; color: string; budget_limit: number; spent: number; carryover: number; mode: string; deadline_day: number|null; is_savings: boolean; balance: number; sort_order: number };
        Insert: { id?: string; user_id: string; name: string; color: string; budget_limit?: number; spent?: number; carryover?: number; mode: string; deadline_day?: number|null; is_savings?: boolean; balance?: number; sort_order?: number };
        Update: { spent?: number; carryover?: number; balance?: number };
      };
      savings_goals: {
        Row:    { id: string; division_id: string; name: string; color: string; amount: number; monthly: number; sort_order: number };
        Insert: { id?: string; division_id: string; name: string; color: string; amount?: number; monthly?: number; sort_order?: number };
        Update: { name?: string; color?: string; amount?: number; monthly?: number };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Profile     = Database["public"]["Tables"]["profiles"]["Row"];
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type DbAccount   = Database["public"]["Tables"]["accounts"]["Row"];
export type DbEntry     = Database["public"]["Tables"]["entries"]["Row"];
export type DbDivision  = Database["public"]["Tables"]["divisions"]["Row"];
export type DbGoal      = Database["public"]["Tables"]["savings_goals"]["Row"];
