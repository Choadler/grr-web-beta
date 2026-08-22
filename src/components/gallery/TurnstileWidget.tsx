import { useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('The security check could not load.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function TurnstileWidget({
  onToken,
  action = 'gallery_upload',
  unavailableMessage = 'Photo submissions are temporarily unavailable.',
}: {
  onToken: (token: string) => void
  action?: string
  unavailableMessage?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (import.meta.env.DEV) {
      onToken('local-development')
      return
    }
    if (!sitekey || !containerRef.current) {
      onToken('')
      setError(unavailableMessage)
      return
    }

    let active = true
    let widgetId = ''
    loadTurnstile()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey,
          action,
          theme: 'dark',
          size: 'flexible',
          callback: (token: string) => {
            setError('')
            onToken(token)
          },
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('')
            setError('The security check failed. Please try again.')
          },
        })
      })
      .catch(() => {
        if (!active) return
        onToken('')
        setError('The security check could not load. Please refresh and try again.')
      })

    return () => {
      active = false
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [action, onToken, sitekey, unavailableMessage])

  return (
    <div className="gallery-turnstile">
      <div ref={containerRef} />
      {error && <p className="gallery-notice gallery-notice--error" role="alert">{error}</p>}
    </div>
  )
}
