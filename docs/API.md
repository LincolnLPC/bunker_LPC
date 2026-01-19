# API Документация - Бункер Онлайн

## Базовый URL

Все API endpoints находятся по адресу `/api/*`

## Аутентификация

Большинство endpoints требуют аутентификации через Supabase Auth. Токен передается автоматически через cookies.

## Rate Limiting

Все endpoints защищены rate limiting. При превышении лимита возвращается статус `429` с заголовками:
- `X-RateLimit-Limit` - максимальное количество запросов
- `X-RateLimit-Remaining` - оставшееся количество запросов
- `X-RateLimit-Reset` - время сброса лимита (Unix timestamp)

---

## Игровые комнаты

### Создание комнаты

**POST** `/api/game`

Создает новую игровую комнату.

**Request Body:**
```json
{
  "maxPlayers": 12,
  "roundTimerSeconds": 120,
  "catastrophe": "Ядерная война",
  "bunkerDescription": "Подземный бункер на 50 человек",
  "password": "optional_password",
  "isHidden": false,
  "settings": {
    "autoReveal": false,
    "spectators": true,
    "hostRole": "host_and_player",
    "roundMode": "automatic",
    "discussionTime": 120,
    "votingTime": 60,
    "excludeNonBinaryGender": false,
    "characteristics": {
      "gender": { "enabled": true },
      "age": { "enabled": true },
      "profession": { "enabled": true, "customList": ["Врач", "Инженер"] }
    }
  }
}
```

**Response:**
```json
{
  "room": {
    "id": "uuid",
    "room_code": "ABC123",
    "host_id": "uuid",
    "max_players": 12,
    "catastrophe": "Ядерная война",
    "bunker_description": "Подземный бункер",
    "phase": "waiting",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Status Codes:**
- `200` - Комната создана успешно
- `400` - Ошибка валидации
- `401` - Не авторизован
- `403` - Превышен лимит подписки
- `429` - Превышен rate limit

---

### Получение списка комнат

**GET** `/api/game/list`

Возвращает список доступных игровых комнат.

**Query Parameters:**
- `phase` - Фильтр по фазе: `waiting`, `playing`, `voting`, `results`
- `maxPlayers` - Фильтр по количеству игроков: `8`, `12`, `16`, `20`
- `search` - Поиск по коду комнаты (case-insensitive)
- `limit` - Количество результатов (по умолчанию: 50)
- `offset` - Смещение для пагинации (по умолчанию: 0)

**Response:**
```json
{
  "rooms": [
    {
      "id": "uuid",
      "room_code": "ABC123",
      "host_id": "uuid",
      "max_players": 12,
      "catastrophe": "Ядерная война",
      "bunker_description": "Подземный бункер",
      "phase": "waiting",
      "current_round": 0,
      "created_at": "2024-01-01T00:00:00Z",
      "profiles": {
        "username": "host_name",
        "display_name": "Host Name"
      },
      "game_players": [
        { "id": "uuid", "name": "Player 1", "is_eliminated": false }
      ],
      "player_count": 1
    }
  ],
  "total": 10
}
```

---

### Присоединение к игре

**POST** `/api/game/join`

Присоединяет пользователя к игровой комнате.

**Request Body:**
```json
{
  "roomCode": "ABC123",
  "password": "optional_password"
}
```

**Response:**
```json
{
  "room": {
    "id": "uuid",
    "room_code": "ABC123",
    "phase": "waiting"
  },
  "player": {
    "id": "uuid",
    "name": "Player Name"
  },
  "wasPlayer": false,
  "isSpectator": false
}
```

**Status Codes:**
- `200` - Успешно присоединился
- `400` - Неверный код комнаты или пароль
- `401` - Не авторизован
- `403` - Комната защищена паролем (`requiresPassword: true`)
- `404` - Комната не найдена
- `409` - Комната заполнена или игра уже началась

---

### Выход из игры

**POST** `/api/game/leave`

Покидает игровую комнату.

**Request Body:**
```json
{
  "roomId": "uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Старт игры

**POST** `/api/game/start`

Запускает игру (только для хоста).

**Request Body:**
```json
{
  "roomId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "room": {
    "phase": "playing",
    "current_round": 1
  }
}
```

**Status Codes:**
- `200` - Игра запущена
- `400` - Не все игроки готовы
- `403` - Не хост комнаты
- `404` - Комната не найдена

---

## Игровой процесс

### Голосование

**POST** `/api/game/vote`

Отправляет голос за исключение игрока.

**Request Body:**
```json
{
  "roomId": "uuid",
  "targetPlayerId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "vote": {
    "id": "uuid",
    "voter_id": "uuid",
    "target_id": "uuid",
    "round": 1
  }
}
```

---

### Получение результатов голосования

**GET** `/api/game/votes/results?roomId=uuid&round=1`

Возвращает результаты голосования для раунда.

**Response:**
```json
{
  "results": {
    "player_id_1": 3,
    "player_id_2": 1,
    "player_id_3": 0
  },
  "totalVotes": 4,
  "eliminatedPlayerId": "player_id_1"
}
```

---

### Исключение игрока

**POST** `/api/game/eliminate`

Исключает игрока из игры (автоматически после голосования или вручную хостом).

**Request Body:**
```json
{
  "roomId": "uuid",
  "playerId": "uuid"
}
```

---

### Раскрытие характеристики

**POST** `/api/game/characteristics/reveal`

Раскрывает характеристику игрока.

**Request Body:**
```json
{
  "roomId": "uuid",
  "characteristicId": "uuid"
}
```

---

### Обновление характеристики (хост)

**POST** `/api/game/characteristics/update`

Обновляет характеристику игрока (только для хоста).

**Request Body:**
```json
{
  "roomId": "uuid",
  "characteristicId": "uuid",
  "newValue": "Новое значение"
}
```

---

### Обмен характеристиками (хост)

**POST** `/api/game/characteristics/exchange`

Обменивает характеристики между игроками (только для хоста).

**Request Body:**
```json
{
  "roomId": "uuid",
  "characteristicId1": "uuid",
  "characteristicId2": "uuid"
}
```

---

## Чат

### Отправка сообщения

**POST** `/api/game/chat`

Отправляет сообщение в чат комнаты.

**Request Body:**
```json
{
  "roomId": "uuid",
  "message": "Текст сообщения"
}
```

**Response:**
```json
{
  "message": {
    "id": "uuid",
    "playerId": "uuid",
    "playerName": "Player Name",
    "message": "Текст сообщения",
    "type": "chat",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**Примечание:** Сообщения автоматически фильтруются на нецензурные слова и блокируются, если содержат ссылки или контакты.

---

## Профиль

### Проверка профиля

**GET** `/api/profile/check`

Проверяет существование профиля пользователя.

**Response:**
```json
{
  "exists": true,
  "profile": {
    "id": "uuid",
    "username": "username",
    "display_name": "Display Name",
    "subscription_tier": "basic"
  }
}
```

---

### Создание профиля

**POST** `/api/profile/create`

Создает профиль пользователя.

**Request Body:**
```json
{
  "username": "username",
  "display_name": "Display Name"
}
```

---

## Шаблоны игр (Премиум)

### Получение списка шаблонов

**GET** `/api/game-templates`

Возвращает список сохраненных шаблонов пользователя.

**Response:**
```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "Классическая игра",
      "description": "Стандартные настройки",
      "max_players": 12,
      "round_mode": "automatic",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `403` - Требуется премиум подписка

---

### Создание шаблона

**POST** `/api/game-templates`

Создает новый шаблон игры.

**Request Body:**
```json
{
  "name": "Классическая игра",
  "description": "Стандартные настройки",
  "maxPlayers": 12,
  "roundMode": "automatic",
  "discussionTime": 120,
  "votingTime": 60,
  "autoReveal": false,
  "spectators": true,
  "hostRole": "host_and_player",
  "catastrophe": "Ядерная война",
  "bunkerDescription": "Подземный бункер",
  "excludeNonBinaryGender": false,
  "characteristicsSettings": {},
  "customCharacteristics": {}
}
```

**Status Codes:**
- `403` - Требуется премиум подписка
- `409` - Шаблон с таким именем уже существует

---

### Удаление шаблона

**DELETE** `/api/game-templates/[id]`

Удаляет шаблон по ID.

**Response:**
```json
{
  "success": true
}
```

---

## Админ панель

### Получение списка комнат (админ)

**GET** `/api/admin/rooms`

Возвращает список всех комнат (только для админов).

**Query Parameters:**
- `phase` - Фильтр по фазе
- `limit` - Количество результатов
- `offset` - Смещение

---

### Удаление комнаты (админ)

**DELETE** `/api/admin/rooms?roomId=uuid`

Удаляет комнату (только для админов).

---

### Получение жалоб (админ)

**GET** `/api/admin/reports`

Возвращает список жалоб на игроков.

---

### Обновление статуса жалобы (админ)

**PATCH** `/api/admin/reports`

Обновляет статус жалобы.

**Request Body:**
```json
{
  "reportId": "uuid",
  "status": "resolved"
}
```

---

### Создание бана (админ)

**POST** `/api/admin/bans`

Создает бан пользователя.

**Request Body:**
```json
{
  "userId": "uuid",
  "reason": "Нарушение правил",
  "durationDays": 7
}
```

---

## Модерация

### Отправка жалобы

**POST** `/api/moderation/report`

Отправляет жалобу на игрока.

**Request Body:**
```json
{
  "roomId": "uuid",
  "reportedPlayerId": "uuid",
  "reason": "Оскорбления",
  "description": "Подробное описание"
}
```

---

### Проверка бана

**GET** `/api/moderation/check-ban`

Проверяет, забанен ли пользователь.

**Response:**
```json
{
  "isBanned": false,
  "ban": null
}
```

---

## Подписки

### Получение информации о подписке

**GET** `/api/subscription`

Возвращает информацию о текущей подписке пользователя.

**Response:**
```json
{
  "tier": "premium",
  "limits": {
    "maxRoomsPerDay": -1,
    "maxPlayersPerRoom": 20,
    "canCreateTemplates": true
  }
}
```

---

## Обработка ошибок

Все endpoints возвращают ошибки в следующем формате:

```json
{
  "error": "Описание ошибки",
  "errors": ["Дополнительные ошибки валидации"]
}
```

**Типичные статус коды:**
- `400` - Ошибка валидации или неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен (нет прав или превышен лимит)
- `404` - Ресурс не найден
- `409` - Конфликт (например, комната заполнена)
- `429` - Превышен rate limit
- `500` - Внутренняя ошибка сервера

---

## WebSocket / Realtime

Приложение использует Supabase Realtime для синхронизации в реальном времени. Подписки на изменения происходят автоматически через клиентские хуки.

**Таблицы с Realtime:**
- `game_rooms` - изменения состояния комнаты
- `game_players` - присоединение/выход игроков
- `chat_messages` - новые сообщения
- `player_characteristics` - раскрытие характеристик
- `votes` - голосование

---

**Последнее обновление:** 2025-01-17
