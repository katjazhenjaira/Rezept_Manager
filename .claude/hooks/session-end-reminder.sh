#!/usr/bin/env bash
# Stop hook: detects goodbye/end-of-session patterns in the user's most recent
# message and injects a reminder to follow the Session end protocol from CLAUDE.md
# (update ROADMAP.md, Application_description.md, commit docs).
#
# Runs synchronously on every Stop event. Exits 0 silently if no goodbye detected.

set -eu

# Read hook input (JSON on stdin); claude Code passes transcript_path among other fields.
input=$(cat)

transcript_path=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)

if [ -z "${transcript_path:-}" ] || [ ! -f "$transcript_path" ]; then
  exit 0
fi

# Extract the most recent user message text from the transcript (JSONL).
# macOS has no `tac`; scan top-to-bottom and keep the last matching line.
# A "user" line is one whose JSON has role=user or type=user.
last_user_text=$(awk '
  {
    if (index($0, "\"role\":\"user\"") > 0 || index($0, "\"type\":\"user\"") > 0) {
      last = $0
    }
  }
  END { if (last != "") print last }
' "$transcript_path" || true)

if [ -z "${last_user_text:-}" ]; then
  exit 0
fi

# Extract the actual text content. Claude Code transcript format varies:
# - { "message": { "role": "user", "content": "..." } }
# - { "message": { "role": "user", "content": [ { "type": "text", "text": "..." } ] } }
# - { "type": "user", "message": { ... } }
text=$(printf '%s' "$last_user_text" | jq -r '
  (.message // .) as $m
  | ($m.content // "") as $c
  | if ($c | type) == "string" then $c
    elif ($c | type) == "array" then
      [ $c[] | select((.type // "") == "text") | (.text // "") ] | join(" ")
    else "" end
' 2>/dev/null || true)

if [ -z "${text:-}" ]; then
  exit 0
fi

# Case-insensitive goodbye patterns (RU + EN). Using shell lowercasing is not
# portable across sh/bash versions; use awk for reliable casefold.
lower=$(printf '%s' "$text" | awk '{print tolower($0)}')

# Match any of the patterns (extended regex via grep -E).
if printf '%s' "$lower" | grep -Eq 'пока|до завтра|на сегодня всё|на сегодня все|до встречи|заканчиваем|до следующего раза|спокойной ночи|хорошего вечера|\bbye\b|goodbye|see you|end session|that'\''s all for today'; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"User is ending the session. Before saying goodbye, follow Session end protocol from CLAUDE.md: (1) update ROADMAP.md → Текущий статус (tick completed subtasks, update next step, refresh date), (2) update Application_description.md if business logic changed, (3) add to Журнал решений if a meaningful decision was made, (4) commit docs as 'docs: update roadmap and business logic — session YYYY-MM-DD' unless user asked not to, (5) tell user briefly what was saved, then say goodbye."}}
JSON
fi

exit 0
