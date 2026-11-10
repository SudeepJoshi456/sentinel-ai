
# 🛡️ SentinelAI

### AI-Driven Security Orchestration, Automation, and Response (SOAR)

🌐 **[Live Demo](https://sentinel-ai-seven-nu.vercel.app/)** 
**SentinelAI** is a class project that explores how artificial intelligence can help security teams review, prioritize, and respond to cybersecurity incidents. Our goal is to combine incident classification, intelligent response recommendations, and analyst feedback in a single, easy-to-use dashboard.

The current version is an **interactive prototype** built with Next.js. A language model (optional) or an offline classifier categorizes incidents, and a contextual bandit chooses the response action and learns from analyst feedback. Alerts, ground truth, and action execution are simulated; production security-tool integrations are planned for future phases.

**Course project | Professor: Sivaprasath Swaminathan**

## Project Overview

Security teams often receive large numbers of alerts from sources such as endpoint protection, identity systems, email gateways, and network monitors. Reviewing every alert manually can take time and make it harder to prioritize serious incidents.

SentinelAI aims to support analysts by:

- Organizing incoming security incidents in one dashboard
- Classifying reports into categories such as phishing, malware, policy violations, and benign activity
- Assigning severity levels and selecting response actions with a learning policy
- Requiring human approval before high-impact actions
- Showing incident activity, decisions, and performance metrics against a fixed-playbook baseline
- Capturing analyst feedback and using it to update the response policy

> **Demo limitation:** The alert stream, ground truth, and action execution are simulated, so metrics demonstrate the evaluation method rather than field results. Actions displayed in the dashboard are not executed on real security infrastructure.

## Features

| Feature | Current status |
| --- | --- |
| Interactive security dashboard | Implemented |
| Simulated live incident feed | Implemented |
| Incident categories and severity levels | Implemented |
| Incident report submission | Implemented |
| Contextual-bandit response selection | Implemented (Beta-UCB, learns from feedback) |
| Fixed-playbook baseline comparison | Implemented |
| Human approval for high-impact actions | Implemented |
| Analyst feedback (correct / wrong action / wrong category) | Implemented, updates the policy |
| Input sanitization and prompt-injection checks | Implemented |
| LLM-based classification | Optional (needs an API key; falls back to offline rules) |
| Performance and analytics views | Implemented (simulated ground truth) |
| Action execution with retry | Simulated |
| Persistent database and backend APIs | Planned |
| Real security-tool integrations | Future work |

## How It Works

```text
Security alert or user report
             |
             v
  Sanitize input + injection check
             |
             v
 Incident classification (LLM or offline rules)
             |
             v
 Contextual bandit picks an allow-listed action
             |
             v
 Guardrails: low confidence → analyst,
             high-impact → human approval
             |
             v
 Simulated execution (with retry) + ticket dashboard
             |
             v
 Analyst feedback → bandit update
```

## What is real and what is simulated

| Component | Status in this build |
| --- | --- |
| Contextual bandit | **Implemented.** Beta-UCB per context (category · source · severity), allow-listed actions per category, updated from analyst feedback, warm-started from reviewed examples. |
| Fixed-playbook baseline | **Implemented.** Same alerts scored against a static rule playbook; shown on the performance chart and Analytics page. |
| Human approval | **Implemented.** High-impact actions (isolate host, reset credentials, revoke session) need approval unless confidence ≥ 95% *and* the policy has ≥ 15 reviewed outcomes for that context. |
| Low-confidence review | **Implemented.** Classifications below 80% confidence are routed to an analyst instead of being auto-actioned. |
| Input safeguards | **Implemented.** Reports are sanitized, scanned for prompt-injection patterns, and kept separate from model instructions; flagged input never triggers automation. LLM output is schema-validated. |
| LLM classification | **Optional.** Used for submitted reports when `OPENAI_API_KEY` is set; otherwise (or on timeout/error) falls back to the offline classifier. |
| Alert stream and ground truth | **Simulated.** Synthetic alerts with hidden ground truth drive the classifier errors, analyst feedback and evaluation metrics. |
| Action execution | **Simulated.** Mock connectors with injected failures and one retry; no live system is changed. |

## Technology Stack

- **Frontend:** Next.js, React, TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Deployment:** Vercel
- **AI/ML:** Optional OpenAI-compatible LLM for classification; Beta-UCB contextual bandit for action selection

## Getting Started

### Prerequisites

- Node.js and npm compatible with the project's Next.js version
- Git

### Run locally

```bash
git clone https://github.com/SudeepJoshi456/sentinel-ai.git
cd sentinel-ai
npm install
npm run dev
```

Open **http://localhost:3000** in your browser. No API keys or network access are required; without configuration the app runs on simulated data and the offline classifier, so a live demo cannot fail on stage.

### Build for production

```bash
npm run build
npm run start
```

The Next.js app can also be deployed through Vercel with the repository root (`./`) selected as the root directory.

### Optional: real LLM classification

Copy `.env.example` to `.env.local` (or add the variables in the Vercel project settings) and set a key:

```bash
OPENAI_API_KEY=sk-...
# Optional
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1   # any OpenAI-compatible endpoint
LLM_PRICE_INPUT_PER_1M=0.15                 # used for the cost estimate
LLM_PRICE_OUTPUT_PER_1M=0.60
```

The key stays on the server (`src/app/api/classify/route.ts`). Each request has a 4 s timeout with one retry on rate limits or server errors; latency, token usage, estimated cost and fallbacks are shown in the ticket details and on the Analytics page.

## Demo Tips

- **Submit a report** (bottom banner) and pick an example, or type your own.
- The malware example usually needs approval: open the ticket from the feed or the **Awaiting approval** button and approve it.
- Click any ticket to see the classification, the options the bandit considered, and to give feedback (correct / wrong action / wrong category).
- Click **LEARNING LIVE** to pause or resume the simulation. Refreshing resets the session.

## Project Roadmap

- [x] **Phase 1 — Project foundation:** Define the SOAR use case, incident categories, and dashboard requirements.
- [x] **Phase 2 — Prototype development:** Build the dashboard, simulated incident feed, incident-report flow, action log, and analytics views.
- [x] **Phase 3 — Demo deployment:** Deploy the prototype to Vercel.
- [ ] **Phase 4 — AI classification:** Integrate and evaluate an LLM for incident classification, severity assessment, and explanations. *(Integration done, optional; evaluation on real data pending.)*
- [ ] **Phase 5 — Intelligent action selection:** Develop and compare a contextual-bandit approach (for example, LinUCB or Thompson Sampling) against rule-based baselines. *(Beta-UCB bandit and playbook baseline implemented on simulated data.)*
- [ ] **Phase 6 — Data and feedback:** Add persistent incident records, analyst feedback storage, and a reproducible evaluation dataset.
- [ ] **Phase 7 — Evaluation:** Measure classification precision, recall, F1-score, response latency, and bandit reward/regret where applicable. *(Metrics implemented on simulated ground truth.)*
- [ ] **Phase 8 — Final project delivery:** Document results, limitations, architecture, and lessons learned; prepare the class presentation.

**Safety goal:** High-impact remediation already requires human approval in the prototype; any future integration with real tools must keep this and add appropriate access controls.

## Team Members

| Team member | Role |
| --- | --- |
| **Sudeep Joshi** | Team Lead and Technical Architecture |
| **Mandeep Khatri** | Researcher and Co-Lead |
| **Carlie Seibert** | Dashboard Design and Presentation |
| **Laketa Ransom** | Evaluation and Accuracy Validation |
| **Aryan Luitel Bolakhe** | Dataset and Competitive Research |

### Faculty Instructor

**Professor Sivaprasath Swaminathan**

## Project Structure

```text
sentinel-ai/
├── src/
│   ├── app/
│   │   ├── api/classify/   # Optional server-side LLM call
│   │   └── ...             # Dashboard and application pages
│   ├── components/         # Reusable UI components
│   └── lib/
│       ├── engine.ts       # Pipeline: classification → bandit → guardrails → approval → execution → metrics
│       ├── bandit.ts       # Action catalog, allow-lists, Beta-UCB policy, playbook baseline
│       ├── classifier.ts   # Offline report classifier and simulated alert classifier
│       ├── security.ts     # Input sanitization and prompt-injection checks
│       ├── triage.ts       # Report triage: LLM first, offline fallback
│       └── mockData.ts     # Synthetic alert templates with ground truth
├── .env.example
├── package.json
├── next.config.ts
└── README.md
```

## Project Status

**Current stage: Deployed classroom demo/prototype.** The learning loop, guardrails, and evaluation metrics run on simulated alerts; incident-response actions are not executed on real systems. The team will use the roadmap above to guide research, development, and validation.

---

*SentinelAI is an educational project. Demo decisions and metrics should not be used for real-world security operations.*
