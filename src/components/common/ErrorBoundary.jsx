import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--paper)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-body)',
          padding: '24px',
          boxSizing: 'border-box',
          textAlign: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-md)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--brick)',
              marginBottom: '12px',
              fontFamily: 'var(--font-display)'
            }}>
              Đã có lỗi xảy ra
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'var(--ink-soft)',
              marginBottom: '24px',
              lineHeight: 1.5
            }}>
              Đã có lỗi xảy ra, vui lòng tải lại trang.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
