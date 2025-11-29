import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/tailwind.css';

// Force cache invalidation on page load
if (typeof window !== 'undefined') {
  sessionStorage.clear();
  
  // Add timestamp to force cache busting
  const version = Date.now();
  sessionStorage.setItem('app_version', version.toString());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
