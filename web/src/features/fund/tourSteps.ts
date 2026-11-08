// The /fund guided tour, top to bottom. Targets are selectors on FundPage
// and its sections; missing ones (no benchmark data yet) are skipped.

import type { TourStep } from '../../components/Tour'

export const FUND_TOUR = 'fund'

export const FUND_STEPS: TourStep[] = [
  {
    target: '.fund-head',
    title: 'Welcome to the fund',
    body: 'This is the total balance as of the latest row, with last month’s gain and everything deposited, withdrawn and earned so far. The next few steps walk through the page — use the arrow keys or the buttons.',
  },
  {
    target: 'section[aria-labelledby="fund-shares"]',
    title: 'Who owns what',
    body: 'Each member has their own capital account. Deposits and withdrawals land on whoever they are split to (50/50 unless a row says otherwise), and every gain or loss is shared in proportion to each balance that month.',
  },
  {
    target: 'section[aria-labelledby="fund-sheet"] .fund-chart-head',
    title: 'Add a row',
    body: 'Each month, add the unrealized gain or loss — in dollars, or as a percent and the dollars are worked out for you. Deposits and withdrawals go here too, with an optional custom split.',
  },
  {
    target: '.fund-ledger',
    title: 'The shared spreadsheet',
    body: 'Every row, newest first, with the running balance and each member’s balance after it. Both members can edit or delete rows, and the other person sees the change live.',
  },
  {
    target: '.fund-details',
    title: 'Change log',
    body: 'Every add, edit and delete is recorded with who did it and when — deleted rows included — so nothing changes silently.',
  },
  {
    target: 'section[aria-labelledby="fund-stats"] .fund-stats',
    title: 'How it has performed',
    body: 'Returns counted the fair way (deposits aren’t gains), your actual yearly return on your deposit timing, how much months swing, the worst drop, and more. Each card says what it means in one line.',
  },
  {
    target: '.fund-forecast .fund-controls',
    title: 'Steer the forecast',
    body: 'The forecast starts from history. Drag the expected return, add doubt (bigger swings), let a hot streak fade, plan a monthly withdrawal, or weight recent months more. The presets above jump to History, Cautious or Stress.',
  },
  {
    target: '[data-tour="fan"]',
    title: 'The weather forecast',
    body: '2,000 simulated futures. Shaded bands hold the middle 50%, 80% and 90%; thin rainbow lines are single futures from worst (blue) to best (red). Thick white is the most likely path. Hover to read any month.',
  },
  {
    target: '[data-tour="benchmark"]',
    title: 'Against the market',
    body: 'The same deposits and withdrawals, as if they had gone into the S&P 500 instead — plus how closely the fund moves with the market (beta, correlation) and the return it adds on top (alpha).',
  },
  {
    target: '.fund-scrub',
    title: 'Pick a month',
    body: 'Slide to any month ahead to see the bad, likely and good case — and each member’s share of it.',
  },
  {
    target: '[data-tour="greeks"]',
    title: 'Greeks',
    body: 'Borrowed from options trading: how much the forecast moves if the return is a point higher (Delta), how that compounds (Gamma), what extra swing does to the bad case (Vega), what the next month should earn (Theta), and what each extra $100 a month withdrawn costs (Rho).',
  },
  {
    target: 'section[aria-labelledby="fund-3d"]',
    title: 'In 3D',
    body: 'Likelihood shows how probable every balance is each month — the red crest is the most likely path. Outcomes shows where you end up at different monthly returns. Drag to rotate, scroll to zoom.',
  },
  {
    target: '.fund-quick',
    title: 'What can we take out?',
    body: 'The most you could withdraw every month and still have money left in 95% of futures, and the amount that keeps the balance flat (living off the gains). “Try it” turns either into a scenario.',
  },
  {
    target: '[data-tour="scenarios"]',
    title: 'Build what-ifs',
    body: 'Make scenarios from one-time or repeating deposits and withdrawals — any interval, any amount, any split. They run on the same forecast settings, so only the cash flows differ.',
  },
  {
    target: '[data-tour="compare"]',
    title: 'Compare them',
    body: '“Ahead by” is end balance plus cash taken out minus new deposits, so plans that take money out compare fairly with leaving it in. “Can’t pay” is the chance a withdrawal is bigger than what’s there.',
  },
  {
    target: 'section[aria-labelledby="fund-calc"]',
    title: 'Calculus',
    body: 'The speed of growth (1st derivative), whether it’s speeding up or slowing (2nd), and higher orders that hint at turns early. The integral is the area under the curve — dollar-months of money at work.',
  },
  {
    target: '.nav__avatar',
    title: 'That’s the tour',
    body: 'Replay it any time from your profile menu while you’re on this page.',
  },
]
