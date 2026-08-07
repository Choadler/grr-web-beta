import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const preserveModuleScripts = {
  name: 'preserve-module-scripts-on-cloudflare',
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string) {
      return html.replace(
        /<script type="module"/g,
        '<script data-cfasync="false" type="module"',
      )
    },
  },
}

export default defineConfig({ plugins: [react(), preserveModuleScripts] })
