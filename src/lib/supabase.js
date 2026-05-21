import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mqyweoweacpyoupxkwlb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xeXdlb3dlYWNweW91cHhrd2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODE2MDcsImV4cCI6MjA5NDk1NzYwN30.XSZzSdUVzpzfbacX7RHf8UicoC876YFNpOyZ5tX3OgE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
