-- Auto-tag jobs now run Claude Code instead of the Codex CLI.
UPDATE `auto_tag_jobs` SET `agent` = 'claude-code' WHERE `agent` = 'codex';
