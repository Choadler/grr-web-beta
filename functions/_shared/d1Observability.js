export function logD1Result(env, endpoint, queryType, result) {
  if (env?.D1_QUERY_LOGGING === '0' || !result?.meta) return
  const meta = result.meta
  console.log(JSON.stringify({
    type: 'd1-query',
    endpoint,
    queryType,
    rowsRead: Number(meta.rows_read) || 0,
    rowsWritten: Number(meta.rows_written) || 0,
    durationMs: Number(meta.duration ?? meta.timings?.sql_duration_ms) || 0,
  }))
}

export async function observedAll(statement, env, endpoint, queryType) {
  const result = await statement.all()
  logD1Result(env, endpoint, queryType, result)
  return result
}

export async function observedFirst(statement, env, endpoint, queryType) {
  const result = await statement.all()
  logD1Result(env, endpoint, queryType, result)
  return result.results[0] ?? null
}
