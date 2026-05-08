import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Turbopack infers the workspace root from /home/jintu/package.json (Paperclip install).
// Pin outputFileTracingRoot to the project directory to avoid incorrect tracing.
const projectRoot = path.resolve(__dirname || process.cwd());

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default withNextIntl(nextConfig);
