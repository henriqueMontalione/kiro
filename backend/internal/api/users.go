package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

var requiredPolicies = []string{"terms_of_use", "privacy_policy"}

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

func (s *Server) toResponse(u sqlc.User) (userResponse, error) {
	storeName, err := s.vault.Decrypt(u.StoreNameEnc)
	if err != nil {
		return userResponse{}, fmt.Errorf("decrypt store_name: %w", err)
	}
	cnpj, err := s.vault.Decrypt(u.CnpjEnc)
	if err != nil {
		return userResponse{}, fmt.Errorf("decrypt cnpj: %w", err)
	}
	email, err := s.vault.Decrypt(u.EmailEnc)
	if err != nil {
		return userResponse{}, fmt.Errorf("decrypt email: %w", err)
	}
	pixKey, err := s.vault.Decrypt(u.PixKeyEnc)
	if err != nil {
		return userResponse{}, fmt.Errorf("decrypt pix_key: %w", err)
	}
	return userResponse{
		ID:               u.ID,
		StoreName:        storeName,
		Cnpj:             cnpj,
		Email:            email,
		PixKey:           pixKey,
		StellarPublicKey: u.StellarPublicKey,
		Status:           u.Status,
		CreatedAt:        u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        u.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

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

	resp, err := s.toResponse(user)
	if err != nil {
		s.logger.Printf("getMe decrypt: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

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

	if body.Email == "" && identity.Email != "" {
		body.Email = strings.ToLower(identity.Email)
	}

	if msg := validateCreate(body); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	storeNameEnc, err := s.vault.Encrypt(body.StoreName)
	if err != nil {
		s.logger.Printf("createMe encrypt store_name: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	cnpjEnc, err := s.vault.Encrypt(body.Cnpj)
	if err != nil {
		s.logger.Printf("createMe encrypt cnpj: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	emailEnc, err := s.vault.Encrypt(body.Email)
	if err != nil {
		s.logger.Printf("createMe encrypt email: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	pixKeyEnc, err := s.vault.Encrypt(body.PixKey)
	if err != nil {
		s.logger.Printf("createMe encrypt pix_key: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	cnpjHash := s.vault.Hash(body.Cnpj)

	ip := pgTextOrNull(clientIP(r))
	ua := pgTextOrNull(r.UserAgent())

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		s.logger.Printf("createMe begin tx: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	defer tx.Rollback(context.Background())

	q := sqlc.New(tx)

	user, err := q.CreateUser(r.Context(), sqlc.CreateUserParams{
		ID:               uuid.New(),
		PrivyUserID:      identity.DID,
		StoreNameEnc:     storeNameEnc,
		CnpjEnc:          cnpjEnc,
		CnpjHash:         cnpjHash,
		EmailEnc:         emailEnc,
		PixKeyEnc:        pixKeyEnc,
		StellarPublicKey: body.StellarPublicKey,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
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

	resp, err := s.toResponse(user)
	if err != nil {
		s.logger.Printf("createMe decrypt: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

type updateMeBody struct {
	StoreName *string `json:"store_name,omitempty"`
	PixKey    *string `json:"pix_key,omitempty"`
}

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
		enc, err := s.vault.Encrypt(trimmed)
		if err != nil {
			s.logger.Printf("updateMe encrypt store_name: %v", err)
			writeError(w, http.StatusInternalServerError, "Erro interno")
			return
		}
		params.StoreNameEnc = enc
	}
	if body.PixKey != nil {
		trimmed := strings.TrimSpace(*body.PixKey)
		if trimmed == "" || len(trimmed) > 255 {
			writeError(w, http.StatusBadRequest, "Chave PIX inválida")
			return
		}
		enc, err := s.vault.Encrypt(trimmed)
		if err != nil {
			s.logger.Printf("updateMe encrypt pix_key: %v", err)
			writeError(w, http.StatusInternalServerError, "Erro interno")
			return
		}
		params.PixKeyEnc = enc
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

	resp, err := s.toResponse(user)
	if err != nil {
		s.logger.Printf("updateMe decrypt: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) deleteMe(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	user, err := s.queries.GetUserByPrivyID(r.Context(), identity.DID)
	if errors.Is(err, pgx.ErrNoRows) {
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
			continue
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
