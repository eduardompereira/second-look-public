# Data and rights

Second Look was built for the **SIC DataHack 2026** (Spengler Cup Data-hack Sport Innovation Challenge, organised by
ThinkSport). The organiser supplied confidential match tracking data (Wisehockey) and match video for use in the challenge.

## What the organiser asked, and how this repository follows it

| Organiser guidance | This repository |
|---|---|
| No real tracking data in a public repository or publicly accessible demo, even small extracts (player positions, puck trajectories, associated player statistics). Use simulated data with the same structure | All data here is a fictional match generated from a seed (`tools/make_fictional_fixtures.py`); it reads no file. `tools/public_gate.py` checks the fixture's lineage on every run |
| No match video clips in a public repository or publicly accessible demo, of any length. Use a placeholder or a 2D replay from simulated data | No clip or still is committed. `fixtures/setup_fixture.py` generates labelled placeholder video and stills locally |
| Real data and video may be used in the live jury demo or kept in a private repository shared only with the organisers | Our full build, pipeline and real-data verification live in a private repository |
| Use is limited to the challenge context; delete the confidential data after the challenge | We will delete the confidential data and every copy after the challenge |

## Names

The competition, the data provider and the real teams are named only here and in the README, NOTICE and AUTHORS pages,
as factual context for the challenge. The app itself uses fictional teams and players. Nothing in this repository implies
endorsement by, or association with, the Spengler Cup, HC Davos or any club.

## Our own work

The code is ours and released under the MIT licence. Fonts are SIL OFL (see NOTICE.md). No third-party media is included.
