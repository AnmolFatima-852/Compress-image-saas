export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type CompressionHistoryRow = {
  id: string;
  user_id: string;
  original_filename: string;
  original_size: number;
  compressed_size: number;
  saved_space: number;
  compression_ratio: string;
  image_format: string;
  width: number;
  height: number;
  created_at: string;
};

export type BatchHistoryRow = {
  id: string;
  user_id: string;
  image_count: number;
  total_original_size: number;
  total_compressed_size: number;
  total_saved_space: number;
  output_format: string;
  zip_downloaded: boolean;
  pdf_downloaded: boolean;
  duration_ms: number;
  created_at: string;
};

export type UserSettingsRow = {
  user_id: string;
  default_unit: 'KB' | 'MB';
  default_output_format: 'jpeg' | 'png' | 'webp';
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, 'id'> & Partial<Omit<ProfileRow, 'id' | 'created_at'>>;
        Update: Partial<Omit<ProfileRow, 'id'>>;
      };
      compression_history: {
        Row: CompressionHistoryRow;
        Insert: Omit<CompressionHistoryRow, 'created_at' | 'saved_space'> & {
          created_at?: string;
          saved_space?: number;
        };
        Update: Partial<Omit<CompressionHistoryRow, 'id' | 'user_id'>>;
      };
      batch_history: {
        Row: BatchHistoryRow;
        Insert: Omit<
          BatchHistoryRow,
          'created_at' | 'total_saved_space' | 'zip_downloaded' | 'pdf_downloaded' | 'duration_ms' | 'output_format'
        > & {
          created_at?: string;
          total_saved_space?: number;
          zip_downloaded?: boolean;
          pdf_downloaded?: boolean;
          duration_ms?: number;
          output_format?: string;
        };
        Update: Partial<Omit<BatchHistoryRow, 'id' | 'user_id'>>;
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: Pick<UserSettingsRow, 'user_id'> & Partial<Omit<UserSettingsRow, 'user_id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<UserSettingsRow, 'user_id'>>;
      };
    };
  };
};
