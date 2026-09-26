import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from './Button';
import { COLORS, FONT } from '../theme';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container} accessibilityRole="alert">
          <Text style={styles.title}>MENTZER</Text>
          <Text style={styles.sub}>HEAVY DUTY</Text>
          <Text style={styles.heading}>Something went wrong.</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Button
            title="TRY AGAIN"
            variant="secondary"
            onPress={() => this.setState({ hasError: false, error: null })}
            style={styles.button}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  title:   { fontSize: 28, fontWeight: FONT.black, color: COLORS.white, letterSpacing: 6, marginBottom: 4 },
  sub:     { fontSize: 11, color: COLORS.gold, letterSpacing: 4, marginBottom: 40 },
  heading: { color: COLORS.white, fontSize: 18, fontWeight: FONT.bold, marginBottom: 12, textAlign: 'center' },
  message: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 32 },
  button:  { alignSelf: 'stretch' },
});
