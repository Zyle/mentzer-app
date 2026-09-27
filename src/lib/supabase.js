import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { createDemoClient } from './demoClient';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Demo mode (web preview only): EXPO_PUBLIC_DEMO=1 swaps in seeded in-memory data
// and skips sign-in. Never set this for real builds.
const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export const supabase = DEMO ? createDemoClient() : createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
