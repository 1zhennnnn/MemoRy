import React from 'react';
import ReactDOM from 'react-dom/client';
import './globals.css';
import App from './App';
import { parseOAuthHash } from './shared/auth';
import { initTheme } from './shared/theme';

initTheme();

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
