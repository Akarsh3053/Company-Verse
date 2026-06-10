COMPANYVERSE BACKEND SPEC

┌────────────────────────────┐
│ Synthetic Company Data     │
│ OR Foundry IQ              │
└────────────┬───────────────┘
│
▼
┌────────────────────────────┐
│ Knowledge Provider Layer   │
│                            │
│ Local Provider             │
│ Foundry Provider           │
└────────────┬───────────────┘
│
▼
┌────────────────────────────┐
│ Knowledge Service          │
│ Unified Enterprise Access  │
└────────────┬───────────────┘
│
┌───────────┼───────────┐
▼           ▼           ▼

┌────────┐ ┌────────┐ ┌────────┐
│ World  │ │ Quest  │ │ NPC    │
│ Agent  │ │ Agent  │ │ Agent  │
└────┬───┘ └────┬───┘ └────┬───┘
│          │          │
▼          ▼          ▼

world.json quests.json npcs.json

```
 │          │          │
 └──────┬───┴──────┬───┘
        │          │
        ▼          ▼

  ┌──────────────────┐
  │ Conversation     │
  │ Service          │
  └────────┬─────────┘
           │
           ▼

   Grounded NPC Chat

           │
           ▼

      FastAPI APIs

           │
           ▼

     Frontend (Phaser)
```

---

Backend Generation Flow

Provider
↓
Knowledge Service
↓
World Generator
↓
world.json

Provider
↓
Knowledge Service
↓
NPC Generator
↓
npcs.json

Provider
↓
Knowledge Service
↓
Quest Generator
↓
quests.json

---

Runtime Chat Flow

Player Message
↓
NPC Service
↓
Knowledge Retrieval
↓
Quest Context
↓
LLM
↓
Grounded Response
↓
Frontend
