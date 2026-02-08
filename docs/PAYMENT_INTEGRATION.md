# Интеграция платежной системы (Yandex Pay)

## Статус

✅ **Интеграция Yandex Pay реализована** — оплата подписки только через Yandex Pay.

### Реализовано
- API endpoint для создания заказов (`/api/payment/create-session`)
- Webhook endpoint для обработки событий (`/v1/webhook`)
- Страница подписки с выбором тарифных планов
- Автоматическое обновление подписки после успешной оплаты
- Редирект на страницу Yandex Pay для оплаты

## Структура файлов

1. **`lib/payment/config.ts`**
   - Конфигурация Yandex Pay
   - Тарифные планы
   - `encodeOrderMetadata` / `decodeOrderMetadata` для передачи данных в orderId

2. **`app/api/payment/create-session/route.ts`**
   - POST: создание заказа через Yandex Pay API
   - Возвращает `paymentUrl` для редиректа

3. **`app/v1/webhook/route.ts`**
   - POST: webhook Yandex Pay (событие `ORDER_STATUS_UPDATED`)
   - При `paymentStatus === "CAPTURED"` обновляет подписку в `profiles`

4. **`app/subscription/page.tsx`**
   - Страница выбора тарифа и оформления подписки

## Настройка Yandex Pay

### 1. Регистрация
1. Зайдите на https://console.pay.yandex.ru
2. Зарегистрируйте магазин и получите API-ключ и Merchant ID

### 2. Переменные окружения
Добавьте в `.env.local`:

```env
PAYMENT_PROVIDER=yandex-pay
YANDEX_PAY_API_KEY=your_api_key_here
NEXT_PUBLIC_YANDEX_PAY_MERCHANT_ID=your_merchant_id_here
YANDEX_PAY_SANDBOX=true   # false для production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Callback URL (Webhook)
В консоли Yandex Pay → Настройки → Callback URL укажите **базовый URL вашего приложения** без `/v1/webhook`:
- Production: `https://your-domain.com`
- Sandbox: по необходимости

Yandex Pay автоматически добавляет путь `/v1/webhook`, поэтому webhook будет вызываться по адресу:
`https://your-domain.com/v1/webhook`

### 4. Для локальной разработки
Используйте ngrok или подобный туннель:
1. `ngrok http 3000`
2. В Callback URL укажите: `https://ваш-ngrok-url.ngrok.io`

## Тарифные планы

Определены в `lib/payment/config.ts`:
- `premium_monthly` — Премиум на месяц (299₽)
- `premium_yearly` — Премиум на год (2990₽)

## Структура базы данных

Подписки хранятся в таблице `profiles`:
- `subscription_tier` — "basic" | "premium"
- `premium_expires_at` — дата истечения премиум подписки (TIMESTAMPTZ)
- `getUserSubscription()` в `lib/subscription/check.ts` проверяет срок действия

## Безопасность

1. Webhook принимает JWT в теле запроса (Content-Type: application/octet-stream)
2. `orderId` кодирует `userId`, `planId`, `expiresAt` — используется при обработке webhook
3. Service role client обновляет подписку (обходит RLS)
4. Для production рекомендуется добавить верификацию подписи JWT по документации Yandex Pay

## Документация

- [Yandex Pay для бизнеса](https://yandex.ru/dev/pay/doc/ru/)
- API заказов: `POST https://pay.yandex.ru/api/merchant/v1/orders` (prod) / `https://sandbox.pay.yandex.ru/...` (sandbox)
