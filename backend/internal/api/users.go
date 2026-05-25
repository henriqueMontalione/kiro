package api

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kiro-app/backend/internal/db/sqlc"
)

var (
	cnpjRegex          = regexp.MustCompile(`^\d{14}$`)
	emailRegex         = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	stellarPKRe        = regexp.MustCompile(`^G[A-Z2-7]{55}$`)
	policyVersionRegex = regexp.MustCompile(`^v\d+(\.\d+){0,2}$`)
)

// requiredPolicies must all be accepted at user creation time. Adding a new
// required policy means existing users will need to re-consent before they
// can continue using the app (UI handles that via a separate flow).
var requiredPolicies = []string{"terms_of_use", "privacy_policy"}

// userResponse is what we expose over HTTP — uses the same shape as the
// sqlc.User model. Defined as a separate type to lock the public contract
// independent of internal struct evolution.
type userResponse struct {
	ID               uuid.UUID `json:"id"`
	StoreName        string    `json:"store_name"`
	Cnpj             string    `json:"cnpj"`
	Email            string    `json:"email"`
	PixKey           string    `json:"pix_key"`
	StellarPublicKey string    `json:"stellar_public_key"`
	Status           string    `json:"status"`
	CreatedAt        string    `json:"created_at"`
	UpdatedAt        string    `json:"updated_at"`
}

func toResponse(u sqlc.User) userResponse {
	return userResponse{
		ID:               u.ID,
		StoreName:        u.StoreName,
		Cnpj:             u.Cnpj,
		Email:            u.Email,
		PixKey:           u.PixKey,
		StellarPublicKey: u.StellarPublicKey,
		Status:           u.Status,
		CreatedAt:        u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        u.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// GET /api/me — returns the authenticated lojista's profile. 404 if they
// haven't completed onboarding yet (frontend should redirect to the form).
func (s *Server) getMe(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	user, err := s.queries.GetUserByPrivyID(r.Context(), identity.DID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Cadastro não encontrado")
		return
	}
	if err != nil {
		s.logger.Printf("getMe: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	writeJSON(w, http.StatusOK, toResponse(user))
}

// consentAcceptance is a single consent line in the createMe body. Each entry
// becomes one INSERT into consent_logs inside the same transaction as the
// user creation.
type consentAcceptance struct {
	PolicyType    string `json:"policy_type"`
	PolicyVersion string `json:"policy_version"`
}

type createMeBody struct {
	StoreName        string              `json:"store_name"`
	Cnpj             string              `json:"cnpj"`
	Email            string              `json:"email"`
	PixKey           string              `json:"pix_key"`
	StellarPublicKey string              `json:"stellar_public_key"`
	Consents         []consentAcceptance `json:"consents"`
}

// POST /api/me — creates the lojista profile on first login. The user row
// and the consent_log entries are written atomically: if any consent insert
// fails (or the required policies aren't accepted), nothing is persisted.
func (s *Server) createMe(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	var body createMeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Corpo da requisição inválido")
		return
	}

	body.StoreName = strings.TrimSpace(body.StoreName)
	body.Cnpj = digitsOnly(body.Cnpj)
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	body.PixKey = strings.TrimSpace(body.PixKey)
	body.StellarPublicKey = strings.TrimSpace(body.StellarPublicKey)

	// Fall back to Privy's email claim when the client didn't pass one.
	if body.Email == "" && identity.Email != "" {
		body.Email = strings.ToLower(identity.Email)
	}

	if msg := validateCreate(body); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	ip := pgTextOrNull(clientIP(r))
	ua := pgTextOrNull(r.UserAgent())

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		s.logger.Printf("createMe begin tx: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	defer tx.Rollback(context.Background()) // no-op if Commit succeeded

	q := sqlc.New(tx)

	user, err := q.CreateUser(r.Context(), sqlc.CreateUserParams{
		ID:               uuid.New(),
		PrivyUserID:      identity.DID,
		StoreName:        body.StoreName,
		Cnpj:             body.Cnpj,
		Email:            body.Email,
		PixKey:           body.PixKey,
		StellarPublicKey: body.StellarPublicKey,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
			switch {
			case strings.Contains(pgErr.ConstraintName, "privy"):
				writeError(w, http.StatusConflict, "Esta conta já tem um cadastro")
			case strings.Contains(pgErr.ConstraintName, "cnpj"):
				writeError(w, http.StatusConflict, "CNPJ já cadastrado")
			default:
				writeError(w, http.StatusConflict, "Registro já existe")
			}
			return
		}
		s.logger.Printf("createMe insert user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	for _, c := range body.Consents {
		if _, err := q.InsertConsentLog(r.Context(), sqlc.InsertConsentLogParams{
			ID:            uuid.New(),
			UserID:        user.ID,
			PolicyType:    c.PolicyType,
			PolicyVersion: c.PolicyVersion,
			Action:        "granted",
			IPAddress:     ip,
			UserAgent:     ua,
		}); err != nil {
			s.logger.Printf("createMe insert consent (%s %s): %v", c.PolicyType, c.PolicyVersion, err)
			writeError(w, http.StatusInternalServerError, "Erro interno")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		s.logger.Printf("createMe commit: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	writeJSON(w, http.StatusCreated, toResponse(user))
}

type updateMeBody struct {
	StoreName *string `json:"store_name,omitempty"`
	PixKey    *string `json:"pix_key,omitempty"`
}

// PATCH /api/me — partial update. Only store_name and pix_key are mutable
// here; CNPJ, email and Stellar key require dedicated flows (re-KYC, key
// rotation) which we'll add later.
func (s *Server) updateMe(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	var body updateMeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Corpo da requisição inválido")
		return
	}

	params := sqlc.UpdateUserParams{PrivyUserID: identity.DID}
	if body.StoreName != nil {
		trimmed := strings.TrimSpace(*body.StoreName)
		if trimmed == "" || len(trimmed) > 255 {
			writeError(w, http.StatusBadRequest, "Nome da loja inválido")
			return
		}
		params.StoreName = pgtype.Text{String: trimmed, Valid: true}
	}
	if body.PixKey != nil {
		trimmed := strings.TrimSpace(*body.PixKey)
		if trimmed == "" || len(trimmed) > 255 {
			writeError(w, http.StatusBadRequest, "Chave PIX inválida")
			return
		}
		params.PixKey = pgtype.Text{String: trimmed, Valid: true}
	}

	user, err := s.queries.UpdateUser(r.Context(), params)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Cadastro não encontrado")
		return
	}
	if err != nil {
		s.logger.Printf("updateMe: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	writeJSON(w, http.StatusOK, toResponse(user))
}

// DELETE /api/me — revogation of consent (LGPD Art. 8º, §5º). Logs a 'revoked'
// event for every currently-granted policy, then soft-deletes the user.
// We preserve the user row so sales/withdrawals/anticipations referencing
// them remain auditable; PII purging happens via a separate retention job
// after the legally-mandated period.
func (s *Server) deleteMe(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	user, err := s.queries.GetUserByPrivyID(r.Context(), identity.DID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Already deleted (or never created) — treat as idempotent success.
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		s.logger.Printf("deleteMe lookup: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	ip := pgTextOrNull(clientIP(r))
	ua := pgTextOrNull(r.UserAgent())

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		s.logger.Printf("deleteMe begin tx: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	defer tx.Rollback(context.Background())

	q := sqlc.New(tx)

	active, err := q.ListLatestActiveConsents(r.Context(), user.ID)
	if err != nil {
		s.logger.Printf("deleteMe list consents: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	for _, c := range active {
		if c.Action != "granted" {
			continue // already revoked previously
		}
		if _, err := q.InsertConsentLog(r.Context(), sqlc.InsertConsentLogParams{
			ID:            uuid.New(),
			UserID:        user.ID,
			PolicyType:    c.PolicyType,
			PolicyVersion: c.PolicyVersion,
			Action:        "revoked",
			IPAddress:     ip,
			UserAgent:     ua,
		}); err != nil {
			s.logger.Printf("deleteMe insert revocation: %v", err)
			writeError(w, http.StatusInternalServerError, "Erro interno")
			return
		}
	}

	if err := q.SoftDeleteUser(r.Context(), identity.DID); err != nil {
		s.logger.Printf("deleteMe soft delete: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		s.logger.Printf("deleteMe commit: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func validateCreate(b createMeBody) string {
	switch {
	case b.StoreName == "" || len(b.StoreName) > 255:
		return "Nome da loja é obrigatório"
	case !cnpjRegex.MatchString(b.Cnpj):
		return "CNPJ deve conter exatamente 14 dígitos"
	case !emailRegex.MatchString(b.Email):
		return "E-mail inválido"
	case b.PixKey == "" || len(b.PixKey) > 255:
		return "Chave PIX é obrigatória"
	case !stellarPKRe.MatchString(b.StellarPublicKey):
		return "Chave pública Stellar inválida"
	}
	if msg := validateConsents(b.Consents); msg != "" {
		return msg
	}
	return ""
}

func validateConsents(consents []consentAcceptance) string {
	seen := map[string]bool{}
	for _, c := range consents {
		if !policyVersionRegex.MatchString(c.PolicyVersion) {
			return "Versão de política inválida"
		}
		// policy_type is also CHECK-constrained in the database, but we fail
		// faster here with a friendlier error.
		switch c.PolicyType {
		case "terms_of_use", "privacy_policy":
			seen[c.PolicyType] = true
		default:
			return "Tipo de política inválido"
		}
	}
	for _, required := range requiredPolicies {
		if !seen[required] {
			return "É necessário aceitar os Termos de Uso e a Política de Privacidade"
		}
	}
	return ""
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// clientIP returns the request's client IP without the port. Assumes the
// chi middleware.RealIP already normalised r.RemoteAddr from X-Forwarded-For
// or X-Real-IP — see router.go.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func pgTextOrNull(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: s, Valid: true}
}
