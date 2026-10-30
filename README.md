# heineart.ca

Live at https://pottedpainter.ca.

The website of Brenda and Jerry Heine: watercolours by both, and Brenda's pottery.

It is a single small Docker container running [PocketBase](https://pocketbase.io):

- **Public site** at `/`: a gallery-first front end (`pb_public/`) with a separate arm for each artist, galleries, a lightbox, a pottery section, a journal and a contact page.
- **Admin page** at `/_/`: log in to add or edit artwork, pottery, posts and page text, and upload photos.
- **Data** (database + uploaded images) lives in `./pb_data` on the server. That folder is the only thing to back up.

```
Dockerfile, docker-compose.yml   container build and run
deploy/nginx-heineart.conf       nginx reverse-proxy config
deploy/deploy.sh                 pull + rebuild + restart
server/                          PocketBase build (version pinned in go.mod)
pb_migrations/                   database schema
pb_public/                       the public website (HTML/CSS/JS, fonts, logos)
migration/                       one-time import of the old Wix content + pottery photos
brand/                           business cards and the hand-lettered wordmarks cut from them
```

## First-time setup on the VPS

You need Docker (with the compose plugin), nginx and certbot.

```sh
# 1. Get the code
git clone https://github.com/scottastone/heineart.ca ~/docker/heineart.ca && cd ~/docker/heineart.ca

# 2. Build and start the container (listens on 127.0.0.1:8090 only)
docker compose up -d --build

# 3. Create your admin login
docker compose exec heineart /app/pocketbase superuser upsert you@example.com 'a-long-password' --dir /app/pb_data

# 4. Copy the old site's content in (needs the Wix site to still be online; takes a few minutes)
docker run --rm --network container:heineart -v "$PWD":/work -w /work \
  -e PB_URL=http://127.0.0.1:8090 -e PB_EMAIL=you@example.com -e PB_PASSWORD='a-long-password' \
  node:22-alpine node migration/import.mjs

# 5. nginx + HTTPS. Get the certificate first (certonly never edits nginx files),
#    then point nginx at the config in this folder with a symlink.
sudo certbot certonly --nginx -d pottedpainter.ca -d www.pottedpainter.ca
sudo ln -s "$PWD/deploy/nginx-pottedpainter.conf" /etc/nginx/sites-enabled/pottedpainter.conf
sudo nginx -t && sudo systemctl reload nginx
```

Before step 5 works, point the domain's DNS `A` (and `AAAA`) records for `pottedpainter.ca` and `www.pottedpainter.ca` at the VPS, and make sure ports 80 and 443 are open in the firewall. Certbot renews the certificate on its own; `sudo certbot renew --dry-run` checks that renewal works.

The import is safe to re-run; it skips anything already there. Once the new site is live and checked, the Wix plan can be cancelled.

## Updating the site

```sh
cd ~/docker/heineart.ca && ./deploy/deploy.sh
```

Content changes made in the admin page are stored in `pb_data` and survive rebuilds.

## Backups

Either copy the folder (`tar czf heineart-$(date +%F).tgz pb_data`), or use the admin page: **Settings → Backups** can make scheduled backups and copy them to S3-compatible storage.

## Using the admin page

Go to `https://pottedpainter.ca/_/` and log in.

| To do this | Go to | Notes |
|---|---|---|
| Add a painting or pottery piece | **artworks → New record** | Pick its **section** (e.g. Brenda › Pottery), upload the **image**, tick **published**. Extra photos go in **more_images**. |
| Mark something sold | the artwork → **status** | `sold` shows a badge; `not_for_sale` hides the inquiry button. |
| Change order | **sort** | Lower numbers come first. |
| Write a news post | **posts → New record** | Tick **published**. The Journal menu link appears once there is a published post. An unpublished example post is included. |
| Edit bios, taglines, wordmarks | **artists** | |
| Edit section intros or add a new gallery | **sections** | A new section shows up on the artist's page automatically. |
| Edit the home or contact text | **pages** | `home` and `contact`. |

Images are resized automatically for the site, so upload full-size photos straight from a phone.

## Local development

```sh
cd server && go build -o pocketbase . && cd ..
./server/pocketbase serve --dir pb_data   # http://127.0.0.1:8090
```
