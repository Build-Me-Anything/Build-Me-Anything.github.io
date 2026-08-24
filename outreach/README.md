# Outreach — the public face of the NSLab programme

Everything intended to be read by someone outside the project. Nothing here has been published: the blog is
built and ready to deploy, the posts are drafted and ready to paste, and both are your call.

```
outreach/
├── blog/                   the logbook: a zero-dependency static site generator + the posts
│   ├── README.md           how to write a post, how to build, how to deploy  ← start here
│   ├── site/               build output: deploy this folder
│   │   └── nslab-logbook.html   the whole logbook as one offline file
│   └── posts/              six posts, in narrative order
└── reddit/
    ├── posting-playbook.md the framing decision, order, verified sub rules, the objection armoury  ← read first
    ├── karma-plan.md       why the account cannot post yet, and what to do for four weeks
    ├── profile.md          u/Build-Me-Anything: bio, settings, avatar and banner, exact text to paste
    ├── reddit.js           zero-dependency client: rules, flairs, requirements, preview, post
    ├── profile-art.js/.html + profile-avatar-256.png, profile-banner-1920.png
    ├── 01-r-CFD.md         primary target, post first
    ├── 02-r-FluidMechanics.md   self-contained: rule 1 there forbids promotion, so no link in the body
    ├── 03-show-hn.md       post this one first, in practice — HN does not gate on account age
    └── 04-r-Physics-optional.md
```

## The account

**u/Build-Me-Anything**, created 23 August 2026. As of 24 August it is 31 hours old with 1 link karma and 0
comment karma, which is why nothing is posted to Reddit until about **22 September** — a new account posting a
self-link is the exact shape spam filters remove, regardless of the quality of the work. `karma-plan.md` has
the reasoning and the four-week plan; `profile.md` has the setup. Hacker News does not gate the same way, so
Show HN goes first, as soon as the site is live.

## The posts

| Order | Post | What it does |
|---|---|---|
| 1 | It started with a CV and "build me anything" | The origin story: empty folder → aerofoil tool → Navier–Stokes laboratory, and the honest sequence — the instrument got trustworthy first, and the Millennium problem was what sat at the top of the ladder it had built |
| 2 | Rules for an amateur attack on a Millennium problem | The charter: what simulation can and cannot do here, the gate table G0–G9, the three rules, and what would change my mind |
| 3 | How the instrument is built | The single-file tool, the pseudo-spectral solver, the hand-written FFT, three implementations, the health report, the build gate |
| 4 | NS-001: what a laptop can measure, and what it cannot | Taylor–Green Re 1600; the dissipation peak converges to 0.7 % of the 512³ reference, max\|ω\| does not; the trust hierarchy |
| 5 | NS-002: the number that grows with the grid | Vortex-tube reconnection at Re_Γ ≈ 16 000; energetics converged, peak vorticity N^0.85; the periodic-image caveat; the worst-snapshot lesson |
| 6 | NS-003: turning the Reynolds number down | The live experiment, with the prediction registered before the top rung lands |

Plus an About page carrying the disclaimer, the verification summary and the reuse terms.

## Before you publish

1. **Pick the URL and rebuild.** `NSLAB_BLOG_URL=https://your-domain node build.js`, so the RSS feed and the
   canonical links are right. Deployment options are in `blog/README.md`.
2. **Decide what to put your name to.** The posts say "Michael, an aeronautical engineer" and nothing more —
   no surname, no employer, no contact address, because publishing those is a decision only you should make.
   Add a byline and a contact line to `blog/pages/about.md` if you want them.
3. **Read the playbook's framing section.** The short version: lead with the measurement, not the prize.
4. **Replace `[BLOG URL]`** in each Reddit draft.

## The rule that governs all of it

Never claim a proof, in a post, a title, a plot label or a reply at midnight. The words are *numerical
evidence* and, at most, *conjecture*. Everything in `outreach/` was written to that standard, and the fastest
way to lose a technical audience is to break it once.
