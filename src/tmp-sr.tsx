import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-500.css';
import '@fontsource/geist-sans/latin-600.css';
import '@fontsource/geist-sans/latin-700.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
import '@phosphor-icons/web/regular/style.css';
import '@phosphor-icons/web/bold/style.css';
import '@phosphor-icons/web/fill/style.css';
import './styles/app.css';
import { DataProvider, useData } from './store/DataContext';
import { AppShell } from './ui/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { SearchPage } from './features/search/SearchPage';
function A() {
  const { session } = useData();
  if (!session) return <LoginPage />;
  return <Routes><Route element={<AppShell />}><Route path="/search" element={<SearchPage />} /><Route path="/pricelist/:id" element={<div>PL</div>} /></Route><Route path="*" element={<Navigate to="/search" replace />} /></Routes>;
}
createRoot(document.getElementById('root')!).render(<HashRouter><DataProvider><A /></DataProvider></HashRouter>);
