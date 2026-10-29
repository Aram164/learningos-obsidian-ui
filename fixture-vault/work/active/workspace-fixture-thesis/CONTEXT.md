---
id: workspace-fixture-thesis
type: workspace
title: Thesis research workspace
created: '2099-01-01'
status: active
module_ids: [module-fixture-thesis]
unit_ids: [unit-fixture-thesis-landscape]
program_ids: [program-bachelors]
---

## Objective

Explore and optimize MLE agents for medical use cases.

## Current Scope

Bounded thesis research.

## Open Questions

Confirm compute budget.

## Next Action

Confirm the bounded compute budget.

## Workstreams

```json
{
  "kind": "parallel",
  "nodes": [
    {
      "children": [
        {
          "id": "step-fixture-scope",
          "kind": "step",
          "status": "active",
          "title": "Confirm scope"
        }
      ],
      "id": "workstream-fixture-landscape",
      "kind": "workstream",
      "status": "active",
      "title": "Landscape and scope"
    },
    {
      "children": [
        {
          "children": [
            {
              "id": "step-fixture-baseline",
              "kind": "step",
              "status": "planned",
              "title": "Run baseline"
            }
          ],
          "id": "step-map-fixture-baseline",
          "kind": "step-map",
          "status": "planned",
          "title": "Baseline map"
        }
      ],
      "id": "workstream-fixture-experiments",
      "kind": "workstream",
      "status": "planned",
      "title": "Experiments"
    }
  ]
}
```

## Research decisions

```json
[
  {
    "id": "decision-fixture-budget",
    "status": "open",
    "summary": "Confirm the bounded compute budget.",
    "title": "Compute budget"
  }
]
```

## Materials and deliverables

```json
{
  "files": [
    {
      "kind": "working",
      "label": "Landscape plan",
      "path": "work/active/fixture-thesis-plan.md"
    }
  ],
  "relationships": [
    {
      "contribution": "Provides evaluation vocabulary and systems methods for the thesis experiments.",
      "from_project_id": "project-fixture-thesis",
      "id": "relationship-fixture-thesis-aml",
      "path": "projects/relations/project-relations.yaml",
      "reason": "Advanced ML supplies the evaluation vocabulary.",
      "relation_type": "informs",
      "to_id": "module-fixture-aml",
      "to_type": "module",
      "type": "project-relationship"
    },
    {
      "contribution": "Keeps the selected evaluation materials in deliberate working order.",
      "from_project_id": "project-fixture-thesis",
      "id": "relationship-fixture-thesis-pack",
      "path": "projects/relations/project-relations.yaml",
      "reason": "The pack provides a narrow experiment support shelf.",
      "relation_type": "uses",
      "to_id": "fixture-evaluation-pack",
      "to_type": "topic-pack",
      "type": "project-relationship"
    }
  ]
}
```

## Boundaries

```json
{
  "confidentiality": "private",
  "external_code_access": "approved",
  "notes": "External code access is task-scoped and never indexed as LearningOS data."
}
```
