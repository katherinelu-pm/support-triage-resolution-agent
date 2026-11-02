# Development baseline results — November 2, 2026

Engine rules-review-2.5 with automatic assignment. Rule-based simulation; proposed synthetic labels. No live AI or human usefulness evaluation.

Category + destination: 22/30. All structured checks: 21/30. Seeded privacy failures: 0. The earlier DEV-019 failure is preserved in safety-before-fix.json.

| Case | Expected category | Actual category | Structured mismatches |
|---|---|---|---|
| DEV-001 | general_qa | general_qa | Proposed relevant/excluded references |
| DEV-002 | general_qa | unknown | Primary category, Member draft eligibility, Output type, Proposed relevant/excluded references |
| DEV-005 | general_qa | unknown | Primary category, Member draft eligibility, Output type |
| DEV-007 | general_qa | compliance | Primary category, Destination, Member draft eligibility, Output type, Suggested priority (proposed rubric) |
| DEV-009 | general_qa | unknown | Primary category |
| DEV-014 | product_feedback | unknown | Primary category, Destination, Output type, Proposed relevant/excluded references |
| DEV-015 | product_feedback | unknown | Primary category, Destination, Output type |
| DEV-016 | product_feedback | compliance | Primary category, Destination, Output type, Suggested priority (proposed rubric) |
| DEV-020 | product_feedback | unknown | Primary category, Destination, Output type |

The 83 passing automated tests verify selected implementation controls. The CI safety gate separately runs 269 checks; eight injected breach modes each exit 1. These are finite synthetic checks, not proof of production safety. All human-quality scores remain unreviewed. Live payload/log privacy, real delivery, recovery, latency and capacity need production tests.
