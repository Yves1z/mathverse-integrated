import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MathverseHome } from './mathverse/MathverseHome';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><MathverseHome /></StrictMode>,
);
