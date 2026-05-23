# AcademiQ — Adaptive Academic Planning Engine TODO

## Phase 1: Database Schema & Migrations
- [x] Define schools table (multi-school support)
- [x] Define majors and minors tables with school FK
- [x] Define courses table (code, name, credits, difficulty, availability, description)
- [x] Define prerequisites table (course → prerequisite, type: required/corequisite)
- [x] Define degree_requirements table (major/minor → required courses, categories, credit rules)
- [x] Define requirement_categories table (core, elective, general ed, etc.)
- [x] Define student_profiles table (school, major, minor, AP credits, preferences)
- [x] Define degree_plans table (student → generated plan metadata, variant type, scores)
- [x] Define plan_semesters table (plan → semester → list of courses)
- [x] Define plan_courses table (semester → course assignments with status)
- [x] Define scenario_simulations table (student → what-if scenarios)
- [x] Define career_tracks table (industry tracks with associated courses)
- [x] Generate and apply migrations
- [x] Seed comprehensive course catalog for 2+ schools with prerequisites
- [x] Seed degree requirements for CS, Business majors

## Phase 2: Core Engine (Server-Side)
- [x] Prerequisite graph builder (directed acyclic graph from course catalog)
- [x] Topological sort for prerequisite ordering
- [x] Hard constraint validator (prereqs met, credit limits, availability)
- [x] Soft constraint scorer (workload balance, difficulty spread, timing)
- [x] Constraint-based scheduling optimizer (greedy + backtracking)
- [x] Fastest path variant generator
- [x] Lowest stress path variant generator
- [x] Most flexible path variant generator
- [x] Plan scoring system (workload score, difficulty score, flexibility score)
- [x] Dynamic replanning engine (recompute with minimal disruption on course drop/fail)
- [x] Career-aware course prioritization (internship readiness, grad school, industry tracks)
- [x] Scenario simulation engine (what-if: drop course, add major, change graduation target)

## Phase 3: tRPC API Layer
- [x] schools.list — list all schools
- [x] majors.list — list majors/minors by school
- [x] courses.list — list courses by school/major with filters
- [x] courses.getGraph — return prerequisite dependency graph data
- [x] profile.create / profile.update — student profile CRUD
- [x] profile.get — get current student profile
- [x] plans.generate — run optimizer and return 3 plan variants
- [x] plans.list — list saved plans for student
- [x] plans.get — get full plan with semesters and courses
- [x] plans.setActive — set a plan as the active plan
- [x] plans.replan — trigger dynamic replanning on course status change
- [x] plans.simulate — run what-if scenario simulation
- [x] career.getTracks — list career tracks
- [x] chat.getHistory — get chat message history
- [x] chat.sendMessage — LLM-powered chat assistant with plan context

## Phase 4: Frontend — Layout & Design System
- [x] Global design system: dark theme with OKLCH color tokens, Inter font
- [x] Consistent sidebar navigation across all pages
- [x] Landing/home page with hero, feature highlights, and CTA
- [x] Student profile setup wizard (multi-step: school → major/minor → AP credits → preferences)
- [x] Responsive layout

## Phase 5: Frontend — Plan Visualization
- [x] Semester plan grid (4-year, semester-by-semester card layout)
- [x] Course cards with difficulty badge, credit hours, status indicator
- [x] Plan variant tabs (Fastest Path / Lowest Stress Path / Most Flexible Path)
- [x] Plan scoring breakdown panel (workload, difficulty, flexibility scores)
- [x] Prerequisite dependency graph visualization (SVG-based node graph)
- [x] Workload heatmap (semester × workload intensity grid)
- [x] Plan comparison side-by-side view (PlanComparison component)

## Phase 6: Frontend — Scenario & Career
- [x] Scenario simulation panel ("What If?" lab)
- [x] Drop course simulation with instant replan preview
- [x] Add second major simulation
- [x] Change graduation target simulation
- [x] Dynamic replanning apply button with navigation to updated plan
- [x] Career tracks selection panel
- [x] Career-aware plan re-scoring explanation

## Phase 7: Frontend — AI Chat Assistant
- [x] AI chat assistant page with full chat UI
- [x] Chat with plan context injection
- [x] Streamdown markdown rendering for AI responses
- [x] Suggested questions (explain schedule, optimize for internship, what if scenarios)
- [x] Chat history persistence via database

## Phase 8: Notifications & Export
- [x] Owner notification on plan generation events
- [x] Plan comparison and export guidance in dashboard

## Phase 9: Testing & Polish
- [x] Vitest unit tests for core engine (graph builder, optimizer, replanning) — 22 tests
- [x] Vitest auth test — 1 test
- [x] All 23 tests passing
- [x] Final checkpoint and delivery

## Ivy League Expansion
- [x] Research all 8 Ivy League schools' majors and minors catalogs
- [x] Build comprehensive seed script for all 8 schools (Harvard, Yale, Princeton, Columbia, Penn, Brown, Dartmouth, Cornell)
- [x] Seed 8 schools with all programs (majors + minors), courses, prerequisites, degree requirements
- [x] Verify data integrity after seeding

## Bug Fixes
- [x] Fix React hooks ordering error in PlanView.tsx (exportPdfMutation hook placed after early return)

## Account Management
- [x] Fix Ivy League seed script to match actual DB schema and run it
- [x] Add deleteAccount tRPC procedure (deletes all user data: profile, plans, chat messages, scenarios)
- [x] Add resetAccount tRPC procedure (resets student profile and plans but keeps the user record)
- [x] Add Delete Account / Reset Account UI in the Dashboard settings area with confirmation dialogs

## AP/Transfer Credits Fix
- [x] Audit setup wizard for AP credits step visibility
- [x] Build proper AP credits input step with AP exam list and score thresholds
- [x] Save AP credits to student profile (apCreditsJson field)
- [x] Ensure optimizer reads AP credits and skips equivalent courses in generated plans

## Ivy League Plan Generation Bugs
- [ ] Fix: plans only generating 3 semesters instead of 8 (should be 4 years)
- [ ] Fix: plans showing only 38 credits instead of 120+ credits
- [ ] Fix: courses from unrelated majors appearing in single-major plans
- [ ] Fix: semester ordering wrong (spring before fall in sequence)
- [ ] Fix: seed data — each Ivy major needs enough courses to fill 120 credits
- [ ] Fix: optimizer totalSemesters and totalCreditsRequired logic
- [ ] Fix: optimizer must respect the student's selected major when filtering courses
