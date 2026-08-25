# Fleet specification — tool grants, autonomy, risks

Phase 1 output for all three agents. Kept as one document because the three share a threat model and differ
mainly in their grants.

## Autonomy and review gates

| agent | autonomy | gate |
|---|---|---|
| oracle-hunter | runs unattended | none needed — output is citations, and a wrong one is caught by the citation-check in its own suite |
| second-implementer | runs unattended | its code is run against the original; a disagreement escalates to a human rather than being reconciled |
| refuter | runs unattended | a **BROKEN** result must be reproduced by the runnable artefact it supplies before anyone acts on it |

Cost of failure sets these. An oracle-hunter that fabricates a citation corrupts the grading targets everything
else is judged against — which is why GT-04 is a hard no-ship gate rather than one task among seven.

## Tool grants, least privilege

| agent | grants | withheld, and why |
|---|---|---|
| oracle-hunter | WebSearch, WebFetch, Read | **no Write, no Bash** — it reports findings; it does not touch the repository. A sourcing agent with write access can quietly edit the thing it is sourcing for. |
| second-implementer | Read, Write (own directory only), Bash (run its own code) | **no read access to the module under test until after its design is committed** — enforced by task construction, not by the harness, and therefore the weakest control here. Stated plainly rather than pretended otherwise. |
| refuter | Read, Write (scratch only), Bash | **no push, no commit** — it produces failing inputs; acting on them is a human decision |

None of the three gets network write access, credentials, or the ability to run the cloud provisioning scripts.

## Risk register

Numbered **F1–F5**, not R1–R5: `R0…R5` are the CAP ladder's *rungs* in `cap/`, and two schemes sharing a prefix in
one directory is a collision waiting to be misread. F is for fleet.

**F1 — fabricated citations (oracle-hunter).** The highest-consequence failure in the fleet: a plausible
non-existent reference becomes a grading target, and everything graded against it inherits the error invisibly.
*Mitigation:* every citation is fetched and checked to contain the claim; `NOT FOUND` is graded as success; GT-04
plants a request with no true answer and a fabrication there is an automatic no-ship.

**F2 — the second implementation is a port (second-implementer).** If the "independent" check reuses the original
argument, the agreement is worthless but looks like corroboration — strictly worse than no check, because it
raises confidence without raising evidence. *Mitigation:* the design is written before the original is read; a
structural import check is run; GT-04 supplies the original deliberately and grades a paraphrase as a failure.

**F3 — the refuter always finds something.** An agent rewarded for findings will produce them. Then a report of
"nothing found" carries no information, which is precisely when you most need it to. *Mitigation:* GT-05 hands it
correct code, and inventing a defect there is a no-ship regardless of the rest.

**F4 — the fleet becomes a panel.** The failure mode this fleet was built to avoid: three agents agreeing, and the
agreement being read as verification. *Mitigation:* no agent emits a verdict; there is no aggregation step; the
`README.md` rule is enforced in each agent's constraints. If a future change adds a consensus mechanism, that is a
redesign, not a feature.

**F5 — correlated blind spots.** All three run on the same model family, so they share priors. This is **not
fully mitigated and cannot be**. It is the reason the fleet is pointed at importing external truth and building
different-method implementations rather than at review. Cross-model grading (per the `build-educated-expert`
pipeline: one model authors the exam, another sits it, a third grades) reduces but does not remove it.

## What would make this fleet untrustworthy

Stated in advance, so it is checkable later:

- any agent emitting a correctness verdict;
- a consensus or voting step appearing anywhere;
- the refuter's finding rate approaching 100 % across runs;
- a citation entering the grading targets without being fetched and checked;
- golden tasks being weakened after a failure instead of the agent being fixed.

The last one is the radii-polynomial rule from `cap/radiipoly.py`, one level up: **you may improve the agent, you
may not move the threshold.**
