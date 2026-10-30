// Pre-generates the resized images PocketBase serves to the site, so the
// first visitor to each gallery doesn't wait for them to be made.
//
//   PB_URL=http://127.0.0.1:8090 node migration/warm-thumbs.mjs

const PB_URL = (process.env.PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
const SIZES = ["480x0", "960x0", "1600x0"];
const FIELDS = { artists: ["cover", "portrait", "showcase"], sections: ["cover"], artworks: ["image", "more_images"], pages: ["image"], posts: ["cover", "gallery"] };

const urls = [];
for (const [collection, fields] of Object.entries(FIELDS)) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records?perPage=500&skipTotal=1`);
  if (!res.ok) continue;
  for (const rec of (await res.json()).items) {
    for (const field of fields) {
      for (const file of [rec[field]].flat().filter(Boolean)) {
        for (const size of SIZES) urls.push(`${PB_URL}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(file)}?thumb=${size}`);
      }
    }
  }
}

let done = 0;
for (let i = 0; i < urls.length; i += 4) {
  await Promise.all(urls.slice(i, i + 4).map((u) => fetch(u).then((r) => r.arrayBuffer()).catch(() => {})));
  done = Math.min(i + 4, urls.length);
  process.stdout.write(`\rwarmed ${done}/${urls.length} images`);
}
console.log();
