package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

func (s *Server) getNotificationsLastSeen(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("getNotificationsLastSeen lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	ts, err := s.queries.GetNotificationsLastSeen(r.Context(), user.ID)
	if err != nil {
		s.logger.Printf("getNotificationsLastSeen query: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	out := map[string]any{"last_seen_at": nil}
	if ts.Valid {
		out["last_seen_at"] = ts.Time.Format(time.RFC3339)
	}
	writeJSON(w, http.StatusOK, out)
}

type markNotificationsReadBody struct {
	LastSeenAt string `json:"last_seen_at"`
}

func (s *Server) markNotificationsRead(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("markNotificationsRead lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	var body markNotificationsReadBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Corpo da requisição inválido")
		return
	}

	ts, err := time.Parse(time.RFC3339, body.LastSeenAt)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Data inválida")
		return
	}

	if err := s.queries.UpdateNotificationsLastSeen(r.Context(), user.ID, ts); err != nil {
		s.logger.Printf("markNotificationsRead update: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
