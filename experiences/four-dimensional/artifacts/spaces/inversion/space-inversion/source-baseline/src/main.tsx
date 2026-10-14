import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { MathverseHome } from './mathverse/MathverseHome';
import './styles.css';

const SpaceStudy = lazy(() => import('./mathverse/revision/SpaceStudy').then(module => ({ default: module.SpaceStudy })));
const SpaceWorldStudy = lazy(() => import('./mathverse/revision/SpaceWorldStudy').then(module => ({ default: module.SpaceWorldStudy })));
const isSpaceStudy = location.pathname.replace(/\/$/, '') === '/space-a';
const isSpaceWorldStudy = location.pathname.replace(/\/$/, '') === '/space-a/worlds';
createRoot(document.getElementById('root')!).render(
  <StrictMode><Suspense fallback={null}>{isSpaceWorldStudy ? <SpaceWorldStudy/> : isSpaceStudy ? <SpaceStudy/> : <MathverseHome />}</Suspense></StrictMode>,
);
