# 📝 Инструкция по Supabase для ZenFlow

## Коротко

Для этого проекта нельзя больше ориентироваться на старую схему “применить 2 SQL-файла вручную и всё готово”.

Текущий источник истины:
- весь каталог `supabase/migrations/`
- linked project в Supabase CLI
- история `supabase_migrations.schema_migrations`

Если нужно проверить или обновить remote проект, рабочий путь только такой:

```bash
supabase login
supabase projects list
supabase migration list
supabase db push --dry-run
supabase db push
```

## Важно: исторический debt

В репозитории есть **legacy миграции с повторяющимися date-prefix**:
- `20260113`
- `20260125`
- `20260201`
- `20260203`
- `20260215`
- `20260307`
- `20260311`
- `20260314`

Это важно, потому что Supabase CLI сравнивает migration history по numeric version/timestamp.  
Из-за этого слепой `supabase db push --include-all` может попытаться повторно прогнать то, что уже частично есть в remote схеме.

### Правило на будущее

Новые миграции создавайте только через CLI:

```bash
supabase migration new <name>
```

или через schema diff:

```bash
supabase db diff -f <name>
```

Не создавайте вручную файлы с prefix вида `YYYYMMDD_name.sql`.  
Нужен уникальный timestamp, который генерирует сам CLI.

## Рекомендуемый workflow для remote проекта

### 1. Убедиться, что проект привязан

```bash
supabase projects list
```

Если проект не linked:

```bash
supabase link --project-ref <project-ref>
```

### 2. Проверить состояние истории миграций

```bash
supabase migration list
```

Смотрите на три сценария:

- `Local == Remote`  
  Значит история согласована.

- есть `Remote migration versions not found in local migrations directory`  
  Значит remote history ушла вперед или была записана под другими version ids. Не делайте сразу `db push`.

- есть `Found local migration files to be inserted before the last migration on remote database`  
  Значит локальная файловая история и remote history расходятся. Не делайте сразу `--include-all`.

### 3. Перед любым push сначала dry-run

```bash
supabase db push --dry-run
```

Только если dry-run показывает ожидаемый и безопасный список миграций, переходите к реальному push.

### 4. Если CLI предлагает repair

Используйте только те команды `supabase migration repair`, которые вы:
- понимаете по смыслу
- можете подтвердить по реальной remote схеме
- прогнали сначала через анализ, а не наугад

Если remote схема менялась вручную через Dashboard, сначала:

```bash
supabase db pull
```

## Что уже проверено для ZenFlow

На linked проекте `ZenFlow` подтверждено:
- `20260204_optimize_rls_policies.sql` уже присутствует в remote history
- journal RLS оптимизация после него живет отдельной миграцией `20260222_optimize_journal_rls.sql`

Это значит, что вопрос по `20260204` как по “висящему непримененному SQL” закрыт.  
Оставшийся риск — не сам этот SQL, а согласованность общей migration history.

## Что проверять после изменения схемы

### 1. История миграций

```bash
supabase migration list
```

### 2. Dry-run deploy

```bash
supabase db push --dry-run
```

### 3. Типы

```bash
npx supabase gen types typescript --project-id <project-ref> > src/types/supabase.ts
```

### 4. Drift guards

```bash
node scripts/check-types-freshness.cjs
node scripts/check-supabase-migration-prefixes.cjs
```

## Частые ошибки

### `Remote migration versions not found in local migrations directory`

Причина:
- в remote history есть version ids, для которых нет локальных файлов
- или история была записана старыми именами/timestamp

Правильный ход:
- не делать сразу `db push`
- проверить `migration list`
- при необходимости сделать `db pull`
- только потом `migration repair`

### `Found local migration files to be inserted before the last migration on remote database`

Причина:
- локальная история не совпадает с remote history
- часто это происходит из-за duplicate prefixes в старых миграциях

Правильный ход:
- не использовать сразу `--include-all`
- сначала проверить, существуют ли объекты этих миграций в remote схеме

### `relation already exists`

Чаще всего это признак, что вы пытаетесь повторно прогнать уже отраженную в схеме миграцию.  
Это сигнал остановиться и перепроверить history, а не просто “продолжать”.

## Резюме

Для ZenFlow правильная ментальная модель такая:
- проблема не в одном старом SQL
- проблема в согласованности `local files <-> remote history <-> actual remote schema`
- future-safe путь — только уникальные CLI-generated timestamps и обязательный dry-run перед push
