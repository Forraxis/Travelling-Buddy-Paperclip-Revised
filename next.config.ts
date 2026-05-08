import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { createRequire } from 'module';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// createRequire from this file's URL resolves modules relative to the config file,
// not process.cwd() — critical when Next.js is started from a parent workspace directory.
let _req: NodeRequire;
try {
  _req = createRequire(import.meta.url);
} catch {
  // CJS fallback
  _req = createRequire(__filename);
}

const tailwindcssIndexCss = _req.resolve('tailwindcss/index.css');
const projectRoot = path.dirname(_req.resolve('./package.json'));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      // Alias the bare 'tailwindcss' CSS import to the exact file so Turbopack's
      // CSS resolver doesn't walk up to the Paperclip workspace root.
      tailwindcss: tailwindcssIndexCss,
    },
  },
  outputFileTracingRoot: projectRoot,
};

export default withNextIntl(nextConfig);
