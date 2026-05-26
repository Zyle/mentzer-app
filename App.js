import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, Platform } from 'react-native';
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
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1a1a1a',
          borderTopWidth: 1,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          height: 70 + insets.bottom,
        },
        tabBarActiveTintColor: '#c9a84c',
        tabBarInactiveTintColor: '#444',
        tabBarLabelStyle: {
          fontSize: 9,
          letterSpacing: 1.5,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'HOME', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚡</Text> }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ tabBarLabel: 'PROGRESS', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📈</Text> }}
      />
      <Tab.Screen
        name="History"
        component={WorkoutHistoryScreen}
        options={{ tabBarLabel: 'HISTORY', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'PROFILE', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

// ─── Dev mode ─────────────────────────────────────────────────────────────────
// Set to 'onboarding', 'exercise', 'main', or false (real auth)
const DEV_SCREEN = false;

export default function App() {
  const [session, setSession]                   = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [needsOnboarding, setNeedsOnboarding]   = useState(false);
  const [needsRoutine, setNeedsRoutine]         = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
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

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
    setNeedsRoutine(true);
  };

  const handleRoutineComplete = () => {
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
    return <ExerciseSelectionScreen onComplete={handleRoutineComplete} />;
  }

  return (
    <SafeAreaProvider>
    <ErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!session ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={TabNavigator} />
              <Stack.Screen name="Workout" component={WorkoutScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
    </SafeAreaProvider>
  );
}
