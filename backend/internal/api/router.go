package api

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kiro-app/backend/internal/auth"
	"github.com/kiro-app/backend/internal/config"
	"github.com/kiro-app/backend/internal/crypto"
	"github.com/kiro-app/backend/internal/db/sqlc"
)

type Server struct {
	cfg      *config.Config
	pool     *pgxpool.Pool
	queries  *sqlc.Queries
	verifier *auth.Verifier
	vault    *crypto.Vault
	logger   *log.Logger
}

func NewRouter(cfg *config.Config, pool *pgxpool.Pool, verifier *auth.Verifier, vault *crypto.Vault) http.Handler {
	s := &Server{
		cfg:      cfg,
		pool:     pool,
		queries:  sqlc.New(pool),
		verifier: verifier,
		vault:    vault,
		logger:   log.New(os.Stdout, "[api] ", log.LstdFlags|log.Lmsgprefix),
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(20 * time.Second))
	r.Use(s.corsMiddleware)

	// Liveness/readiness: also confirms the pool can reach Postgres.
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := contextWithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := s.pool.Ping(ctx); err != nil {
			writeError(w, http.StatusServiceUnavailable, "db unavailable")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/me", func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/", s.getMe)
		r.Post("/", s.createMe)
		r.Patch("/", s.updateMe)
		r.Delete("/", s.deleteMe)
		r.Get("/consent", s.listMyConsents)
		r.Post("/consent", s.postConsent)
		r.Get("/transactions", s.listTransactions)
		r.Post("/transactions", s.createTransaction)
		r.Get("/kyc-profile", s.getKycProfile)
		r.Post("/kyc-profile", s.createKycProfile)
		r.Post("/kyc-profile/docs", s.markKycDocsUploaded)
	})

	return r
}
