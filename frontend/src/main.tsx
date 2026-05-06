import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Toaster from './components/Toaster';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ThemeProvider>
        <App />
        <Toaster />
      </ThemeProvider>
    </ToastProvider>
  </React.StrictMode>
);
