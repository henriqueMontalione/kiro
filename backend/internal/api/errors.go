package api

import (
	"encoding/json"
	"net/http"
)

// User-facing error messages are in pt-BR because they may surface in the UI.
// Server logs (log.Printf, etc.) stay in English by convention.

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
