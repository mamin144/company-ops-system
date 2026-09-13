import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

// Register service worker and handle updates
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('يتوفر تحديث جديد للتطبيق. هل ترغب في التحديث الآن؟')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('التطبيق جاهز للعمل دون اتصال بالإنترنت');
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
