# Как сделать себя премиум пользователем для тестов

## Быстрый способ

### Шаг 1: Найдите свой email или user_id

1. Откройте Supabase Dashboard → **SQL Editor**
2. Выполните один из запросов:

**Найти по email:**
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'ваш_email@example.com';
```

**Список всех пользователей:**
```sql
SELECT u.id, u.email, p.username, p.subscription_tier
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 20;
```

### Шаг 2: Обновите subscription_tier

**Вариант 1: По email (рекомендуется)**

1. Откройте файл `scripts/034-grant-premium-subscription.sql`
2. Найдите строку: `target_email TEXT := 'your_email@example.com';`
3. Замените `'your_email@example.com'` на ваш email (в кавычках!)
4. Выполните скрипт в Supabase SQL Editor

**Вариант 2: По user_id (если знаете UUID)**

```sql
UPDATE profiles
SET subscription_tier = 'premium', 
    premium_expires_at = NULL,
    updated_at = NOW()
WHERE id = 'ваш_user_id_здесь'::UUID;
```

**Вариант 3: Прямой запрос (самый быстрый)**

Просто выполните этот запрос, заменив email:

```sql
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Замените 'your_email@example.com' на ваш email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = LOWER('your_email@example.com');
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Создать или обновить профиль с премиум подпиской
  INSERT INTO profiles (id, username, subscription_tier, premium_expires_at)
  VALUES (
    target_user_id,
    COALESCE(
      (SELECT username FROM profiles WHERE id = target_user_id),
      'user_' || SUBSTRING(target_user_id::TEXT, 1, 8)
    ),
    'premium',
    NULL -- NULL = permanent premium
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    subscription_tier = 'premium',
    premium_expires_at = NULL,
    updated_at = NOW();

  RAISE NOTICE 'Premium subscription granted to user: %', target_user_id;
END $$;
```

### Шаг 3: Проверьте результат

```sql
SELECT 
  p.id,
  p.username,
  p.subscription_tier,
  p.premium_expires_at,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'ваш_email@example.com';
```

Должно показать `subscription_tier = 'premium'`

### Шаг 4: Обновите страницу

1. Выйдите из аккаунта и войдите снова (или просто обновите страницу)
2. Перейдите на страницу создания игры
3. Должна появиться карточка "Шаблоны игр"

---

## Альтернативный способ через Supabase Dashboard

1. Откройте **Table Editor** → **profiles**
2. Найдите свой профиль (по email или username)
3. Откройте строку для редактирования
4. Измените `subscription_tier` с `basic` на `premium`
5. Сохраните изменения

---

## Откат обратно на базовый тариф

Если нужно вернуть базовый тариф:

```sql
UPDATE profiles
SET subscription_tier = 'basic', 
    premium_expires_at = NULL,
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'ваш_email@example.com');
```

---

## Выдача премиума на определенный срок

Для временной премиум подписки (например, на 30 дней):

```sql
DO $$
DECLARE
  target_user_id UUID;
  target_email TEXT := 'your_email@example.com'; -- Замените на ваш email
  expiration_days INTEGER := 30; -- Количество дней
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = LOWER(target_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO profiles (id, username, subscription_tier, premium_expires_at)
  VALUES (
    target_user_id,
    COALESCE(
      (SELECT username FROM profiles WHERE id = target_user_id),
      'user_' || SUBSTRING(target_user_id::TEXT, 1, 8)
    ),
    'premium',
    NOW() + (expiration_days || ' days')::INTERVAL
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    subscription_tier = 'premium',
    premium_expires_at = NOW() + (expiration_days || ' days')::INTERVAL,
    updated_at = NOW();

  RAISE NOTICE 'Premium subscription granted for % days', expiration_days;
END $$;
```

---

## Примечания

- Изменения применяются сразу после выполнения SQL запроса
- Может потребоваться обновить страницу или перелогиниться
- Премиум подписка дает доступ к:
  - Созданию шаблонов игр
  - Комнатам на более чем 12 игроков (до 20)
  - Неограниченному созданию комнат
  - Кастомным характеристикам
  - Экспорту данных игр
