# AGENTS.md

This file is the repository-wide source of truth for AI agent workflow in this project.

## Mandatory First Read
- For any spec/docs change under `specs/**`, `docs/**`, `README.md`, `CHANGELOG.md`:
  - Read `.agent/rules/role-pm-architect.md`
  - Read `docs/templates/prd_spec_template.md`
- For any code change:
  - Read `.agent/rules/coder-agent.md`
  - Read `.agent/rules/module-boundaries.md`
  - If the task touches list/form pages, also read `.agent/rules/Design Baselines.md`

## Rule Precedence
- `system / developer instructions` > `AGENTS.md` > `.agent/rules/*.md` > task prompt
- If rules conflict with the current task, stop and explicitly declare the deviation instead of silently ignoring the rule
- If a task spans both spec and code, load the spec rules first, then the coding rules

## Task Routing
- Spec / PRD / docs work -> PM architect rules
- Coding work -> coder + module boundary rules
- Review work -> findings-first, devil's advocate mode
- Tmp / experimental page work -> require explicit task scope; do not silently retrofit existing pages
- Rewriting existing docs -> preserve business truth, but normalize structure to the active template/rule set

## Non-Negotiables
- Do not start writing specs before loading the matching rule file
- When editing spec docs, follow the PRD template structure
- When a task asks for a tmp/new page, do not retrofit an existing page unless explicitly allowed
- If no matching rule file was loaded, do not start writing specs or code
- For spec tasks, list missing template sections / missing field definitions before writing the document

## Spec Checklist
- Background / Context
- User Stories
- Acceptance Criteria
- Logic Flow / 交互逻辑
- At least 3 edge cases / 异常场景
- Tracking Events
- i18n considerations and `resource_key` suggestions
- Logical View for complex pages
- Field-level definitions for filters / lists / forms

## Code Checklist
- Respect module boundaries and do not silently cross modules
- Place new pages/components in the correct module path
- Reuse shared components only when explicitly compatible with the target scope
- Do not bypass spec intent with convenient retrofits
- Keep naming, ownership, and public interfaces explicit

## Response Protocol
- In the first update, state which rule files were loaded
- In the final update, state any deviations from the rules
