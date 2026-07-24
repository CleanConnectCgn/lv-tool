import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unbehandelter Fehler in der Anwendung:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary-page">
          <div className="error-boundary-card">
            <h1>Etwas ist schiefgelaufen</h1>
            <p>
              Es ist ein unerwarteter Fehler aufgetreten. Deine gespeicherten Daten sind davon nicht betroffen.
            </p>
            <p className="error-boundary-detail">{this.state.error?.message || String(this.state.error)}</p>
            <button
              className="btn-primary"
              onClick={() => {
                this.setState({ error: null });
                window.location.href = '/';
              }}
            >
              Zurück zur Startseite
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
