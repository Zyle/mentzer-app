import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, Platform, StyleSheet, Animated, AppState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { supabase } from './src/lib/supabase';
import { registerForPushNotifications } from './src/lib/notifications';
import ErrorBoundary from './src/components/ErrorBoundary';

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

// Minimal tab icon: Feather icon + active dot indicator
function TabIcon({ name, color, focused }) {
  return (
    <View style={ti.wrap}>
      <Feather name={name} size={20} color={color} strokeWidth={focused ? 2.5 : 1.5} />
      {focused && <View style={ti.dot} />}
    </View>
  );
}
const ti = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  dot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: '#c9a84c' },
});

const sp = StyleSheet.create({
  overlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  wordmark: { color: '#c9a84c', fontSize: 36, fontWeight: '900', letterSpacing: 12 },
  sub:      { color: '#333', fontSize: 10, fontWeight: '700', letterSpacing: 6, marginTop: 10 },
});

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#161616',
          borderTopWidth: 1,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 10,
          height: 72 + insets.bottom,
        },
        tabBarActiveTintColor: '#c9a84c',
        tabBarInactiveTintColor: '#3a3a3a',
        tabBarLabelStyle: {
          fontSize: 9,
          letterSpacing: 1.5,
          fontWeight: '700',
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ tabBarIcon: ({ color, focused }) => <TabIcon name="bar-chart-2" color={color} focused={focused} /> }}
      />
      <Tab.Screen
        name="History"
        component={WorkoutHistoryScreen}
        options={{ tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" color={color} focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, focused }) => <TabIcon name="user" color={color} focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── Dev mode ─────────────────────────────────────────────────────────────────
// Set to 'onboarding', 'exercise', 'main', or false (real auth)
const DEV_SCREEN = 'exercise';

export default function App() {
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
        Animated.timing(splashOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(splashOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
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
      if (user && selectedProgramme) {
        await supabase.from('profiles')
          .update({ routine_type: selectedProgramme })
          .eq('id', user.id);
      }
    } catch (_) {}
    setNeedsRoutine(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#c9a84c" />
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
    <SafeAreaProvider>
    <ErrorBoundary>
      {showSplash && (
        <Animated.View style={[sp.overlay, { opacity: splashOpacity }]}>
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
    </SafeAreaProvider>
  );
}
