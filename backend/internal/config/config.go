package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	PrivyAppID     string
	PIIMasterKey   string
	AllowedOrigins []string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:         getEnv("PORT", "8000"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		PrivyAppID:   os.Getenv("PRIVY_APP_ID"),
		PIIMasterKey: os.Getenv("PII_MASTER_KEY"),
	}

	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		cfg.AllowedOrigins = []string{"http://localhost:5173"}
	} else {
		for _, o := range strings.Split(origins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				cfg.AllowedOrigins = append(cfg.AllowedOrigins, trimmed)
			}
		}
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.PrivyAppID == "" {
		return nil, fmt.Errorf("PRIVY_APP_ID is required")
	}
	if cfg.PIIMasterKey == "" {
		return nil, fmt.Errorf("PII_MASTER_KEY is required (base64-encoded, >= 32 bytes)")
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
