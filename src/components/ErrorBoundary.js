import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
        <View style={styles.container}>
          <Text style={styles.title}>MENTZER</Text>
          <Text style={styles.sub}>HEAVY DUTY II</Text>
          <Text style={styles.heading}>Something went wrong.</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0a0a0a',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  title: {
    fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 6, marginBottom: 4,
  },
  sub: {
    fontSize: 10, color: '#c9a84c', letterSpacing: 4, marginBottom: 40,
  },
  heading: {
    color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12, textAlign: 'center',
  },
  message: {
    color: '#555', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 32,
  },
  button: {
    backgroundColor: '#1c1c1e', borderWidth: 1, borderColor: '#2c2c2e',
    borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32,
  },
  buttonText: {
    color: '#c9a84c', fontSize: 13, fontWeight: '900', letterSpacing: 2,
  },
});
