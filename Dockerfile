ARG BUILD_SHA=dev

FROM node:22-alpine AS web-builder
ARG BUILD_SHA
WORKDIR /build
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
COPY frontend ./frontend
RUN npm ci && VITE_BUILD_SHA="${BUILD_SHA:-dev}" npm run build

FROM rust:1-alpine AS server-builder
ARG BUILD_SHA
RUN apk add --no-cache musl-dev sqlite-dev pkgconfig
WORKDIR /build
COPY Cargo.toml Cargo.lock build.rs ./
COPY migrations ./migrations
COPY src ./src
RUN BUILD_SHA="${BUILD_SHA:-dev}" cargo build --locked --release

FROM alpine:3.22
ARG BUILD_SHA
RUN apk add --no-cache ca-certificates sqlite-libs \
    && addgroup -S ledger \
    && adduser -S -G ledger -h /app ledger \
    && mkdir -p /app/dist /data \
    && chown -R ledger:ledger /app /data
WORKDIR /app
COPY --from=server-builder /build/target/release/internal-event-ledger /usr/local/bin/internal-event-ledger
COPY --from=web-builder /build/dist ./dist
ENV PORT=8080 \
    BUILD_SHA=$BUILD_SHA \
    DATABASE_URL="sqlite:///data/ledger.db?mode=rwc" \
    ADMIN_TOKEN_FILE=/data/admin-token \
    STATIC_DIR=/app/dist \
    RUST_LOG=internal_event_ledger=info,tower_http=info
LABEL org.opencontainers.image.revision=$BUILD_SHA
VOLUME ["/data"]
EXPOSE 8080
USER ledger
ENTRYPOINT ["/usr/local/bin/internal-event-ledger"]
