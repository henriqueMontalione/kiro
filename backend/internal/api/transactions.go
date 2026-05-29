package api

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

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
	FeeBrlAmount     int64     `json:"fee_brl_amount"`
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
		FeeBrlAmount:  t.FeeBrlAmount,
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
	FeeBrlAmount     int64   `json:"fee_brl_amount,omitempty"`
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
		FeeBrlAmount:     body.FeeBrlAmount,
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

func (s *Server) getTotalFees(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("getTotalFees lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	total, err := s.queries.SumFeesByUserID(r.Context(), user.ID)
	if err != nil {
		s.logger.Printf("getTotalFees sum: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int64{"total_fee_brl_amount": total})
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

// Streams all of the authenticated user's transactions as a UTF-8 CSV with a
// BOM so Excel opens it with the right encoding. Uses ';' as separator and
// ',' as the decimal mark to match Brazilian spreadsheet conventions.
func (s *Server) exportTransactionsCSV(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Printf("exportTransactionsCSV lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	txs, err := s.queries.ListAllTransactionsByUserID(r.Context(), user.ID)
	if err != nil {
		s.logger.Printf("exportTransactionsCSV list: %v", err)
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}

	filename := fmt.Sprintf("kiro-transacoes-%s.csv", time.Now().Format("20060102"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Cache-Control", "no-store")

	// UTF-8 BOM so Excel renders accents correctly.
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	cw := csv.NewWriter(w)
	cw.Comma = ';'
	cw.Write([]string{"Data", "Tipo", "Valor (R$)", "Taxa (R$)", "TESOURO", "Status", "Identificador"})

	for _, t := range txs {
		var tipo string
		switch t.Direction {
		case "in":
			tipo = "Recebido via PIX"
		case "out":
			tipo = "Saque via PIX"
		default:
			tipo = t.Direction
		}

		status := t.Status
		switch t.Status {
		case "completed":
			status = "Concluído"
		case "pending":
			status = "Pendente"
		case "failed":
			status = "Falhou"
		case "canceled":
			status = "Cancelado"
		}

		identifier := ""
		if t.StellarTxHash.Valid {
			identifier = t.StellarTxHash.String
		} else if t.EtherfuseOrderID.Valid {
			identifier = t.EtherfuseOrderID.String
		}

		cw.Write([]string{
			t.CreatedAt.In(time.Local).Format("02/01/2006 15:04"),
			tipo,
			centavosToBRString(t.BrlAmount),
			centavosToBRString(t.FeeBrlAmount),
			stroopsToTesouroBRString(t.TesouroAmount),
			status,
			identifier,
		})
	}

	cw.Flush()
}

// Centavos to "1234,56" (no thousands separator to keep the CSV machine-readable).
func centavosToBRString(centavos int64) string {
	neg := centavos < 0
	if neg {
		centavos = -centavos
	}
	whole := centavos / 100
	frac := centavos % 100
	s := fmt.Sprintf("%d,%02d", whole, frac)
	if neg {
		return "-" + s
	}
	return s
}

// Stroops (1 TESOURO = 10^7 stroops) to "12345,6789012" — 7 decimals.
func stroopsToTesouroBRString(stroops int64) string {
	neg := stroops < 0
	if neg {
		stroops = -stroops
	}
	whole := stroops / 10_000_000
	frac := stroops % 10_000_000
	s := fmt.Sprintf("%d,%07d", whole, frac)
	if neg {
		return "-" + s
	}
	return s
}

func pgTextOrNullPtr(s *string) pgtype.Text {
	if s == nil || *s == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *s, Valid: true}
}
