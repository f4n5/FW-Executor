// Pricing tiers matching FW store cards
module.exports = {
  day: {
    id: 'day',
    label: 'DAY',
    price: '$3',
    duration: '24h',
    durationMs: 24 * 60 * 60 * 1000,
    button: 'Get Day',
    features: [
      'Full UNC + sUNC',
      'Auto offsets',
      'Manual-map inject',
      'Editor + hub',
      'Single key, HWID lock',
    ],
  },
  week: {
    id: 'week',
    label: 'WEEK',
    price: '$12',
    duration: '7d',
    durationMs: 7 * 24 * 60 * 60 * 1000,
    button: 'Get Week',
    popular: true,
    features: [
      'Everything in Day',
      'Priority offset refresh',
      'Strategy A + B',
      'Theme pack',
      'Discord support channel',
    ],
  },
  month: {
    id: 'month',
    label: 'MONTH',
    price: '$30',
    duration: '30d',
    durationMs: 30 * 24 * 60 * 60 * 1000,
    button: 'Get Month',
    features: [
      'Everything in Week',
      'Best value',
      'Early feature builds',
      'Key reset (1× / month)',
      'Direct support priority',
    ],
  },
};
