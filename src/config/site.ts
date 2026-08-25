export const externalLinks = {
  discord: 'https://discord.gg/grassrootsracing',
  twitch: 'https://www.twitch.tv/grassrootsracing',
  merchandise:
    import.meta.env.VITE_FOURTHWALL_STOREFRONT_URL ||
    'https://grassroots-racing-shop.fourthwall.com/collections/all',
} as const

// TODO(assets): Migrate these verified GRR homepage files locally when originals are supplied.
export const currentSiteAssets = {
  heroVideo:
    'https://cdn.fourthwall.com/sr-creators/resources/069dbe3f-9383-4cc0-9040-71b6ff026dcf/d8ef813d43a49faf2c88509a45df5ed3_e725f7c4c60d.mp4',
  cup: 'https://imgproxy.fourthwall.dev/oVRK3-pd2crP9k7A-QbjoFRurwDD3rWTY6w68O9H9Dw/w:1920/sm:1/enc/k7gKUgzttZREI45m/HhYmycY8TJvDoHF0/NYCKL5ZtWPCVASnk/rSPSTqFZQZ1XOtPS/YNrQqMPYpu25AcdZ/DzD1q0W2fPhqrVd7/mj_EP5-YziUe7eHY/Ra1eWXgBykQLdBf2/gCgaIpgr7WmX6AyV/6MhDDf0imFwGoxXe/Kd-aKJ3zGLEV8xx9/IRh9PyO6CI6gu2Q3/w5D8Dph4cz4ay8J4/D2qNhO2N40_7LJKm/u3PW3gyenDMKnzrw/FARlt1virm3TMkTb.webp',
  gt: 'https://imgproxy.fourthwall.dev/dVEwwOHQicZDT51tH2tFRArILH1NRl274lEpWe7NXc8/w:1920/sm:1/enc/QAwRJ5wA9uyozVzG/uO6yoyVF-i5kd-iM/msHTDo2l_oo0iiLL/VFEpLNQtn7KPUOrA/KcCRSNxD0WZHfCEc/vojn85w1Ues7kGi2/GJrIaSr5-a36bwPt/-FXte80J3a2qmpz0/9gLM_pHng0JscbOe/OA_uUbsFF8n2lP0U/Sq3yXKx837DUyE0X/FkdUug9QecE9Hzgm/NfWC82odP5BlH4vk/7YckH4u5tFthL01R/z7G3sJRuBmqlWbLl/t12yNS6ROqsQGwpn.webp',
} as const
export type NavGroup = { label: string; href: string; items?: { label: string; href: string }[] }
export const navigation: NavGroup[] = [
  { label: 'Home', href: '/' },
  { label: 'Schedule', href: '/schedule' },
  {
    label: 'GT League',
    href: '/pages/gt-league',
    items: [
      ['GT League', '/pages/gt-league'],
      ['GT Rules', '/pages/gt-rules'],
      ['GT Schedule', '/pages/gt-schedule'],
      ['GT Standings', '/pages/gt-standings'],
      ['GT Race Results', '/pages/gt-race-results'],
      ['GT Stats', '/pages/gt-stats'],
      ['GT Archive', '/pages/gt-archive'],
    ].map(([label, href]) => ({ label, href })),
  },
  {
    label: 'Cup Series',
    href: '/pages/grr-cup-series',
    items: [
      ['Cup Series', '/pages/grr-cup-series'],
      ['Sporting Code', '/pages/cup-series-sporting-code'],
      ['Cup Standings', '/pages/cupstandings'],
      ['Cup Penalty Report', '/cup/penalties'],
      ['Cup Schedule', '/pages/cup-series-schedule'],
      ['Latest Race Results', '/pages/cup-latest-race-results'],
      ['Broadcast', '/pages/broadcast'],
    ].map(([label, href]) => ({ label, href })),
  },
  {
    label: 'IndyCar',
    href: '/pages/indycar',
    items: [
      ['IndyCar', '/pages/indycar'],
      ['Sporting Code', '/pages/indycar-sporting-code'],
      ['Standings', '/pages/indycar-standings'],
      ['Schedule', '/pages/indycar-schedule'],
      ['Race Results', '/pages/indycar-results'],
    ].map(([label, href]) => ({ label, href })),
  },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Driver History', href: '/driver-history' },
  { label: 'Merch', href: externalLinks.merchandise },
  { label: 'Discord', href: externalLinks.discord },
]
