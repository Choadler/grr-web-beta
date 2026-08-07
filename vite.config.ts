import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const preserveScriptsOnCloudflare = {
  name: 'preserve-scripts-on-cloudflare',
  augmentChunkHash() {
    return 'grr-classic-loader-v2'
  },
  renderChunk(code: string) {
    return `/* grr-classic-loader-v2 */\n${code
      .replaceAll('import.meta.resolve', 'null')
      .replaceAll('import.meta.url', 'document.baseURI')}`
  },
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string) {
      return html.replace(
        /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
        '<script data-cfasync="false" defer src="$1?v=grr-classic-v2"></script>',
      )
    },
  },
}

export default defineConfig({
  plugins: [react(), preserveScriptsOnCloudflare],
  build: { modulePreload: false },
})
