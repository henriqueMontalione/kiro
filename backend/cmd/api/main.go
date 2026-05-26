package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/kiro-app/backend/internal/api"
	"github.com/kiro-app/backend/internal/auth"
	"github.com/kiro-app/backend/internal/config"
	"github.com/kiro-app/backend/internal/crypto"
	"github.com/kiro-app/backend/internal/migrate"
	"github.com/kiro-app/backend/migrations"
)

func main() {
	// godotenv.Load is a no-op when there's no .env (e.g. in production
	// container where env comes from the orchestrator) — and that's fine.
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Run migrations BEFORE opening the pool to avoid racing with the first
	// query. Idempotent — does nothing when the schema is already current.
	if err := migrate.Up(cfg.DatabaseURL, migrations.FS); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db pool: %v", err)
	}
	defer pool.Close()

	pingCtx, pingCancel := context.WithTimeout(ctx, 5*time.Second)
	defer pingCancel()
	if err := pool.Ping(pingCtx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	verifier, err := auth.NewPrivyVerifier(ctx, cfg.PrivyAppID)
	if err != nil {
		log.Fatalf("privy verifier: %v", err)
	}

	vault, err := crypto.NewVault(cfg.PIIMasterKey)
	if err != nil {
		log.Fatalf("pii vault: %v", err)
	}

	handler := api.NewRouter(cfg, pool, verifier, vault)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		// No global WriteTimeout — chi's middleware.Timeout handles per-route
		// timeouts and a server-level WriteTimeout would short-circuit
		// long-lived responses (SSE, downloads) we may add later.
	}

	srvErr := make(chan error, 1)
	go func() {
		log.Printf("listening on :%s (allowed origins: %v)", cfg.Port, cfg.AllowedOrigins)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			srvErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-stop:
		log.Println("shutdown requested")
	case err := <-srvErr:
		log.Printf("server error: %v", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	log.Println("shutdown complete")
}
