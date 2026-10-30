// Heine Art front end. Reads everything from the PocketBase REST API that
// serves this page, so all content is editable from the admin at /_/.

const main = document.getElementById("main");
const CONTACT_EMAIL = "bheine.art@gmail.com";

// ---------------------------------------------------------------- data access

const cache = new Map();

async function list(collection, params = {}) {
  const q = new URLSearchParams({ perPage: "500", skipTotal: "1", ...params });
  const url = `/api/collections/${collection}/records?${q}`;
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} loading ${collection}`);
      return r.json();
    }).then((d) => d.items).catch((err) => { cache.delete(url); throw err; }));
  }
  return cache.get(url);
}

const artists = () => list("artists", { sort: "sort" });
const sections = () => list("sections", { sort: "sort", expand: "artist" });
const pages = () => list("pages");
const posts = () => list("posts", { sort: "-date", expand: "artist" });
const artworksIn = (sectionId) => list("artworks", { filter: `section="${sectionId}"`, sort: "sort,created" });
const featured = () => list("artworks", { filter: "featured=true", sort: "sort", expand: "section,section.artist" });

function fileUrl(record, filename, thumb) {
  if (!filename) return "";
  const base = `/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(filename)}`;
  return thumb ? `${base}?thumb=${thumb}` : base;
}

function img(record, filename, { sizes = "(max-width: 700px) 100vw, 33vw", alt = "", cls = "", eager = false } = {}) {
  if (!filename) return "";
  const src = fileUrl(record, filename, "960x0");
  const srcset = ["480x0 480w", "960x0 960w", "1600x0 1600w"]
    .map((s) => `${fileUrl(record, filename, s.split(" ")[0])} ${s.split(" ")[1]}`).join(", ");
  return `<img src="${src}" srcset="${srcset}" sizes="${sizes}" alt="${esc(alt)}" class="${cls}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------------------------------------------------------------- helpers

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const stripHtml = (html = "") => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function setMeta(title, description) {
  document.title = title ? `${title} · Heine Art` : "Heine Art · Brenda & Jerry Heine";
  if (description) document.querySelector('meta[name="description"]').setAttribute("content", description.slice(0, 160));
}

function accentFor(artist) {
  document.documentElement.style.setProperty("--accent", artist?.accent || "var(--ink)");
}

function priceLine(a) {
  if (a.status === "sold") return '<span class="badge sold">Sold</span>';
  if (a.status === "not_for_sale") return '<span class="badge">Not for sale</span>';
  return esc([a.size, a.price].filter(Boolean).join(" · "));
}

function sectionPath(section) {
  const artist = section.expand?.artist;
  return `/${artist?.slug}/${section.slug}`;
}

const fmtDate = (d) => new Date(d.replace(" ", "T")).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

// ---------------------------------------------------------------- views

async function viewHome() {
  const [as, ps, feat, secs, blog] = await Promise.all([artists(), pages(), featured(), sections(), posts()]);
  const home = ps.find((p) => p.key === "home") || {};
  const pottery = secs.find((s) => s.slug === "pottery");
  const potteryPieces = feat.filter((a) => a.section === pottery?.id).slice(0, 4);
  const paintings = feat.filter((a) => a.section !== pottery?.id).slice(0, 4);
  accentFor(null);
  setMeta("", stripHtml(home.body));

  return `
    <section class="arms" aria-label="The artists">
      ${as.map((a, i) => `
        <a class="arm" href="/${a.slug}" data-link>
          ${img(a, a.cover, { sizes: "(max-width: 760px) 100vw, 50vw", alt: `Painting by ${a.name}`, eager: i === 0 })}
          <div class="arm-text">
            <h2>${esc(a.name)}</h2>
            <p>${esc(a.tagline)}</p>
            <span class="btn arrow">Explore</span>
          </div>
        </a>`).join("")}
    </section>

    <section class="wrap intro">
      <div>
        <p class="eyebrow">Father &amp; daughter</p>
        <h1>${esc(home.title || "Welcome to Heine Art")}</h1>
        <div class="prose">${home.body || ""}</div>
      </div>
      ${home.image ? `<figure class="photo">${img(home, home.image, { sizes: "(max-width: 860px) 100vw, 45vw", alt: "Brenda and Jerry Heine" })}
        <figcaption>Brenda and Jerry</figcaption></figure>` : ""}
    </section>

    ${pottery ? `
    <section class="band">
      <div class="wrap">
        <div class="band-head">
          <div>
            <p class="eyebrow">New from Brenda</p>
            ${pottery.wordmark ? `<img class="wordmark" src="${fileUrl(pottery, pottery.wordmark)}" alt="Brenda Heine Pottery" width="560">` : `<h2>Pottery</h2>`}
          </div>
          <a class="btn arrow" href="${sectionPath(pottery)}" data-link>See the pottery</a>
        </div>
        <div class="strip">
          ${potteryPieces.map((a) => `<a href="${sectionPath(pottery)}?piece=${a.id}" data-link>${img(a, a.image, { sizes: "(max-width: 860px) 50vw, 25vw", alt: a.title })}<span>${esc(a.title)}</span></a>`).join("")}
        </div>
      </div>
    </section>` : ""}

    ${paintings.length ? `
    <section class="wrap section-block">
      <div class="band-head">
        <div><p class="eyebrow">From the studio</p><h2>Selected paintings</h2></div>
      </div>
      <div class="strip">
        ${paintings.map((a) => {
          const s = a.expand?.section;
          return `<a href="/${s?.expand?.artist?.slug}/${s?.slug}?piece=${a.id}" data-link>${img(a, a.image, { sizes: "(max-width: 860px) 50vw, 25vw", alt: a.title })}<span>${esc(a.title)}</span></a>`;
        }).join("")}
      </div>
    </section>` : ""}

    ${blog.length ? `
    <section class="wrap section-block">
      <div class="band-head"><div><p class="eyebrow">Journal</p><h2>Latest news</h2></div><a class="btn arrow" href="/journal" data-link>All posts</a></div>
      <div class="posts">${blog.slice(0, 3).map(postCard).join("")}</div>
    </section>` : ""}
  `;
}

async function viewArtist(slug) {
  const [as, secs] = await Promise.all([artists(), sections()]);
  const artist = as.find((a) => a.slug === slug);
  if (!artist) return viewNotFound();
  accentFor(artist);
  setMeta(artist.name, stripHtml(artist.bio));
  const mine = secs.filter((s) => s.artist === artist.id);
  const firsts = await Promise.all(mine.map((s) => s.cover ? null : artworksIn(s.id)));

  // A single-section artist (Jerry) goes straight to the gallery from the cards.
  const cards = mine.map((s, i) => {
    const pieces = firsts[i];
    const coverRec = s.cover ? s : pieces?.[0];
    const coverFile = s.cover ? s.cover : pieces?.[0]?.image;
    const count = pieces ? `${pieces.length} piece${pieces.length === 1 ? "" : "s"}` : "";
    return `
      <a class="section-card ${i === 0 && mine.length > 2 ? "feature" : ""}" href="/${slug}/${s.slug}" data-link>
        <div class="img">${coverRec ? img(coverRec, coverFile, { sizes: "(max-width: 640px) 100vw, 50vw", alt: s.title }) : ""}</div>
        <h3>${esc(s.title)}</h3>
        <p>${count || "View gallery"}</p>
      </a>`;
  }).join("");

  const single = mine.length === 1 ? galleryBlock(firsts[0] || await artworksIn(mine[0].id), { artist, section: mine[0], path: `/${slug}/${mine[0].slug}` }) : null;

  const html = `
    <section class="wrap artist-hero">
      ${artist.wordmark
        ? `<h1><img class="wordmark" src="${fileUrl(artist, artist.wordmark)}" alt="${esc(artist.name)}" width="620"></h1>`
        : `<h1>${esc(artist.name)}</h1>`}
      <p class="tagline">${esc(artist.tagline)}</p>
    </section>

    <section class="wrap artist-about">
      <div>
        <p class="eyebrow">About ${esc(artist.name.split(" ")[0])}</p>
        <div class="prose">${artist.bio || ""}</div>
        <p style="margin-top:28px"><a class="btn arrow" href="#work">View the work</a></p>
      </div>
      ${artist.showcase?.length ? `<div class="mosaic">${artist.showcase.map((f, i) =>
        `<button data-showcase="${i}" aria-label="View image ${i + 1}">${img(artist, f, { sizes: "(max-width: 860px) 100vw, 40vw" })}</button>`).join("")}</div>` : ""}
    </section>

    <section class="wrap section-block" id="work">
      <p class="eyebrow">The work</p>
      ${single
        ? `<h2>${esc(mine[0].title)}</h2>${mine[0].pricing_note ? `<p class="note muted"><em>${esc(mine[0].pricing_note)}</em></p>` : ""}${single.html}`
        : `<h2>Galleries</h2><div class="sections-grid">${cards}</div>`}
    </section>
  `;
  return { html, after: single?.after };
}

async function viewSection(artistSlug, sectionSlug, params) {
  const [as, secs] = await Promise.all([artists(), sections()]);
  const artist = as.find((a) => a.slug === artistSlug);
  const section = secs.find((s) => s.slug === sectionSlug && s.artist === artist?.id);
  if (!artist || !section) return viewNotFound();
  accentFor(artist);
  setMeta(`${section.title} · ${artist.name}`, stripHtml(section.intro) || `${section.title} by ${artist.name}`);
  const pieces = await artworksIn(section.id);
  const gallery = galleryBlock(pieces, { artist, section }, params);

  const html = `
    <div class="wrap">
      <p class="crumbs"><a href="/${artist.slug}" data-link>${esc(artist.name)}</a> / ${esc(section.title)}</p>
      <header class="section-head">
        ${section.wordmark
          ? `<h1><img class="wordmark" src="${fileUrl(section, section.wordmark)}" alt="${esc(`${artist.name} ${section.title}`)}" width="720"></h1>`
          : `<h1>${esc(section.title)}</h1>`}
        ${section.intro ? `<div class="prose">${section.intro}</div>` : ""}
        ${section.pricing_note ? `<p class="note">${esc(section.pricing_note)}</p>` : ""}
      </header>
      ${gallery.html}
    </div>`;

  return { html, after: gallery.after };
}

// Filter chips + masonry gallery + lightbox wiring for one section's pieces.
function galleryBlock(pieces, ctx, params) {
  const hasSold = pieces.some((p) => p.status === "sold");
  const hasAvail = pieces.some((p) => p.status === "available");
  const html = `
      ${hasSold && hasAvail ? `
        <div class="filters" role="group" aria-label="Filter">
          <button class="chip" data-filter="all" aria-pressed="true">All</button>
          <button class="chip" data-filter="available" aria-pressed="false">Available</button>
          <button class="chip" data-filter="sold" aria-pressed="false">Sold</button>
        </div>` : ""}
      ${pieces.length ? `<div class="gallery">${pieces.map((a, i) => `
        <figure class="piece" data-status="${a.status || "available"}">
          <button data-piece="${i}" aria-label="View ${esc(a.title)}">${img(a, a.image, { sizes: "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 400px", alt: a.title })}</button>
          <figcaption><span class="t">${esc(a.title)}</span><span class="m">${priceLine(a)}</span></figcaption>
        </figure>`).join("")}</div>`
        : `<p class="empty">New pieces are on their way. Check back soon, or <a href="/contact" data-link>get in touch</a>.</p>`}`;

  return {
    html,
    after() {
      main.querySelectorAll("[data-piece]").forEach((b) =>
        b.addEventListener("click", () => openLightbox(pieces, +b.dataset.piece, ctx)));
      main.querySelectorAll("[data-filter]").forEach((chip) => chip.addEventListener("click", () => {
        main.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        main.querySelectorAll(".piece").forEach((p) => {
          p.hidden = chip.dataset.filter !== "all" && p.dataset.status !== chip.dataset.filter;
        });
      }));
      const idx = pieces.findIndex((p) => p.id === params?.get("piece"));
      if (idx >= 0) openLightbox(pieces, idx, ctx);
    },
  };
}

function postCard(p) {
  return `
    <a class="post-card" href="/journal/${p.slug}" data-link>
      <div class="img">${p.cover ? img(p, p.cover, { sizes: "(max-width: 700px) 100vw, 33vw", alt: p.title }) : ""}</div>
      <time datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
      <h3>${esc(p.title)}</h3>
      ${p.excerpt ? `<p class="muted">${esc(p.excerpt)}</p>` : ""}
    </a>`;
}

async function viewJournal() {
  const blog = await posts();
  accentFor(null);
  setMeta("Journal", "News, shows and new work from Brenda and Jerry Heine.");
  return `
    <div class="wrap">
      <header class="section-head"><p class="eyebrow">News &amp; new work</p><h1>Journal</h1></header>
      ${blog.length ? `<div class="posts">${blog.map(postCard).join("")}</div>` : `<p class="empty">No posts yet.</p>`}
    </div>`;
}

async function viewPost(slug) {
  const blog = await posts();
  const p = blog.find((x) => x.slug === slug);
  if (!p) return viewNotFound();
  accentFor(p.expand?.artist);
  setMeta(p.title, p.excerpt || stripHtml(p.body));
  const gallery = (p.gallery || []).map((f) => ({ ...p, image: f, title: p.title, _single: true }));
  return {
    html: `
      <article class="wrap narrow post">
        <p class="crumbs"><a href="/journal" data-link>Journal</a></p>
        <time datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
        <h1>${esc(p.title)}</h1>
        ${p.cover ? img(p, p.cover, { sizes: "(max-width: 760px) 100vw, 720px", alt: "", cls: "cover", eager: true }) : ""}
        <div class="prose">${p.body || ""}</div>
        ${gallery.length ? `<div class="post-gallery">${gallery.map((g, i) => `<button data-g="${i}">${img(p, g.image, { sizes: "(max-width: 760px) 100vw, 360px" })}</button>`).join("")}</div>` : ""}
      </article>`,
    after() {
      main.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => openLightbox(gallery, +b.dataset.g, {})));
    },
  };
}

async function viewContact() {
  const ps = await pages();
  const c = ps.find((p) => p.key === "contact") || {};
  accentFor({ accent: "#9b2226" });
  setMeta("Contact", "Get in touch about paintings, pottery, commissions and art cards.");
  return `
    <section class="wrap contact">
      <div>
        <p class="eyebrow">Contact</p>
        <h1>${esc(c.title || "Get in touch")}</h1>
        <div class="prose">${c.body || ""}</div>
        <div class="actions">
          <a class="btn solid" href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Heine Art inquiry")}">Email us</a>
          <a class="btn" href="https://www.instagram.com/bheine.art/" rel="noopener">Instagram</a>
        </div>
        <img class="card-img" src="/assets/brand/card-pottery.jpg" alt="Brenda Heine Pottery business card: heineart.ca, @bheine.art, bheine.art@gmail.com" width="420" loading="lazy">
      </div>
      ${c.image ? `<div>${img(c, c.image, { sizes: "(max-width: 760px) 100vw, 50vw", alt: "Asters, watercolour" })}</div>` : ""}
    </section>`;
}

function viewNotFound() {
  setMeta("Not found");
  return `<div class="wrap section-head"><h1>Page not found</h1><p><a href="/" data-link>Back to the home page</a></p></div>`;
}

// ---------------------------------------------------------------- lightbox

const lb = document.querySelector(".lightbox");
const lbImg = lb.querySelector(".lb-media img");
const lbCap = lb.querySelector(".lb-caption");
let lbItems = [], lbIndex = 0, lbSub = 0, lbCtx = {}, lbReturnFocus = null;

function openLightbox(items, index, ctx) {
  lbItems = items; lbIndex = index; lbSub = 0; lbCtx = ctx;
  lbReturnFocus = document.activeElement;
  lb.hidden = false;
  document.body.classList.add("lb-open");
  renderLightbox();
  lb.querySelector(".lb-close").focus();
}

function closeLightbox() {
  lb.hidden = true;
  document.body.classList.remove("lb-open");
  if (lbCtx.section) history.replaceState(null, "", location.pathname);
  lbReturnFocus?.focus();
}

function renderLightbox() {
  const a = lbItems[lbIndex];
  const files = [a.image, ...(a.more_images || [])].filter(Boolean);
  const file = files[lbSub] || a.image;
  lbImg.src = fileUrl(a, file, "1600x0");
  lbImg.alt = a.title || "";
  const multi = lbItems.length > 1;
  lb.querySelector(".lb-prev").hidden = !multi;
  lb.querySelector(".lb-next").hidden = !multi;

  if (a._single || lbCtx.showcase) { lbCap.innerHTML = ""; return; }
  const meta = [a.medium, a.size, a.year, a.status === "available" ? a.price : ""].filter(Boolean).map(esc).join(" · ");
  const status = a.status === "sold" ? ' <span class="badge sold">Sold</span>' : a.status === "not_for_sale" ? ' <span class="badge">Not for sale</span>' : "";
  const subject = encodeURIComponent(`Inquiry: ${a.title}${lbCtx.artist ? ` (${lbCtx.artist.name})` : ""}`);
  const link = `${location.origin}${lbCtx.path || location.pathname}?piece=${a.id}`;
  lbCap.innerHTML = `
    ${files.length > 1 ? `<div class="lb-thumbs">${files.map((f, i) => `<button data-sub="${i}" aria-current="${i === lbSub}" aria-label="Photo ${i + 1}"><img src="${fileUrl(a, f, "600x600")}" alt=""></button>`).join("")}</div>` : ""}
    <h2>${esc(a.title)}${status}</h2>
    ${meta ? `<p class="meta">${meta}</p>` : ""}
    ${a.details ? `<p class="details">${esc(a.details)}</p>` : ""}
    ${a.status !== "sold" ? `<a class="btn" href="mailto:${CONTACT_EMAIL}?subject=${subject}&body=${encodeURIComponent(`I'm interested in "${a.title}".\n\n${link}`)}">Inquire about this piece</a>` : ""}`;
  lbCap.querySelectorAll("[data-sub]").forEach((b) => b.addEventListener("click", () => { lbSub = +b.dataset.sub; renderLightbox(); }));
  if (lbCtx.section && !lbCtx.path) history.replaceState(null, "", `${location.pathname}?piece=${a.id}`);

  // warm the neighbours
  [lbIndex - 1, lbIndex + 1].forEach((i) => {
    const n = lbItems[(i + lbItems.length) % lbItems.length];
    if (n) new Image().src = fileUrl(n, n.image, "1600x0");
  });
}

function step(d) {
  if (lbItems.length < 2) return;
  lbIndex = (lbIndex + d + lbItems.length) % lbItems.length;
  lbSub = 0;
  renderLightbox();
}

lb.querySelector(".lb-close").addEventListener("click", closeLightbox);
lb.querySelector(".lb-prev").addEventListener("click", () => step(-1));
lb.querySelector(".lb-next").addEventListener("click", () => step(1));
lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-media")) closeLightbox(); });
document.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});
let touchX = null;
lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) step(dx > 0 ? -1 : 1);
  touchX = null;
});

// ---------------------------------------------------------------- router

async function route() {
  lastUrl = location.pathname + location.search;
  const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(location.search);
  if (!lb.hidden) { lb.hidden = true; document.body.classList.remove("lb-open"); }

  let view;
  try {
    if (parts.length === 0) view = await viewHome();
    else if (parts[0] === "journal") view = parts[1] ? await viewPost(parts[1]) : await viewJournal();
    else if (parts[0] === "contact") view = await viewContact();
    else if (parts.length === 1) view = await viewArtist(parts[0]);
    else if (parts.length === 2) view = await viewSection(parts[0], parts[1], params);
    else view = viewNotFound();
  } catch (err) {
    console.error(err);
    view = `<div class="wrap section-head"><h1>Something went wrong</h1><p class="muted">Please try again in a moment.</p></div>`;
  }

  const { html, after } = typeof view === "string" ? { html: view } : view;
  main.innerHTML = html;
  after?.();

  // artist page mosaic opens its own images in the lightbox
  main.querySelectorAll("[data-showcase]").forEach((b) => b.addEventListener("click", async () => {
    const artist = (await artists()).find((a) => a.slug === parts[0]);
    const items = artist.showcase.map((f) => ({ ...artist, image: f, title: artist.name, more_images: [] }));
    openLightbox(items, +b.dataset.showcase, { showcase: true });
  }));

  const path = "/" + parts.join("/");
  document.querySelectorAll(".site-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    const current = href === path || (href !== "/brenda/pottery" && path.startsWith(href + "/") && !path.startsWith("/brenda/pottery"));
    if (current) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

function navigate(url) {
  history.pushState(null, "", url);
  window.scrollTo(0, 0);
  closeMenu();
  route();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});
let lastUrl = location.pathname + location.search;
window.addEventListener("popstate", () => {
  // in-page anchors (#work) also fire popstate; only re-render on real navigation
  const url = location.pathname + location.search;
  if (url !== lastUrl) route();
});

// mobile menu
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("site-nav");
function closeMenu() { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
toggle.addEventListener("click", () => {
  const open = !nav.classList.contains("open");
  nav.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", String(open));
});

document.querySelector("[data-year]").textContent = new Date().getFullYear();
posts().then((p) => { if (p.length) document.querySelector("[data-journal]").hidden = false; }).catch(() => {});
route();
