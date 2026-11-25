// Entry point. Since Phase 4 the application wiring lives in app/bootstrap.tsx
// (providers + error boundary) and app/router.tsx (route tree + guard); this
// file only mounts React and supplies the router root.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Bootstrap } from '@/app/bootstrap';
import '@/shared/styles/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Bootstrap />
    </BrowserRouter>
  </React.StrictMode>,
);
