package api

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

type consentLogResponse struct {
	ID            string  `json:"id"`
	PolicyType    string  `json:"policy_type"`
	PolicyVersion string  `json:"policy_version"`
	Action        string  `json:"action"`
	IPAddress     *string `json:"ip_address,omitempty"`
	UserAgent     *string `json:"user_agent,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

// GET /api/me/consent — full history of the authenticated lojista's consent
// events, newest first. Used by the "Dados compartilhados" page to operate
// LGPD Art. 18 II/III (right of access) for consent records specifically.
func (s *Server) listMyConsents(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("listMyConsents lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	logs, err := s.queries.ListConsentLogsByUserID(r.Context(), user.ID)
	if err != nil {
		s.logger.Printf("listMyConsents list: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	out := make([]consentLogResponse, 0, len(logs))
	for _, l := range logs {
		entry := consentLogResponse{
			ID:            l.ID.String(),
			PolicyType:    l.PolicyType,
			PolicyVersion: l.PolicyVersion,
			Action:        l.Action,
			CreatedAt:     l.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		if l.IPAddress.Valid {
			ip := l.IPAddress.String
			entry.IPAddress = &ip
		}
		if l.UserAgent.Valid {
			ua := l.UserAgent.String
			entry.UserAgent = &ua
		}
		out = append(out, entry)
	}

	writeJSON(w, http.StatusOK, out)
}
