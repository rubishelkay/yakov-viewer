import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [, , sourceArg, outputArg = "src/content/portfolio-manifest.json"] = process.argv;

if (!sourceArg) {
  throw new Error(
    "Usage: node scripts/import-fable-manifest.mjs /path/to/albums.json [output.json]"
  );
}

const sourcePath = resolve(sourceArg);
const outputPath = resolve(outputArg);
const publicRoot = resolve(dirname(sourcePath), "../..", "public");
const source = JSON.parse(await readFile(sourcePath, "utf8"));

if (!Array.isArray(source.albums) || source.albums.length === 0) {
  throw new Error("The source manifest must contain a non-empty albums array.");
}

const albums = await Promise.all(source.albums.map(async (album, albumIndex) => {
  if (!Array.isArray(album.images) || album.images.length === 0) {
    throw new Error(`Album ${album.slug ?? albumIndex} has no images.`);
  }

  const images = await Promise.all(album.images.map(async (image, imageIndex) => {
    const srcKey = stripLeadingSlash(image.src);
    const thumbKey = stripLeadingSlash(image.thumb);

    return {
      id: image.id,
      srcKey,
      thumbKey,
      srcBytes: await assetBytes(srcKey),
      thumbBytes: await assetBytes(thumbKey),
      width: image.width,
      height: image.height,
      orientation: image.orientation,
      alt: image.alt,
      position: imageIndex + 1
    };
  }));

  return {
    id: album.id,
    slug: album.slug,
    title: album.title,
    subtitle: album.subtitle ?? "",
    type: album.type ?? "digital",
    year: album.year ?? "",
    location: album.location ?? "",
    filmStock: album.filmStock ?? "",
    tags: Array.isArray(album.tags) ? album.tags : [],
    coverImage: album.coverImage,
    coverThumb: album.coverThumb,
    order: albumIndex,
    images
  };
}));

const hero = Array.isArray(source.hero)
  ? source.hero.map((photo) => ({
      id: photo.id,
      albumSlug: photo.albumSlug,
      albumTitle: photo.albumTitle
    }))
  : [];

const manifest = {
  source: "Fable 5 frontend",
  albums,
  hero
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const photoCount = albums.reduce((sum, album) => sum + album.images.length, 0);
console.log(`Imported ${albums.length} albums and ${photoCount} photos into ${outputPath}`);

function stripLeadingSlash(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Each image must have src and thumb paths.");
  }

  return value.replace(/^\/+/, "");
}

async function assetBytes(key) {
  const assetPath = resolve(publicRoot, key);

  if (!assetPath.startsWith(`${publicRoot}/`)) {
    throw new Error(`Asset path escapes the source public directory: ${key}`);
  }

  return (await stat(assetPath)).size;
}
