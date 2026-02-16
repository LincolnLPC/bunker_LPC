-- Включить Realtime для таблицы private_messages
-- После выполнения личные сообщения будут приходить в открытый диалог без обновления страницы.
-- Выполните в Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;
