# SentinelAI

### AI-Driven Security Orchestration, Automation, and Response (SOAR)

**SentinelAI** is a class project that explores how artificial intelligence can help security teams review, prioritize, and respond to cybersecurity incidents. Our goal is to combine incident classification, intelligent response recommendations, and analyst feedback in a single, easy-to-use dashboard.

The current version is an **interactive prototype** built with Next.js. It demonstrates the incident-response workflow using simulated security events and rule-based classification. Real LLM integration, contextual-bandit learning, and production security-tool integrations are planned for future phases.

**Course project | Professor: Sivaprasath Swaminathan**

## Project Overview

Security teams often receive large numbers of alerts from sources such as endpoint protection, identity systems, email gateways, and network monitors. Reviewing every alert manually can take time and make it harder to prioritize serious incidents.

SentinelAI aims to support analysts by:

- Organizing incoming security incidents in one dashboard
- Classifying reports into categories such as phishing, malware, policy violations, and benign activity
- Assigning severity levels and suggesting possible response actions
- Showing incident activity, decisions, and performance metrics
- Capturing analyst feedback to support future learning and evaluation

> **Current demo limitation:** The live feed, confidence scores, expected rewards, and performance chart use simulated data. Classification currently uses keyword-based rules; no live LLM or trained contextual-bandit policy is connected. Actions displayed in the dashboard are not executed on real security infrastructure.

## Features

| Feature | Current status |
| --- | --- |
| Interactive security dashboard | Implemented |
| Simulated live incident feed | Implemented |
| Incident categories and severity levels | Implemented (rule-based) |
| Incident report submission | Implemented |
| Suggested actions and action log | Implemented (simulated) |
| Analyst confirmation/override feedback | Implemented (demo only) |
| Performance and analytics views | Implemented (simulated metrics) |
| Real LLM-based classification | Planned |
| Contextual-bandit response optimization | Planned |
| Persistent database and backend APIs | Planned |
| Real security-tool integrations | Future work |

## How It Works

```text
Security alert or user report
             |
             v
     Incident classification
             |
             v
      Severity assessment
             |
             v
    Suggested response action
             |
             v
       Ticket dashboard
             |
             v
    Analyst review and feedback
```

In the current prototype, predefined rules and mock data power this workflow. Our planned research work will investigate how an LLM and a contextual-bandit model can improve classification and response recommendations while keeping analysts in control of important security decisions.

## Technology Stack

- **Frontend:** Next.js, React, TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Deployment:** Vercel
- **Planned AI/ML:** LLM-based incident classification and contextual bandits

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

Open **http://localhost:3000** in your browser.

### Build for production

```bash
npm run build
npm run start
```

The Next.js app can also be deployed through Vercel with the repository root (`./`) selected as the root directory.

## Project Roadmap

- [x] **Phase 1 — Project foundation:** Define the SOAR use case, incident categories, and dashboard requirements.
- [x] **Phase 2 — Prototype development:** Build the dashboard, simulated incident feed, incident-report flow, action log, and analytics views.
- [x] **Phase 3 — Demo deployment:** Deploy the prototype to Vercel.
- [ ] **Phase 4 — AI classification:** Integrate and evaluate an LLM for incident classification, severity assessment, and explanations.
- [ ] **Phase 5 — Intelligent action selection:** Develop and compare a contextual-bandit approach (for example, LinUCB or Thompson Sampling) against rule-based baselines.
- [ ] **Phase 6 — Data and feedback:** Add persistent incident records, analyst feedback storage, and a reproducible evaluation dataset.
- [ ] **Phase 7 — Evaluation:** Measure classification precision, recall, F1-score, response latency, and bandit reward/regret where applicable.
- [ ] **Phase 8 — Final project delivery:** Document results, limitations, architecture, and lessons learned; prepare the class presentation.

**Safety goal:** For any future integration with real tools, require human approval and appropriate access controls before impactful remediation actions.

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
│   ├── app/            # Dashboard and application pages
│   ├── components/     # Reusable UI components
│   └── lib/            # Incident simulation, rules, and data types
├── package.json
├── next.config.ts
└── README.md
```

## Project Status

**Current stage: Deployed classroom demo/prototype.** The dashboard is available for demonstration, but its AI capabilities and incident-response actions are not yet production implementations. The team will use the roadmap above to guide research, development, and validation.

---

*SentinelAI is an educational project. Demo decisions and metrics should not be used for real-world security operations.*
