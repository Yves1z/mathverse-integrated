import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { MathverseHome } from './mathverse/MathverseHome';
import './styles.css';

const SpaceStudy = lazy(() => import('./mathverse/revision/SpaceStudy').then(module => ({ default: module.SpaceStudy })));
const SpaceWorldStudy = lazy(() => import('./mathverse/revision/SpaceWorldStudy').then(module => ({ default: module.SpaceWorldStudy })));
const InversionStudy = lazy(() => import('./mathverse/revision/InversionStudy').then(module => ({ default: module.InversionStudy })));
const isSpaceStudy = location.pathname.replace(/\/$/, '') === '/space-a';
const isSpaceWorldStudy = location.pathname.replace(/\/$/, '') === '/space-a/worlds';
const isInversionStudy = location.pathname.replace(/\/$/, '') === '/space-inversion';
const isInversionWorlds = location.pathname.replace(/\/$/, '') === '/space-inversion/worlds';
const isLegacy = location.pathname.replace(/\/$/, '') === '/legacy';
const isFusion = location.pathname.replace(/\/$/, '') === '/space-fusion';
const isFusionWorlds = location.pathname.replace(/\/$/, '') === '/space-fusion/worlds';
const isMobiusFusion = location.pathname.replace(/\/$/, '') === '/space-fusion/mobius';
const isMobiusFusionWorlds = location.pathname.replace(/\/$/, '') === '/space-fusion/mobius/worlds';
createRoot(document.getElementById('root')!).render(
  <StrictMode><Suspense fallback={null}>{isInversionStudy ? <InversionStudy/> : isSpaceWorldStudy ? <SpaceWorldStudy/> : isSpaceStudy ? <SpaceStudy/> : <MathverseHome inversion={!isLegacy} fusion={isFusion||isFusionWorlds||isMobiusFusion||isMobiusFusionWorlds} fusionContent={isMobiusFusion||isMobiusFusionWorlds} skipEntrance={isInversionWorlds||isFusionWorlds||isMobiusFusionWorlds}/>}</Suspense></StrictMode>,
);
