import React from 'react';
import ReactDOM from 'react-dom/client';
import './globals.css';
import App from './App';
import { parseOAuthHash } from './shared/auth';
import { initTheme } from './shared/theme';

initTheme();

// Extension passes token via hash to avoid server-side logging
if (window.location.hash.includes('ext_token=')) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken  = params.get('ext_token');
  const refreshToken = params.get('ext_refresh') ?? '';
  if (accessToken) {
    let email = '';
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]!)) as { email?: string };
      email = payload.email ?? '';
    } catch { /* ignore */ }
    localStorage.setItem('memory_auth', JSON.stringify({ accessToken, refreshToken, email }));
  }
  // Strip the hash so the token isn't visible in the address bar
  const cleanUrl = window.location.pathname + window.location.search;
  window.history.replaceState(null, '', cleanUrl);
}

if (parseOAuthHash()) {
  window.location.replace('/');
} else {
  const root = document.getElementById('root')!;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
