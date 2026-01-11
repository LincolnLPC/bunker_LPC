# Интеграция платежной системы

## Статус

✅ **Базовая структура готова** - API endpoints созданы и готовы к подключению платежных провайдеров.

## Созданные файлы

1. **`app/api/subscription/route.ts`**
   - GET: получение информации о подписке пользователя
   - POST: обновление подписки (для внутреннего использования)

2. **`app/api/subscription/webhook/route.ts`**
   - POST: webhook endpoint для обработки событий от платежных провайдеров
   - Готов для интеграции со Stripe или ЮKassa

3. **`lib/payment/config.ts`**
   - Конфигурация платежных провайдеров
   - Определение тарифных планов
   - Утилиты для работы с платежами

## Следующие шаги для интеграции

### Для Stripe:

1. Установить Stripe SDK:
```bash
pnpm add stripe @stripe/stripe-js
```

2. Добавить в `.env.local`:
```env
PAYMENT_PROVIDER=stripe
PAYMENT_API_KEY=pk_test_...
PAYMENT_SECRET_KEY=sk_test_...
PAYMENT_WEBHOOK_SECRET=whsec_...
```

3. Создать API endpoint для создания платежной сессии:
   - `app/api/payment/create-session/route.ts`
   - Использовать `stripe.checkout.sessions.create()`

4. Реализовать обработку событий в `app/api/subscription/webhook/route.ts`:
   - `checkout.session.completed` - успешная оплата
   - `customer.subscription.updated` - обновление подписки
   - `customer.subscription.deleted` - отмена подписки

5. Настроить webhook в Stripe Dashboard:
   - URL: `https://your-domain.com/api/subscription/webhook`
   - События: `checkout.session.completed`, `customer.subscription.*`

### Для ЮKassa:

1. Установить ЮKassa SDK:
```bash
pnpm add @yookassa/sdk
```

2. Добавить в `.env.local`:
```env
PAYMENT_PROVIDER=yookassa
PAYMENT_SECRET_KEY=live_... или test_...
PAYMENT_SHOP_ID=your_shop_id
PAYMENT_WEBHOOK_SECRET=...
```

3. Создать API endpoint для создания платежа:
   - `app/api/payment/create-payment/route.ts`
   - Использовать ЮKassa API для создания платежа

4. Реализовать обработку событий в `app/api/subscription/webhook/route.ts`:
   - `payment.succeeded` - успешная оплата
   - `payment.canceled` - отмена оплаты

5. Настроить webhook в ЮKassa личном кабинете:
   - URL: `https://your-domain.com/api/subscription/webhook`
   - События: `payment.succeeded`, `payment.canceled`

## Структура базы данных

Подписки хранятся в таблице `profiles`:
- `subscription_tier` - "basic" | "premium"
- `subscription_status` - "active" | "expired" | "cancelled" | "pending"
- `subscription_expires_at` - дата истечения подписки (для временных подписок)

## Тарифные планы

Определены в `lib/payment/config.ts`:
- `premium_monthly` - Премиум на месяц (299₽)
- `premium_yearly` - Премиум на год (2990₽)

## Безопасность

⚠️ **ВАЖНО**: Перед запуском в production необходимо:
1. Реализовать проверку подписи webhook в `verifyWebhookSignature()`
2. Проверять, что webhook действительно пришел от платежного провайдера
3. Никогда не доверять данным от клиента без проверки

## Тестирование

Для тестирования можно использовать:
- **Stripe**: Test mode с тестовыми картами
- **ЮKassa**: Sandbox режим для тестирования

## Документация

- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [ЮKassa Webhooks](https://yookassa.ru/developers/using-api/webhooks)
