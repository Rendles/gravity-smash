# Gravity Smash

`Gravity Smash` — браузерная физическая puzzle-игра на `React + TypeScript + Vite + Matter.js`. Игрок уничтожает падающие фигуры в стакане, использует способности, зарабатывает монеты, покупает постоянные улучшения и проходит уровни в двух разных режимах.

Игровая документация для игроков вынесена в [README.players.md](README.players.md).

## Что есть в проекте
- 2 игровых режима: аркадный и пошаговый
- физика через `Matter.js`
- canvas-рендер с собственными визуальными эффектами
- локальное сохранение прогресса через `IndexedDB`
- программный звук через Web Audio API
- магазин постоянных улучшений между уровнями

## Стек
- `React 18`
- `TypeScript`
- `Vite`
- `Matter.js`
- `npm`

## Быстрый старт
```bash
npm install
npm run dev
```

## Команды
- `npm run dev` — локальный dev-сервер Vite
- `npm run build` — production build с проверкой TypeScript
- `npm run build:release` — release-сборка через `vite.config.mjs --mode release`
- `npm run preview` — локальный просмотр собранной версии

## Структура репозитория
```text
Acutal/
|-- src/
|   |-- App.tsx
|   |-- main.tsx
|   |-- audio/
|   |   `-- GameAudio.ts
|   |-- game/
|   |   |-- config.ts
|   |   |-- economy.ts
|   |   |-- GravitySmashGame.ts
|   |   |-- level.ts
|   |   |-- rendering.ts
|   |   |-- types.ts
|   |   |-- ui.ts
|   |   `-- GravitySmashGame/
|   |       |-- matching.ts
|   |       |-- pieceFactory.ts
|   |       |-- progress.ts
|   |       |-- specials.ts
|   |       `-- turnBased.ts
|   |-- storage/
|   |   `-- progressStore.ts
|   `-- styles/
|       `-- game.css
|-- index.html
|-- package.json
|-- tsconfig.json
|-- vite.config.mjs
`-- vite.config.ts
```

## Архитектура

### React-слой
[src/App.tsx](src/App.tsx) связывает интерфейс и игровой контроллер. Здесь находятся:
- главное меню
- запуск нужного режима
- HUD и overlay-окна
- кнопка паузы
- кнопки способностей
- экран победы и магазин улучшений
- инициализация и уничтожение экземпляра `GravitySmashGame`
- загрузка и сохранение прогресса

`App.tsx` не должен брать на себя физику, спавн, матчи или правила уровней.

### Игровой контроллер
[src/game/GravitySmashGame.ts](src/game/GravitySmashGame.ts) — главный runtime-класс игры. Он отвечает за:
- запуск уровня
- связывание Matter.js engine/runner/render
- обработку кликов по фигурам
- матчи
- спавн
- победу и поражение
- способности
- прогресс уровня
- начисление монет
- применение постоянных улучшений

Это главный контракт между React-слоем и ядром игры. Его публичный API нужно менять осторожно.

### Внутренние модули игрового ядра
Папка [src/game/GravitySmashGame](src/game/GravitySmashGame) хранит вспомогательную логику игрового контроллера:
- [matching.ts](src/game/GravitySmashGame/matching.ts) — цепочки фигур одного цвета или символа
- [pieceFactory.ts](src/game/GravitySmashGame/pieceFactory.ts) — создание тел фигур
- [progress.ts](src/game/GravitySmashGame/progress.ts) — прогресс и переходы по уровням
- [specials.ts](src/game/GravitySmashGame/specials.ts) — расчеты для бомб, color destroyer и способностей
- [turnBased.ts](src/game/GravitySmashGame/turnBased.ts) — правила пошагового режима

### Баланс и конфиг
[src/game/config.ts](src/game/config.ts) — источник игровых констант:
- физика
- вероятности спавна
- progression
- цены способностей
- награды за фигуры
- параметры аркадного и пошагового режима

[src/game/level.ts](src/game/level.ts) строит `LevelSettings` для конкретного уровня на основе `config.ts`.

### Экономика
[src/game/economy.ts](src/game/economy.ts) отвечает за:
- монеты
- награды за уничтожение фигур
- уровни апгрейдов
- расчет стоимости следующего улучшения
- расчет бонусов апгрейдов
- каталог магазина между уровнями

### Сохранение
[src/storage/progressStore.ts](src/storage/progressStore.ts) хранит прогресс в `IndexedDB`.

Сейчас сохраняются:
- уровень для продолжения
- максимальный открытый уровень
- монеты
- уровни постоянных улучшений

Отдельно настройка звука хранится через `localStorage` в UI-слое.

### Звук
[src/audio/GameAudio.ts](src/audio/GameAudio.ts) генерирует звук программно через Web Audio API:
- музыку меню
- звук уничтожения фигур
- звуки способностей
- звук победы
- звук поражения

Внешних аудиофайлов в проекте сейчас нет.

## Текущая игровая модель

### Аркадный режим
- фигуры падают постоянно
- сложность растет за счет ускорения и волн
- цель уровня: уничтожить заданное количество фигур
- проигрыш происходит, если фигуры слишком долго держатся выше красной линии

### Пошаговый режим
- уровень начинается с уже частично заполненного стакана
- после успешного действия игрока падают новые фигуры
- цель уровня: уничтожить обычные фигуры или спецфигуры
- если нет доступных матчей, игра перераспределяет цвета и символы до появления валидного хода
- проигрыш происходит только после пересечения красной линии и неудачной попытки исправить ситуацию следующим ходом

## Подтвержденные игровые сущности
- обычные цветные фигуры
- белые фигуры с символами `+`, `A`, `M`, `T`
- `bomb`
- `colorDestroyer`
- способности `freeze`, `fire`, `spectrum`

Подробное описание того, как они работают для игрока, находится в [README.players.md](README.players.md).

## Постоянные улучшения
Между уровнями игрок может покупать 3 постоянных улучшения:
- усиление радиуса взрыва бомбы
- усиление высоты поджигания снизу
- усиление длительности заморозки

Текущая модель цен в [src/game/economy.ts](src/game/economy.ts):
- базовая цена каждого улучшения: `100 Coin`
- каждая следующая покупка стоит на `10%` дороже
- цена округляется вверх

## Что обычно меняется вместе
- Если меняется структура сохранения: [src/game/types.ts](src/game/types.ts), [src/game/economy.ts](src/game/economy.ts), [src/storage/progressStore.ts](src/storage/progressStore.ts)
- Если добавляется новая фигура: [src/game/types.ts](src/game/types.ts), [src/game/config.ts](src/game/config.ts), [src/game/GravitySmashGame/pieceFactory.ts](src/game/GravitySmashGame/pieceFactory.ts), [src/game/GravitySmashGame.ts](src/game/GravitySmashGame.ts), [src/game/GravitySmashGame/specials.ts](src/game/GravitySmashGame/specials.ts) или [src/game/GravitySmashGame/matching.ts](src/game/GravitySmashGame/matching.ts), [src/game/rendering.ts](src/game/rendering.ts)
- Если меняется UI/HUD/overlay: [src/App.tsx](src/App.tsx), [src/game/ui.ts](src/game/ui.ts), [src/styles/game.css](src/styles/game.css)
- Если меняется логика уровня или режима: [src/game/config.ts](src/game/config.ts), [src/game/level.ts](src/game/level.ts), [src/game/GravitySmashGame.ts](src/game/GravitySmashGame.ts), [src/game/GravitySmashGame/turnBased.ts](src/game/GravitySmashGame/turnBased.ts)

## Что особенно важно не ломать
- публичный контракт между `App.tsx` и `GravitySmashGame`
- совместимость снапшота прогресса
- различия между аркадным и пошаговым режимом
- матчинг обычных фигур по цвету
- матчинг фигур с символами по символу
- особые комбо `colorDestroyer + colorDestroyer` и `colorDestroyer + bomb`

## Что не удалось подтвердить по репозиторию
На текущий момент в проекте не обнаружены:
- backend
- env-файлы
- CI
- Docker
- тестовый раннер
- eslint/prettier-конфиги

Если эти подсистемы появятся позже, README стоит расширить отдельно.

