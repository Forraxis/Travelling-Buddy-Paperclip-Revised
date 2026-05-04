# Paperclip Task Three — TravellingBuddy Calculator v2 Year-Range Schema Integration

**Purpose of this brief:** Hand off the year-range variant schema patch — the resolution of Open Decision #1, captured during the previous strategic-design session — to Paperclip for integration into the canonical TravellingBuddy Calculator v2 documentation. This is the strategic-design blocker that has been holding Phase 2 catalogue work; once integrated, build can resume.

**Status of the underlying work:** The decision has been made. The patch document is fully self-contained — all five sub-decisions that arose during patch drafting (current-production encoding, slug regeneration policy, FAQ entry cap, sibling linking heuristic, combo page year-pair handling) have been resolved by Tim and threaded into the patch's instructions. No open questions remain for the integration agent. This task is a verification-and-integration pass against three canonical documents.

---

## 1. Context

TravellingBuddy is an Australian road travel companion platform. Phase 1 is a physics-grade rig weight and compliance calculator (GVM, GCM, axle loads, tow ball mass, longitudinal centre of gravity). The platform is being built by Tim, the founder and sole developer, who delegates to AI agents via Paperclip and Claude Code.

The calculator v2 build was unblocked of seven open decisions by Paperclip Task Two. One remaining strategic-design item — **Open Decision #1: year-range vs single-year variant schema** — was held back from Task Two because it required closer attention to SEO content strategy implications before locking in.

That decision has now been made: **year-range canonical** for `VehicleVariant` and `CaravanVariant`. The decision was driven by combo page consolidation (Phase 12 generates 2,000–4,000 plausible combo pages; per-year canonical inflated this 5–10× with thin-content URLs), link equity concentration on a single comprehensive variant URL rather than spread across thin per-year pages, and Google's documented direction of travel since 2024 favouring authoritative reference pages over scaled thin content. The on-page mechanism for capturing per-year search query volume (year selector, FAQ schema with per-year question/answer pairs, plain-prose year enumeration in the lead paragraph) was sketched in detail before the decision was locked, to verify the per-year capture claim was achievable in practice.

Five secondary sub-decisions were resolved during patch drafting:

1. **Current production encoding:** explicit `is_current_production` boolean column, not a NULL or sentinel `year_to`.
2. **Slug regeneration:** `-{yearFrom}-current` slug form for in-production variants, stable through annual `year_to` advances; single 301 at end-of-production when slug regenerates to closed-range form.
3. **FAQ entry cap:** 12–15 entries per profile page, with documented selection priority order.
4. **Variant sibling linking:** hybrid model — strict-overlap siblings displayed prominently, plus a "see all variants" overflow link to a new model-level page type.
5. **Combo page year-pair handling:** lead-paragraph cross-product enumeration plus selective per-(year-pair, verdict-aspect) FAQ entries within the cap.

The fifth sub-decision required adding a new page type to the SEO content engine: **model-level pages** at `/vehicles/{make-slug}/{model-slug}/` and `/caravans/{make-slug}/{model-slug}/`. Make-level pages were considered and explicitly excluded.

---

## 2. Source material

**Pre-drafted patch document (attached to this task):**

- `TravellingBuddy_Calculator_v2_YearRange_Schema_PATCH.md` — the patch document. Self-contained: contains the resolved-decisions record, all patch instructions per target document, integration constraints, acceptance criteria, and uncertainty-handling guidance. Equivalent in structure to the Build Plan and Platform Docs patches applied during Task Two.

**Existing canonical documents (also attached):**

- `TravellingBuddy_Calculator_v2_Specification.md` (current version, post-Task-Two) — to receive modifications to sections 5.1, 7.5, 9.2, and a new subsection 9.4 (with subsequent subsections renumbered).
- `TravellingBuddy_Calculator_v2_Build_Plan.md` (current version, post-Task-Two) — to receive modifications to tasks 1.2 and 1.3, additions to Phase 2, Phase 11, and Phase 12.
- `TravellingBuddy_Calculator_v2_Open_Decisions.md` (current version, post-Task-Two) — to have item #1 moved from pending to resolved.

**Documents NOT touched by this task:**

- `TravellingBuddy_Master_Architecture_Overview_v1_0.md` — out of scope. Schema-level details live in the Calculator v2 spec and build plan.
- `TravellingBuddy_Proxmox_Setup_and_Design_System_v1_0.md` — out of scope.

---

## 3. Task definition

The task is **document integration: applying the patch document to three canonical documents**. The patch is structured by target document; each target receives a defined set of modifications. The patch document itself contains the full instructions; this task brief points at the work and defines the acceptance bar.

### 3.1 Calculator Specification

Apply the modifications described in patch sections 2.2 through 2.5:

- **Section 5.1:** replace the variant keying language for both vehicle and caravan hierarchies. Add `year_from`, `year_to`, `is_current_production` field definitions and exclusion-constraint description per the patch.
- **Section 7.5:** soften the spec-equivalence grouping language to reflect that the schema now natively supports ranges. The picker behaviour barely changes; the paragraph just becomes less load-bearing.
- **Section 9.2:** update vehicle profile, caravan profile, and combo page slug examples to year-range form. Add the slug rule note. Add two new page-type bullets for vehicle and caravan model-level pages immediately after the caravan profile pages bullet.
- **Section 9.3 → 9.4 (new):** insert a new subsection 9.4 ("Year-range page structure for per-year query capture") covering the on-page structure for variant profile pages, combo pages, and model-level pages. Renumber existing 9.4 (Pre-fill mechanism) to 9.5, 9.5 (Plausibility filter) to 9.6, and so on through 9.8.

Verify section numbering is internally consistent after the renumbering. Verify cross-references within the document still resolve correctly. Bump version (e.g. v2.1 → v2.2) with a changelog entry referencing this integration.

### 3.2 Open Decisions

Apply the modification described in patch section 2.1:

- Remove item #1 (Year-range vs single-year variant schema) from the "Pending strategic / design decisions" section.
- Add the resolved-entry text to the resolved decisions section (or whatever section name is used for resolved items in the current document).
- Renumber remaining pending items if applicable (the patch's resolved entry preserves item #1's headline label as a checkmark line; remaining pending items 2, 3, etc. either stay as-is or shift up by one — verify against the existing document's convention).

Bump version (v1.1 → v1.2) with a changelog entry.

### 3.3 Build Plan

Apply the modifications described in patch sections 2.6 through 2.10:

- **Task 1.2** (vehicle entity schema): replace `year` field with `year_from`, `year_to`, `is_current_production` per the patch. Add the Postgres exclusion-constraint instructions including the `btree_gist` extension requirement. Update the migration name. Add the new manual-review questions.
- **Task 1.3** (caravan entity schema): apply the equivalent changes to `CaravanVariant`. Update migration name. Add equivalent review questions.
- **Phase 2 introduction** (or the relevant scraper task, once Phase 2 tasks are defined): add the scraper guidance note covering year-range extraction, ingestion-time deduplication of adjacent identical rows, and split-variant emission for mid-range specification changes.
- **Phase 11 variant CRUD task:** add the four admin actions (split range, advance year_to, close current production, overlap validation surfaced via the constraint).
- **Phase 12 vehicle and caravan profile page templates:** add the per-year query capture structural requirements per spec section 9.4.
- **Phase 12 new sub-task:** add the model-level page templates sub-task per the patch (4–6 hours estimated, deliverables and acceptance criteria as specified).

Bump version (v1.1 → v1.2) with a changelog entry. Note in the changelog that Phase 1 tasks 1.2 and 1.3 were modified in place — this is expected per the patch's design and is consistent with the patch's own constraint that "Phase 1 schema tasks are being modified in place per this patch."

---

## 4. Acceptance criteria

The task is complete when:

- All three target documents reflect the integrations described in the patch document.
- A change-summary or diff is produced and reviewable, listing every section added, replaced, or modified across all three target documents.
- Section numbering is internally consistent within each updated document, especially the spec section 9.x renumbering.
- Cross-references between documents (Build Plan referencing Spec sections, Spec referencing Build Plan, Open Decisions referencing Spec) resolve correctly to the new section locations.
- Open Decision #1 is no longer present in the pending section of the Open Decisions document.
- The patch document's own acceptance criteria (section 6) are met as a sub-set of the criteria above.

---

## 5. Constraints (what NOT to do)

- **Do not introduce new design decisions beyond those captured in the patch.** All design decisions for this work are recorded in patch section 4 (resolved decisions) and threaded into the relevant patch instructions. If ambiguity arises during integration that isn't already addressed by the patch — a section that doesn't fit cleanly, a cross-reference that resolves to nothing, a contradiction between the patch and existing content — surface the ambiguity as a question to Tim rather than resolving autonomously.
- **Do not re-interrogate the resolved sub-decisions.** Patch section 4 captures the rationale for each. The decisions are made; the integration is mechanical from here.
- **Do not modify Phase 0 completion status in the Build Plan.** Phase 1 tasks 1.2 and 1.3 are being modified in place per the patch — this is expected and is the correct behaviour. No other completed task should be reverted or modified.
- **Do not rewrite or paraphrase the pre-drafted patch text.** Use it as-authored, with only formatting adjustments needed for document conventions (heading levels, list styles to match the existing documents).
- **Do not modify the Master Architecture Overview or Proxmox Setup documents.** Both are explicitly out of scope per the patch.
- **Do not preemptively start engineering work.** This is a documentation pass only. No schema migrations, no code changes, no implementation tasks. The schema migration is a Phase 1 follow-up task that happens after this integration completes.
- **Do not consider make-level pages.** The patch explicitly excludes make-level pages (`/vehicles/{make-slug}/`) from scope, with rationale recorded. Do not add them speculatively.
- **Do not resolve any of the smaller items previously flagged** (fragment metadata taxonomy, URL state encoding, bootstrap/seed mechanics, legal text drafts) — those remain in the Open Decisions document as pickable later.

---

## 6. Out of scope

- Engineering implementation of the schema change, scraper updates, admin CRUD, or page templates
- The schema migration itself (a Phase 1 follow-up task that runs after this integration completes)
- Re-litigating any of the five resolved sub-decisions in patch section 4
- Modifications to documents outside the three named target documents
- Brand outreach, content authoring, or any of Tim's parallel workstreams
- Make-level pages

---

## 7. How to surface uncertainty

If during integration the agent encounters:
- A section number that doesn't have a clean insertion point in the existing document
- A cross-reference that resolves to nothing or to an unexpected location
- A contradiction between a patch instruction and the existing document content
- A formatting convention in the existing document that the patch text doesn't follow
- A renumbering decision that ripples in unexpected ways (e.g. if the spec already has content past 9.8 that the patch doesn't anticipate)
- Any other ambiguity not addressed by the patch

The agent stops, summarises the ambiguity in a clear question, and waits for Tim's direction. Do not proceed on assumptions.

The patch is designed to be exhaustive; questions surfaced should be rare and structural rather than design-level. If a design-level question arises, that's a strong signal something has been missed — surface it rather than resolving it.

---

## 8. Sequencing note

This task unblocks Phase 2 catalogue work. Once integration is complete and verified, the next pieces of work, in order, are:

1. **Phase 1 schema migration follow-up task** — a small engineering task to update `prisma/schema.prisma` per the new task 1.2 and 1.3 definitions, run the migration, regenerate the Prisma client, and verify build/type-check. Empty-table migration so risk is low.
2. **Phase 2 catalogue data layer tasks** — Phase 2 work as defined in the Build Plan, now able to proceed with year-range-aware scrapers and ingestion logic.

These are not part of this task. They are the next things after this task completes.

---

## 9. Optional alternative scope

The patch document is fully drafted and self-contained. If verification of the patch instructions passes cleanly with no ambiguities surfaced, the task is purely the mechanical application of the patch to the three target documents and the production of the change summary.

Tim may also choose to skip this Paperclip task entirely and apply the patch directly. This brief assumes the task is being run through Paperclip primarily for the orchestration discipline (consistent integration approach, change-summary artefact, audit trail) on a low-risk well-bounded task; if Tim has applied the patch outside Paperclip, this task should be marked superseded.

---

*— End of Task Brief —*
