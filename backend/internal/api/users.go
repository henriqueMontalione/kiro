package api

import (
	"encoding/json"
	"errors"
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
	cnpjRegex   = regexp.MustCompile(`^\d{14}$`)
	emailRegex  = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	stellarPKRe = regexp.MustCompile(`^G[A-Z2-7]{55}$`)
)

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

type createMeBody struct {
	StoreName        string `json:"store_name"`
	Cnpj             string `json:"cnpj"`
	Email            string `json:"email"`
	PixKey           string `json:"pix_key"`
	StellarPublicKey string `json:"stellar_public_key"`
}

// POST /api/me — creates the lojista profile on first login. Idempotent in
// spirit (a duplicate DID returns 409). CNPJ uniqueness is enforced at the
// database level so two lojistas can't claim the same registration.
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

	user, err := s.queries.CreateUser(r.Context(), sqlc.CreateUserParams{
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
		s.logger.Printf("createMe: %v", err)
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

// DELETE /api/me — soft delete (status='inactive'). We preserve the row so
// sales/withdrawals/anticipations referencing this user remain auditable.
func (s *Server) deleteMe(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	if err := s.queries.SoftDeleteUser(r.Context(), identity.DID); err != nil {
		s.logger.Printf("deleteMe: %v", err)
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
