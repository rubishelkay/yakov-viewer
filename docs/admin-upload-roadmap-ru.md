# Панель управления: текущий статус и ближайший путь

Обновлено: 26 июля 2026.

## Где мы сейчас

Публичный Fable-derived frontend принят и отделен от админских моков и `localStorage`.
Он читает только 9 реальных опубликованных альбомов из portfolio manifest. В production
уже загружены 312 фото и по две публичные версии каждого изображения.

Админка пока имеет два источника данных:

- `/admin/albums`, `/admin/photos`, `/admin/sets`, `/admin/tags`, `/admin/bin` -
  локальная UX-песочница на `localStorage` + IndexedDB;
- `/admin/ingest` - настоящий Cloudflare flow на D1 + R2.

Локальная песочница нужна для интерфейсных тестов, но не является постоянным архивом.

## Реальная загрузка

Первый Cloudflare upload принимает JPEG до 20 MiB и делает:

```txt
sourceJpeg -> private R2, без изменения
thumb      -> browser-generated public JPEG, до 300 KB
display    -> browser-generated public JPEG, около 1 MB, максимум 2 MiB
metadata   -> Photo + AlbumPhoto + Asset + UploadJob в D1
```

Source обязателен для каждой новой фотографии. Retry использует стабильный
`clientUploadId`, поэтому повтор завершенного запроса не создает дубликат. Порядок
выбранных файлов становится начальным порядком альбома.

Админка считает общий размер записанных assets и показывает предупреждение после
рабочего порога 8 GiB. Это предупреждение, а не жесткий лимит: владелец согласен при
необходимости перейти на платное хранение или заранее готовить source JPEG по 3-5 MB.

## Что уже готово перед production upload

1. Cloudflare Zero Trust Access защищает `/admin*` и `/api/admin*`.
2. Встроенный Cloudflare account identity provider разрешает только
   `Jacobjshmol@gmail.com`.
3. Access team domain и application AUD записаны в Worker variables.
4. Production migration `0003_upload_job_photo.sql` применена.
5. Worker version `dd98686e-673e-41fa-b816-d57cfc4f1131` развернут с
   `ADMIN_ACCESS_ENABLED=true`.
6. Публичные маршруты отвечают `200`, а анонимные admin-запросы перехватываются Access.
7. Owner-вход выполнен; production `/admin/ingest` загружает архив из D1 через
   защищенный API.

Production smoke upload завершен 26 июля 2026:

- создан непубличный album `Cloud upload smoke test`;
- JPEG `1920x1273`, `1,764,148` bytes загружен через Safari admin;
- private `sourceJpeg` совпал с локальным файлом побайтно и по SHA-256;
- public thumb: `640x424`, `121,898` bytes;
- public display: `1920x1273`, `1,132,453` bytes;
- D1 теперь содержит 10 albums, 313 photos, 313 memberships, 627 assets и 1 upload job;
- album остался `draft`, photo получил `review`, upload job завершился со статусом
  `review` и progress `100`;
- draft отсутствует в публичном album index и не имеет публичного route.

Cloud ingest вынесен из localStorage/IndexedDB provider в отдельную route-ветку. Admin
navigation больше не prefetch-ит все тяжелые локальные редакторы, что делает upload
страницу устойчивее в Safari.

## Следующие milestones

### A. Protected cloud ingest

- Access, migration, deploy - done;
- один production JPEG с readback-проверкой - done;
- следующий шаг: тестовый альбом на 30-40 JPEG;
- проверить последовательную очередь, порядок, retry, reload, размеры и отсутствие
  файлов в Git.

### B. Cloudflare mutations

- edit title/subtitle/status;
- теги альбома и прямые теги фото;
- covers;
- forward/reverse и ручной порядок;
- hide/show;
- Delete -> Bin, restore, purge;
- set membership и порядок.

После этого локальный repository заменяется D1/R2 adapter целиком, без смешивания
локальных и облачных сохранений на одном экране.

### C. Public site from D1

- тот же компактный public view model;
- только `published`, без hidden/bin/deleted;
- только публичные `thumb`/`display` URLs;
- никаких private keys, source assets, GPS или чувствительного EXIF;
- принятый дизайн остается неизменным.

### D. GitHub automatic deploy

- GitHub branch/production policy;
- Cloudflare Workers Builds;
- проверки перед автодеплоем;
- rollback документирован.

## Практическое правило

Настоящие новые альбомы теперь можно создавать и наполнять через защищенный
`/admin/ingest`. Пока cloud mutations не готовы, title/status/tags/covers/order после
загрузки не следует считать финально редактируемыми. Локальная админка остается UX-средой
разработки. Перед Access, migration, deploy или production upload Codex дает короткий
бриф с точными именами ресурсов и ожидаемым эффектом. Секреты и изображения никогда не
попадают в Git.
