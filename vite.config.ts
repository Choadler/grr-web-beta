import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const preserveScriptsOnCloudflare = {
  name: 'preserve-scripts-on-cloudflare',
  renderChunk(code: string) {
    return code
      .replaceAll('import.meta.resolve', 'null')
      .replaceAll('import.meta.url', 'document.baseURI')
  },
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string) {
      return html.replace(
        /<script type="module" crossorigin src=/g,
        '<script data-cfasync="false" defer src=',
      )
    },
  },
}

export default defineConfig({
  plugins: [react(), preserveScriptsOnCloudflare],
  build: { modulePreload: false },
})
