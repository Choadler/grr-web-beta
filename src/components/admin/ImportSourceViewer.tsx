export type ImportSource = {
  seasonName: string
  round: number
  track: string
  filename: string
  importedAt: string
  rawJson: unknown
}

export function ImportSourceViewer({ source, close }: { source: ImportSource; close: () => void }) {
  return <section className="admin-source-viewer" aria-labelledby="import-source-title">
    <div className="admin-source-viewer__heading">
      <div>
        <p className="eyebrow">Original iRacing source</p>
        <h3 id="import-source-title">{source.seasonName} · Round {source.round}: {source.track}</h3>
        <small>{source.filename} · {new Date(source.importedAt).toLocaleString()}</small>
      </div>
      <button className="button button--compact button--secondary" type="button" onClick={close}>Close JSON</button>
    </div>
    <pre><code>{JSON.stringify(source.rawJson, null, 2)}</code></pre>
  </section>
}
