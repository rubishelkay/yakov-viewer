import {
  collectionSchema,
  contentSchema,
  filmSchema,
  photoSchema,
  type Collection,
  type Content,
  type Film,
  type Photo
} from "./schema";
import { collections as seedCollections, films as seedFilms, photos as seedPhotos } from "./seed";

const rawContent = {
  films: seedFilms,
  photos: seedPhotos,
  collections: seedCollections
};

export function validateContent(): Content {
  const content = contentSchema.parse(rawContent);
  const errors: string[] = [];

  validateUnique(content.films.map((film) => film.id), "film id", errors);
  validateUnique(content.films.map((film) => film.slug), "film slug", errors);
  validateUnique(content.photos.map((photo) => photo.id), "photo id", errors);
  validateUnique(content.photos.map((photo) => photo.slug), "photo slug", errors);
  validateUnique(
    content.collections.map((collection) => collection.id),
    "collection id",
    errors
  );
  validateUnique(
    content.collections.map((collection) => collection.slug),
    "collection slug",
    errors
  );

  const filmIds = new Set(content.films.map((film) => film.id));
  const photoIds = new Set(content.photos.map((photo) => photo.id));
  const routeSlugs = [
    ...content.films.map((film) => `/films/${film.slug}`),
    ...content.photos.map((photo) => `/photos/${photo.slug}`),
    ...content.collections.map((collection) => `/collections/${collection.slug}`)
  ];
  validateUnique(routeSlugs, "route", errors);

  for (const film of content.films) {
    if (!photoIds.has(film.coverImageId)) {
      errors.push(`${film.id} references missing cover image ${film.coverImageId}`);
    }
  }

  for (const photo of content.photos) {
    if (photo.sourceType === "film" && (!photo.filmId || !filmIds.has(photo.filmId))) {
      errors.push(`${photo.id} references missing film ${photo.filmId ?? "(none)"}`);
    }
    if (photo.rights.downloadAllowed && !photo.rights.downloadUrl) {
      errors.push(`${photo.id} allows download but has no downloadUrl`);
    }
  }

  for (const collection of content.collections) {
    if (!photoIds.has(collection.coverImageId)) {
      errors.push(`${collection.id} references missing cover image ${collection.coverImageId}`);
    }
    for (const imageId of collection.imageIds) {
      if (!photoIds.has(imageId)) {
        errors.push(`${collection.id} references missing image ${imageId}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Content validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  return content;
}

function validateUnique(values: string[], label: string, errors: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

export const content = validateContent();

export const films = filmSchema.array().parse(content.films);
export const photos = photoSchema.array().parse(content.photos);
export const collections = collectionSchema.array().parse(content.collections);

export function getPublishedFilms(): Film[] {
  return films
    .filter((film) => film.visibility === "published")
    .sort((a, b) => a.order - b.order);
}

export function getPublishedPhotos(): Photo[] {
  return photos.filter((photo) => photo.visibility === "published");
}

export function getFeaturedPhotos(): Photo[] {
  return getPublishedPhotos().filter((photo) => photo.featured);
}

export function getHeroPhotos(): Photo[] {
  const heroPhotos = getPublishedPhotos().filter((photo) => photo.heroCandidate);
  return heroPhotos.length ? heroPhotos.slice(0, 5) : getFeaturedPhotos().slice(0, 5);
}

export function getFilmBySlug(slug: string): Film | undefined {
  return films.find((film) => film.slug === slug && film.visibility === "published");
}

export function getFilmById(id: string): Film | undefined {
  return films.find((film) => film.id === id && film.visibility === "published");
}

export function getPhotoBySlug(slug: string): Photo | undefined {
  return photos.find((photo) => photo.slug === slug && photo.visibility === "published");
}

export function getPhotoById(id: string): Photo | undefined {
  return photos.find((photo) => photo.id === id);
}

export function getPhotosForFilm(filmId: string): Photo[] {
  return getPublishedPhotos()
    .filter((photo) => photo.filmId === filmId)
    .sort((a, b) => (a.frameNumber ?? 0) - (b.frameNumber ?? 0));
}

export function getPublishedCollections(): Collection[] {
  return collections
    .filter((collection) => collection.visibility === "published")
    .sort((a, b) => a.order - b.order);
}
