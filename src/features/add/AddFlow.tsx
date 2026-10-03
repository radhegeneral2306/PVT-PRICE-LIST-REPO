import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { AddProvider, useAdd } from './AddContext';
import { FactoryStep } from './FactoryStep';
import { MethodStep } from './MethodStep';
import { PasteStep } from './PasteStep';
import { UploadStep } from './UploadStep';
import { ConfirmStep } from './ConfirmStep';
import './add.css';

/** Sends people back to the first step that still needs an answer (deep links, refresh, cleared draft). */
function Guard({ need, children }: { need: 'factory' | 'method' | 'paste' | 'upload'; children: ReactElement }) {
  const { state, ready } = useAdd();
  if (need === 'factory') return children;
  if (!ready && state.factoryId) return children; // factory list still loading; the step shows its own skeleton
  if (!state.factoryId) return <Navigate to="/add" replace />;
  if (need === 'method') return children;
  if (!state.method) return <Navigate to="/add/method" replace />;
  if (need === 'paste' && state.method !== 'paste') return <Navigate to="/add/method" replace />;
  if (need === 'upload' && state.method === 'paste') return <Navigate to="/add/method" replace />;
  return children;
}

function Steps() {
  const { state, ready } = useAdd();
  const [params] = useSearchParams();
  const wantsPreselect = !!params.get('factory');
  // ?factory=:id on the bare /add route: skip step 1 once the factory is known (the provider applies it).
  const first = state.factoryLocked && state.factoryId
    ? <Navigate to="/add/method" replace />
    : wantsPreselect && !ready ? null : <FactoryStep />;
  return (
    <Routes>
      <Route index element={first} />
      <Route path="method" element={<Guard need="method"><MethodStep /></Guard>} />
      <Route path="paste" element={<Guard need="paste"><PasteStep /></Guard>} />
      <Route path="upload" element={<Guard need="upload"><UploadStep /></Guard>} />
      <Route path="confirm" element={<Guard need="method"><ConfirmStep /></Guard>} />
      <Route path="*" element={<Navigate to="/add" replace />} />
    </Routes>
  );
}

export function AddFlow() {
  return (
    <AddProvider>
      <Steps />
    </AddProvider>
  );
}
