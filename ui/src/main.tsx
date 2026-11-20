import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { applyAccent, applyTheme, loadAccent, loadTheme } from './theme';

// Before the first render, so a chosen theme or colour never flashes the default one.
applyTheme(loadTheme());
applyAccent(loadAccent());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
