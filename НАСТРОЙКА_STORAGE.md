# Настройка Supabase Storage для аватаров

## Проблема
Ошибка: "Bucket not found" - это означает, что bucket `avatars` не создан в Supabase Storage.

## Решение

### Шаг 1: Создайте bucket в Supabase Dashboard

1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/pklwfuyxumtjbgyqlxsf/storage/buckets

2. Нажмите кнопку **"New bucket"** (Создать bucket)

3. Заполните форму:
   - **Name**: `avatars`
   - **Public bucket**: ✅ Включите (должен быть включен, чтобы аватары были доступны публично)

4. Нажмите **"Create bucket"**

### Шаг 2: Настройте политики доступа (RLS)

После создания bucket нужно настроить политики доступа. Откройте SQL Editor: https://supabase.com/dashboard/project/pklwfuyxumtjbgyqlxsf/sql

**Быстрый способ:** Выполните скрипт `scripts/007-setup-storage-bucket.sql`

**Или выполните следующий SQL код вручную:**

```sql
-- Политика для чтения аватаров (публичный доступ)
CREATE POLICY "Public Avatar Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Политика для загрузки аватаров (только свой аватар)
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);

-- Политика для обновления аватаров (только свой аватар)
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);

-- Политика для удаления аватаров (только свой аватар)
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);
```

### Шаг 3: Проверьте настройки

1. Убедитесь, что bucket `avatars` существует:
   - Перейдите в Storage → Buckets
   - Должен быть виден bucket с именем `avatars`
   - Он должен быть помечен как "Public"

2. Проверьте политики:
   - Перейдите в Storage → Policies
   - Должны быть видны 4 политики для bucket `avatars`

### Альтернативный способ (через Dashboard)

Если вы предпочитаете настраивать через интерфейс:

1. Перейдите в **Storage** → **Policies**
2. Выберите bucket `avatars`
3. Нажмите **"New Policy"**
4. Создайте политики вручную:

   **Policy 1 - Public Avatar Access:**
   - Policy name: `Public Avatar Access`
   - Allowed operation: `SELECT`
   - Policy definition:
     ```sql
     bucket_id = 'avatars'
     ```

   **Policy 2 - Users can upload own avatars:**
   - Policy name: `Users can upload own avatars`
   - Allowed operation: `INSERT`
   - Policy definition:
     ```sql
     bucket_id = 'avatars' AND auth.uid() IS NOT NULL
     ```

   **Policy 3 - Users can update own avatars:**
   - Policy name: `Users can update own avatars`
   - Allowed operation: `UPDATE`
   - Policy definition:
     ```sql
     bucket_id = 'avatars' AND auth.uid() IS NOT NULL
     ```

   **Policy 4 - Users can delete own avatars:**
   - Policy name: `Users can delete own avatars`
   - Allowed operation: `DELETE`
   - Policy definition:
     ```sql
     bucket_id = 'avatars' AND auth.uid() IS NOT NULL
     ```

## После настройки

После выполнения всех шагов:
1. Обновите страницу редактирования профиля
2. Попробуйте загрузить аватар
3. Ошибка "Bucket not found" должна исчезнуть

## Примечания

- Bucket должен быть **публичным** (Public bucket = ON), чтобы аватары отображались на сайте
- Политики безопасности позволяют пользователям загружать только свои собственные аватары
- Все аватары хранятся в папке `avatars/` внутри bucket
