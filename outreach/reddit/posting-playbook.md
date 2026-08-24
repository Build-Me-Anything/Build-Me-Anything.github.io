# Posting playbook — NSLab on Reddit and elsewhere

Written 2026-08-23, before anything has been posted. Drafts live beside this file, one per target. Nothing has
been posted for you: publishing is your call and your account.

---

## 1. The framing decision (read this first)

There are two ways to introduce this work, and they get completely different receptions.

**Framing A — "my attempt at the Millennium Prize."** This gets you filtered as a crank inside one comment.
Every technical subreddit has a weekly visitor who has solved Navier–Stokes, Riemann or P vs NP, and moderators
of r/math and r/Physics remove those posts on sight regardless of merit. Worse, it is not what the work is: the
archive contains no claim about regularity, and the honest headline of all three studies is *the instrument ran
out before the physics did*.

**Framing B — "I built a verified DNS instrument on a laptop and the maximum vorticity refuses to converge."**
This is a result-shaped post that a CFD person finds genuinely interesting, and the Millennium problem sits in
the second paragraph as *the reason the programme exists*, not as a claim. It invites the exact expertise you
want in the comments: people who have fought resolution battles in reconnection flows.

**Recommendation: framing B everywhere.** Every draft is written that way. The ambition is not hidden — the
blog's charter post is called "Rules for an amateur attack on a Millennium problem" and links from the top of
each post — but the *headline* is the measurement, not the prize. If you want the ambition in the title, the
draft for r/CFD carries an alternative title that does it honestly.

## 2. Order and timing

Post one at a time, and only move on when the previous thread has stopped needing you.

| # | Target | When | Why this one |
|---|---|---|---|
| 1 | **r/CFD** | first — Tue–Thu, 13:00–16:00 UK (US morning) | The natural home. Practitioners, small enough to read every post, exactly the people who will find a real flaw if there is one. |
| 2 | **r/FluidMechanics** | 2–3 days later | Overlaps r/CFD but skews academic/student; lead with the reconnection physics rather than the software. |
| 3 | **Hacker News (Show HN)** | after the CFD threads have stood up | Different crowd: the single-file offline instrument is the story there, not the vorticity. |
| 4 | **r/Physics** | optional, only if 1–2 went well | Strict on self-promotion and on anything that smells of a personal theory. Use their weekly thread if the standalone post is removed. |
| — | **r/math** | do not | Millennium-adjacent posts from non-mathematicians are removed as a matter of policy, and rightly. There is nothing in this work a mathematician needs yet. Revisit at gate G7, with an inequality. |

Do not cross-post the same text to several subreddits on the same day. It reads as marketing and gets caught by
site-wide spam heuristics.

## 3. Pre-flight, every time

### Rules, as read from Reddit on 24 August 2026

| Sub | Rules on the record |
|---|---|
| **r/CFD** | **None.** `about/rules.json` returns an empty list — only Reddit's site-wide three (spam, personal information, harassment). No flair requirement written down, no self-promotion clause. Moderation is therefore discretion plus AutoModerator, and AutoMod's commonest setting is an account-age/karma gate. |
| **r/FluidMechanics** | Five. In order: **1. No promotions, ads or profanity. 2. Do not spam. 3. Off-topic posts will be removed.** 4. Moderation criteria — "all school of thoughts are allowed… moderators will judge by quality of the submission and not by opinion." 5. Homework help is allowed if you show an attempt. |
| r/Physics | Not checked. Verify before posting; it is the optional target anyway. |

**Rule 1 of r/FluidMechanics governs draft 2.** A post whose payoff is a link to your own blog is promotion,
whatever its quality. Draft 2 is therefore written to stand entirely on its own — every number in the post,
no link in the body. If someone asks where the full write-up is, that is what a comment is for.

### Checking a sub yourself

Claude's sandbox cannot reach any Reddit host, including the API, so anything not in the table above is
unverified. `reddit.js` in this folder checks from your machine:

```
node reddit.js check CFD
```

which prints the account's karma and age, the subreddit's rules verbatim, the available flairs with their ids,
and the posting requirements (flair mandatory? title length? banned domains?). Setup is in the header of that
file — a "script" app at reddit.com/prefs/apps, credentials in a gitignored file. Then:

- [ ] Run `node reddit.js check <sub>` and read the rules it prints. Look specifically for: self-promotion /
      blog-link policy, a required flair, a "no personal theory" rule, and any weekly megathread this belongs
      in instead.
- [ ] Check your account's history is not mostly links to your own site. If it is, comment on other people's
      posts for a while first. The 9:1 guideline is unofficial but the moderators do look.
- [ ] Post the **text**, not the link. A self-post with the numbers in it, and the blog linked at the end, is
      treated far better than a bare link and reads better anyway.
- [ ] Put the disclaimer in the post, not in a reply. One line, early: *this is not a claim about regularity.*
- [ ] Disclose the AI involvement in the post (see §5). Do not let someone else discover it.
- [ ] Have the blog reachable at a stable URL before you post, and check it on a phone.
- [ ] **After posting, open the thread in a logged-out browser window.** A post caught by a karma gate or a
      spam filter looks perfectly normal to the account that made it and is invisible to everyone else. If it
      is missing, message the moderators politely — never repost.

**Post the first one through the web UI, not the API.** `reddit.js post` works, but the web composer previews
the rendered markdown, offers the flair picker, and catches a formatting mistake before 3 000 people see it.
Use the API for the pre-flight checks and keep `post --confirm` for when the routine is boring.

## 4. The objections, and the answers

These will come. Every one of them is fair, and you have evidence for all of them — that is the point of having
built it this way. Answer briefly, link to the specific number, concede what is true.

**"Your growing max|ω| is just under-resolution."**
Yes. That is the post's conclusion, in the post's own words. The interesting part is the quantification: the
energetics converge to 0.8 % at the same resolution where the local maximum moves 28 %, and the spectrally
interpolated maximum is within 2.3 % of the grid maximum, so it is not a sampling artefact — the structure
itself is different at the finer grid.

**"kmax·η ≥ 1 is a mean criterion; it says nothing about a reconnection bridge."**
Agreed, and that is exactly what NS-002 found: PASS on the global criterion, unconverged locally. It is why the
health verdict now carries the worst snapshot rather than the last one.

**"The periodic images contaminate your reconnection."**
Correct, and stated in the NS-002 post before anyone asked: the vorticity crosses the boundary in *z* at t ≈ 7
and the event is at t = 8.25, so everything after the crossing is the dynamics of a replicated system. NS-003
logs the image gap every snapshot and will report convergence separately for t ≤ 7 and t > 7.

**"Why write your own solver instead of using Nek5000 / Basilisk / spectralDNS?"**
Because an independent implementation that reproduces exact solutions and agrees with a second independent
implementation to 4·10⁻¹² is worth more to me than a faster one I cannot see inside. Also honestly: because the
tool it lives in is not allowed dependencies. A cross-check against an established code is very welcome — that
is a standing offer in every thread.

**"256³ is small. Serious runs are 2048³ and up."**
Completely true, and the reason no claim is made. This is a 6 GB laptop GPU at its double-precision ceiling.
The contribution is not resolution, it is the discipline: a graded health report and a refinement ladder on
every result, and a public statement of which quantities that resolution can and cannot support.

**"Kerr's 1993 singularity evidence was disputed."**
Yes — Hou & Li (2006) found dynamic depletion of stretching in a re-run of that configuration at higher
resolution, and Kerr's own later work (2018) reframed it around enstrophy and circulation scaling. That history
is precisely why this programme judges growth on the BKM integral across a ladder and calls unconverged growth
what it is.

**"BKM is a theorem about Euler."**
It is; the analogous continuation criterion for Navier–Stokes is standard, and that is how it is used here — as
the quantity to watch, not as a proof technique.

**"Did an AI write this?"**
See below. Answer plainly and immediately.

## 5. On the AI question

The solver, the verification framework, the analysis scripts and most of the prose were built in partnership
with Claude; the experiment design, the physics judgement and every decision about what may be claimed are
yours. That sentence, or one like it, belongs **in the post**. Three reasons:

1. It is true, and someone will work it out.
2. It converts your biggest vulnerability into the post's most interesting sub-plot — an engineer using an AI
   as an instrument-builder while refusing to let it near the conclusions. The blog already contains the beat
   where the local model got the Beale–Kato–Majda criterion wrong and was therefore kept on the switches.
3. It sets up the correct defence of the work, which is not "a human wrote it" but "here is the verification,
   check it": exact solutions to 3·10⁻¹², two independent implementations agreeing to 4·10⁻¹², a published
   benchmark reproduced to 0.7 %, and every run's graded health report in the archive.

What will get you savaged is a confident claim that turns out to be AI-generated and wrong. There are no
confident claims in this work — that was designed in from the start. Keep it that way in the comments too: if
someone asks something you have not measured, the answer is "I have not measured that", not a plausible
paragraph.

## 6. Rules for the thread

- Reply to technical criticism within a few hours, briefly, with a number or a link.
- Concede immediately and visibly when someone is right. It is the fastest way to earn a technical audience.
- Never argue with a moderator; ask what would make the post acceptable.
- Never claim a proof, a breakthrough, or "evidence for a singularity" — not even hedged, not even in a reply
  at midnight.
- If a comment asks for the data, give it. It is a few hundred megabytes and it is nobody's secret.
- If the thread goes quiet, leave it. Do not bump.

## 7. What "success" looks like

Not upvotes. Success is: one person who has run reconnection DNS tells you something you did not know about
resolving the bridge, or offers a cross-check with an established code. That single outcome is worth more to
gate G6 than any amount of traffic — so make it easy: end every post with a specific, answerable question
rather than "thoughts?".
