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
	"github.com/gowebpki/jcs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kiro-app/backend/internal/db/sqlc"
)

// Etherfuse webhook events are tiny JSON envelopes. Cap defends against
// abusive bodies; legitimate events sit well under this.
const maxWebhookBodyBytes = 64 * 1024

type etherfuseWebhookEvent struct {
	ID        string          `json:"id"`
	EventType string          `json:"eventType"`
	Data      json.RawMessage `json:"data"`
}

// Subset of the order shape we need to materialize a transactions row.
// Fields are optional because (a) on-ramp and off-ramp payloads carry
// different combinations of fiat/rate fields and (b) we want to fail
// loudly only at compute time, not at JSON decode.
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

// POST /webhooks/etherfuse — receives ramp order status changes from
// Etherfuse and reconciles them into our transactions table. Public route
// (no Privy auth) — authenticity comes from HMAC over the body using a
// secret Etherfuse shares with us at subscription creation time.
//
// Always returns 200 for events we choose to ignore so Etherfuse doesn't
// retry endlessly. 4xx/5xx is reserved for genuine validation/persistence
// failures we want them to retry.
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

	sigHeader := r.Header.Get("X-Signature")
	if sigHeader == "" {
		writeError(w, http.StatusUnauthorized, "missing signature")
		return
	}
	if !verifyEtherfuseSignature(body, sigHeader, s.cfg.EtherfuseWebhookSecret) {
		writeError(w, http.StatusUnauthorized, "invalid signature")
		return
	}

	var event etherfuseWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		s.logger.Printf("etherfuseWebhook decode envelope: %v", err)
		writeError(w, http.StatusBadRequest, "invalid event")
		return
	}

	if event.EventType != "order_updated" {
		w.WriteHeader(http.StatusOK)
		return
	}

	order, err := decodeWebhookOrder(body, event.Data)
	if err != nil {
		s.logger.Printf("etherfuseWebhook decode order: %v", err)
		writeError(w, http.StatusBadRequest, "invalid order payload")
		return
	}
	if order.OrderID == "" || order.CustomerID == "" {
		writeError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	user, err := s.queries.GetUserByEfCustomerID(r.Context(), order.CustomerID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Event for a customer we don't recognize (e.g. webhook accidentally
		// pointed at this env). Ack so Etherfuse stops retrying.
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

// Etherfuse docs say the signature is computed over the JCS-canonicalized
// JSON body. We try that first per spec; if it doesn't match we fall back
// to verifying against the raw bytes — providers sometimes ship the simpler
// raw-body scheme despite what the docs say, and the extra HMAC compute is
// cheap. Either form has to match a valid sha256= prefix from a Base64
// secret we hold; nothing else opens the door.
func verifyEtherfuseSignature(body []byte, sigHeader, secretB64 string) bool {
	secret, err := base64.StdEncoding.DecodeString(secretB64)
	if err != nil || len(secret) == 0 {
		return false
	}

	if canonical, err := jcs.Transform(body); err == nil {
		if hmacMatches(secret, canonical, sigHeader) {
			return true
		}
	}
	return hmacMatches(secret, body, sigHeader)
}

func hmacMatches(secret, msg []byte, sigHeader string) bool {
	mac := hmac.New(sha256.New, secret)
	mac.Write(msg)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(expected), []byte(sigHeader)) == 1
}

// decodeWebhookOrder accepts both envelope shapes Etherfuse might use —
// `{ eventType, data: {...order...} }` or the flat order object — so we
// don't lock ourselves to a guess if the doc-vs-real-payload differs.
func decodeWebhookOrder(rawBody []byte, data json.RawMessage) (etherfuseWebhookOrder, error) {
	var order etherfuseWebhookOrder
	if len(data) > 0 && string(data) != "null" {
		if err := json.Unmarshal(data, &order); err != nil {
			return order, fmt.Errorf("data envelope: %w", err)
		}
		if order.OrderID != "" {
			return order, nil
		}
	}
	if err := json.Unmarshal(rawBody, &order); err != nil {
		return order, fmt.Errorf("flat body: %w", err)
	}
	return order, nil
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

// On-ramp payloads carry fiat fields directly (amountInFiat, feeAmountInFiat).
// Off-ramp payloads (e.g. the example in our notes) only carry exchangeRate
// and feeBps — gross BRL has to be derived from tokens × rate. Either path
// has to yield grossBRL or we can't reconcile.
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
