# Recipe Manager App — Claude Code Project Context

## Project Overview

**Recipe Manager** is a mobile/web application for intelligent nutrition management. It combines a smart recipe book, interactive meal planner, and an AI-powered personal dietitian in one product.

**Target users:** Nutritionists, dietitians, fitness trainers, food bloggers, meal-prep specialists, and health-conscious individuals.

**Core value proposition:** Transforms chaotic collections of links, photos, and PDFs into a structured digital ecosystem for nutrition management.

---

## Tech Stack

**Frontend**
- React 19 + TypeScript 5.8 (strict mode)
- Vite 6 — bundler and dev server
- Tailwind CSS v4 — styling via Vite plugin (no separate config file)

**UI / Utilities**
- `lucide-react` — icons
- `motion` (Framer Motion) — animations
- `clsx` + `tailwind-merge` — conditional class merging
- `react-markdown` — Markdown rendering
- `date-fns` — date utilities
- `pdfjs-dist` — client-side PDF parsing

**State Management**
- Plain React `useState` in the root `App.tsx`, passed down via props (prop drilling)
- No external state management library (no Zustand, Redux, Jotai, etc.)

**Backend / Database**
- Firebase 12: Firestore (primary DB), Firebase Analytics
- Express — local proxy/API server
- `better-sqlite3` — SQLite, likely for local cache or offline storage

**AI / ML**
- Google Gemini API (`@google/genai`) — recipe import (URL, PDF, photo), KBZHU calculation, AI image generation, "Fill remaining macros" suggestions

**Hosting**
- Cloudflare

---

## Repository Structure

.
├── CLAUDE.md
├── README.md
├── index.html
├── metadata.json
├── package-lock.json
├── package.json
├── src
│   ├── App.tsx
│   ├── firebase.ts
│   ├── index.css
│   └── main.tsx
├── tsconfig.json
└── vite.config.ts

---

## Application Architecture — Feature Map

### Tab 1: Recipes
- Recipe card feed with photo, cook time, macros (KBZHU)
- Search by name or ingredient
- Filters: category, author, program, cook time slider, calorie slider
- Sort: by date, cook time, calories
- Favorites (heart icon)
- **5 import methods (all via Gemini AI):**
  1. URL import (Instagram Reels, TikTok, websites)
  2. PDF import (extracts multiple recipes from one document)
  3. Photo import (OCR from book pages or screens)
  4. AI image generation (for recipes without photos)
  5. Manual entry
- Auto KBZHU calculation on import; manual "Calculate KBZHU" button
- Recipe card: ingredients, steps, edit, delete, schedule, allergy check

### Tab 2: Planner
- Calendar views: Day / Week / Month
- Display modes: Calendar grid / List
- Meal slots: Breakfast, Lunch, Dinner, Snack
- Add from recipe library or as standalone food item (weight + macros)
- Daily and per-meal KBZHU summary
- Visual red indicators when limits exceeded
- Allergy check on add
- Sync with Cart (auto-populate shopping list)

### Tab 3: Tracker
- Real-time KBZHU progress bars (Calories, Protein, Fat, Carbs)
- Comparison: consumed vs. daily goal
- Red alert when norm exceeded
- Switch active nutrition program (e.g. "Cutting", "Bulking")
- Meal checklist: mark dishes as eaten → KBZHU added to progress
- Water intake tracker (displayed at top)
- Remaining macro calculation
- **"Fill remaining KBZHU" AI feature:**
  - Analyzes today's progress, user goals, allergies, own recipe library, program rules
  - Returns 3 snack suggestions (from user's recipes or food combinations)
  - Each suggestion includes a portion recommendation and reasoning
  - User can add chosen suggestion directly to diary

### Tab 4: Cart (Shopping List)
- Auto-populated from Planner recipes
- Each item tagged with source dish name
- Two sections: "Main ingredients" vs. "Staples" (salt, sugar, oil, spices)
- Quick-add form for manual items
- Edit quantity, delete items, clear all
- Interactive checklist (tap to mark as purchased → item grays out with strikethrough)
- Firebase sync (available across devices)

### Tab 5: Programs
- Hierarchical folder structure (programs → subfolders)
- Create manually or import from PDF
- Populate with recipes from library or import directly inside program
- Search and filter within a program
- Per-program KBZHU goals (overrides profile goals in Tracker when active)
- Allowed / forbidden food lists per program (for specific diets, e.g. Keto, FODMAP)
- Sharing: generate unique link → friends/clients can view
- Author attribution (name + social/website link)
- Program cover images

### Tab 6: Settings (Profile)
- User profile: name, age, gender
- Weight tracking: current weight, target weight
- Manual KBZHU goals: calories (kcal), protein (g), fat (g), carbs (g)
- Allergy manager: preset list (Gluten, Lactose, Nuts, etc.) + custom entries
- Water calculator: auto-calculated as weight × 35ml; one-tap goal setting
- Custom recipe categories (affects Recipes tab filters)
- All data synced to Firebase

---

## Key Business Logic & Constraints

1. **Allergy check** must run before any recipe is added to Planner or Tracker. This is a safety-critical feature — never skip or bypass it.
2. **KBZHU calculation** must be accurate. All macro sums in Planner, Tracker, and Programs must stay in sync.
3. **"Fill remaining KBZHU"** sends context to Gemini: current progress, active program goals, allergies, user's recipe library, program rules. Response must return exactly 3 options with portion and reasoning.
4. **Active program** overrides profile goals in Tracker. When no program is active, profile goals apply.
5. **Cart staples detection** uses keyword matching (salt, sugar, oil, flour, spices) — keep this list configurable.
6. **Firebase is the single source of truth** — all state must sync to Firestore.

---

## AI Integration (Gemini API)

Used in the following features:
- Recipe import from URL, PDF, photo
- KBZHU auto-calculation
- AI recipe image generation
- "Fill remaining KBZHU" snack suggestion

**Important:** Gemini calls should be rate-limited and error-handled gracefully. Always show loading states during AI operations.

---

## Development Conventions

### Code Style
- Language: TypeScript (strict mode)
- Formatter: Prettier (runs on save)
- Linter: ESLint with project config

### Naming
- Components: PascalCase (`UserCard.tsx`)
- Functions/variables: camelCase (`getUserData`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- CSS classes: kebab-case or Tailwind utilities

### File Structure
- One component per file
- Co-locate styles, tests, and types with the component

### Git
- Branch naming: `feature/`, `fix/`, `chore/`
- Commits: conventional commits (`feat:`, `fix:`, `docs:`)

### API & Data
- All API calls go through `/lib/api` or similar service layer
- No direct fetch calls inside components
---

## Current Development Status

| Phase | Status | Description |
|-------|--------|-------------|
| Core features | ✅ Complete | All 6 tabs with base functionality |
| AI import flows | ✅ Complete | URL, PDF, photo, image gen |
| Firebase sync | ✅ Complete | Auth, Firestore, Storage |
| Architecture review | 🔄 In progress | Optimize structure before next phase |
| Next features | 📋 Planned | See below |

---

## Planned Next Steps

- [ ] Architecture improvement: get rid of monolitic App.psx and switch to a more scaleable architecture, break it down in multiple files.
- [ ] Switch the database to Supabase
- [ ] Optionally switch the frontentend to Next.js
- [ ] Optionally switch the hosting provider to Vercel
- [ ] Add login functionality

---

## What to Do First (for Claude Code)

When starting a new session, Claude should:
1. Read this file fully
2. Run `tree -L 3` to understand the current file structure
3. Identify the state management pattern in use
4. Review how Gemini API calls are structured (look for API service files)
5. Check Firebase config and Firestore data model
6. Then proceed with the requested task

---

## Notes & Decisions Log

> Use this section to track important architectural decisions.

- Firebase chosen for real-time sync across devices
- Gemini chosen over OpenAI for multimodal import (PDF, photo, URL)
- Programs use hierarchical structure (folders + subfolders) to support professional use cases