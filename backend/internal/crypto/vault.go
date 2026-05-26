// Package crypto encapsulates the at-rest protection for PII columns.
//
// Two operations:
//   - Encrypt / Decrypt — AES-256-GCM with a random 12-byte nonce per call,
//     stored as nonce||ciphertext. Same plaintext encrypted twice produces
//     different ciphertexts (semantic security).
//   - Hash — HMAC-SHA256, deterministic. Used for the cnpj_hash column so
//     unique constraints work without storing plaintext.
//
// Both keys derive from a single PII_MASTER_KEY via HKDF, with distinct
// "info" labels so reusing the master across roles is safe.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/hkdf"
)

const (
	hkdfAEADInfo = "kiro/pii/aead/v1"
	hkdfHashInfo = "kiro/pii/hash/v1"
)

type Vault struct {
	aead    cipher.AEAD
	hashKey []byte
}

func NewVault(masterKeyB64 string) (*Vault, error) {
	master, err := base64.StdEncoding.DecodeString(masterKeyB64)
	if err != nil {
		return nil, fmt.Errorf("PII_MASTER_KEY: invalid base64: %w", err)
	}
	if len(master) < 32 {
		return nil, fmt.Errorf("PII_MASTER_KEY: must decode to at least 32 bytes, got %d", len(master))
	}

	encKey, err := derive(master, []byte(hkdfAEADInfo), 32)
	if err != nil {
		return nil, err
	}
	hashKey, err := derive(master, []byte(hkdfHashInfo), 32)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(encKey)
	if err != nil {
		return nil, fmt.Errorf("aes: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm: %w", err)
	}

	return &Vault{aead: aead, hashKey: hashKey}, nil
}

func (v *Vault) Encrypt(plaintext string) ([]byte, error) {
	nonce := make([]byte, v.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("nonce: %w", err)
	}
	return v.aead.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

func (v *Vault) Decrypt(ciphertext []byte) (string, error) {
	ns := v.aead.NonceSize()
	if len(ciphertext) < ns {
		return "", errors.New("ciphertext too short")
	}
	nonce, ct := ciphertext[:ns], ciphertext[ns:]
	pt, err := v.aead.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}
	return string(pt), nil
}

// Hash produces a deterministic 32-byte tag of plaintext. Use for lookup
// columns (e.g. cnpj_hash) where uniqueness or equality matching is needed.
func (v *Vault) Hash(plaintext string) []byte {
	m := hmac.New(sha256.New, v.hashKey)
	m.Write([]byte(plaintext))
	return m.Sum(nil)
}

func derive(master, info []byte, n int) ([]byte, error) {
	r := hkdf.New(sha256.New, master, nil, info)
	out := make([]byte, n)
	if _, err := io.ReadFull(r, out); err != nil {
		return nil, fmt.Errorf("hkdf %q: %w", info, err)
	}
	return out, nil
}
