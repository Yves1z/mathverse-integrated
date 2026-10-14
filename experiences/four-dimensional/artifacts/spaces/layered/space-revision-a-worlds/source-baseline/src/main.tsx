import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { MathverseHome } from './mathverse/MathverseHome';
import './styles.css';

const SpaceStudy = lazy(() => import('./mathverse/revision/SpaceStudy').then(module => ({ default: module.SpaceStudy })));
const isSpaceStudy = location.pathname.replace(/\/$/, '') === '/space-a';
createRoot(document.getElementById('root')!).render(
  <StrictMode><Suspense fallback={null}>{isSpaceStudy ? <SpaceStudy/> : <MathverseHome />}</Suspense></StrictMode>,
);
