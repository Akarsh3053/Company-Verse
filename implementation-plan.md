# CompanyVerse Backend Implementation Plan

## Current State

Available:

* Synthetic company dataset
* Product overview
* Hackathon guide

Not available:

* Live Microsoft tenant access
* Production Foundry credentials

Development must use synthetic data.

Architecture must support Foundry IQ.

---

# Milestone 1

Goal:

Generate a playable world from synthetic company data.

Deliverables:

* FastAPI application
* Provider abstraction
* Local provider implementation
* Foundry provider scaffold
* World generator
* World API endpoint

Output:

generated/world.json

Success criteria:

GET /world returns generated world.

No NPCs.

No quests.

No chat.

---

# Milestone 2

Goal:

Generate NPCs.

Deliverables:

* NPC generator
* NPC schemas
* NPC persistence

Output:

generated/npcs.json

Success criteria:

GET /npcs returns generated NPCs.

No quests.

No runtime conversations.

---

# Milestone 3

Goal:

Generate quests.

Deliverables:

* Quest generator
* Quest schemas
* Quest persistence

Output:

generated/quests.json

Success criteria:

GET /quests returns generated quests.

---

# Milestone 4

Goal:

Runtime AI conversations.

Deliverables:

* Conversation service
* Retrieval layer
* NPC grounding

Success criteria:

POST /chat returns grounded NPC response.

---

# Milestone 5

Goal:

Foundry IQ integration.

Deliverables:

* Foundry provider implementation
* Foundry retrieval
* Provider switching

Success criteria:

Changing PROVIDER=foundry requires no other code changes.
