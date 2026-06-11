"""AI content-generation layer (the generative half of Microsoft IQ).

This package owns the *language* of CompanyVerse: quest prose, challenges, NPC
dialogue, and narration. It is deliberately separated from the deterministic
world/NPC *structure* so that switching between the offline engine and a real
model (Azure OpenAI / Foundry IQ) is a single configuration flip.
"""
