"""Persona + player-character schemas.

:class:`UserPersona` is the **input** the frontend POSTs when a new joiner starts
their onboarding game (name, email, the role they joined as, and some basic
info). Everything else in a :class:`~app.models.bundle.GameBundle` is generated
*from* this persona, grounded in the active knowledge provider.

:class:`PlayerCharacter` is the in-world avatar (the "PC") the bundle hands back
to the frontend — spawn point, starting stats, and an AI-authored backstory.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.world import Position

#: Coarse experience tier. Inferred from the role when the caller omits it.
ExperienceLevel = Literal["intern", "junior", "mid", "senior", "lead", "executive"]


class UserPersona(BaseModel):
    """A new joiner. The single input to game-bundle generation."""

    name: str = Field(min_length=1, description="Full name of the new joiner.")
    email: str = Field(description="Work email; also used to derive a stable key.")
    role: str = Field(
        min_length=1,
        description="The job title they joined as, e.g. 'Junior Software Engineer'.",
    )
    department: str | None = Field(
        default=None, description="Optional department hint (else inferred from role)."
    )
    team: str | None = Field(
        default=None, description="Optional team hint (else inferred from role)."
    )
    experience_level: ExperienceLevel | None = Field(
        default=None, description="Optional; inferred from the role when omitted."
    )
    bio: str | None = Field(
        default=None, description="Free-text 'about me' / basic info."
    )
    start_date: str | None = None
    goals: list[str] = Field(
        default_factory=list, description="Optional explicit learning goals."
    )

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        value = value.strip()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("email must be a valid address")
        return value

    @property
    def user_key(self) -> str:
        """A filesystem-safe key derived from the email local-part + domain."""
        from app.utils.text import slugify

        return slugify(self.email.replace("@", "-at-"))


class PlayerCharacter(BaseModel):
    """The player's in-world avatar (the PC), handed to the frontend."""

    id: str
    display_name: str
    role: str
    title: str
    sprite_type: str
    home_region_id: str
    spawn: Position
    level: int = 1
    xp: int = 0
    #: Knowledge stats (0-100) the game can grow as quests complete.
    stats: dict[str, int] = Field(default_factory=dict)
    backstory: str = ""
    avatar_color: str | None = None
