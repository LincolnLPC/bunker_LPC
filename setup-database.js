// Скрипт для автоматической настройки базы данных Supabase
// Требует: node.js и установленные зависимости

const { createClient } = require('@supabase/supabase-js');

// Загрузка .env.local (опционально)
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    });
  }
} catch (e) {}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Примечание: SQL скрипты нужно выполнять через SQL Editor в панели Supabase
// Этот скрипт только проверяет подключение (требует .env.local с ключами)

async function testConnection() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('❌ Укажите NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local');
    return false;
  }
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('Проверка подключения к Supabase...');

    // Попробуем простой запрос
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      console.log('✅ Подключение работает, но таблицы еще не созданы');
      console.log('⚠️  Необходимо выполнить SQL скрипт вручную в Supabase SQL Editor');
      return false;
    } else if (error) {
      console.log('❌ Ошибка подключения:', error.message);
      return false;
    } else {
      console.log('✅ Подключение работает, таблицы существуют!');
      return true;
    }
  } catch (err) {
    console.log('❌ Ошибка:', err.message);
    return false;
  }
}

testConnection();
