# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

WORKDIR /src

# Pre-cache deps to speed up rebuilds when only Go files change.
COPY go.mod go.sum* ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 produces a fully static binary, runnable from a scratch base.
# -trimpath strips local file paths from the binary for reproducible builds.
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/api ./cmd/api

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S kiro && adduser -S kiro -G kiro

COPY --from=builder /out/api /usr/local/bin/api

USER kiro
EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/api"]
