// Скрипт для проверки подключения к Supabase
// Запуск: node check-connection.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Читаем .env.local вручную
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Ошибка: Переменные окружения не найдены!');
  console.error('Проверьте файл .env.local');
  process.exit(1);
}

console.log('🔍 Проверка подключения к Supabase...');
console.log('URL:', SUPABASE_URL);
console.log('Key:', SUPABASE_KEY.substring(0, 20) + '...');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConnection() {
  try {
    // Попробуем проверить подключение через простой запрос
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log('\n⚠️  Подключение работает, но таблицы еще не созданы!');
        console.log('👉 Выполните SQL скрипт из scripts/001-create-tables.sql в Supabase SQL Editor\n');
        return false;
      } else if (error.message.includes('JWT') || error.message.includes('invalid')) {
        console.log('\n❌ Ошибка аутентификации!');
        console.log('Возможно, используется неправильный ключ.');
        console.log('Для клиентского приложения нужен anon public key (начинается с eyJ...), а не service role key.\n');
        return false;
      } else {
        console.log('\n❌ Ошибка:', error.message);
        return false;
      }
    } else {
      console.log('\n✅ Подключение работает! Таблицы созданы.\n');
      return true;
    }
  } catch (err) {
    console.log('\n❌ Ошибка подключения:', err.message);
    return false;
  }
}

checkConnection().then(success => {
  process.exit(success ? 0 : 1);
});
