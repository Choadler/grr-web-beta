export const publicEndpoints = {
  cup: {
    standings: 'https://www.simracerhub.com/scoring/get_standings.php?season_id=28581',
    recentResults: 'https://red-star-b0d9.cknoedler1013.workers.dev/?series_id=12921&limit=12',
  },
} as const

// Administrative refresh endpoints intentionally do not belong in public client configuration.
