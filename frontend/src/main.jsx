import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import axios from 'axios';
import './index.css'
import App from './App.jsx'

// --- Global API Setup ---
// 1. Axios Interceptor
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('agentToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 2. Fetch Monkey-patch for legacy fetch calls
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  let [resource, config] = args;
  
  // Only inject token for our own API
  if (typeof resource === 'string' && resource.includes('/api/')) {
    config = config || {};
    config.headers = config.headers || {};
    const token = localStorage.getItem('agentToken');
    
    if (token) {
      if (config.headers instanceof Headers) {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers = { ...config.headers, 'Authorization': `Bearer ${token}` };
      }
    }
    args[1] = config;
  }
  
  return originalFetch(...args);
};
// ------------------------

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
