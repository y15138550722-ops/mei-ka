# Codex Skills Activation Runbook

## Scope

This runbook standardizes how project skills are installed and activated for Codex.

## Canonical Skill Location

- Install skills into `~/.codex/skills/<skill-name>/`.
- Do not rely on project-local `.agent/skills/` folder for runtime discovery.

## Supported Local Skills

- `change-write`
- `commit-wip-sync`
- `commit-milestone-publish`

## Install and Validate

Run from project root:

```bash
bash .agent/scripts/sync-codex-skills.sh
```

This command:

1. Copies supported skills from `.agent/skills/` to `~/.codex/skills/`.
2. Enforces `SKILL.md` and `agents/openai.yaml` existence.
3. Runs `quick_validate.py` for each installed skill.

## Reload Requirement

After installing or updating skills:

1. Fully quit Codex (not only closing the chat tab).
2. Reopen Codex.
3. Start a new session.

## Invocation Standard

- Use plain text skill names: `use skill-name ...`
- Avoid Markdown link style for invocation.

## Verification Checklist

1. In a new session, the injected `Available skills` includes your custom skills.
2. `/` -> `Skills` shows your custom skill cards.
3. Plain text invocation works:
   - `use skill-creator ...`
   - `use skill-installer ...`
   - `use change-write ...`
   - `use commit-wip-sync ...`
   - `use commit-milestone-publish ...`
4. Behavior matches each skill's `SKILL.md`.
5. If plain text works but Markdown link does not, keep plain text as the only supported invocation syntax.

## Isolation Procedure (If Still Failing)

1. Keep only one minimal custom skill in `~/.codex/skills/`.
2. Restart Codex and validate discovery.
3. Add skills back one by one.