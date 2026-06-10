# CompanyVerse

## Overview

CompanyVerse is an AI-powered organizational learning platform that transforms enterprise knowledge into a playable adventure world.

Instead of forcing employees to read documentation, browse wikis, and search through scattered knowledge bases, CompanyVerse converts organizational knowledge into interactive quests, NPCs, regions, landmarks, and challenges.

The platform is designed to help employees understand how a company works through exploration and guided learning experiences.

---

# Problem Statement

Enterprise knowledge is fragmented across:

* Documentation
* SOPs
* Runbooks
* Architecture guides
* Wikis
* SharePoint
* Teams
* Subject matter experts

New employees often spend weeks understanding:

* Organizational structure
* Deployment processes
* Incident response
* System ownership
* Internal workflows

Traditional onboarding relies heavily on static documents and tribal knowledge.

CompanyVerse transforms that knowledge into an interactive experience.

---

# Vision

Convert enterprise knowledge into a living world.

Documentation becomes quests.

Experts become NPCs.

Teams become regions.

Systems become landmarks.

Processes become adventures.

---

# Core User Persona

## Alex Johnson

Role: Junior Software Engineer

Experience: 0-1 years

Team: Platform Engineering

Objective:

Understand how the company works without reading dozens of disconnected documents.

---

# Product Experience

Alex joins the company.

CompanyVerse generates an organizational world from enterprise knowledge.

Example:

Backend Citadel
DevOps Mountains
Security Keep
Observability Valley

Alex explores the world, talks to NPCs, completes quests, and learns real organizational processes.

---

# Example Quest

Quest Name:

The Ritual of Release

Generated From:

Deployment SOP

Objectives:

* Learn deployment workflow
* Understand approval requirements
* Complete release process
* Handle deployment incident

Outcome:

Improved understanding of deployment processes.

---

# Microsoft IQ Integration

## Foundry IQ

Foundry IQ serves as the enterprise knowledge layer.

Responsibilities:

* Knowledge retrieval
* Grounded responses
* Quest generation context
* NPC knowledge grounding
* World generation context

Example:

Deployment SOP
→ Foundry IQ
→ Quest Generator
→ The Ritual of Release

---

## Work IQ (Future Integration)

Work IQ integration layer will support:

* Organizational relationships
* Reporting structures
* Team ownership
* Employee expertise

For the hackathon demo, a synthetic organization graph is used.

Integration interfaces will be implemented but remain disconnected from live enterprise systems.

---

# Synthetic Enterprise Dataset

To avoid exposing confidential information, CompanyVerse uses a synthetic company.

Company:

NebulaCloud

Industry:

Cloud Observability Platform

Contains:

* Employees
* Teams
* Projects
* Systems
* SOPs
* Architecture Documents
* ADRs
* Policies
* Runbooks

The synthetic dataset mirrors realistic enterprise structures.

---

# Technical Architecture

## High Level Flow

Enterprise Knowledge
↓
Foundry IQ
↓
World Generator
↓
Quest Generator
↓
NPC Generator
↓
Playable World

---

# World Generation

Input:

* Teams
* Systems
* Projects
* Documentation

Output:

world.json

The world generator creates:

* Regions
* Landmarks
* Connections
* Themes

Example:

Platform Engineering
→ Backend Citadel

Infrastructure
→ DevOps Mountains

Security
→ Security Keep

---

# Quest Generation

Input:

Enterprise knowledge

Output:

quests.json

Generated:

* Quest title
* Objectives
* Challenges
* Rewards
* NPC assignments

---

# NPC System

NPCs represent organizational expertise.

Examples:

Release Guardian

Security Sentinel

Incident Oracle

NPC dialogue is grounded using Foundry IQ retrieval.

---

# Runtime Gameplay

Player enters region.

Player interacts with NPC.

NPC retrieves relevant knowledge.

Response generated in-character.

Knowledge remains grounded in enterprise documents.

---

# World Rendering

World data is represented using JSON.

Frontend renders the world using Phaser.js.

Assets are predefined.

AI generates:

* World structure
* Quest structure
* NPC metadata

AI does not generate:

* Sprites
* Tile assets
* Animations

---

# Technology Stack

Frontend

* Next.js
* TypeScript
* Tailwind
* Phaser.js

Backend

* Python
* FastAPI

AI Layer

* Azure OpenAI
* LangGraph

Knowledge Layer

* Foundry IQ
* Local RAG Fallback

Storage

* JSON
* Vector Database (optional)

---

# Repository Structure

frontend/

backend/

synthetic_company/

generated/

world.json

quests.json

npcs.json

---

# MVP Scope

Regions

* Backend Citadel
* DevOps Mountains
* Security Keep
* Observability Valley

Quests

* The Ritual of Release
* The Great Latency Crisis
* The Guardian's Audit

NPCs

* Release Guardian
* Incident Oracle
* Security Sentinel

---

# Success Criteria

A user can:

* Explore a generated organizational world
* Talk to grounded NPCs
* Complete generated quests
* Learn organizational processes
* Understand company systems and workflows

without reading traditional documentation.
