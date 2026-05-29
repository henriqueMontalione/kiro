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

	"github.com/kiro-app/backend/internal/db/sqlc"
)

var (
	cpfRegex       = regexp.MustCompile(`^\d{11}$`)
	birthDateRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	cepRegex       = regexp.MustCompile(`^\d{8}$`)
	stateRegex     = regexp.MustCompile(`^[A-Z]{2}$`)
)

// GET /api/me/kyc-profile — returns KYC status without exposing PII.
func (s *Server) getKycProfile(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("getKycProfile lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	consentGiven := false
	if _, err := s.queries.GetEtherfuseConsent(r.Context(), user.ID); err == nil {
		consentGiven = true
	} else if !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Printf("getKycProfile consent lookup: %v", err)
	}

	profile, err := s.queries.GetKycProfileByUserID(r.Context(), user.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"has_profile":   false,
			"docs_uploaded": false,
			"consent_given": consentGiven,
		})
		return
	}
	if err != nil {
		s.logger.Printf("getKycProfile: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	out := map[string]interface{}{
		"has_profile":   true,
		"docs_uploaded": profile.DocsUploaded,
		"consent_given": consentGiven,
		"created_at":    profile.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if profile.EfCustomerID != nil {
		out["ef_customer_id"] = *profile.EfCustomerID
	}
	writeJSON(w, http.StatusOK, out)
}

type createKycProfileBody struct {
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Cpf           string `json:"cpf"`
	BirthDate     string `json:"birth_date"`
	AddressStreet string `json:"address_street"`
	AddressCity   string `json:"address_city"`
	AddressState  string `json:"address_state"`
	AddressPostal string `json:"address_postal_code"`
	EfCustomerID  string `json:"ef_customer_id"`
}

// POST /api/me/kyc-profile — stores personal KYC data encrypted at rest.
func (s *Server) createKycProfile(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	var body createKycProfileBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Corpo da requisição inválido")
		return
	}

	body.GivenName = strings.TrimSpace(body.GivenName)
	body.FamilyName = strings.TrimSpace(body.FamilyName)
	body.Cpf = digitsOnly(body.Cpf)
	body.BirthDate = strings.TrimSpace(body.BirthDate)
	body.AddressStreet = strings.TrimSpace(body.AddressStreet)
	body.AddressCity = strings.TrimSpace(body.AddressCity)
	body.AddressState = strings.ToUpper(strings.TrimSpace(body.AddressState))
	body.AddressPostal = digitsOnly(body.AddressPostal)
	body.EfCustomerID = strings.TrimSpace(body.EfCustomerID)

	if msg := validateKycProfileBody(body); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	user, err := s.queries.GetUserByPrivyID(r.Context(), identity.DID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Cadastro não encontrado")
		return
	}
	if err != nil {
		s.logger.Printf("createKycProfile lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	enc := func(v string) ([]byte, bool) {
		b, e := s.vault.Encrypt(v)
		if e != nil {
			s.logger.Printf("createKycProfile encrypt: %v", e)
		}
		return b, e == nil
	}

	givenEnc, ok := enc(body.GivenName)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }
	familyEnc, ok := enc(body.FamilyName)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }
	cpfEnc, ok := enc(body.Cpf)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }
	birthEnc, ok := enc(body.BirthDate)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }
	streetEnc, ok := enc(body.AddressStreet)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }
	cityEnc, ok := enc(body.AddressCity)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }
	stateEnc, ok := enc(body.AddressState)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }
	postalEnc, ok := enc(body.AddressPostal)
	if !ok { writeError(w, http.StatusInternalServerError, "Erro interno"); return }

	cpfHash := s.vault.Hash(body.Cpf)
	efID := &body.EfCustomerID

	_, err = s.queries.CreateKycProfile(r.Context(), sqlc.CreateKycProfileParams{
		ID:                   uuid.New(),
		UserID:               user.ID,
		GivenNameEnc:         givenEnc,
		FamilyNameEnc:        familyEnc,
		CpfEnc:               cpfEnc,
		CpfHash:              cpfHash,
		BirthDateEnc:         birthEnc,
		AddressStreetEnc:     streetEnc,
		AddressCityEnc:       cityEnc,
		AddressStateEnc:      stateEnc,
		AddressPostalCodeEnc: postalEnc,
		EfCustomerID:         efID,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeError(w, http.StatusConflict, "Perfil KYC já cadastrado")
			return
		}
		s.logger.Printf("createKycProfile insert: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// POST /api/me/kyc-profile/docs — marks documents as uploaded in Etherfuse.
func (s *Server) markKycDocsUploaded(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("markKycDocsUploaded lookup: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	if _, err := s.queries.MarkKycDocsUploaded(r.Context(), user.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Perfil KYC não encontrado")
			return
		}
		s.logger.Printf("markKycDocsUploaded: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type postConsentBody struct {
	PolicyType    string `json:"policy_type"`
	PolicyVersion string `json:"policy_version"`
}

var allowedStandaloneConsents = map[string]bool{
	"data_sharing_etherfuse": true,
}

// POST /api/me/consent — records a post-registration consent (e.g. Etherfuse data sharing).
func (s *Server) postConsent(w http.ResponseWriter, r *http.Request) {
	identity := identityFrom(r.Context())
	if identity == nil {
		writeError(w, http.StatusUnauthorized, "Não autorizado")
		return
	}

	var body postConsentBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Corpo da requisição inválido")
		return
	}

	if !allowedStandaloneConsents[body.PolicyType] {
		writeError(w, http.StatusBadRequest, "Tipo de política inválido")
		return
	}
	if !policyVersionRegex.MatchString(body.PolicyVersion) {
		writeError(w, http.StatusBadRequest, "Versão de política inválida")
		return
	}

	user, err := s.queries.GetUserByPrivyID(r.Context(), identity.DID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Cadastro não encontrado")
		return
	}
	if err != nil {
		s.logger.Printf("postConsent lookup: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	if _, err := s.queries.InsertConsentLog(r.Context(), sqlc.InsertConsentLogParams{
		ID:            uuid.New(),
		UserID:        user.ID,
		PolicyType:    body.PolicyType,
		PolicyVersion: body.PolicyVersion,
		Action:        "granted",
		IPAddress:     pgTextOrNull(clientIP(r)),
		UserAgent:     pgTextOrNull(r.UserAgent()),
	}); err != nil {
		s.logger.Printf("postConsent insert: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func validateKycProfileBody(b createKycProfileBody) string {
	switch {
	case b.GivenName == "" || len(b.GivenName) > 100:
		return "Nome é obrigatório"
	case b.FamilyName == "" || len(b.FamilyName) > 100:
		return "Sobrenome é obrigatório"
	case !cpfRegex.MatchString(b.Cpf):
		return "CPF deve conter exatamente 11 dígitos"
	case !birthDateRegex.MatchString(b.BirthDate):
		return "Data de nascimento inválida (AAAA-MM-DD)"
	case b.AddressStreet == "" || len(b.AddressStreet) > 255:
		return "Logradouro é obrigatório"
	case b.AddressCity == "" || len(b.AddressCity) > 100:
		return "Cidade é obrigatória"
	case !stateRegex.MatchString(b.AddressState):
		return "Estado deve ser a sigla com 2 letras (ex: SP)"
	case !cepRegex.MatchString(b.AddressPostal):
		return "CEP deve conter 8 dígitos"
	case b.EfCustomerID == "":
		return "ID do parceiro é obrigatório"
	}
	return ""
}
