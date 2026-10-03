import { Navigate, Route, Routes } from 'react-router-dom';
import { useData } from './store/DataContext';
import { AppShell } from './ui/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { HomePage } from './features/home/HomePage';
import { FactoriesPage } from './features/factories/FactoriesPage';
import { FactoryDetailPage } from './features/factories/FactoryDetailPage';
import { PricelistPage } from './features/pricelist/PricelistPage';
import { FileViewerPage } from './features/files/FileViewerPage';
import { SearchPage } from './features/search/SearchPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AddFlow } from './features/add/AddFlow';

export function App() {
  const { session } = useData();
  if (!session) return <LoginPage />;
  return (
    <Routes>
      {/* Flow screens: no tab bar */}
      <Route path="/add/*" element={<AddFlow />} />
      <Route path="/file/:pricelistId" element={<FileViewerPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/factories" element={<FactoriesPage />} />
        <Route path="/factories/:id" element={<FactoryDetailPage />} />
        <Route path="/pricelist/:id" element={<PricelistPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
