# u/Build-Me-Anything — profile setup

Everything to put on the account before the first post, with the exact text to paste. Fifteen minutes of work,
and it is what someone checks in the four seconds between reading your post and deciding whether you are worth
replying to.

**Account state, read from the API on 24 August 2026:** created Sun 23 Aug 09:06, **31 hours old**, link karma 1,
comment karma 0, email verified, not suspended. That is the profile of an account whose first self-post gets
filtered — see `karma-plan.md`.

---

## 1. Fix the setting that is currently hiding your work

Your profile says *"Hiding all content — any posts you make to communities will be hidden from your profile."*

Turn that off. It is the single most damaging setting for what you are about to do: the first thing a sceptical
commenter does is click your name to see whether you are a real participant or a drive-by advertiser, and right
now they would find an empty page.

`reddit.com/settings/profile` → **Show my posts on my profile** (or the "Update Settings" button that appears on
your own profile page) → on.

While you are there:

| Setting | Value | Why |
|---|---|---|
| Show my posts on my profile | **on** | as above |
| Allow people to follow you | on | costs nothing; a few people will |
| Mark as NSFW | off | it is not |
| Content visibility (in search) | on | you want the posts findable |
| Email verified | already done | several subreddits require it |

## 2. Display name

```
Build Me Anything
```

(30-character limit; this is 17.)

## 3. About / bio

Reddit's bio field is 200 characters. This is 178:

```
An offline wind tunnel that grew a Navier-Stokes laboratory. Refinement ladders, health reports, and a maximum vorticity that refuses to converge. Numerical evidence only, never a proof.
```

The last four words are doing real work. Anyone arriving from a Millennium-problem-adjacent post is primed to
suspect a crank, and the bio answers that before they ask.

## 4. Avatar and banner

Both rendered from the project's own logo — the NACA 2412 section inside the tunnel ring, with streamlines
computed by the tool's panel method — in the studio palette (gunmetal, cyan emissive):

| File | Size | Where it goes |
|---|---|---|
| `profile-avatar-256.png` | 256 x 256, 33 kB | Profile → Edit → Avatar |
| `profile-banner-1920.png` | 1920 x 384, 274 kB | Profile → Edit → Banner |

Regenerate either after a design change with:

```bash
node profile-art.js
```

(needs `puppeteer-core`; see the header of that file — it drives the Chrome already on this machine.)

## 5. Social link

Once the site is live, add one link on the profile — Profile → Edit → Social links:

- **Label:** `NSLab logbook`
- **URL:** `https://build-me-anything.github.io`

One link, not three. A profile with a single relevant link reads as a person with a project; a profile with a
stack of them reads as a funnel.

## 6. What not to put on it

- No real name, no employer, no location, no contact email. The blog says "Michael, an aeronautical engineer"
  and nothing more, and the profile should not say more than the blog.
- No mention of the Clay Prize in the bio. The bio is read by people deciding whether to take you seriously,
  and prize-adjacent language in a bio does the opposite of what you want. The logbook makes the ambition clear
  to anyone who reads it, which is the right order.
- Do not fill in the "Reddit Pro" business prompts. This is not a business account, and the label follows you
  into subreddits that dislike marketing.

## 7. Order of operations

1. Fix the visibility setting, set display name, bio, avatar, banner (today).
2. Start commenting — `karma-plan.md` (today, and then most days).
3. Add the social link when the site is live.
4. First self-post no earlier than **22 September**, and only if the karma target is met.
