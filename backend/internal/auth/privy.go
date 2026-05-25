// Package auth verifies Privy-issued JWTs against Privy's JWKS so the backend
// can identify the authenticated lojista without ever holding a password.
//
// The verification is cryptographic, not cosmetic:
//   - signature checked against Privy's published JWKS (cached in-memory)
//   - issuer must be "privy.io"
//   - audience must equal the configured Privy app ID
//   - expiration / not-before validated by jwx automatically
//
// Note the JWKS path is /jwks.json directly under the app — NOT under
// /.well-known/. Privy doesn't publish the standard OIDC discovery doc.
//
// The Privy DID (sub claim, e.g. "did:privy:abc123") is the stable identifier
// we use to key the users table.
package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

type Verifier struct {
	appID  string
	keyset jwk.Set
}

type Identity struct {
	// DID is the Privy decentralized identifier, used as the stable user key.
	DID string
	// Email is best-effort extracted from the JWT's `email` claim if present;
	// not all login methods populate it (e.g. wallet-only login), so callers
	// must treat it as optional.
	Email string
}

// NewPrivyVerifier sets up a cached JWKS fetcher pointed at the Privy app.
// The cache refreshes on its own when keys rotate (jwk.Cache handles that).
func NewPrivyVerifier(ctx context.Context, appID string) (*Verifier, error) {
	if appID == "" {
		return nil, fmt.Errorf("privy app id is required")
	}
	jwksURL := fmt.Sprintf("https://auth.privy.io/api/v1/apps/%s/jwks.json", appID)

	cache := jwk.NewCache(ctx)
	if err := cache.Register(jwksURL); err != nil {
		return nil, fmt.Errorf("register jwks: %w", err)
	}
	// Warm the cache on startup so the first request doesn't pay the fetch cost.
	if _, err := cache.Refresh(ctx, jwksURL); err != nil {
		return nil, fmt.Errorf("warm jwks cache: %w", err)
	}

	return &Verifier{
		appID:  appID,
		keyset: jwk.NewCachedSet(cache, jwksURL),
	}, nil
}

// Verify pulls the Bearer token from the request and validates it. Returns the
// authenticated identity on success, or an error suitable for a 401 response.
func (v *Verifier) Verify(ctx context.Context, r *http.Request) (*Identity, error) {
	raw := r.Header.Get("Authorization")
	if !strings.HasPrefix(raw, "Bearer ") {
		return nil, fmt.Errorf("missing bearer token")
	}
	token := strings.TrimPrefix(raw, "Bearer ")
	if token == "" {
		return nil, fmt.Errorf("empty bearer token")
	}

	parsed, err := jwt.ParseString(token,
		jwt.WithKeySet(v.keyset),
		jwt.WithIssuer("privy.io"),
		jwt.WithAudience(v.appID),
		jwt.WithValidate(true),
	)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	identity := &Identity{DID: parsed.Subject()}
	if identity.DID == "" {
		return nil, fmt.Errorf("token missing sub claim")
	}

	// Privy sometimes embeds the verified email under the `email` claim.
	// Treat as optional — wallet-only logins won't have one.
	if v, ok := parsed.Get("email"); ok {
		if s, ok := v.(string); ok {
			identity.Email = s
		}
	}

	return identity, nil
}
