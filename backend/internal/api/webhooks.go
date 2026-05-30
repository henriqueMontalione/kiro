package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kiro-app/backend/internal/db/sqlc"
)

const maxWebhookBodyBytes = 64 * 1024

type etherfuseWebhookOrder struct {
	OrderID              string   `json:"orderId"`
	CustomerID           string   `json:"customerId"`
	OrderType            string   `json:"orderType"`
	Status               string   `json:"status"`
	AmountInTokens       string   `json:"amountInTokens"`
	AmountInFiat         *string  `json:"amountInFiat,omitempty"`
	FeeAmountInFiat      *string  `json:"feeAmountInFiat,omitempty"`
	FeeBps               *float64 `json:"feeBps,omitempty"`
	ExchangeRate         *string  `json:"exchangeRate,omitempty"`
	ConfirmedTxSignature *string  `json:"confirmedTxSignature,omitempty"`
}

// Etherfuse delivers events as `{"<event_type>": { ...payload... }}`. The
// event type is the key, not a field. We currently only react to order_updated.
type etherfuseWebhookEnvelope struct {
	OrderUpdated *etherfuseWebhookOrder `json:"order_updated,omitempty"`
}

// POST /webhooks/etherfuse — receives ramp order status changes from Etherfuse
// and reconciles them into our transactions table. Public route (no Privy
// auth); authenticity comes from HMAC-SHA256 over the raw body using a secret
// Etherfuse shares with us at subscription creation time.
//
// Returns 200 for events we choose to ignore so Etherfuse doesn't retry
// endlessly. 4xx/5xx is reserved for genuine validation/persistence failures.
func (s *Server) etherfuseWebhook(w http.ResponseWriter, r *http.Request) {
	if s.cfg.EtherfuseWebhookSecret == "" {
		s.logger.Printf("etherfuseWebhook rejected: ETHERFUSE_WEBHOOK_SECRET not configured")
		writeError(w, http.StatusServiceUnavailable, "webhook not configured")
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxWebhookBodyBytes))
	if err != nil {
		s.logger.Printf("etherfuseWebhook read body: %v", err)
		writeError(w, http.StatusBadRequest, "bad body")
		return
	}

	sig := r.Header.Get("X-Signature")
	if sig == "" || !verifyEtherfuseSignature(body, sig, s.cfg.EtherfuseWebhookSecret) {
		writeError(w, http.StatusUnauthorized, "invalid signature")
		return
	}

	var env etherfuseWebhookEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		s.logger.Printf("etherfuseWebhook decode envelope: %v", err)
		writeError(w, http.StatusBadRequest, "invalid event")
		return
	}

	if env.OrderUpdated == nil {
		w.WriteHeader(http.StatusOK)
		return
	}
	order := *env.OrderUpdated

	if order.OrderID == "" || order.CustomerID == "" {
		writeError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	user, err := s.queries.GetUserByEfCustomerID(r.Context(), order.CustomerID)
	if errors.Is(err, pgx.ErrNoRows) {
		s.logger.Printf("etherfuseWebhook unknown customer_id=%s order=%s", order.CustomerID, order.OrderID)
		w.WriteHeader(http.StatusOK)
		return
	}
	if err != nil {
		s.logger.Printf("etherfuseWebhook lookup user: %v", err)
		writeError(w, http.StatusInternalServerError, "lookup failed")
		return
	}

	params, err := buildTransactionParams(user.ID, order)
	if err != nil {
		s.logger.Printf("etherfuseWebhook build params order=%s: %v", order.OrderID, err)
		writeError(w, http.StatusBadRequest, "could not interpret order")
		return
	}

	if _, err := s.queries.UpsertTransactionByEtherfuseOrderID(r.Context(), params); err != nil {
		s.logger.Printf("etherfuseWebhook upsert order=%s: %v", order.OrderID, err)
		writeError(w, http.StatusInternalServerError, "persist failed")
		return
	}

	w.WriteHeader(http.StatusOK)
}

// Etherfuse returns the webhook secret in base64URL (uses `-_` instead of
// `+/`), not standard base64 — confirmed empirically against live signatures.
func verifyEtherfuseSignature(body []byte, sigHeader, secretB64URL string) bool {
	secret, err := base64.URLEncoding.DecodeString(secretB64URL)
	if err != nil || len(secret) == 0 {
		return false
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(expected), []byte(sigHeader)) == 1
}

func buildTransactionParams(userID uuid.UUID, order etherfuseWebhookOrder) (sqlc.UpsertTransactionByEtherfuseOrderIDParams, error) {
	var direction string
	switch order.OrderType {
	case "onramp":
		direction = "in"
	case "offramp":
		direction = "out"
	default:
		return sqlc.UpsertTransactionByEtherfuseOrderIDParams{}, fmt.Errorf("unknown orderType %q", order.OrderType)
	}

	tokens, err := strconv.ParseFloat(order.AmountInTokens, 64)
	if err != nil {
		return sqlc.UpsertTransactionByEtherfuseOrderIDParams{}, fmt.Errorf("amountInTokens: %w", err)
	}
	tesouroStroops := int64(math.Round(tokens * 1e7))

	grossBRL, feeBRL, err := computeBrlAmounts(tokens, order)
	if err != nil {
		return sqlc.UpsertTransactionByEtherfuseOrderIDParams{}, err
	}

	netBRL := grossBRL - feeBRL
	if netBRL < 0 {
		netBRL = 0
	}

	return sqlc.UpsertTransactionByEtherfuseOrderIDParams{
		ID:               uuid.New(),
		UserID:           userID,
		Direction:        direction,
		TesouroAmount:    tesouroStroops,
		BrlAmount:        int64(math.Round(netBRL * 100)),
		FeeBrlAmount:     int64(math.Round(feeBRL * 100)),
		StellarTxHash:    pgTextOrNullPtr(order.ConfirmedTxSignature),
		EtherfuseOrderID: pgtype.Text{String: order.OrderID, Valid: true},
		Status:           mapEtherfuseOrderStatus(order.Status),
	}, nil
}

// On-ramp payloads carry fiat amounts directly. Off-ramp payloads carry only
// exchangeRate and feeBps, so gross BRL has to be derived from tokens × rate.
func computeBrlAmounts(tokens float64, order etherfuseWebhookOrder) (gross, fee float64, err error) {
	if order.AmountInFiat != nil && *order.AmountInFiat != "" {
		gross, err = strconv.ParseFloat(*order.AmountInFiat, 64)
		if err != nil {
			return 0, 0, fmt.Errorf("amountInFiat: %w", err)
		}
		if order.FeeAmountInFiat != nil && *order.FeeAmountInFiat != "" {
			fee, err = strconv.ParseFloat(*order.FeeAmountInFiat, 64)
			if err != nil {
				return 0, 0, fmt.Errorf("feeAmountInFiat: %w", err)
			}
		}
		return gross, fee, nil
	}
	if order.ExchangeRate != nil && *order.ExchangeRate != "" {
		rate, err := strconv.ParseFloat(*order.ExchangeRate, 64)
		if err != nil {
			return 0, 0, fmt.Errorf("exchangeRate: %w", err)
		}
		gross = tokens * rate
		if order.FeeBps != nil {
			fee = gross * (*order.FeeBps) / 10_000
		}
		return gross, fee, nil
	}
	return 0, 0, errors.New("no fiat amount or exchange rate in payload")
}

func mapEtherfuseOrderStatus(efStatus string) string {
	switch efStatus {
	case "created":
		return "pending"
	case "funded", "completed":
		return "completed"
	case "failed":
		return "failed"
	case "refunded":
		return "refunded"
	case "canceled":
		return "canceled"
	default:
		return "pending"
	}
}
