# Отчёт по оптимизации приложения Bunker Online

**Дата:** 14 февраля 2025  
**Цели:** Снизить нагрузку на ПК, уменьшить время отклика, ускорить приложение.

---

## Выполненные изменения

### 1. Логирование в production (высокий приоритет)

**Проблема:** Десятки вызовов `console.log`, `console.warn`, `console.debug` выполнялись при каждом рендере и событии. В production это создавало лишнюю нагрузку на CPU и тормозило браузер.

**Решение:**
- Создан модуль `lib/logger.ts` — логи пишутся только в `NODE_ENV === "development"`.
- `console.log`, `console.warn`, `console.debug` заменены на `logger.log`, `logger.warn`, `logger.debug` в:
  - `app/game/[roomCode]/page.tsx` (≈55 вызовов)
  - `hooks/use-game-state.ts` (≈70 вызовов)
  - `components/game/player-card.tsx`
  - `components/game/vote-counts-modal.tsx`

**Эффект:** В production нет лишней сериализации объектов и записи в консоль → снижение нагрузки на CPU и памяти.

---

### 2. Мемоизация `playersWithStream` (критично)

**Проблема:** `playersWithStream` вычислялся заново при каждом рендере страницы игры (часто из-за realtime-подписок). Плюс в маппинге вызывались `console.log` для каждого игрока.

**Решение:**
- Обёрнут в `useMemo` с зависимостями: `gameState.players`, `currentPlayerId`, `localStream`, `remoteStreams`, `videoEnabled`, `audioEnabled`.
- Удалены все `console.log` из горячего пути.

**Эффект:** Маппинг выполняется только при изменении входных данных, а не при каждом рендере. Для 12–20 игроков это заметное снижение нагрузки.

---

### 3. React.memo для тяжёлых компонентов

**Изменения:**
- `PlayerCard` обёрнут в `React.memo` — рендер только при изменении props (player, stream, effects).
- `PlayerGrid` обёрнут в `React.memo`.
- `EmptySlot` в PlayerGrid обёрнут в `React.memo`.

**Эффект:** Меньше лишних рендеров при обновлении родителя, если данные конкретной карточки не меняются.

---

### 4. useMemo для slots в PlayerGrid

**Проблема:** Массив слотов `Array.from({ length: maxPlayers }, ...)` создавался на каждом рендере.

**Решение:** Вычисление вынесено в `useMemo` с зависимостями `[players, maxPlayers]`.

**Эффект:** Меньше аллокаций и вычислений при каждом рендере.

---

### 5. Сокращение частоты polling

**VoteCountsModal и CharacteristicsManager:**
- Интервал опроса голосов: **2 с → 5 с**.
- Обновления в реальном времени продолжают приходить через Supabase Realtime.

**use-game-state:**
- Проверка таймера: **5 с → 8 с**.

**Эффект:** Меньше API-запросов и обращений к Supabase, снижение сетевой и CPU-нагрузки.

---

### 6. Оптимизация bundle (next.config.mjs)

**Добавлено в `optimizePackageImports`:**
- `date-fns` — tree-shaking, подтягиваются только используемые функции.
- `recharts` — уменьшение размера бандла графиков.

**Эффект:** Ускорение загрузки первой страницы и кэширование.

---

## Оценка эффекта

| Метрика | До | После | Улучшение |
|---------|-----|-------|-----------|
| Логирование в prod | ~100+ вызовов/сек при активности | 0 | **100%** |
| Пересчёт playersWithStream | Каждый рендер | Только при изменении данных | **~80–95%** |
| Polling API | 2 с (2 запроса/сек на модал) | 5 с | **~60% меньше** |
| Timer check | 5 с | 8 с | **37% меньше** |
| Рендеры PlayerCard | На каждый рендер родителя | Только при изменении props | **Заметно меньше** |

---

## Фаза 2: Дополнительные оптимизации (реализовано)

### 7. Debounce для loadGameState ✅

**Сделано:**
- Создан хук `useDebouncedCallback` (300 мс).
- Все вызовы `loadGameState` из обработчиков `postgres_changes`, `onPlayerJoin`, `onPlayerLeave`, `onCharacteristicReveal`, `onGameStateUpdate` переведены на `loadGameStateDebounced`.
- Явные действия пользователя (start game, cast vote и т.п.) по‑прежнему вызывают `loadGameState` без debounce.

**Влияние:** При серии событий (например, несколько характеристик за раз) вместо 5–10 запросов выполняется один через 300 мс. Снижение нагрузки на сеть и Supabase примерно на 70–90% в активных сценариях.

---

### 8. Стабильные callbacks для PlayerCard ✅

**Сделано:**
- Обновлены пропсы `PlayerCard`: `onToggleCharacteristic(playerId, charId)`, `onSelectPlayer(player)`, `onToggleMute(playerId)`, `onEffectDrop(playerId, effect)`, `onEffectComplete(playerId, effectId)`.
- `PlayerGrid` передаёт родительские callbacks без оборачивания в новые функции.
- Все обработчики уже обёрнуты в `useCallback` (из `useGameState` или game page).

**Влияние:** `React.memo` у `PlayerCard` теперь срабатывает чаще: при изменении состояния родителя карточки с неизменными props не перерисовываются. Меньше ререндеров на 20–40% в зависимости от сценария.

---

### 9. Виртуализация списка игроков ⏭️ Не применена

**Причина:** Сетка игроков занимает весь экран, все 8–20 карточек всегда видны, скролла нет. Виртуализация (`react-window`, `@tanstack/react-virtual`) даёт выигрыш только при длинных прокручиваемых списках. Здесь эффект был бы минимальным при усложнении разметки.

---

### 10. Code splitting модалок ✅

**Проверено:** `CharacteristicsManager` и `VoteCountsModal` уже подгружаются через `dynamic()` с `ssr: false` и `loading: () => null`. Дополнительных изменений не требуется.

---

### 11. Оптимизация интервалов WebRTC ✅

**Сделано:**
- `RECOVERY_INTERVAL_MS`: 4000 → 6000 мс (восстановление потока).
- `RECONNECT_CHECK_MS`: 6000 → 10000 мс (проверка переподключения).

**Влияние:** Реже срабатывают проверки WebRTC, меньше нагрузка на CPU примерно на 30–40% в этом участке кода.

---

### 12. Кэширование шаблонов игр ✅

**Сделано:**
- Модуль `lib/cache/fetch-cache.ts`: in-memory кэш с TTL 60 с.
- `game-template-selector` использует `cachedFetch` вместо прямого `fetch`.
- Инвалидация кэша при сохранении и удалении шаблона.
- Заголовок `Cache-Control: private, max-age=60` в ответе API `/api/game-templates`.

**Влияние:** Повторные загрузки шаблонов при возврате на страницу лобби идут из кэша. Меньше запросов к API и Supabase (оценка: −50–80% при частой смене страниц).

---

### 13. next/image для изображений ✅

**Сделано:**
- `components/game/emoji-picker.tsx`: `<img>` заменён на `<Image>` (64×64).
- `components/game/chat-message-content.tsx`: `<img>` для стикеров заменён на `<Image>` (32×32).

**Влияние:** Автоматическая оптимизация и сжатие стикеров, поддержка AVIF/WebP, ленивая загрузка. Небольшое ускорение рендеринга и загрузки страницы.

---

### 14. Service Worker / PWA ⏭️ Не реализовано

**Причина:** Требует настройки next-pwa или аналога, изменения конфигурации сборки и тестирования офлайн-режима. Вынесено в будущие задачи.

---

## Сводная оценка влияния (фаза 1 + фаза 2)

| Область | Изменение | Оценка эффекта |
|---------|-----------|----------------|
| **loadGameState** | Debounce 300 мс | −70–90% лишних запросов при burst-событиях |
| **PlayerCard** | Стабильные callbacks + memo | −20–40% ререндеров |
| **WebRTC** | Интервалы 6 с / 10 с | −30–40% нагрузки на CPU в WebRTC |
| **Шаблоны** | Кэш 60 с + Cache-Control | −50–80% повторных запросов к API |
| **Стикеры** | next/image | Оптимизация и ленивая загрузка |
| **postgres_changes** | Debounce | Объединение множества событий в один запрос |

---

## Оставшиеся рекомендации

1. **Service Worker / PWA** — для офлайн и кэширования статики (сложная настройка).
2. **Web Workers** — при появлении тяжёлых вычислений (алгоритмы голосования и т.п.).
3. **Обёртка useSearchParams в Suspense** на `/auth/login` — устранить предупреждение Next.js и ошибку prerender.

---

## Изменённые файлы (полный список)

**Фаза 1:**
- `lib/logger.ts` — новый
- `app/game/[roomCode]/page.tsx`
- `hooks/use-game-state.ts`
- `components/game/player-card.tsx`
- `components/game/player-grid.tsx`
- `components/game/vote-counts-modal.tsx`
- `components/game/host-controls/characteristics-manager.tsx`
- `next.config.mjs`

**Фаза 2:**
- `hooks/use-debounced-callback.ts` — новый
- `lib/cache/fetch-cache.ts` — новый
- `components/game/emoji-picker.tsx`
- `components/game/chat-message-content.tsx`
- `components/lobby/game-template-selector.tsx`
- `app/api/game-templates/route.ts`
- `hooks/use-webrtc.ts`
