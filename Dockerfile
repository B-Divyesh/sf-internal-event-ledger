ARG BUILD_SHA

FROM node:22-alpine AS web-builder
ARG BUILD_SHA
WORKDIR /build
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
COPY frontend ./frontend
RUN test -n "$BUILD_SHA"
ENV VITE_BUILD_SHA=$BUILD_SHA
RUN npm ci && npm run build

FROM rust:1.88-alpine AS server-builder
ARG BUILD_SHA
RUN apk add --no-cache musl-dev sqlite-dev pkgconfig
WORKDIR /build
COPY Cargo.toml Cargo.lock build.rs ./
COPY migrations ./migrations
COPY src ./src
RUN test -n "$BUILD_SHA"
ENV BUILD_SHA=$BUILD_SHA
RUN cargo build --locked --release

FROM alpine:3.22
RUN apk add --no-cache ca-certificates sqlite-libs \
    && addgroup -S ledger \
    && adduser -S -G ledger -h /app ledger \
    && mkdir -p /app/dist /data \
    && chown -R ledger:ledger /app /data
WORKDIR /app
COPY --from=server-builder /build/target/release/internal-event-ledger /usr/local/bin/internal-event-ledger
COPY --from=web-builder /build/dist ./dist
ENV PORT=8080 \
    DATABASE_URL="sqlite:///data/ledger.db?mode=rwc" \
    STATIC_DIR=/app/dist \
    RUST_LOG=internal_event_ledger=info,tower_http=info
VOLUME ["/data"]
EXPOSE 8080
USER ledger
ENTRYPOINT ["/usr/local/bin/internal-event-ledger"]
