import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error in application:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0B0F17',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🥗</div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Something went wrong</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '320px', marginBottom: '20px' }}>
            {this.state.error?.message || "An unexpected error occurred while loading the tracker."}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#10B981',
                color: '#0B0F17',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Reload Tracker
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                  window.location.reload();
                } catch {}
              }}
              style={{
                backgroundColor: '#1E293B',
                color: '#94A3B8',
                border: '1px solid #334155',
                padding: '10px 16px',
                borderRadius: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Reset Data
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

