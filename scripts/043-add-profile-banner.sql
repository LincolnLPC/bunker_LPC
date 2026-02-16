-- Фон блока профиля для премиум-пользователей (картинка за аватаром и ником)
-- Выполните в Supabase SQL Editor после 039.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_banner_url TEXT;

COMMENT ON COLUMN profiles.profile_banner_url IS 'URL фонового изображения блока профиля (только для премиум)';
