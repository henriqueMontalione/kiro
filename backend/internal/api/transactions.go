package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kiro-app/backend/internal/db/sqlc"
)

const defaultTxListLimit = 100

type transactionResponse struct {
	ID               uuid.UUID `json:"id"`
	Direction        string    `json:"direction"`
	TesouroAmount    int64     `json:"tesouro_amount"`
	BrlAmount        int64     `json:"brl_amount"`
	StellarTxHash    *string   `json:"stellar_tx_hash,omitempty"`
	EtherfuseOrderID *string   `json:"etherfuse_order_id,omitempty"`
	Status           string    `json:"status"`
	CreatedAt        string    `json:"created_at"`
}

func toTransactionResponse(t sqlc.Transaction) transactionResponse {
	out := transactionResponse{
		ID:            t.ID,
		Direction:     t.Direction,
		TesouroAmount: t.TesouroAmount,
		BrlAmount:     t.BrlAmount,
		Status:        t.Status,
		CreatedAt:     t.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if t.StellarTxHash.Valid {
		s := t.StellarTxHash.String
		out.StellarTxHash = &s
	}
	if t.EtherfuseOrderID.Valid {
		s := t.EtherfuseOrderID.String
		out.EtherfuseOrderID = &s
	}
	return out
}

type createTransactionBody struct {
	Direction        string  `json:"direction"`
	TesouroAmount    int64   `json:"tesouro_amount"`
	BrlAmount        int64   `json:"brl_amount"`
	StellarTxHash    *string `json:"stellar_tx_hash,omitempty"`
	EtherfuseOrderID *string `json:"etherfuse_order_id,omitempty"`
	Status           string  `json:"status,omitempty"`
}

func (s *Server) createTransaction(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("createTransaction lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	var body createTransactionBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Corpo da requisição inválido")
		return
	}

	if body.Direction != "in" && body.Direction != "out" {
		writeError(w, http.StatusBadRequest, "direction deve ser 'in' ou 'out'")
		return
	}
	if body.TesouroAmount < 0 || body.BrlAmount < 0 {
		writeError(w, http.StatusBadRequest, "Valores não podem ser negativos")
		return
	}
	status := strings.TrimSpace(body.Status)
	if status == "" {
		status = "completed"
	}

	tx, err := s.queries.InsertTransaction(r.Context(), sqlc.InsertTransactionParams{
		ID:               uuid.New(),
		UserID:           user.ID,
		Direction:        body.Direction,
		TesouroAmount:    body.TesouroAmount,
		BrlAmount:        body.BrlAmount,
		StellarTxHash:    pgTextOrNullPtr(body.StellarTxHash),
		EtherfuseOrderID: pgTextOrNullPtr(body.EtherfuseOrderID),
		Status:           status,
	})
	if err != nil {
		s.logger.Printf("createTransaction insert: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	writeJSON(w, http.StatusCreated, toTransactionResponse(tx))
}

func (s *Server) listTransactions(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("listTransactions lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	txs, err := s.queries.ListTransactionsByUserID(r.Context(), sqlc.ListTransactionsByUserIDParams{
		UserID: user.ID,
		Limit:  defaultTxListLimit,
	})
	if err != nil {
		s.logger.Printf("listTransactions: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	out := make([]transactionResponse, 0, len(txs))
	for _, t := range txs {
		out = append(out, toTransactionResponse(t))
	}
	writeJSON(w, http.StatusOK, out)
}

func pgTextOrNullPtr(s *string) pgtype.Text {
	if s == nil || *s == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *s, Valid: true}
}
