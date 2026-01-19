# Настройка Stripe для платежей

## Быстрый старт

### 1. Создайте Stripe аккаунт

1. Перейдите на https://dashboard.stripe.com/register
2. Зарегистрируйтесь или войдите в существующий аккаунт
3. Выберите режим "Test mode" для разработки

### 2. Получите API ключи

1. В Stripe Dashboard перейдите: **Developers → API keys**
2. Скопируйте:
   - **Secret key** (начинается с `sk_test_...` для тестирования)
   - **Publishable key** (начинается с `pk_test_...`, опционально для клиентской стороны)

### 3. Настройте переменные окружения

Откройте `.env.local` и добавьте:

```env
# Payment Provider
PAYMENT_PROVIDER=stripe

# Stripe Keys
PAYMENT_SECRET_KEY=sk_test_ваш_секретный_ключ
PAYMENT_API_KEY=pk_test_ваш_публичный_ключ  # Опционально

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Для разработки
# NEXT_PUBLIC_APP_URL=https://your-domain.com  # Для production

# Webhook Secret (получите после настройки webhook ниже)
PAYMENT_WEBHOOK_SECRET=whsec_...
```

### 4. Настройте Webhook

#### Вариант A: Локальная разработка (рекомендуется)

1. Установите Stripe CLI: https://stripe.com/docs/stripe-cli
2. Авторизуйтесь:
   ```bash
   stripe login
   ```
3. Запустите форвардинг webhook:
   ```bash
   stripe listen --forward-to localhost:3000/api/subscription/webhook
   ```
4. Скопируйте webhook secret (начинается с `whsec_...`) и добавьте в `.env.local`:
   ```env
   PAYMENT_WEBHOOK_SECRET=whsec_...
   ```

#### Вариант B: Production

1. В Stripe Dashboard перейдите: **Developers → Webhooks**
2. Нажмите **"Add endpoint"**
3. Укажите URL: `https://your-domain.com/api/subscription/webhook`
4. Выберите события для подписки:
   - `checkout.session.completed`
5. Скопируйте **Signing secret** и добавьте в `.env.local`:
   ```env
   PAYMENT_WEBHOOK_SECRET=whsec_...
   ```

### 5. Тестирование

1. Запустите приложение: `pnpm dev`
2. Перейдите на страницу подписки: `/subscription`
3. Выберите тарифный план
4. Используйте тестовую карту от Stripe:
   - **Успешная оплата**: `4242 4242 4242 4242`
   - **Отклоненная карта**: `4000 0000 0000 0002`
   - Любая дата истечения в будущем
   - Любой CVC (3 цифры)
   - Любой почтовый индекс

### 6. Проверка работы

После успешной оплаты:
1. Проверьте логи сервера - должно появиться `[Subscription Webhook] Verified event`
2. Проверьте Stripe Dashboard → Payments - должен появиться платеж
3. Проверьте профиль пользователя в приложении - `subscription_tier` должен стать `premium`

## Тарифные планы

Текущие планы определены в `lib/payment/config.ts`:
- **Премиум (месяц)**: 299₽
- **Премиум (год)**: 2,990₽ (≈249₽/месяц)

Для изменения цен отредактируйте `SUBSCRIPTION_PLANS` в `lib/payment/config.ts`.

## Переход в Production

1. **Переключитесь на Live mode** в Stripe Dashboard
2. **Получите Live ключи**:
   - `sk_live_...` вместо `sk_test_...`
   - `pk_live_...` вместо `pk_test_...`
3. **Обновите `.env.local`** с live ключами
4. **Настройте webhook для production URL**
5. **Убедитесь, что `NEXT_PUBLIC_APP_URL` указывает на production домен**

## Troubleshooting

### Webhook не работает
- Убедитесь, что `PAYMENT_WEBHOOK_SECRET` правильно настроен
- Проверьте логи сервера на ошибки
- Для локальной разработки используйте Stripe CLI

### Платеж успешен, но подписка не обновляется
- Проверьте логи webhook в Stripe Dashboard → Webhooks → выберите endpoint → View logs
- Убедитесь, что `service role client` имеет права на обновление `profiles`
- Проверьте, что в metadata checkout session есть `userId`

### Ошибка "Payment provider not configured"
- Убедитесь, что `PAYMENT_PROVIDER=stripe` в `.env.local`
- Проверьте, что `PAYMENT_SECRET_KEY` установлен
- Перезапустите dev сервер после изменения `.env.local`

## Дополнительные ресурсы

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Test Cards](https://stripe.com/docs/testing)
