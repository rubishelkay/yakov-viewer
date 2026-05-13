# Yakov Viewer / Яков Ювер — Master Brief для Codex

**Дата брифа:** 12 мая 2026  
**Язык проекта:** можно писать код и названия файлов на английском, но пользовательский контекст и часть текстов сайта — на русском/английском по решению владельца.  
**Главная задача:** превратить старую идею сервиса отбора фотографий в красивый, быстрый, долговечный сайт-портфолио для плёночных и цифровых фотографий.

---

## 0. Как использовать этот файл в Codex

Этот файл нужно приложить к разговору с Codex как главный контекст проекта. Codex должен прочитать его перед тем, как предлагать архитектуру или писать код.

**Не начинать сразу с кода. Сначала:**

1. Войти в режим планирования (`/plan`, если доступен).
2. Осмотреть текущий репозиторий: структуру, стек, package manager, наличие `README`, `AGENTS.md`, `wrangler.toml`, `astro.config.*`, `next.config.*`, `src/`, `public/`, `data/`.
3. Сформировать план работ с этапами, рисками, решениями и критериями готовности.
4. Обсудить только действительно блокирующие вопросы. Всё, что можно разумно предположить, нужно предположить и зафиксировать.
5. После согласования/принятия плана реализовывать маленькими проверяемыми шагами.
6. В конце каждого значимого шага запускать проверки: форматирование, lint, typecheck, build, хотя бы базовую проверку маршрутов/страниц.

**Очень важно:** этот файл — не просто “описание идеи”. Это продуктовый, дизайнерский и технический контракт. Он нужен, чтобы Codex не сделал случайную галерею, а построил именно аккуратный, быстрый, премиальный сайт-портфолио с правильной архитектурой хранения и отображения фотографий.

---

## 1. Короткое резюме проекта

**Yakov Viewer / Яков Ювер / Яков Вьювер** — публичный сайт-портфолио фотографий.

Изначально проект рос из идеи **Logjamming** — приватного сервиса для отбора фотографий, где можно было просматривать кадры, лайкать/отклонять, ставить рейтинги, делать заметки, работать с плёнками и JSON-манифестами. Сейчас фокус меняется: **не сервис отбора, а публичная витрина**.

Текущая версия должна быть:

- минималистичной;
- визуально дорогой;
- очень быстрой;
- статической или почти статической;
- размещённой на Cloudflare;
- рассчитанной на тысячи фотографий;
- удобной для дальнейшего пополнения;
- с high-quality оригиналами в хранилище и быстрыми оптимизированными версиями на сайте;
- с дизайном в духе Apple + Spotify: чёрно-белая основа, большие радиусы, мягкие поверхности, системная тема, фокус на контенте, а не на интерфейсе.

Планируемый объём контента:

- около **100 плёнок**;
- примерно **36 кадров на плёнку**;
- итого около **3 600 плёночных фотографий**;
- плюс около **1 000 цифровых фотографий**;
- общий ориентир: **4 500–5 000 фотографий**.

---

## 2. Что известно из предыдущего контекста

### 2.1. Logjamming — очень коротко

**Logjamming** — это прежнее рабочее название/направление приватного инструмента для отбора и ревью фотографий.

Ключевая идея Logjamming:

- загрузить/описать плёнки и фотографии через JSON;
- смотреть фото в fullscreen;
- быстро принимать решения: like/nope, swipe, rating;
- делать заметки;
- видеть список плёнок и сетку кадров;
- хранить решения локально, например в `localStorage`;
- готовить curated selection, то есть отобранные кадры для публичного показа.

Logjamming не нужно выбрасывать из памяти проекта. Его можно оставить как **будущий приватный backstage-инструмент**, но сейчас он не является главным публичным продуктом.

### 2.2. Yakov Viewer / Yakov Yuver / Yakov Shmol

В прошлой логике рядом с Logjamming существовал публичный слой: **Yakov Shmol / Yakov Viewer** — минималистичная публичная галерея/портфолио.

Текущий пользовательский поворот:

- не строить “сервис отбора” как основной продукт;
- сделать **личный сайт-портфолио**;
- красиво разместить большое количество плёночных и цифровых фотографий;
- хранить high-quality файлы;
- быстро показывать оптимизированные версии;
- разместить всё на Cloudflare;
- сделать проект достойным, современным и технически правильным.

### 2.3. Алиасы названия

В разговоре встречаются разные варианты:

- Yakov Viewer
- Яков Вьювер
- Yakov Yuver
- Яков Ювер
- Yakov Shmol
- Logjamming

**Для Codex:** считать, что это связанные сущности одного проекта.  
**Текущий публичный продукт:** `Yakov Viewer` / `Yakov Yuver`, если владелец не выберет другое финальное название.

---

## 3. Главная продуктовая формулировка

Сайт должен ощущаться не как “папка с фотками”, а как **архив автора**.

Это личное фото-портфолио, где:

- плёнки — это важная единица структуры;
- цифровые фотографии — отдельный, но равноправный архив;
- каждая фотография может существовать как самостоятельная работа;
- главная ценность — сами изображения;
- интерфейс должен исчезать, но оставаться удобным;
- сайт должен быть быстрым даже на мобильном;
- пользователь должен легко проваливаться из общего архива в конкретную серию, плёнку или кадр;
- владелец должен легко добавлять новые плёнки и фотографии без переписывания сайта.

---

## 4. Нефункциональные цели

### 4.1. Красота

Сайт должен выглядеть как современный премиальный продукт:

- много воздуха;
- аккуратная сетка;
- почти невидимые, но приятные micro-interactions;
- большие скругления;
- чистая типографика;
- строгая чёрно-белая база;
- адаптация под светлую/тёмную системную тему;
- возможность ручного переключателя темы;
- фото всегда важнее UI.

### 4.2. Скорость

Нельзя показывать оригиналы в сетке. Нужны:

- responsive images;
- `srcset`/`sizes`;
- lazy loading;
- preloading/fetchpriority только для ключевых hero-изображений;
- маленькие placeholder-версии;
- кеширование через Cloudflare;
- минимальный JS;
- статическая генерация страниц, где возможно.

### 4.3. Долговечность

Проект должен пережить смену фреймворка и не стать хаосом.

Поэтому:

- фото-данные должны быть в понятных JSON/Markdown/Content Collection структурах;
- исходные изображения должны лежать отдельно от кода;
- генерация манифестов должна быть скриптом;
- дизайн-система должна быть через токены, а не случайные CSS-магические числа;
- Cloudflare-настройки нужно документировать.

### 4.4. Простота поддержки

Владелец проекта должен суметь:

- добавить новую плёнку;
- добавить цифровую серию;
- поменять title/description/tags;
- выбрать featured-кадры;
- скрыть кадр из публичного показа;
- обновить сайт через GitHub/Cloudflare Pages;
- не трогать сложный backend.

---

## 5. Что не нужно делать на первом этапе

На первом этапе не строить:

- социальную сеть;
- лайки посетителей;
- комментарии;
- публичные аккаунты;
- сложный backend admin;
- оплату;
- marketplace;
- e-commerce;
- ML-рекомендации;
- приватные пользовательские кабинеты;
- тяжелую CMS;
- сложную базу данных, если JSON/Content Collections достаточно.

Можно оставить архитектурные точки расширения, но не перегружать MVP.

---

## 6. Рекомендованный стек

### 6.1. Предпочтительный вариант: Astro + TypeScript

Для такого проекта лучше всего подходит static-first подход.

**Почему Astro хорошо подходит:**

- сайт контентный, а не сложное приложение;
- большинство страниц можно генерировать заранее;
- интерактивность нужна точечно: фильтры, lightbox, fullscreen, keyboard navigation;
- Astro позволяет рендерить большую часть сайта в HTML и подключать JavaScript только как “острова” интерактивности;
- Content Collections подходят для статичных данных, которые можно валидировать и использовать на build-time.

**Рекомендация:** если репозиторий ещё не закреплён за Next.js или другим стеком, выбрать **Astro + TypeScript**.

### 6.2. Альтернатива: Next.js static export

Если проект уже начат на Next.js, можно остаться на Next.js, но:

- использовать static export там, где возможно;
- не усложнять SSR;
- избегать server-only фич, если сайт должен быть простым на Cloudflare Pages;
- отдельно продумать image optimization, потому что стандартный Next image pipeline может конфликтовать со static export/Cloudflare-стратегией.

### 6.3. CSS

Рекомендация:

- CSS variables / design tokens;
- можно Tailwind, но не обязательно;
- если Tailwind используется, всё равно создать слой design tokens;
- важнее не “модный CSS-фреймворк”, а единая система отступов, радиусов, поверхностей, цвета и motion.

### 6.4. JavaScript

Минимизировать.

Нужный JS:

- fullscreen/lightbox;
- клавиатурная навигация;
- фильтры/поиск;
- переключатель темы;
- maybe command palette;
- сохранение состояния фильтра/темы;
- progressive enhancement.

Не нужен JS:

- для обычного отображения сетки;
- для базовых страниц;
- для статичных описаний;
- для навигации, если можно сделать обычными ссылками.

---

## 7. Cloudflare-архитектура

Пользователь сказал “CloudFlyer”; в техническом плане предполагается **Cloudflare**.

### 7.1. Cloudflare Pages

Использовать Cloudflare Pages для фронтенда:

- GitHub repo → Cloudflare Pages;
- preview deployments для веток/PR;
- production deployment из `main` или `master`;
- build command: зависит от стека;
- output directory: например `dist` для Astro.

### 7.2. Cloudflare R2

Использовать R2 для хранения оригиналов и/или исходных high-quality файлов:

- bucket для публичных optimized/original assets;
- возможно отдельный bucket для private originals/backups;
- кастомный домен для production, например `assets.example.com`;
- не использовать `r2.dev` как production CDN;
- включить кеширование через custom domain.

### 7.3. Cloudflare Images / Image Transformations

Варианты:

**Вариант A — R2 + Cloudflare Image Transformations**

- хранить оригиналы в R2;
- генерировать оптимизированные версии на лету через Cloudflare;
- использовать `/cdn-cgi/image/<OPTIONS>/<SOURCE-IMAGE>`;
- внимательно считать unique transformations;
- не создавать слишком много случайных размеров;
- использовать фиксированный набор размеров.

**Вариант B — build-time/pre-upload variants**

- локально или скриптом создать варианты: `480`, `800`, `1200`, `1600`, `2400`;
- загрузить варианты в R2;
- сайт использует готовые URLs;
- меньше непредсказуемых transformation bills;
- больше места в хранилище;
- проще контролировать качество.

**Рекомендация для старта:**  
Сделать архитектуру так, чтобы можно было выбрать оба режима:

- `imageStrategy: "cloudflare-transform"`  
или
- `imageStrategy: "prebuilt-variants"`

На MVP можно начать с Cloudflare Transformations и фиксированного набора размеров. Для большого архива и полного контроля можно позже перейти на prebuilt variants.

### 7.4. Пример доменной схемы

```txt
yakov.example.com              # сайт
assets.yakov.example.com       # R2 custom domain для изображений
```

Пример URL оригинала:

```txt
https://assets.yakov.example.com/film/0001/original/001.jpg
```

Пример transformed URL:

```txt
https://yakov.example.com/cdn-cgi/image/width=1200,format=auto,quality=85/https://assets.yakov.example.com/film/0001/original/001.jpg
```

Пример prebuilt variants:

```txt
https://assets.yakov.example.com/film/0001/variants/001-w480.avif
https://assets.yakov.example.com/film/0001/variants/001-w1200.avif
https://assets.yakov.example.com/film/0001/original/001.jpg
```

---

## 8. Контентная структура сайта

### 8.1. Основные разделы

1. **Home**
   - hero;
   - короткое описание;
   - featured фотографии;
   - последние плёнки;
   - лучшие серии;
   - входы в `Films`, `Digital`, `Archive`.

2. **Films**
   - список 100 плёнок;
   - каждая плёнка как отдельный объект;
   - cover image;
   - год/месяц, камера, плёнка, место, количество кадров;
   - фильтры по году, плёнке, камере, тегам.

3. **Film detail**
   - title: `Film 001`, либо осмысленное имя;
   - metadata;
   - grid из 36 кадров;
   - narrative note;
   - next/previous film;
   - fullscreen/lightbox.

4. **Digital**
   - цифровые фотографии;
   - можно группировать по сериям/годам/местам;
   - не обязательно привязывать к “плёнке”.

5. **Collections / Series**
   - curated подборки;
   - например: `Bangkok`, `Night`, `Portraits`, `Streets`, `Contact Sheets`, `Best of 2024`.

6. **Archive**
   - полный архив;
   - плотная сетка;
   - фильтры;
   - поиск;
   - быстрый доступ.

7. **Photo page**
   - отдельная страница кадра;
   - крупное изображение;
   - metadata;
   - описание/заметка;
   - Open Graph;
   - next/previous внутри контекста.

8. **About**
   - кто автор;
   - statement;
   - контакты;
   - links.

9. **Contact / Uses**
   - email/social links;
   - краткие правила использования изображений;
   - licensing note, если нужно.

### 8.2. Не все 4 600 фото должны быть одинаково заметными

Нужна иерархия:

- `featured` — главные кадры;
- `published` — публичные;
- `hidden` — не показывать;
- `draft` — в данных, но не на сайте;
- `archiveOnly` — показывать в архиве, но не в главных подборках;
- `heroCandidate` — можно использовать в hero;
- `coverCandidate` — можно использовать как cover плёнки/серии.

---

## 9. Данные и манифесты

### 9.1. Film schema

Пример:

```json
{
  "id": "film-0001",
  "slug": "film-0001-bangkok-night",
  "type": "film",
  "title": "Film 001 — Bangkok Night",
  "shortTitle": "Film 001",
  "description": "Night walks, reflections, neon, quiet streets.",
  "dateStart": "2024-11-03",
  "dateEnd": "2024-11-08",
  "year": 2024,
  "location": {
    "city": "Bangkok",
    "country": "Thailand",
    "showExact": false
  },
  "camera": "Leica M6",
  "lens": "35mm",
  "filmStock": "Kodak Portra 400",
  "iso": 400,
  "development": "Lab name or self-developed",
  "scan": {
    "scanner": "Frontier",
    "lab": "Lab name",
    "notes": "Optional"
  },
  "coverImageId": "film-0001-001",
  "tags": ["night", "street", "bangkok", "color"],
  "visibility": "published",
  "order": 1,
  "notes": "Private/internal notes can be separated from public description."
}
```

### 9.2. Image schema

Пример:

```json
{
  "id": "film-0001-001",
  "slug": "film-0001-001",
  "sourceType": "film",
  "filmId": "film-0001",
  "frameNumber": 1,
  "title": "Untitled",
  "description": "",
  "alt": "Night street in Bangkok with neon reflections.",
  "visibility": "published",
  "featured": true,
  "archiveOnly": false,
  "dateTaken": "2024-11-03",
  "location": {
    "city": "Bangkok",
    "country": "Thailand",
    "showExact": false
  },
  "camera": "Leica M6",
  "lens": "35mm",
  "filmStock": "Kodak Portra 400",
  "tags": ["night", "street", "neon"],
  "aspectRatio": 1.5,
  "width": 6048,
  "height": 4024,
  "dominantColor": "#1b1b1b",
  "blurData": "optional-lqip-or-blurhash",
  "r2": {
    "originalKey": "film/0001/original/001.jpg",
    "assetBaseUrl": "https://assets.example.com",
    "variants": {
      "480": "film/0001/variants/001-w480.avif",
      "800": "film/0001/variants/001-w800.avif",
      "1200": "film/0001/variants/001-w1200.avif",
      "1600": "film/0001/variants/001-w1600.avif",
      "2400": "film/0001/variants/001-w2400.avif"
    }
  },
  "rights": {
    "copyright": "© Yakov",
    "downloadAllowed": false
  }
}
```

### 9.3. Collection schema

```json
{
  "id": "collection-night",
  "slug": "night",
  "title": "Night",
  "description": "A selection of night photographs across film and digital work.",
  "coverImageId": "film-0001-001",
  "imageIds": ["film-0001-001", "digital-2024-008"],
  "tags": ["night"],
  "visibility": "published",
  "order": 10
}
```

### 9.4. Content validation

Codex должен добавить валидацию данных:

- Zod schema или аналог;
- build должен падать, если:
  - нет `alt`;
  - нет `width/height`;
  - photo ссылается на несуществующую плёнку;
  - cover image не существует;
  - slug повторяется;
  - visibility имеет неизвестное значение;
  - route collision.

---

## 10. Загрузка и обработка фотографий

### 10.1. Локальная папка импорта

Пример:

```txt
/import
  /film
    /0001
      001.jpg
      002.jpg
      ...
      film.json
    /0002
      ...
  /digital
    /2024-bangkok
      DSCF0001.jpg
      DSCF0002.jpg
      series.json
```

Эта папка может быть вне repo, чтобы не коммитить огромные файлы.

### 10.2. Скрипт ingest

Codex должен спланировать скрипт:

```bash
pnpm ingest:film ./import/film/0001
pnpm ingest:digital ./import/digital/2024-bangkok
```

Что делает скрипт:

1. Читает изображения.
2. Извлекает размеры.
3. Извлекает EXIF, но осторожно.
4. Удаляет или скрывает GPS для публичной версии.
5. Создаёт LQIP/blurData/dominantColor.
6. Создаёт responsive variants, если выбран prebuilt mode.
7. Загружает файлы в R2.
8. Генерирует/обновляет JSON-манифест.
9. Проверяет, что все публичные фотографии имеют alt или placeholder-alt.
10. Печатает summary.

### 10.3. EXIF и приватность

Правило:

- GPS не публиковать по умолчанию.
- Серийные номера камер/объективов не публиковать, если это лишнее.
- Оригинал можно хранить приватно.
- Публичный “original” может быть не настоящим RAW/полным оригиналом, а high-quality JPEG/AVIF/WebP без чувствительного EXIF.

### 10.4. Naming convention

Для плёнки:

```txt
film/0001/original/001.jpg
film/0001/original/002.jpg
film/0001/variants/001-w480.avif
film/0001/variants/001-w800.avif
film/0001/variants/001-w1200.avif
film/0001/variants/001-w1600.avif
film/0001/variants/001-w2400.avif
```

Для digital:

```txt
digital/2024/bangkok-night/original/0001.jpg
digital/2024/bangkok-night/variants/0001-w1200.avif
```

---

## 11. Дизайн-направление

### 11.1. Главное ощущение

“Apple clarity + Spotify darkness + gallery calm”.

Но важно: **не копировать Spotify/Apple напрямую**. Нужен свой сайт, вдохновлённый:

- content-first интерфейсом;
- тёмной сценой, на которой фото светятся;
- системной аккуратностью;
- скруглениями;
- прозрачностью/слоями очень умеренно;
- крупными карточками;
- плавными переходами.

### 11.2. Темы

Три режима:

1. `system` — по умолчанию, подхватывать системную тему;
2. `light`;
3. `dark`.

CSS-основа:

```css
:root {
  color-scheme: light dark;

  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-pill: 999px;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", sans-serif;
  --font-display: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif;

  --ease-standard: cubic-bezier(.2, .8, .2, 1);
  --duration-fast: 140ms;
  --duration-normal: 240ms;
  --duration-slow: 420ms;
}

:root,
[data-theme="light"] {
  --bg: #f7f7f5;
  --bg-elevated: rgba(255, 255, 255, 0.78);
  --bg-muted: #eeeeea;
  --text: #0a0a0a;
  --text-muted: #666662;
  --border: rgba(0, 0, 0, 0.10);
  --shadow-soft: 0 20px 60px rgba(0, 0, 0, 0.08);
  --accent: #111111;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #050505;
    --bg-elevated: rgba(18, 18, 18, 0.72);
    --bg-muted: #111111;
    --text: #f5f5f3;
    --text-muted: #a7a7a0;
    --border: rgba(255, 255, 255, 0.12);
    --shadow-soft: 0 20px 80px rgba(0, 0, 0, 0.50);
    --accent: #ffffff;
  }
}

[data-theme="dark"] {
  --bg: #050505;
  --bg-elevated: rgba(18, 18, 18, 0.72);
  --bg-muted: #111111;
  --text: #f5f5f3;
  --text-muted: #a7a7a0;
  --border: rgba(255, 255, 255, 0.12);
  --shadow-soft: 0 20px 80px rgba(0, 0, 0, 0.50);
  --accent: #ffffff;
}
```

### 11.3. Цвет

База:

- почти чёрный;
- почти белый;
- серые поверхности;
- акцент — не яркий “брендовый”, а часто сам цвет фотографии.

Можно добавить `photo accent`:

- dominant color из фото;
- очень аккуратная подложка;
- не красить весь интерфейс;
- не делать “rainbow UI”.

### 11.4. Типографика

Использовать system font stack.

Не обязательно подключать платные/тяжёлые шрифты. Хорошая системная типографика может выглядеть дороже.

Пример:

```css
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

h1, h2, .display {
  font-family: var(--font-display);
  letter-spacing: -0.04em;
}
```

### 11.5. Layout

- max width не должен быть слишком узким;
- на archive/grid — использовать почти всю ширину;
- на текстовых страницах — ограничивать ширину;
- отступы responsive;
- mobile-first.

Пример:

```css
.page-shell {
  width: min(100% - 32px, 1600px);
  margin-inline: auto;
}

.text-shell {
  width: min(100% - 32px, 760px);
  margin-inline: auto;
}
```

### 11.6. Grid

Нужно несколько режимов:

1. **Masonry-like** — красиво, но осторожно с layout shift.
2. **Uniform grid** — спокойно и быстро.
3. **Contact sheet** — плёночный режим 6x6/4x9.
4. **Editorial grid** — разные размеры featured-карточек.

Для MVP:

- Films list: карточки/обложки.
- Film detail: contact sheet grid.
- Archive: dense responsive grid.

### 11.7. Motion

Motion должен быть дорогим, не кричащим.

Правила:

- hover scale максимум 1.01–1.03;
- opacity/transform вместо heavy effects;
- lightbox transition плавный;
- уважать `prefers-reduced-motion`;
- никакой бессмысленной анимации.

Пример:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 11.8. Скругления

Большие радиусы — важная часть стиля, но фото не должны выглядеть как игрушечные карточки.

Рекомендация:

- thumbnails: `16px–24px`;
- большие hero images: `28px–36px`;
- fullscreen image: без скругления или минимально;
- chips/buttons: pill.

### 11.9. Навигация

Навигация должна быть незаметной:

- top bar glass/elevated;
- пункты: `Index`, `Films`, `Digital`, `Collections`, `About`;
- theme toggle;
- search/command palette опционально;
- на мобильном — compact nav.

### 11.10. Lightbox

Lightbox — критически важен.

Функции:

- открыть фото;
- next/prev;
- keyboard arrows;
- `Esc` закрывает;
- `i` показывает/скрывает info panel;
- zoom на desktop;
- pinch/drag на mobile желательно позже;
- prefetch соседних фото;
- не ломать scroll restoration;
- URL может обновляться на photo slug.

---

## 12. UI-компоненты

Codex должен спланировать и создать компоненты.

### 12.1. Core

- `Layout`
- `Header`
- `Footer`
- `ThemeToggle`
- `PhotoGrid`
- `PhotoCard`
- `FilmCard`
- `FilmMeta`
- `PhotoMeta`
- `Lightbox`
- `CollectionCard`
- `TagChip`
- `FilterBar`
- `SearchInput`
- `EmptyState`
- `ResponsiveImage`

### 12.2. ResponsiveImage

Самый важный компонент.

Обязанности:

- принимать image object;
- строить `srcset`;
- задавать `sizes`;
- использовать `width`/`height` для предотвращения CLS;
- `loading="lazy"` по умолчанию;
- `decoding="async"`;
- `fetchpriority="high"` только когда явно указано;
- поддерживать Cloudflare Transform URL или prebuilt variant URL;
- показывать blur/lqip background.

Пример API:

```tsx
<ResponsiveImage
  image={photo}
  sizes="(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw"
  variant="grid"
  loading="lazy"
/>
```

### 12.3. PhotoGrid

Пример API:

```tsx
<PhotoGrid
  images={film.images}
  mode="contact-sheet"
  enableLightbox
/>
```

### 12.4. Lightbox

Пример API:

```tsx
<Lightbox
  images={images}
  initialImageId={selectedId}
  context="film-0001"
/>
```

---

## 13. Архитектура файлов

Рекомендуемая структура для Astro:

```txt
.
├── AGENTS.md
├── README.md
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── wrangler.toml
├── docs/
│   ├── YAKOV_VIEWER_CODEX_BRIEF.md
│   ├── cloudflare-setup.md
│   ├── design-system.md
│   ├── image-pipeline.md
│   └── decisions/
│       ├── 0001-stack.md
│       ├── 0002-cloudflare-r2.md
│       └── 0003-image-strategy.md
├── scripts/
│   ├── ingest/
│   │   ├── ingest-film.ts
│   │   ├── ingest-digital.ts
│   │   ├── extract-metadata.ts
│   │   ├── generate-variants.ts
│   │   └── upload-r2.ts
│   └── validate-content.ts
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── layout/
│   │   ├── media/
│   │   ├── navigation/
│   │   └── ui/
│   ├── content/
│   │   ├── films/
│   │   ├── collections/
│   │   └── pages/
│   ├── data/
│   │   ├── images.json
│   │   └── digital.json
│   ├── lib/
│   │   ├── images/
│   │   ├── content/
│   │   ├── cloudflare/
│   │   └── seo/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── films/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── digital/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── collections/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── photos/
│   │   │   └── [slug].astro
│   │   └── about.astro
│   └── styles/
│       ├── global.css
│       ├── tokens.css
│       └── utilities.css
└── public/
    ├── favicon.svg
    ├── robots.txt
    └── og-default.jpg
```

---

## 14. Репо-инструкции для AGENTS.md

Codex должен создать или обновить `AGENTS.md`.

Пример:

```md
# AGENTS.md — Yakov Viewer

## Project goal

Build a premium, static-first photography portfolio for Yakov Viewer/Yakov Yuver. The site displays film rolls, digital photos, curated collections, and individual photo pages. It is deployed to Cloudflare Pages, with images stored in Cloudflare R2 and delivered through responsive optimized URLs.

## Important docs

Read these before major work:

- `docs/YAKOV_VIEWER_CODEX_BRIEF.md`
- `docs/design-system.md`
- `docs/image-pipeline.md`
- `docs/cloudflare-setup.md`

## Engineering rules

- Prefer static generation.
- Keep JavaScript minimal.
- Use TypeScript for data validation and utilities.
- Do not commit original high-resolution photos to the repo.
- Do not expose secrets, R2 keys, or private bucket names.
- Do not publish GPS EXIF by default.
- Use responsive images with width/height to prevent layout shift.
- Keep design tokens centralized.
- Do not copy Spotify/Apple branding; use them only as broad inspiration.

## Commands

Update after inspecting the repo:

- Install: `pnpm install`
- Dev: `pnpm dev`
- Check: `pnpm check`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Validate content: `pnpm validate:content`

## Done means

A task is done only when:

- implementation matches the brief;
- build passes;
- content validation passes;
- responsive behavior is checked;
- no secrets or originals are committed;
- design tokens are used instead of one-off styling;
- the diff is reviewed for regressions.
```

---

## 15. Репо-scoped skills вместо случайного скачивания “дизайн MD”

Пользователь думает, можно ли “скачать пачку MD файлов дизайна”. Лучше не скачивать случайные design-md из интернета. Надёжнее создать **свои repo-scoped skills** на основе этого брифа.

Codex может создать:

```txt
.agents/
  skills/
    yakov-design-system/
      SKILL.md
    yakov-image-pipeline/
      SKILL.md
    yakov-cloudflare-deploy/
      SKILL.md
```

### 15.1. Skill: yakov-design-system

```md
---
name: yakov-design-system
description: Use when creating or changing Yakov Viewer UI, visual design, CSS tokens, layout, grids, themes, photo cards, navigation, and motion.
---

Follow the Yakov Viewer design direction:
- content-first photography portfolio;
- Apple-like clarity;
- Spotify-like dark stage, but no brand copying;
- black/white/gray base;
- large radii;
- system light/dark theme;
- minimal JS;
- accessible contrast;
- respect prefers-reduced-motion;
- centralize tokens in `src/styles/tokens.css`;
- never introduce random colors/radii/spacings outside tokens unless updating tokens intentionally.

Before changing UI:
1. Read `docs/YAKOV_VIEWER_CODEX_BRIEF.md`.
2. Check existing tokens/components.
3. Prefer reusable components.
4. Verify responsive behavior.
```

### 15.2. Skill: yakov-image-pipeline

```md
---
name: yakov-image-pipeline
description: Use when working on image manifests, EXIF, responsive images, R2 keys, Cloudflare transformations, variants, upload scripts, or photo validation.
---

Rules:
- Never commit high-res originals to git.
- Strip or hide GPS EXIF by default.
- Every public image needs width, height, aspectRatio, alt, visibility, and stable id/slug.
- Use fixed responsive widths unless explicitly changing the strategy.
- Prefer deterministic R2 key naming.
- Validate manifests before build.
- Avoid generating unbounded Cloudflare transformation sizes.
```

### 15.3. Skill: yakov-cloudflare-deploy

```md
---
name: yakov-cloudflare-deploy
description: Use when configuring Cloudflare Pages, R2, custom domains, caching, wrangler, env vars, or deployment docs for Yakov Viewer.
---

Rules:
- Use Cloudflare Pages for frontend.
- Use R2 for photo storage.
- Use custom R2 domain for production assets.
- Do not rely on r2.dev for production.
- Document every required Cloudflare setting.
- Never expose API tokens in code.
- Keep Wrangler config safe and reproducible.
```

---

## 16. Performance budget

Целевые бюджеты:

- Lighthouse Performance: 90+ на production-like build.
- Lighthouse Accessibility: 95+.
- Initial JS: как можно ниже, желательно < 150 KB gzip.
- Grid thumbnails: не грузить больше нужного размера.
- Hero image: оптимизированный AVIF/WebP/JPEG, не оригинал.
- CLS: почти 0, потому что известны `width`/`height`.
- LCP: hero/first visible image должен быть оптимизирован.
- Lazy load для всего ниже первого экрана.
- Prefetch соседних кадров в lightbox, но без агрессивной загрузки всего архива.

---

## 17. SEO и sharability

### 17.1. Общие правила

- У каждой плёнки свой URL.
- У каждой коллекции свой URL.
- У каждой важной фотографии свой URL.
- Open Graph image для photo/film/collection.
- `title`, `description`, canonical.
- `sitemap.xml`.
- `robots.txt`.
- structured data можно добавить позже.

### 17.2. URL patterns

```txt
/
/films
/films/film-0001-bangkok-night
/digital
/digital/bangkok-2024
/collections/night
/photos/film-0001-001
/about
```

### 17.3. Photo page title

```txt
Film 001 / Frame 01 — Yakov Viewer
```

или, если есть title:

```txt
Bangkok Night Reflection — Yakov Viewer
```

---

## 18. Accessibility

Правила:

- все интерактивные элементы доступны с клавиатуры;
- lightbox управляется keyboard;
- `Esc` закрывает modal;
- focus trap внутри modal;
- visible focus states;
- alt text у изображений;
- не полагаться только на цвет;
- contrast check;
- `prefers-reduced-motion`;
- не ломать zoom браузера;
- touch targets на мобильном.

---

## 19. Безопасность и приватность

### 19.1. Секреты

Не коммитить:

- Cloudflare API token;
- R2 access key;
- R2 secret key;
- `.env`;
- приватные bucket names, если не нужно.

Использовать:

- Cloudflare dashboard env vars;
- GitHub secrets;
- `.env.example`.

### 19.2. Фото

- GPS скрыть.
- Лица/частные места — отдельное решение владельца.
- Если кадр не должен быть публичным, `visibility: "hidden"` или не включать в публичный манифест.
- Оригиналы высокого качества можно хранить в приватном bucket.
- Публично отдавать “display original” без чувствительных метаданных.

### 19.3. R2 access

Для публичного сайта:

- public bucket/custom domain для optimized assets;
- private bucket для raw originals, если нужно;
- не использовать `r2.dev` для production;
- custom domain даёт нормальную cache/security конфигурацию.

---

## 20. Analytics

Сайт не должен становиться tracking-heavy.

Рекомендация:

- Cloudflare Web Analytics или другой privacy-friendly вариант;
- без cookie banners, если нет cookies/tracking;
- не добавлять Google Analytics автоматически;
- аналитика должна отвечать на вопросы:
  - какие страницы смотрят;
  - какие плёнки открывают;
  - насколько быстро грузится сайт;
  - какие ошибки.

---

## 21. Редакторский слой

Для такого проекта важен не только код, но и редактура.

### 21.1. Плёнка как история

У каждой плёнки может быть:

- название;
- 2–4 предложения описания;
- место/время;
- камера/плёнка;
- mood/tags;
- 1 cover image;
- 3–6 selected/featured images.

### 21.2. Цифровые фотографии

Цифровые можно группировать:

- по году;
- по месту;
- по серии;
- по теме;
- по проекту.

### 21.3. Главная страница

Главная не должна показывать всё. Она должна дать ощущение автора:

- 1 сильный hero;
- 6–12 featured;
- 3–6 последних плёнок;
- 2–4 curated collections;
- спокойный About teaser.

---

## 22. Дизайн-промпт для отдельного UI/design инструмента

Если владелец будет использовать Figma, v0, Claude, Lovable или другой дизайн-инструмент, можно дать такой prompt:

```txt
Design a premium photography portfolio called Yakov Viewer.

It should feel like Apple clarity meets Spotify-like content-first dark surfaces, but do not copy either brand. Use a black/white/gray design system, large rounded corners, subtle glass/elevated navigation, quiet motion, and a system-aware light/dark theme.

The site contains:
- about 100 film rolls, each with about 36 photos;
- about 1000 digital photos;
- film roll pages;
- digital series pages;
- curated collections;
- archive grid;
- individual photo pages;
- fullscreen lightbox.

Design priorities:
- photography is always the hero;
- UI should feel minimal, expensive, calm;
- dark mode should feel like a gallery/theater;
- light mode should feel like a clean Apple-like archive;
- no clutter, no social network features;
- strong mobile experience;
- clear typography with system fonts;
- accessible contrast;
- filters and tags should be quiet, not dominant.

Create:
1. Home page
2. Films index
3. Film detail/contact sheet
4. Archive grid
5. Photo detail/lightbox
6. About page
7. Design tokens for colors, spacing, radius, typography, motion
8. Component states for hover/focus/active
```

---

## 23. Prompt для Codex

Скопировать в Codex вместе с этим файлом:

```txt
Прочитай приложенный файл `YAKOV_VIEWER_CODEX_BRIEF.md`. Это главный продуктовый, дизайнерский и технический контекст проекта.

Сначала работай в режиме планирования, не начинай писать код сразу.

Твоя задача:
1. Осмотреть текущий репозиторий и определить фактический стек.
2. Сопоставить репозиторий с брифом.
3. Предложить большой поэтапный план превращения проекта в статический/почти статический premium photo portfolio Yakov Viewer.
4. Отдельно спланировать:
   - дизайн-систему;
   - структуру данных для плёнок и цифровых фотографий;
   - image pipeline;
   - Cloudflare Pages + R2 deployment;
   - performance/SEO/accessibility;
   - AGENTS.md и, если уместно, repo-scoped skills.
5. Указать решения, которые нужно принять сейчас, и решения, которые можно отложить.
6. После плана предложить первый маленький implementation step.

Важные ограничения:
- Не коммить high-res оригиналы в git.
- Не раскрывай Cloudflare secrets.
- Не делай тяжёлый backend без необходимости.
- Не копируй Spotify/Apple branding, только используй общую визуальную идею.
- Сайт должен быть быстрым, красивым, системно оформленным и долговечным.
- Фото должны показываться через responsive images, а не оригиналами в сетке.
- По возможности создай или обнови AGENTS.md, чтобы правила проекта были reusable.
```

---

## 24. Текст, который владелец может вставить в конце своего рассказа Codex

```txt
Отдельно важно: приложенный MD-файл — это не просто справка, а главный контекст проекта. В нём собрана история идеи, переход от Logjamming к публичному Yakov Viewer, требования к дизайну, Cloudflare, хранению фотографий, структуре данных и будущему image pipeline.

Пожалуйста, используй этот MD как основной контракт. Не делай случайную галерею и не начинай с кода без плана. Сначала прочитай файл, осмотри репозиторий, составь архитектурный план, выдели риски и только потом предложи первый маленький шаг реализации.
```

---

## 25. Что Codex должен спланировать особенно внимательно

### 25.1. Image strategy

Нужно принять решение:

- Cloudflare transformations on demand;
- prebuilt variants;
- гибрид.

Критерии:

- стоимость;
- удобство;
- качество;
- контроль;
- скорость;
- риск большого числа unique transformations;
- масштаб на 4 600+ фото.

### 25.2. Data model

Codex должен не просто нарисовать страницы, а сделать данные устойчивыми.

Проверить:

- как хранить 100 films;
- как хранить 1 000 digital photos;
- как генерировать routes;
- как валидировать ссылки;
- как добавлять новые плёнки.

### 25.3. Design system

Нельзя допустить, чтобы каждый компонент имел случайные цвета/отступы.

Нужно:

- tokens;
- theme system;
- components;
- docs;
- examples.

### 25.4. Build time

4 600 фото и тысячи photo pages могут увеличить build time. Codex должен оценить:

- генерировать ли страницу для каждого фото;
- как работает Cloudflare Pages build limit;
- сколько страниц будет;
- нужно ли разбить архив;
- нужны ли paginated routes.

### 25.5. SEO vs privacy

У каждой photo page хороший SEO, но не все фото должны быть публично индексируемыми.

Нужно решить:

- какие фото получают отдельные страницы;
- какие фото только в archive;
- какие hidden;
- какие noindex.

---

## 26. MVP

### 26.1. MVP должен включать

- базовый layout;
- дизайн-токены;
- system/light/dark theme;
- home;
- films index;
- film detail;
- archive grid;
- photo lightbox;
- sample data;
- responsive image component;
- content validation;
- Cloudflare deployment docs;
- AGENTS.md;
- build passing.

### 26.2. MVP может использовать mock/sample images

До загрузки всех фотографий можно использовать:

- 2–3 sample films;
- 10–30 sample images;
- local placeholders;
- mock R2 URLs.

Но архитектура должна быть готова к 4 600 фото.

---

## 27. Этапы реализации

### Phase 0 — Repo audit

Codex:

- определить стек;
- проверить package manager;
- проверить текущий код;
- найти устаревшие/мертвые части Logjamming;
- решить, что сохранить, что вынести, что удалить;
- сформировать план.

### Phase 1 — Foundation

- `AGENTS.md`;
- docs folder;
- design tokens;
- base layout;
- theme toggle;
- routes skeleton.

### Phase 2 — Data model

- schemas;
- sample films/images;
- content validation;
- route generation;
- typed helpers.

### Phase 3 — Gallery UI

- film cards;
- photo grid;
- responsive image;
- film detail;
- archive.

### Phase 4 — Lightbox

- fullscreen;
- keyboard;
- info panel;
- prefetch neighbors;
- mobile behavior.

### Phase 5 — Cloudflare image pipeline

- R2 key conventions;
- Cloudflare image URL builder;
- optional prebuilt variants;
- upload script plan;
- docs.

### Phase 6 — SEO/performance/accessibility

- metadata;
- sitemap;
- OG;
- Lighthouse;
- a11y checks;
- reduced motion;
- image budgets.

### Phase 7 — Real content import

- first real film;
- first digital series;
- test upload;
- verify cache/transforms;
- verify design with actual photos.

---

## 28. Проверки готовности

Codex должен считать задачу готовой только если:

- `pnpm build` проходит;
- typecheck проходит;
- content validation проходит;
- нет секретов;
- нет high-res оригиналов в git;
- responsive images используют размеры;
- lightbox доступен с клавиатуры;
- темы работают;
- дизайн не расползся;
- docs обновлены;
- есть понятный следующий шаг.

---

## 29. Возможные будущие расширения

Не делать сейчас, но предусмотреть:

- приватный Logjamming backstage;
- локальный отбор кадров;
- экспорт curated selections;
- protected admin через Cloudflare Access;
- CMS-like editor;
- signed upload URLs;
- автоматическая генерация contact sheets;
- print shop/licensing;
- password-protected collections;
- private client galleries;
- map/timeline, если privacy позволяет.

---

## 30. Решения, которые нужно принять владельцу

Codex может спросить, но не должен стопориться, если ответа нет:

1. Финальное название: Yakov Viewer / Yakov Yuver / другое?
2. Домен?
3. Публичны ли все 4 600 фото или часть скрыта?
4. Нужны ли отдельные страницы для каждого фото?
5. Разрешать ли download high-res?
6. Показывать ли camera/film metadata?
7. Показывать ли location?
8. Темы: system default + manual toggle?
9. Нужна ли английская версия?
10. Нужна ли приватная Logjamming-часть в будущем?

Разумные дефолты:

- название: Yakov Viewer;
- публичны не все, есть visibility;
- photo pages только для `published`;
- download high-res выключен;
- camera/film metadata включены;
- точная location скрыта;
- system theme + manual toggle;
- язык можно начать с английского UI и русских внутренних docs;
- Logjamming оставить на будущее.

---

## 31. Технические источники, которые Codex может проверить

Codex должен использовать официальные источники и не тащить случайные “design MD” без необходимости.

Полезные источники:

- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- Cloudflare R2 overview: https://developers.cloudflare.com/r2/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 public buckets/custom domains: https://developers.cloudflare.com/r2/buckets/public-buckets/
- Cloudflare R2 CLI: https://developers.cloudflare.com/r2/get-started/cli/
- Cloudflare Images pricing: https://developers.cloudflare.com/images/pricing/
- Cloudflare Images transformations overview: https://developers.cloudflare.com/images/optimization/transformations/overview/
- Cloudflare Images URL transformation format: https://developers.cloudflare.com/images/optimization/features/
- Cloudflare Images responsive images: https://developers.cloudflare.com/images/optimization/make-responsive-images/
- Cloudflare Images limits: https://developers.cloudflare.com/images/get-started/limits/
- Astro Islands: https://docs.astro.build/en/concepts/islands/
- Astro Content Collections: https://docs.astro.build/en/guides/content-collections/
- MDN `prefers-color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme
- MDN `color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
- OpenAI Codex skills: https://developers.openai.com/codex/skills
- Spotify design guidelines, only for broad inspiration and legal caution: https://developer.spotify.com/documentation/design
- Apple Human Interface Guidelines, only for broad inspiration: https://developer.apple.com/design/human-interface-guidelines/

---

## 32. Cost sketch: примерная логика, не финальный расчёт

Перед финальным решением Codex должен проверить актуальные цены.

Грубая оценка только для мышления:

- 4 600 фото;
- если средний public high-quality файл 20 MB → около 92 GB;
- если 40 MB → около 184 GB;
- R2 Standard storage тарифицируется за GB-month плюс операции;
- egress в R2 заявлен как free;
- Cloudflare Images transformations могут тарифицироваться по unique transformations;
- если на каждое фото сделать 5 размеров, потенциально это 23 000 unique transformations в первый месяц, если все варианты реально запрошены;
- поэтому нужно ограничить набор размеров и не генерировать случайные widths.

Возможная стратегия экономии:

- сетка использует 480/800;
- detail использует 1200/1600;
- high-res only on demand;
- originals не грузятся автоматически;
- использовать cache;
- использовать фиксированные `srcset`, а не бесконечный `width=auto`, если есть риск непредсказуемой трансформационной стоимости.

---

## 33. Возможная реализация image URL builder

Пример TypeScript-логики:

```ts
type ImageStrategy = "cloudflare-transform" | "prebuilt-variants";

type TransformOptions = {
  width: number;
  quality?: number;
  format?: "auto" | "avif" | "webp" | "jpeg";
};

export function buildCloudflareImageUrl(
  zoneBaseUrl: string,
  sourceUrl: string,
  options: TransformOptions
): string {
  const params = [
    `width=${options.width}`,
    `quality=${options.quality ?? 85}`,
    `format=${options.format ?? "auto"}`
  ].join(",");

  return `${zoneBaseUrl}/cdn-cgi/image/${params}/${sourceUrl}`;
}
```

Нужно добавить:

- escaping/URL validation;
- allowed widths;
- tests;
- no arbitrary options from user input.

---

## 34. Allowed responsive widths

Стартовый набор:

```ts
export const IMAGE_WIDTHS = {
  thumb: [320, 480, 640],
  grid: [480, 800, 1200],
  detail: [1200, 1600, 2400],
  hero: [1200, 1600, 2400, 3200]
} as const;
```

Не генерировать бесконечные размеры.

---

## 35. Visual QA checklist

Перед релизом проверить:

- dark mode home;
- light mode home;
- film index mobile;
- film detail mobile;
- archive with 100+ images;
- lightbox keyboard;
- image loading slow network;
- no layout shift;
- tags/filters overflow;
- long film titles;
- missing metadata;
- empty collection;
- 404 page;
- OG preview;
- retina displays;
- very wide screens.

---

## 36. Tone of the site

Тон:

- тихий;
- уверенный;
- без маркетингового шума;
- без “AI startup” эстетики;
- больше “архив / галерея / авторский сайт”.

Возможные microcopy:

```txt
Yakov Viewer
A photographic archive of film rolls, digital notes, and selected work.

Films
100 rolls, contact sheets, selected frames.

Digital
Digital photographs, grouped by year, place, and series.

Archive
Everything published, in one quiet index.
```

---

## 37. Важное предупреждение про “похожий на Spotify”

Можно вдохновляться:

- тёмной сценой;
- карточками;
- focus on media;
- rounded artwork;
- контрастом;
- простыми системными шрифтами.

Нельзя:

- использовать Spotify logo;
- использовать Spotify green как главный бренд без причины;
- копировать интерфейс один-в-один;
- использовать их название/бренд;
- делать сайт похожим на продукт Spotify юридически/визуально слишком буквально.

То же касается Apple: можно вдохновляться системностью и ясностью, но не копировать Apple UI как брендовый продукт.

---

## 38. Что делать прямо сейчас

Codex должен начать с такого плана:

1. Прочитать этот файл.
2. Осмотреть repo.
3. Сказать: “Я понял, что проект теперь публичный photo portfolio, а Logjamming — будущий backstage/исторический контекст”.
4. Предложить архитектуру.
5. Выбрать стек или подтвердить текущий.
6. Создать/обновить `AGENTS.md`.
7. Создать docs:
   - `docs/design-system.md`;
   - `docs/image-pipeline.md`;
   - `docs/cloudflare-setup.md`.
8. Создать минимальный skeleton сайта.
9. Добавить sample data.
10. Добавить validation/build checks.

---

## 39. Итоговая формула проекта

**Yakov Viewer — это не приложение ради приложения. Это медленный, красивый, быстрый и устойчивый фотоархив.**

Код должен быть таким же аккуратным, как сайт:

- мало лишнего;
- ясно структурировано;
- данные валидируются;
- изображения не ломают производительность;
- Cloudflare используется осмысленно;
- дизайн живёт в токенах;
- Logjamming остаётся как потенциальный backstage, но не мешает публичному портфолио.

