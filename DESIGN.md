# Design notes

The reasoning behind the main product decisions. The [README](README.md) has the short overview.

## Who it's for

I started from the problem description: a compliance marketing team working in Excel and email, at a lender that markets through many channels, including affiliate partners. Channel research shaped the personas: banks and credit unions use email most (85%), while affiliate marketing is less common (32%) but the channel most often called underleveraged ([Fintel Connect](https://www.fintelconnect.com/blog/what-are-the-most-effective-marketing-channels-for-financial-services-in-2026/)). So the marketer writes across several channels, and partners get a persona of their own, since their volume is likely to grow and the lender answers for what they publish ([CFPB action against Zero Parallel](https://www.consumerfinance.gov/about-us/newsroom/cfpb-takes-action-against-zero-parallel-steering-consumers-toward-bad-deals)).

| Persona | Who they are | What they want | What gets in the way today |
|---|---|---|---|
| **Maya, growth marketer** | Writes email, SMS and social ads for loans, cards and mortgage prequalification | Launch on time without surprises | Waits days with no status; feedback is scattered across email; gets rejected for the same things because nobody explains the rules |
| **Jordan, affiliate partner** | Runs a comparison site that promotes ClearPath offers and is paid per application | Get placements approved fast | Least trained and least supervised, yet ClearPath is accountable for what partners publish |
| **Dev, compliance reviewer** | Reads every ad line by line against lending ad rules | Make a correct, defensible call quickly | Rechecks the same basics on every ad, hunts for the latest version, and rereads a whole ad after a one-line fix |
| **Priya, compliance manager** | Owns the team, the queue and exam readiness | Throughput, consistent decisions and proof for examiners | No view of what's waiting or stuck, and an Excel log that isn't a reliable audit trail |

**Dev matters most.** Reviewer time is what limits how many ads get through, so most decisions were judged by one question: does this save Dev minutes? Helping Maya and Jordan get it right before they submit is the biggest way to do that.

## Pain points

I didn't interview a compliance team for this prototype, so these come from published research and enforcement actions. Three findings shaped the product most: reviews are slow, much of the time goes to repeat work, and feedback feels subjective. The surveys are vendor-run, so I treat the numbers as directional rather than precise. Each pain point maps to something the product does.

| Pain point | Evidence | What the product does |
|---|---|---|
| Reviewers recheck the same basic rules on every ad | 85% of compliance professionals say reviews would be much faster without rechecking basics ([IntelligenceBank](https://intelligencebank.com/insights/what-are-the-top-marketing-compliance-challenges/)) | The pre-check catches them while the ad is written, before it reaches review |
| Marketers don't know why the rules exist, so the same mistakes come back | 82% of compliance professionals say marketers don't understand why the rules matter, leading to more revisions ([IntelligenceBank](https://intelligencebank.com/insights/what-are-the-top-marketing-compliance-challenges/)) | Every flag explains why it matters and suggests a fix, so marketers learn as they write |
| Reviews take days, across multiple rounds | Of 59 compliance leaders, 56% say a review takes 4 to 5 days and 39% say 6 to 10 ([Saifr survey via FinTech Global](https://fintech.global/2024/06/27/how-compliance-reviews-are-shaping-financial-marketing-strategies/)) | Round 2 shows only what changed and which flags were fixed, instead of a full reread |
| Growing volume with no way to prioritize | 61% of compliance teams report growing review volume as channels multiply (same source) | A queue sorted by risk, with the reasons shown |
| Feedback feels subjective, like "no" without a path forward | 81% of marketers and 89% of compliance professionals want reviews to be less subjective ([IntelligenceBank](https://intelligencebank.com/insights/what-are-the-top-marketing-compliance-challenges/)) | Comments point at the exact words, with the rule behind them and a suggested fix |
| Nobody has the same picture of what's been reviewed | Compliance teams estimate 66% of content gets reviewed; marketing teams estimate 59% ([Saifr survey via FinTech Global](https://fintech.global/2024/06/27/how-compliance-reviews-are-shaping-financial-marketing-strategies/)) | Marketers see who has their ad and when to expect a decision; the manager sees turnaround and what's waiting |
| Partner content is hard to oversee, but the lender is accountable | The CFPB ordered a lead aggregator to review lead generators' ads before accepting applications ([CFPB](https://www.consumerfinance.gov/about-us/newsroom/cfpb-takes-action-against-zero-parallel-steering-consumers-toward-bad-deals)) | Partners submit through the same pre-check, score higher risk, and come with a track record |
| Approved ads go stale when rates change | Lenders may advertise only terms they actually offer ([Reg Z checklist, NCUA](https://ncua.gov/regulation-supervision/manuals-guides/federal-consumer-financial-protection-guide/truth-lending-act-checklist)) | Approved ads are rechecked against today's rate sheet, and the manager can send stale ones back |
| Excel and email make a weak audit trail | Mortgage advertisers must keep records of ads for 24 months after last use ([MAP Rule summary, Smarsh](https://www.smarsh.com/regulations/mortgage-acts-and-practices-advertising-final-rule-map-rule/)) | Every submission, flag, reason, comment and decision is logged |

The first three are where reviewer time is won or lost, so they got the most depth.

## A calm interface

Reviewers read dense copy for hours, and marketers dip in between other work. Neither needs another busy screen, so the goal was full capability without information overload.

- **Detail on request.** Screens show the short version first. A flag shows its title and the exact words; "why this matters", the rule and its source open on click. The queue shows a short flag count, and the full risk breakdown lives in a small "Why high risk?" window. Nothing is on screen just because it exists.
- **Clean and calm by design.** Lots of whitespace and one accent color for the main action. Red, amber and green are reserved for meaning (severity and status) and always come with a text label, so color is never the only signal.
- **One obvious next step.** Each screen has a single primary action, such as Submit for review, Revise and resubmit, or Approve; everything else is quieter. The review screen reads top to bottom (the ad, the judgment calls, then the decision) with the flags alongside, so the reviewer never scrolls past every flag to decide.
- **See it the way customers will.** Marketers can flip the copy between Edit and Preview, which shows the ad shaped like its channel (an email, a text bubble, a social post, a partner page) with the same highlights. Their ad page shows that view too, so submitters see exactly what the reviewer sees.
- **Find things fast.** The queue, My ads, the rule library and the audit log each have a search box, and the queue can be filtered to high, medium or low risk. Filters live in the URL, so a filtered view can be shared, and a filtered list says "Showing 2 of 6" with a way to clear it.
- **Say each thing once.** When the queue started to feel dense, repeated labels came out: the partner tag, launch date and risk reasons had been saying the same thing three ways.
- **A tour that shows each point of view.** Because the product serves four roles, the guided tour walks one ad through all of them: Maya writes it, Dev reviews it, a partner revises theirs, Dev approves round 2, and Priya sees the team. Anyone can understand the whole loop in a few minutes, from each person's side. Starting the tour resets the shared demo data, so the steps always match what's on screen no matter what earlier visitors changed.

## Roles and what each can do

| Role | Sees | Can do | Can't do, and why |
|---|---|---|---|
| **Marketer (Maya)** | Her own ads and the rules | Write, check, submit and revise ads | See other people's work or the review queue; she only needs her own ads |
| **Partner (Jordan)** | Only their company's ads and the rules | Submit and revise placements | See ClearPath's internal ads, other partners' work or any review data; they're an outside company |
| **Reviewer (Dev)** | The queue, every ad, and their own recent work (ads they sent back and their decisions from the last two weeks) | Approve, request changes, reject, and add rules | |
| **Manager (Priya)** | Everything (read-only), plus team metrics and the audit log | Add and turn off rules, and send stale ads back for an update | Approve or reject |

**Two compliance roles, on purpose.** Compliance teams aren't one job. Reviewers work ad by ad; managers own the team, the queue and exam readiness, and often don't read every ad in depth given their scope. Splitting the roles shows that range: the reviewer gets a focused, line-by-line workspace, and the manager gets the big picture (what's waiting, where issues come from, what went stale) with the ability to step in where it matters. Keeping approval with reviewers also separates oversight from decisions, which is what an examiner would expect to see.

**Why partners get their own access.** Today a partner emails copy to someone at ClearPath, who forwards it to compliance. Giving partners a limited login means they see the pre-check and fix issues before submitting, there's one clear path to approval instead of email threads, and ClearPath gets a record of every partner submission, warning, reason and decision. That record is ClearPath's proof that it oversees its partners.

**Why no login.** A role switcher lets anyone see all four perspectives in seconds, which matters for a prototype. The boundaries in the table are still enforced on every page and action, so it behaves like a real permission model. Real sign-in (SSO for staff, invitations for partners) is the next step.

## How flags work, and why

A flag only helps if the person reading it can act on it, so every flag is designed to answer three questions: what's wrong, why it matters, and how to fix it.

- **Highlighted in place.** The flagged words are marked inside the ad itself, in the form and on the review screen, so nobody hunts for them. It works both ways: clicking a flag selects its words, and clicking highlighted words lights up their flag.
- **Why it matters, in plain language.** Each flag explains the harm to the consumer ("people need the APR to compare offers"), with the rule and source one click away for reviewers. This is the direct answer to marketers not knowing why the rules exist.
- **A fix that keeps the ad's voice.** Suggested changes swap only the problem words or add the missing condition, so applying one doesn't flatten the marketing copy. Undo is always there.
- **A reason when sending with open issues.** Submitters can still send an ad with flags, but they say why, and the reviewer sees that reason next to the flags. It keeps the human in charge without letting warnings be ignored silently.
- **Comments attach to a flag.** Reviewer feedback points at the exact words, which makes it specific instead of subjective.
- **The risk window.** The queue order depends on a risk score. Rather than show raw points on every row, a small "Why high risk?" window explains each factor in plain language (for example, "Partners are less supervised than ClearPath's own marketers, and ClearPath is accountable for what they publish"), so reviewers can trust the order.

## Rules first, AI second

Rules are explainable, consistent, instant and free, and they handle the most common problems well: conditions missing from rate claims, missing disclosures, and rates that don't match the rate sheet. They're built around what careful in-house marketers actually get wrong, not just obvious claims like "guaranteed approval", which mostly come from partners.

Rules miss paraphrases and overall impressions, so there's an optional AI second opinion, deliberately limited: it only adds advisory suggestions, can't clear a flag or approve anything, and treats partner copy as untrusted (suggestions must quote text actually in the ad, and an embedded "ignore your rules" note is flagged instead of obeyed). Without an API key it's simply off. Compliance also owns the rules directly, adding team rules in the app and testing them before saving.

## What I left out

- **Real authentication,** replaced by the role switcher for now.
- **State-by-state rules.** ClearPath lends nationally, but the library covers federal rules plus one state-style example (the NMLS ID on mortgage ads).
- **More channels,** such as influencer scripts and direct mail; email, SMS, social and partner placements got depth first.
- **Monitoring live partner pages** after approval, to catch copy that changes.
- **Checking text inside images and video.**
- **Notifications** by email or Slack.
- **A library of past approved ads** for reviewers to compare against.

Each is a reasonable next step; none was needed to show the core loop of catching issues early, reviewing faster and proving oversight.
