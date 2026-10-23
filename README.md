# ClearPath Compliance Review

**Catches predictable compliance problems while an ad is being written, sends reviewers the riskiest work first, and turns resubmissions into a quick check of what changed.**

**Live demo: https://clearpath-one-ebon.vercel.app**: click **Start the tour** (about 3 minutes, no login; it resets the shared demo data first so every step lines up).

A prototype for the compliance marketing team at ClearPath Financial, a hypothetical consumer lender (personal loans, credit cards, mortgage prequalification) whose ad review runs on Excel and email today.

The reasoning behind the main decisions (personas, research, pain points, interface, roles and flags) is in [DESIGN.md](DESIGN.md).

## The problem

Reviewer time is the bottleneck, and most of it goes to repeat work: catching the same mistakes, chasing versions, and re-reading a whole ad after a one-line fix.

- Most compliance teams report reviews taking **4 to 10 days**, with volume growing ([Saifr survey via FinTech Global](https://fintech.global/2024/06/27/how-compliance-reviews-are-shaping-financial-marketing-strategies/)).
- **85%** of compliance professionals say reviews would be much faster without rechecking basic rules ([IntelligenceBank](https://intelligencebank.com/insights/what-are-the-top-marketing-compliance-challenges/)).

## What it does

One loop, where each step uses what the last one produced:

1. **Pre-check while writing (marketers, partners).** Copy is checked as it's typed against the rule library and ClearPath's rate sheet. Flagged words are highlighted, each with a plain-English "why this matters" and a one-click fix that keeps the ad's wording.
2. **Risk-sorted review (reviewer).** The queue puts the riskiest ads first, with a plain-language "Why high risk?", search, and high/medium/low filters. Each ad shows in the shape of its channel (email, text, social post or partner page), with the same flags, the rate sheet, and, for partners, their track record.
3. **Round 2 in seconds.** Sent-back ads are revised in the same form. The reviewer sees "1 of 1 flag fixed" and a word diff, not the whole ad again.
4. **Team view (manager).** Turnaround, first-round approval rate, rounds per approval, the most common issues and where they come from, plus a full audit log.

**Also:**
- **Compliance owns the rules.** Reviewers and managers can add rules in the app, e.g. flag "payday loan" or require "Equal Housing Lender" on mortgage ads, and test them before saving.
- **Stale ads are caught.** When rates change, approved ads that no longer match are listed, and the manager can send them back for an update.
- **An optional AI second opinion** catches paraphrases the rules miss (see below).

## Key decisions

- **Rules built around what real marketers get wrong.** In-house copy rarely says "guaranteed approval"; that's mostly a partner problem, and partner ads score higher risk. What gets sent back is well-meant copy missing a condition: "as low as 8.99%" without the autopay condition, "no fees" despite an origination fee, "apply with no impact to your credit". Rates are checked against the actual rate sheet.
- **Rules first, AI as a constrained second opinion.** Rules are explainable, instant and free. The optional AI (Claude, when `ANTHROPIC_API_KEY` is set) only adds advisory suggestions, and each must quote text actually in the ad. It can't clear flags or approve anything, and it treats partner copy as untrusted, so an embedded "ignore your rules" note gets flagged, not obeyed.
- **Feedback marketers can act on.** Every flag explains itself and suggests a fix, so marketers learn the rules and fewer problems reach review.
- **Managers oversee; reviewers decide.** The manager sees everything, owns the rules and can reopen stale ads; approving stays with reviewers.
- **A role switcher instead of login,** so every perspective is a click away. Partners still see only their own ads.

## What it could save

A back-of-envelope estimate with assumed inputs, not a measurement.

| Assumption | Today | With this |
|---|---|---|
| Rounds per approved ad | 1.8 | 1.4 |
| Reviewer time per round | 25 min | 20 min first, 8 min after (diff only) |
| **Reviewer time per ad** | **45 min** | **about 23 min** |

At about 125 ads a month, that's roughly **45 reviewer hours a month**. I'd measure it with the three numbers on the manager view (turnaround, first-round approval rate, rounds per approval), against a baseline from the team's Excel log.

## Assumptions

- **Team and volume:** about 3 reviewers and 1 manager, roughly 20 marketers plus a few dozen partners, 100–150 ads a month.
- **Review target:** a first decision within 48 hours.
- **Risk score:** open flags (high 3 points, medium 2) plus 2 for partners, 1 for mortgage, and 2 when launch is within 3 days. A starting policy for compliance to tune.
- **Rate sheet (made up for the demo):**
  - personal loans 8.99%–35.99% APR (lowest rate needs autopay) with a 0%–8% origination fee
  - card 19.99%–29.99% APR
  - mortgage from 6.42% APR
- **Rules are illustrative,** not legal advice; a real library would be maintained by compliance.

## Known limitations and what's next

- **Rules match words and numbers, not meaning.** The AI and team rules help; a human still decides.
- **The AI hasn't been evaluated at scale.** Next: a test set and false-positive tracking.
- **Approval covers what partners submit, not what they publish.** Next: re-scan live partner pages.
- **Rules are national, with one state example (the NMLS ID).** A national lender also needs state-by-state rules. Next: rules scoped to the states an ad runs in.
- **Text only, no real login, one shared demo database.** Next: image text checks, SSO, notifications, more channels.
- **Rollout idea:** seed the rule library from the most common comments in the team's existing Excel log, and start with partners, the highest-risk channel.

## Run locally

```bash
npm install
cp .env.example .env    # DATABASE_URL required; DIRECT_URL and ANTHROPIC_API_KEY optional
npm run db:push         # create tables
npm run db:seed         # load (or reset) the demo data
npm run dev             # http://localhost:3000
npm run test:rules      # 45 test cases for the rule library
```

**Stack:** Next.js, TypeScript, Tailwind, shadcn/ui, Postgres (Supabase) with Drizzle, Vercel. Rules and the pre-check engine live in `src/lib/rules/`.

ClearPath Financial is not a real company. All people, partners, rates and ads are made up, and the rule library is illustrative, not legal advice.
