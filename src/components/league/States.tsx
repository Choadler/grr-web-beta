export function LoadingState({ label = 'Loadingâ€¦' }: { label?: string }) {
  return (
    <div className="state-message" role="status">
      <span className="loader" aria-hidden="true" />
      {label}
    </div>
  )
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state-message">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-message state-message--error" role="alert">
      <strong>Unable to load data</strong>
      <p>{message}</p>
      {onRetry && <button className="button button--compact" type="button" onClick={onRetry}>Try again</button>}
    </div>
  )
}
