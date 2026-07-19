# Recipe Manager — Status

## Активная фаза
Phase 3 — миграция на Supabase (не начата); параллельно — проработка отчёта аудита кода

## Следующий шаг
Продолжить проработку `docs/audits/2026-07-19-project-audit-report.md` начиная с DOC-1 (закрыто 8/60 — все критические; осталось 52: DOC×15, UNDOC×1, LOGIC×9, DEAD×9, TS×7, CONV×3, PERF×8). Phase 3 не начата, ждёт после аудита или по решению пользователя.

## Blocker
Незапушенные коммиты (CRIT-2…CRIT-8 + доп. фикс редиректов/IPv6 для CRIT-5) — ждут отдельной команды на push

## Обновлено
2026-07-19

---

## Итоги последней сессии
- Закрыты все 8 критических находок аудита (`docs/audits/2026-07-19-project-audit-report.md`):
  - CRIT-4: CORS worker'а ограничен `rezept-manager.flowgence.de` + `localhost:5173`
  - CRIT-5: SSRF в `importFromUrl.ts` — новый `validateExternalUrl()`/`safeFetch()` в `worker/src/helpers/validateExternalUrl.ts` (блокирует private/link-local хосты, включая IPv4-mapped IPv6; ревалидирует каждый редирект-хоп, до 5 хопов) — фикс дополнен по итогам автоматического security-review коммита
  - CRIT-6: серверная валидация `Array.isArray(allergies)`/`Array.isArray(userRecipes)` в `fillRemaining.ts`
  - CRIT-7: `fillRemaining.ts` теперь требует ровно 3 варианта от Gemini (`data.options.length === 3`), иначе 502 с логированием
  - CRIT-8: `err.message` больше не уходит клиенту — ни из глобального `onError` в `index.ts`, ни из catch-блоков `fillRemaining`/`importFromPdf`/`importFromPhoto`/`importFromUrl`
- Каждая находка — отдельный коммит с указанием ID, отчёт обновлён `✅ Исправлено (commit ...)` после каждой (следуя правилу из `CLAUDE.md`)

## Ключевые решения, влияющие на следующий шаг
- Проработка аудита идёт по одной находке за раз с отдельным коммитом на каждую — правило подтвердило себя, продолжать так же для оставшихся 52
- Автоматический security-review коммитов (background hook) может находить пробелы в только что закоммиченном security-фиксе (редиректы, IPv4-mapped IPv6 в CRIT-5) — реагировать сразу отдельным коммитом, не откладывать
- Пользователь осознанно остановился после закрытия критических находок, не начиная не-critical часть (DOC/LOGIC/DEAD/TS/CONV/PERF) — следующая сессия начинает с DOC-1
- Repository pattern уже реализован — для Supabase нужны только новые реализации интерфейсов из `src/services/`
- Feature flag `VITE_BACKEND=firebase|supabase` переключает бэкенд в `src/infrastructure/createRepositories.ts`

---

## Где искать контекст
- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5)
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура, env vars
- `docs/roadmap-archive/` — завершённые фазы (0a, 0b, 1, 2) + журнал решений
- `docs/superpowers/specs/` — спеки фаз
