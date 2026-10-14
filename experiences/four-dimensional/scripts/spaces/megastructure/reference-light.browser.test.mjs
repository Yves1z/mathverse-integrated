const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
process.env.MATHVERSE_QA_OUT=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-reference-light`;
process.env.MATHVERSE_QA_URL=`${INTEGRATION_BASE_URL}/space-a/reference/?finish=polished`;
await import('./reference-euler.browser.test.mjs');
