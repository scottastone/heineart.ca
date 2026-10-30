# --- build PocketBase (pinned in server/go.mod) ------------------------------
FROM golang:1-alpine AS build
# go.mod may need a newer Go than the image ships; let Go fetch it.
ENV GOTOOLCHAIN=auto CGO_ENABLED=0
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN go build -trimpath -ldflags="-s -w" -o /pocketbase .

# --- runtime -----------------------------------------------------------------
FROM alpine:3.22
WORKDIR /app
COPY --from=build /pocketbase /app/pocketbase
COPY pb_migrations /app/pb_migrations
COPY pb_public /app/pb_public
VOLUME /app/pb_data
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1
CMD ["/app/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/app/pb_data"]
