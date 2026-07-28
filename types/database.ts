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
  compression_ratio: string;
  image_format: string;
  width: number;
  height: number;
  created_at: string;
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
        Insert: Omit<CompressionHistoryRow, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<CompressionHistoryRow, 'id' | 'user_id'>>;
      };
    };
  };
};
