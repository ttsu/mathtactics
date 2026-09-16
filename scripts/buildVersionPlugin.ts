import type { Plugin } from 'vite';

/** Injects `import.meta.env.VITE_BUILD_ID`, a `<meta name="mt-build-id">`, and `version.json`. */
export function buildVersionPlugin(): Plugin {
  let buildId = 'dev';

  return {
    name: 'mt-build-version',
    config(_config, { mode }) {
      buildId = process.env.VITE_BUILD_ID ?? (mode === 'development' ? 'dev' : 'local');
      return {
        define: {
          'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
        },
      };
    },
    transformIndexHtml(html) {
      if (html.includes('name="mt-build-id"')) return html;
      return html.replace('<head>', `<head>\n    <meta name="mt-build-id" content="${buildId}" />`);
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId }),
      });
    },
  };
}
