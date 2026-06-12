"use client";

import { useMemo, useState } from "react";
import type { ExperienceLevel, UserPersona } from "@/types/bundle";

const QUICK_ROLES = [
  "Junior Software Engineer",
  "Software Engineer",
  "Senior Software Engineer",
  "Product Manager",
  "DevOps Engineer",
  "Data Analyst",
  "UX Designer",
  "Engineering Manager",
];

const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "executive",
];

interface ProfileFormProps {
  onSubmit: (persona: UserPersona) => void;
  disabled?: boolean;
}

function emailValid(email: string): boolean {
  const trimmed = email.trim();
  return (
    trimmed.includes("@") &&
    !trimmed.startsWith("@") &&
    !trimmed.endsWith("@")
  );
}

export default function ProfileForm({ onSubmit, disabled }: ProfileFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [team, setTeam] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel | "">("");
  const [bio, setBio] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [goalDraft, setGoalDraft] = useState("");

  const valid = useMemo(
    () => name.trim().length > 0 && emailValid(email) && role.trim().length > 0,
    [name, email, role],
  );

  const addGoal = () => {
    const g = goalDraft.trim();
    if (g && !goals.includes(g)) setGoals((prev) => [...prev, g]);
    setGoalDraft("");
  };

  const submit = () => {
    if (!valid || disabled) return;
    const persona: UserPersona = {
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      department: department.trim() || null,
      team: team.trim() || null,
      experience_level: experience || null,
      bio: bio.trim() || null,
      goals,
    };
    onSubmit(persona);
  };

  return (
    <form
      className="cv-panel cv-scroll max-h-[85vh] w-full max-w-lg overflow-y-auto p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="cv-heading mb-5 text-base text-accent">New Joiner Profile</h2>

      <div className="mb-4">
        <label className="cv-label mb-1 block">Name *</label>
        <input
          className="cv-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Johnson"
          maxLength={80}
        />
      </div>

      <div className="mb-4">
        <label className="cv-label mb-1 block">Work email *</label>
        <input
          className="cv-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alex.johnson@nexova.io"
        />
        {email.length > 0 && !emailValid(email) && (
          <p className="cv-body mt-1 text-base text-danger">
            Enter a valid email containing “@”.
          </p>
        )}
      </div>

      <div className="mb-2">
        <label className="cv-label mb-1 block">Role *</label>
        <input
          className="cv-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Junior Software Engineer"
          maxLength={80}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`cv-body border-2 px-2 py-0.5 text-base ${
              role === r
                ? "border-accent text-accent"
                : "border-frame text-slate-300 hover:border-accent"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="cv-label mb-1 block">Department</label>
          <input
            className="cv-input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Engineering"
          />
        </div>
        <div>
          <label className="cv-label mb-1 block">Team</label>
          <input
            className="cv-input"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="Platform Engineering"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="cv-label mb-1 block">Experience level</label>
        <select
          className="cv-input"
          value={experience}
          onChange={(e) => setExperience(e.target.value as ExperienceLevel | "")}
        >
          <option value="">Infer from role</option>
          {EXPERIENCE_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="cv-label mb-1 block">About you</label>
        <textarea
          className="cv-input"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Fresh CS grad excited to learn how a real platform team ships software."
          maxLength={500}
        />
      </div>

      <div className="mb-6">
        <label className="cv-label mb-1 block">Learning goals</label>
        <div className="flex gap-2">
          <input
            className="cv-input"
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGoal();
              }
            }}
            placeholder="Understand deployments"
          />
          <button type="button" className="cv-btn px-3" onClick={addGoal}>
            +
          </button>
        </div>
        {goals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {goals.map((g) => (
              <span
                key={g}
                className="cv-body flex items-center gap-2 border-2 border-frame px-2 py-0.5 text-base text-slate-200"
              >
                {g}
                <button
                  type="button"
                  onClick={() => setGoals((prev) => prev.filter((x) => x !== g))}
                  className="text-danger"
                  aria-label={`Remove ${g}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="cv-btn cv-btn-primary w-full"
        disabled={!valid || disabled}
      >
        {disabled ? "Generating…" : "Begin Onboarding ▶"}
      </button>
    </form>
  );
}
