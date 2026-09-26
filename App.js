import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, Platform, StyleSheet, Animated, AppState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { supabase } from './src/lib/supabase';
import { registerForPushNotifications } from './src/lib/notifications';
import { saveRoutineType } from './src/lib/programme';
import ErrorBoundary from './src/components/ErrorBoundary';
import { COLORS, FONT } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WorkoutHistoryScreen from './src/screens/WorkoutHistoryScreen';
import ExerciseSelectionScreen from './src/screens/ExerciseSelectionScreen';
import ProgrammeSelectionScreen from './src/screens/ProgrammeSelectionScreen';
import TwoWaySplitSetupScreen from './src/screens/TwoWaySplitSetupScreen';
import CalorieTrackerScreen from './src/screens/CalorieTrackerScreen';
import HDScoreDetailScreen from './src/screens/HDScoreDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// Tab icon: Feather icon with a gold pill behind the active tab
function TabIcon({ name, color, focused }) {
  return (
    <View style={[ti.wrap, focused && ti.wrapActive]}>
      <Feather name={name} size={20} color={color} />
    </View>
  );
}
const ti = StyleSheet.create({
  wrap:       { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wrapActive: { backgroundColor: COLORS.goldFaint },
});

const sp = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject,
              backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  wordmark: { color: COLORS.gold, fontSize: 34, fontWeight: FONT.black, letterSpacing: 12 },
  sub:      { color: COLORS.textDim, fontSize: 11, fontWeight: FONT.semibold, letterSpacing: 6, marginTop: 10 },
});

const TABS = [
  { name: 'Home',     label: 'Today',    icon: 'sun',         component: HomeScreen },
  { name: 'Progress', label: 'Progress', icon: 'trending-up', component: ProgressScreen },
  { name: 'History',  label: 'History',  icon: 'calendar',    component: WorkoutHistoryScreen },
  { name: 'Profile',  label: 'Profile',  icon: 'user',        component: ProfileScreen },
];

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 8,
          height: 66 + insets.bottom,
        },
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: FONT.semibold, marginTop: 2 },
      }}
    >
      {TABS.map(t => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            tabBarLabel: t.label,
            tabBarAccessibilityLabel: `${t.label} tab`,
            tabBarIcon: ({ color, focused }) => <TabIcon name={t.icon} color={color} focused={focused} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

// ─── Dev mode ─────────────────────────────────────────────────────────────────
// Set to 'onboarding', 'exercise', 'main', or false (real auth)
const DEV_SCREEN = false;

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [session, setSession]                   = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [needsOnboarding, setNeedsOnboarding]   = useState(false);
  const [needsRoutine, setNeedsRoutine]         = useState(false);
  const [selectedProgramme, setSelectedProgramme] = useState(null);
  const [showSplash, setShowSplash]             = useState(false);
  const splashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const hideNavBar = () => {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    };
    hideNavBar();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') hideNavBar();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // DEV: bypass Supabase entirely — jump straight to target screen
    if (DEV_SCREEN) {
      if (DEV_SCREEN === 'onboarding') { setNeedsOnboarding(true); setSession({ user: { id: 'dev' } }); }
      if (DEV_SCREEN === 'exercise')   { setNeedsRoutine(true);   setSession({ user: { id: 'dev' } }); }
      if (DEV_SCREEN === 'main')       { setSession({ user: { id: 'dev' } }); }
      setLoading(false);
      return;
    }

    // ── Production auth flow ───────────────────────────────────────────────
    const timeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      if (session) checkOnboarding(session.user.id);
      else setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkOnboarding(session.user.id);
      else setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const checkOnboarding = async (userId) => {
    registerForPushNotifications(); // non-blocking — asks permission, no await needed
    try {
      const { data } = await supabase
        .from('profiles')
        .select('name, age, sex, height_cm, bodyweight_kg, goal, experience_level, routine')
        .eq('id', userId)
        .single();

      const profileComplete = data &&
        data.name && data.age && data.sex &&
        data.height_cm && data.bodyweight_kg &&
        data.goal && data.experience_level;

      if (!profileComplete) {
        setNeedsOnboarding(true);
      } else if (!data.routine || data.routine.length === 0) {
        setNeedsRoutine(true);
      }
      setLoading(false);
    } catch (_) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && session && !needsOnboarding && !needsRoutine) {
      splashOpacity.setValue(0);
      setShowSplash(true);
      Animated.sequence([
        Animated.timing(splashOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(splashOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start(() => setShowSplash(false));
    }
  }, [loading]);

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
    setNeedsRoutine(true);
  };

  const handleRoutineComplete = async () => {
    // Save the chosen programme type to the profile
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await saveRoutineType(user?.id, selectedProgramme);
    } catch (_) {}
    setNeedsRoutine(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.gold} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (needsOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (needsRoutine) {
    // Step 1 — pick a programme
    if (!selectedProgramme) {
      return <ProgrammeSelectionScreen onSelect={setSelectedProgramme} />;
    }
    // Step 2 — Consolidation uses the existing exercise picker
    // Ideal Routine and Two-Way Split will get their own flows later
    if (selectedProgramme === 'consolidation') {
      return <ExerciseSelectionScreen onComplete={handleRoutineComplete} onBack={() => setSelectedProgramme(null)} />;
    }
    if (selectedProgramme === 'two_way') {
      return <TwoWaySplitSetupScreen onComplete={handleRoutineComplete} onBack={() => setSelectedProgramme(null)} />;
    }
    // Ideal Routine — placeholder until its flow is built
    return <ExerciseSelectionScreen onComplete={handleRoutineComplete} onBack={() => setSelectedProgramme(null)} />;
  }

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      {showSplash && (
        <Animated.View style={[sp.overlay, { opacity: splashOpacity }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={sp.wordmark}>MENTZER</Text>
          <Text style={sp.sub}>HEAVY DUTY</Text>
        </Animated.View>
      )}
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!session ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={TabNavigator} />
              <Stack.Screen name="Workout" component={WorkoutScreen} />
              <Stack.Screen name="CalorieTracker" component={CalorieTrackerScreen} />
              <Stack.Screen name="HDScoreDetail" component={HDScoreDetailScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
