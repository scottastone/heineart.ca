// One-time import of the content copied from the old Wix site (and Brenda's
// pottery photos) into PocketBase.
//
//   PB_URL=http://127.0.0.1:8090 PB_EMAIL=you@example.com PB_PASSWORD=... node migration/import.mjs
//
// Safe to re-run: records that already exist (matched by slug / title) are skipped.
// Images listed as {"wix": "..."} are downloaded from Wix's CDN, so run this
// before the Wix site is cancelled.

import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PB_URL = (process.env.PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
const { PB_EMAIL, PB_PASSWORD } = process.env;
if (!PB_EMAIL || !PB_PASSWORD) {
  console.error("Set PB_EMAIL and PB_PASSWORD to your PocketBase superuser login.");
  process.exit(1);
}

const content = JSON.parse(await readFile(join(ROOT, "migration/content.json"), "utf8"));
let token = "";

async function api(path, opts = {}) {
  const res = await fetch(PB_URL + path, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: token } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function loadImage(ref) {
  if (ref.file) {
    return { blob: new Blob([await readFile(join(ROOT, ref.file))]), name: basename(ref.file) };
  }
  // Ask Wix for a 2400px version instead of the multi-megabyte original.
  const ext = ref.wix.toLowerCase().endsWith(".png") ? "png" : "jpg";
  const url = `https://static.wixstatic.com/media/${ref.wix}/v1/fit/w_2400,h_2400,q_90/image.${ext}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url).catch((err) => ({ ok: false, status: err.message }));
    if (res.ok) return { blob: await res.blob(), name: `${ref.wix.split("~")[0]}.${ext}` };
    if (attempt >= 4) throw new Error(`download failed (${res.status}): ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function create(collection, data) {
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const refs = Array.isArray(value) ? value : [value];
    if (refs.length && typeof refs[0] === "object" && (refs[0].wix || refs[0].file)) {
      for (const ref of refs) {
        const { blob, name } = await loadImage(ref);
        form.append(key, blob, name);
      }
    } else {
      form.append(key, typeof value === "boolean" ? String(value) : value);
    }
  }
  return api(`/api/collections/${collection}/records`, { method: "POST", body: form });
}

async function findFirst(collection, filter) {
  const q = new URLSearchParams({ filter, perPage: "1", skipTotal: "1" });
  const res = await api(`/api/collections/${collection}/records?${q}`);
  return res.items[0];
}

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

async function inBatches(list, size, fn) {
  for (let i = 0; i < list.length; i += size) {
    await Promise.all(list.slice(i, i + size).map(fn));
  }
}

// --- run ---------------------------------------------------------------------

token = (await api("/api/collections/_superusers/auth-with-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
})).token;

const artistIds = {};
for (const a of content.artists) {
  const existing = await findFirst("artists", `slug = "${a.slug}"`);
  artistIds[a.slug] = existing ? existing.id : (await create("artists", a)).id;
  console.log(existing ? "exists " : "created", "artist", a.slug);
}

const sectionIds = {};
for (const s of content.sections) {
  const artist = artistIds[s.artist];
  const existing = await findFirst("sections", `artist = "${artist}" && slug = "${s.slug}"`);
  sectionIds[`${s.artist}/${s.slug}`] = existing ? existing.id : (await create("sections", { ...s, artist })).id;
  console.log(existing ? "exists " : "created", "section", `${s.artist}/${s.slug}`);
}

for (const p of content.pages) {
  const existing = await findFirst("pages", `key = "${p.key}"`);
  if (!existing) await create("pages", p);
  console.log(existing ? "exists " : "created", "page", p.key);
}

for (const p of content.posts) {
  const existing = await findFirst("posts", `slug = "${p.slug}"`);
  if (!existing) await create("posts", { ...p, artist: p.artist ? artistIds[p.artist] : undefined });
  console.log(existing ? "exists " : "created", "post", p.slug);
}

let created = 0;
await inBatches(content.artworks, 6, async (a) => {
  const section = sectionIds[a.section];
  const existing = await findFirst("artworks", `section = "${section}" && title = "${esc(a.title)}" && sort = ${a.sort}`);
  if (existing) return;
  await create("artworks", { ...a, section });
  created++;
  process.stdout.write(`\rcreated ${created} artworks`);
});
console.log(`\ndone: ${created} new artworks (${content.artworks.length} in content.json)`);
