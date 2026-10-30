/// <reference path="../pb_data/types.d.ts" />

// Initial schema for heineart.ca.
//
// artists   -> Brenda, Jerry (the two "arms" of the site)
// sections  -> galleries within an artist arm (Watercolours, Pottery, Commissions, ...)
// artworks  -> individual pieces, each belonging to one section
// posts     -> news / journal entries, optionally tied to an artist
// pages     -> small editable text blocks (home intro, contact, ...)

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const THUMBS = ["480x0", "960x0", "1600x0", "600x600"];
const MAX_UPLOAD = 25 * 1024 * 1024;

function timestamps() {
  return [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
}

function image(name, opts) {
  return Object.assign(
    { name, type: "file", maxSelect: 1, maxSize: MAX_UPLOAD, mimeTypes: IMAGE_MIMES, thumbs: THUMBS },
    opts || {},
  );
}

migrate((app) => {
  const artists = new Collection({
    type: "base",
    name: "artists",
    listRule: "",
    viewRule: "",
    fields: [
      { name: "name", type: "text", required: true, max: 120 },
      { name: "slug", type: "text", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { name: "tagline", type: "text", max: 200 },
      { name: "bio", type: "editor" },
      image("portrait"),
      image("cover", { help: "Large image used on the home page for this artist." }),
      image("wordmark", { help: "Optional logo / hand-lettered name shown instead of plain text." }),
      { name: "showcase", type: "file", maxSelect: 24, maxSize: MAX_UPLOAD, mimeTypes: IMAGE_MIMES, thumbs: THUMBS, help: "Mosaic of images shown on the artist page." },
      { name: "accent", type: "text", max: 20, help: "Accent colour, e.g. #9b2226" },
      { name: "email", type: "email" },
      { name: "instagram", type: "url" },
      { name: "sort", type: "number" },
      ...timestamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_artists_slug ON artists (slug)"],
  });
  app.save(artists);

  const sections = new Collection({
    type: "base",
    name: "sections",
    listRule: "published = true",
    viewRule: "published = true",
    fields: [
      { name: "artist", type: "relation", required: true, collectionId: artists.id, maxSelect: 1, cascadeDelete: false },
      { name: "title", type: "text", required: true, max: 120 },
      { name: "slug", type: "text", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { name: "intro", type: "editor" },
      image("cover"),
      image("wordmark", { help: "Optional hand-lettered banner shown at the top of this section." }),
      { name: "pricing_note", type: "text", max: 300, help: "Small print under the intro, e.g. \"Prices refer to unframed paintings.\"" },
      { name: "sort", type: "number" },
      { name: "published", type: "bool" },
      ...timestamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_sections_artist_slug ON sections (artist, slug)"],
  });
  app.save(sections);

  const artworks = new Collection({
    type: "base",
    name: "artworks",
    listRule: "published = true",
    viewRule: "published = true",
    fields: [
      { name: "title", type: "text", required: true, max: 200 },
      { name: "section", type: "relation", required: true, collectionId: sections.id, maxSelect: 1, cascadeDelete: false },
      image("image", { required: true }),
      { name: "more_images", type: "file", maxSelect: 12, maxSize: MAX_UPLOAD, mimeTypes: IMAGE_MIMES, thumbs: THUMBS },
      { name: "medium", type: "text", max: 200, help: "e.g. Watercolour on paper, Stoneware with celadon glaze" },
      { name: "size", type: "text", max: 100, help: "e.g. 22x15\" or 16 oz" },
      { name: "year", type: "number", onlyInt: true },
      { name: "price", type: "text", max: 60, help: "Free text, e.g. $625" },
      { name: "status", type: "select", maxSelect: 1, values: ["available", "sold", "not_for_sale"] },
      { name: "details", type: "text", max: 2000, help: "Anything else to show under the title." },
      { name: "featured", type: "bool", help: "Show on the artist page and home page." },
      { name: "sort", type: "number" },
      { name: "published", type: "bool" },
      ...timestamps(),
    ],
    indexes: ["CREATE INDEX idx_artworks_section ON artworks (section, sort)"],
  });
  app.save(artworks);

  const posts = new Collection({
    type: "base",
    name: "posts",
    listRule: "published = true",
    viewRule: "published = true",
    fields: [
      { name: "title", type: "text", required: true, max: 200 },
      { name: "slug", type: "text", required: true, max: 120, pattern: "^[a-z0-9-]+$" },
      { name: "artist", type: "relation", collectionId: artists.id, maxSelect: 1, cascadeDelete: false },
      { name: "date", type: "date", required: true },
      { name: "excerpt", type: "text", max: 400 },
      { name: "body", type: "editor" },
      image("cover"),
      { name: "gallery", type: "file", maxSelect: 30, maxSize: MAX_UPLOAD, mimeTypes: IMAGE_MIMES, thumbs: THUMBS },
      { name: "published", type: "bool" },
      ...timestamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)"],
  });
  app.save(posts);

  const pages = new Collection({
    type: "base",
    name: "pages",
    listRule: "",
    viewRule: "",
    fields: [
      { name: "key", type: "text", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { name: "title", type: "text", max: 200 },
      { name: "body", type: "editor" },
      image("image"),
      ...timestamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_pages_key ON pages (key)"],
  });
  app.save(pages);

  const settings = app.settings();
  settings.meta.appName = "Heine Art";
  app.save(settings);
}, (app) => {
  for (const name of ["pages", "posts", "artworks", "sections", "artists"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
