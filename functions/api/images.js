export async function onRequest(context) {
  var url = new URL(context.request.url);
  var folder = url.searchParams.get('folder');

  if (!folder) {
    return json({ error: 'folder parameter required' }, 400);
  }

  var bucket = context.env.R2_BUCKET;
  if (!bucket) {
    return json({ error: 'R2 bucket not bound — add R2_BUCKET binding in Pages settings' }, 500);
  }

  var prefix = folder.endsWith('/') ? folder : folder + '/';
  var all = [];
  var cursor = undefined;

  do {
    var opts = { prefix: prefix, limit: 1000 };
    if (cursor) opts.cursor = cursor;
    var listed = await bucket.list(opts);
    all = all.concat(listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  var publicUrl = context.env.R2_PUBLIC_URL || 'https://pub-500a8cf5bb2a4e3db51ea0c9789e6e88.r2.dev';

  var images = all
    .filter(function (obj) { return /\.(jpe?g|png|webp|gif|tiff?)$/i.test(obj.key); })
    .sort(function (a, b) { return a.key.localeCompare(b.key); })
    .map(function (obj) { return publicUrl + '/' + obj.key; });

  return json({ images: images, folder: folder, count: images.length });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60'
    }
  });
}
