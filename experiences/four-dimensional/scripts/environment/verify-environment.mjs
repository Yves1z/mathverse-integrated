import { mathverseBrowserOptions } from './browser-options.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import katex from 'katex';
import { BloomEffect } from 'postprocessing';
import { EffectComposer } from '@react-three/postprocessing';
import { build } from 'vite';
import reactPlugin from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname,'../..');
const probeDir = path.join(root, 'temp', 'environment-check');
const results = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  npmCache: process.env.NPM_CONFIG_CACHE,
  temp: process.env.TEMP,
  packageImports: false,
  typescript: null,
  viteBuild: false,
  browser: null,
  webgl2: false,
};
await fs.mkdir(probeDir, { recursive: true });
const markup = renderToStaticMarkup(React.createElement('span', null, 'Mathverse'));
const vector = new THREE.Vector3(1, 2, 3);
const formula = katex.renderToString('e^{i\\pi}+1=0', { throwOnError: true });
if (!markup.includes('Mathverse') || vector.lengthSq() !== 14 || !formula.includes('katex') || !Canvas || !EffectComposer) {
  throw new Error('Runtime dependency verification failed');
}
const bloom = new BloomEffect();
bloom.dispose();
results.packageImports = true;
results.typescript = execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--version'], { encoding: 'utf8', windowsHide: true }).trim();
const fixturePath = path.join(probeDir, 'probe.tsx');
await fs.writeFile(fixturePath, 'import { Canvas } from "@react-three/fiber";\nexport default function Probe(){return <Canvas><mesh><boxGeometry/><meshBasicMaterial color="#514c43"/></mesh></Canvas>;}\n');
await build({
  configFile: false,
  root: probeDir,
  plugins: [reactPlugin()],
  logLevel: 'warn',
  build: {
    outDir: path.join(probeDir, 'dist'),
    emptyOutDir: false,
    minify: false,
    lib: { entry: fixturePath, formats: ['es'], fileName: 'probe' },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', '@react-three/fiber'] },
  },
});
results.viteBuild = true;
let browser;
try {
  browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
  results.browser = browser.version();
  const page = await browser.newPage();
  await page.setContent('<canvas id="probe" width="64" height="64"></canvas>');
  results.webgl2 = await page.evaluate(() => {
    const gl = document.getElementById('probe').getContext('webgl2');
    if (!gl) return false;
    gl.clearColor(0.05, 0.05, 0.04, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return gl.getError() === gl.NO_ERROR;
  });
} finally {
  if (browser) await browser.close();
}
await fs.writeFile(path.join(root, 'docs/environment/environment-verification.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (!results.webgl2) process.exitCode = 2;
