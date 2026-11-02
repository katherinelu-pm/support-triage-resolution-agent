# Support Triage & Resolution Agent

Bankrate’s Customer Support team manually reviews hundreds of member intakes each day. Agents gather context, answer routine questions, and forward Product or Compliance issues. This creates slow, inconsistent handling as volume grows.

The Support Triage & Resolution Agent helps support agents classify member intakes, gather permitted context, draft routine responses, and route Product or Compliance issues to the right team. The goal is to support resolution of roughly 80% of intakes with AI assistance while retaining human approval before member communication. This prototype demonstrates the proposed workflow.

Artifacts:
[RFC](docs/RFC.md)
[AI leverage log](docs/AI_LEVERAGE_LOG.md)

## Live demo
[Try the Support Triage & Resolution Agent](https://support-triage-lab-kl-nov26.katherinelu110.chatgpt.site/)

## User workflow

1. **Intake — start a case.** View an existing case or Click **Create case** in the left navigation. You can either choose one of the three sample cases or create your own then select **Create case & run AI**. The submitted text—not the sample’s label—runs through the shared processing function. Repeat for each category to see the same intake path produce different decisions. 

2. **Classification and risk — inspect the decision.** Open **AI Assistance → Classification**. The system automatically assigns a category; compliance signals take priority over routine intent. The category and product area appear at the top of the case. Use **Report incorrect** to flag a mistake or click **Category** to manually route with a reason. Detected compliance risk cannot be downgraded through that control. The demo uses rule-based uncertainty, not calibrated model confidence.

3. **Review Drafted Content & Evidence.** Open **Evidence** for the case’s source documents. In **Next Steps**, click the source references and, where available, **similar cases** to inspect prior handling, similarities and differences. Historical cases provide context; current policy controls the permitted action. This layer uses synthetic guidance and local retrieval, not live knowledge or profile services.

4. **Review the next action.** Open **Next Steps** to see how the assigned category changes the permitted output:

   | Category | What the agent sees | Action |
   | --- | --- | --- |
   | General FAQ | A complete email draft with source references | Edit, **Approve response**, then **Send approved response** |
   | Product feedback | Summary of Product Feedback, product type, intake channel, and named demo team | **Route to product team — [team name]**, then confirm |
   | Compliance-sensitive | Compliance concern, why it was flagged, team to involve, and reported issue | **Approve summary**, then confirm the restricted Compliance / Legal handoff; no member-answer draft |

   All three use the same [processing function](dist/review-engine.mjs). [Category policies](dist/engine.mjs) define detection signals, output permission and destination. The prototype separates these policies from shared processing, although additional categories may still need output/UI mappings.

5. **Safety and accountability — inspect what happened.** Open **Activity** after an approval or handoff to see the recorded decision. Add a **Simulate member update** containing a compliance allegation to a routine case: analysis refreshes and the previous response approval becomes invalid. Part 2 item 3 is also proved by the automated CI gate below; it does not depend on an agent spotting a breach in this screen.

## Tests

**Tested:** 83 automated tests passed locally. They cover classification and routing, intake, evidence eligibility, exact-output approval, stale approvals, simulated delivery/handoffs, and selected failure conditions.

The [CI safety gate](tests/ci-safety.test.mjs) runs **269 checks across 57 fixtures and operating-condition variants**. It automatically fails on prohibited compliance answers/sends, seeded sensitive-data leaks, or unauthorized handoff/audit fields. Eight deliberately injected breaches each exit with code **1** and a **SAFETY BREACH** message without printing the sensitive value. The gate caught and prompted a fix for unrelated financial/family context in a Product summary and its similar-case preview. See the [before-fix result](review/results/safety-before-fix.json) and [passing report](review/results/safety-latest.json).

With Node.js and npm installed, run `npm test` for the full suite or `npm run test:safety` for the safety gate. The [GitHub Actions workflow](.github/workflows/tests.yml) runs on pushes and pull requests; its safety job must be configured as a required check to block merges. Verification so far is local, not a confirmed GitHub CI run.

The separate [30-case development evaluation](review/results/development-latest.md) achieved **22/30 routing matches**, **21/30 fully passing structured checks**, and **zero seeded privacy failures**. Human quality scoring remains pending. These finite synthetic results do not establish production safety or the 80% resolution goal.

**Test next:** Use the RFC’s proposed 500 representative cases and 200 compliance challenge cases to measure routing and missed-risk performance. Have experts assess 150 outputs for grounding, usefulness and privacy. Test live integration permissions, model inputs, logs, traces and outgoing payloads; durable recovery, duplicate prevention, outages and burst load; and a controlled pilot measuring resolution, active handling time, time to close, reopenings, latency and review burden.

## What was not covered

- **Degraded mode:** The demo simulates low confidence, dependency failures, pause and shadow mode, with safe blocking/manual outcomes covered by tests. Live dependency timeouts, durable human queues, retries, backpressure and burst throughput were not built or validated. Engineering would implement these around the existing support systems, keeping failed or uncertain work with a human owner.
- **Human-in-the-loop and explainable decisions:** The demo models approvals, source references, routing reasons, activity and audit metadata. Production reviewer authentication, server-enforced approval, durable audit storage, access control and retention were not implemented. Engineering would persist the decision, evidence/policy versions, exact approved output, approver and execution outcome; Support, Compliance and Security would agree access and retention before launch. Browser session state is not a production audit trail.
