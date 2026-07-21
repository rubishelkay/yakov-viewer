# Панель управления: текущий статус и ближайший путь

Обновлено: 22 июля 2026.

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
5. Worker version `652010be-06b1-49e6-a051-6a1a878be02a` развернут с
   `ADMIN_ACCESS_ENABLED=true`.
6. Публичные маршруты отвечают `200`, а анонимные admin-запросы перехватываются Access.
7. Owner-вход выполнен; production `/admin/ingest` загружает архив из D1 через
   защищенный API.

Перед реальным наполнением остается отдельно подтвержденный маленький smoke upload с
проверкой private R2, public R2 и D1.

## Следующие milestones

### A. Protected cloud ingest

- Access, migration, deploy;
- один тестовый JPEG;
- затем тестовый альбом на 30-40 JPEG;
- проверка reload, порядка, размеров и отсутствия файлов в Git.

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

Настоящие новые альбомы загружаются только через защищенный remote admin после smoke
test. Локальная админка остается средой разработки. Перед Access, migration, deploy или
production upload Codex дает короткий бриф с точными именами ресурсов и ожидаемым
эффектом. Секреты и изображения никогда не попадают в Git.
