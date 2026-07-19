# Recipe Manager — Status

## Активная фаза
Phase 3 — миграция на Supabase (не начата); параллельно — проработка отчёта аудита кода

## Следующий шаг
Продолжить проработку `docs/audits/2026-07-19-project-audit-report.md` (закрыто 3/60, начиная с CRIT-4 — открытый CORS в worker/src/index.ts). Phase 3 не начата, ждёт после аудита или по решению пользователя.

## Blocker
2 незапушенных коммита (CRIT-2, CRIT-3) — ждут отдельной команды на push

## Обновлено
2026-07-19

---

## Итоги последней сессии
- Полный аудит кода (`project-audit`): 60 находок по 9 категориям → `docs/audits/2026-07-19-project-audit-report.md`
- Закрыты все 3 safety-critical находки: CRIT-1 (base64-картинки → Firebase Storage через `resolveImageField()`, подтверждено вручную), CRIT-2 (allergy-check дедуп на `recipeAllergens`/`recipeHasAllergens`), CRIT-3 (КБЖУ-суммирование дедуп на `sumMacros`/`remainingMacros`/`resolveActiveTargets`)
- `ROADMAP.md`: разделы «Технический долг» (ссылка на отчёт) и «Баги» (импорт рецепта по ссылке не работает, не диагностирован)
- `CLAUDE.md`: правило проработки отчётов аудита — по одной находке, коммит + отметка в отчёте на каждую, roadmap-пункт снимается только после полного закрытия отчёта

## Ключевые решения, влияющие на следующий шаг
- Проработка аудита идёт по одной находке за раз с отдельным коммитом на каждую — не пытаться закрывать пачками
- CRIT-4…8 (осталось 5 критических) — все в `worker/src/`: открытый CORS, SSRF в `importFromUrl.ts`, отсутствие серверной валидации в `fillRemaining.ts`, утечка деталей ошибок клиенту
- Найден недокументированный баг вне исходного отчёта: `PlannerView` не использует `activeNutritionPlan` для подсветки превышения лимита (constraint №3) — стоит завести отдельной находкой перед фиксом
- Repository pattern уже реализован — для Supabase нужны только новые реализации интерфейсов из `src/services/`
- Feature flag `VITE_BACKEND=firebase|supabase` переключает бэкенд в `src/infrastructure/createRepositories.ts`

---

## Где искать контекст
- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5)
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура, env vars
- `docs/roadmap-archive/` — завершённые фазы (0a, 0b, 1, 2) + журнал решений
- `docs/superpowers/specs/` — спеки фаз
