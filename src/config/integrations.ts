export const publicEndpoints = {
  cup: {
    standings: 'https://www.simracerhub.com/scoring/get_standings.php?season_id=28581',
    recentResults: 'https://red-star-b0d9.cknoedler1013.workers.dev/?series_id=12921&limit=12',
  },
  gt: {
    standings: {
      am: 'https://aged-breeze-c1bb.cknoedler1013.workers.dev/gt/am',
      pro: 'https://aged-breeze-c1bb.cknoedler1013.workers.dev/gt/pro',
      gtp: 'https://aged-breeze-c1bb.cknoedler1013.workers.dev/gt/gtp',
    },
    teamStandings: {
      am: 'https://holy-bird-8afa.cknoedler1013.workers.dev/gt/am',
      pro: 'https://holy-bird-8afa.cknoedler1013.workers.dev/gt/pro',
      gtp: 'https://holy-bird-8afa.cknoedler1013.workers.dev/gt/gtp',
    },
    raceBreakdown: 'https://grr-gt-racebyrace.cknoedler1013.workers.dev/api/race-breakdown',
  },
  indycar: {
    seriesId: 14491,
    standings: 'https://www.simracerhub.com/scoring/get_standings.php?series_id=14491',
  },
} as const

// Administrative refresh endpoints intentionally do not belong in public client configuration.
