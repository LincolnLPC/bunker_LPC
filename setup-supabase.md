# Автоматическая настройка Supabase

## ⚠️ Важное замечание о ключе

Предоставленный ключ начинается с `sb_secret_`, что похоже на **service role key**.

Для клиентского приложения обычно нужен **anon public key** (начинается с `eyJ...`).

**Что делать:**
1. В Supabase Dashboard перейдите: **Settings → API**
2. Скопируйте **anon public** key (не service_role key!)
3. Обновите `.env.local` с правильным ключом

## Настройка базы данных

SQL скрипт нужно выполнить **вручную** в Supabase SQL Editor, так как он требует DDL привилегий.

### Инструкция:

1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/pklwfuyxumtjbgyqlxsf
2. Перейдите в **SQL Editor**
3. Нажмите **New query**
4. Откройте файл `scripts/001-create-tables.sql` из проекта
5. Скопируйте весь содержимое SQL скрипта
6. Вставьте в SQL Editor
7. Нажмите **Run** (или Ctrl+Enter)

### Включение Realtime

После создания таблиц:

1. Перейдите: **Database → Replication**
2. Включите репликацию для таблиц:
   - `game_rooms`
   - `game_players`
   - `chat_messages`
   - `player_characteristics`
   - `votes`

### Настройка Authentication

1. Перейдите: **Authentication → URL Configuration**
2. Добавьте в **Redirect URLs**:
   - `http://localhost:3000/**`
   - `http://localhost:3000/auth/callback`
3. В **Site URL** укажите: `http://localhost:3000`

---

После выполнения этих шагов приложение будет полностью настроено!
