package api

import (
	"context"
	"net/http"

	"github.com/kiro-app/backend/internal/auth"
)

type ctxKey string

const identityCtxKey ctxKey = "identity"

// authMiddleware verifies the Privy Bearer JWT and stashes the resulting
// Identity in the request context. Handlers retrieve it via identityFrom.
func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, err := s.verifier.Verify(r.Context(), r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Não autorizado")
			return
		}
		ctx := context.WithValue(r.Context(), identityCtxKey, identity)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func identityFrom(ctx context.Context) *auth.Identity {
	if v, ok := ctx.Value(identityCtxKey).(*auth.Identity); ok {
		return v
	}
	return nil
}

// corsMiddleware enforces an allow-list of origins. We deliberately do NOT use
// "*" because all our endpoints carry credentials (Bearer JWT) — wildcards are
// rejected by browsers when combined with Authorization headers.
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, allowed := range s.cfg.AllowedOrigins {
			if allowed == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Max-Age", "86400")
				break
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
