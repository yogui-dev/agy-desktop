import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AGY Desktop ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          backgroundColor: '#0d1117',
          color: '#f85149',
          padding: '30px',
          fontFamily: 'sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '650px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ color: '#ff7b72', margin: '0 0 12px 0', fontSize: '18px' }}>
              ⚠️ Se produjo un error al renderizar la interfaz
            </h2>
            <p style={{ color: '#8b949e', fontSize: '13px', margin: '0 0 16px 0' }}>
              AGY Desktop ha interceptado el error para evitar el cierre inesperado.
            </p>
            <pre style={{
              background: '#0d1117',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #21262d',
              color: '#f85149',
              fontSize: '12px',
              fontFamily: 'monospace',
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '18px',
                padding: '8px 18px',
                backgroundColor: '#238636',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              Reiniciar Interfaz
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
