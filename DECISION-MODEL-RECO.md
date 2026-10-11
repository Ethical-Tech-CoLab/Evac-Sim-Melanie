# Decision-model recommendation: keep behavioral transitions explicit

Date: 2026-10-11. Public-source proposal; no experiment performed.
Reviewed [README](https://github.com/Ethical-Tech-CoLab/Evac-Sim-Melanie/blob/bf67959de2fda7e2c6ce454165719f4baae08120/README.md).
Assessment is README-led, not a review of the simulation's scientific validity.

## Default decision

Keep the declared unaware/seeking/milling/evacuating/done lifecycle, household
constraints and probabilistic transitions explicit and reproducible. Replacing
them with a decision model would change the model being studied, not merely
make it cheaper.

An optional offline assistant could match public research passages to a
documented behavioral assumption, using supports / partially supports /
not established / insufficient evidence. Preserve source populations and
conditions; demographic stereotypes are not valid transition probabilities.

## Trial

Compare a human evidence checklist and exact metadata checks with a local
classifier, Jev's [citation pattern](https://docs.typesafe.ai/cookbooks/citation_check.md),
Microsoft-Decision-1 and Sage. Split by study/assumption family. Include claims
generalized beyond the studied population, contradictory evidence and missing
support for a parameter.

Measure false support, missing-evidence recall, calibration and review effort.
Synthetic simulation outcomes cannot serve as labels proving real human
behavior. Total accepted-annotation cost includes human adjudication.

## Gate

Read-only annotations, no transition/parameter changes, no individual evacuation
advice or prioritization. Preserve seeded comparisons and the original research
limitations. Exact proprietary models are not locally offered; a local
alternative needs independent validation. No saving or accuracy result claimed.
