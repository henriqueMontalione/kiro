package sqlc

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID               uuid.UUID `json:"id"`
	PrivyUserID      string    `json:"privy_user_id"`
	StoreNameEnc     []byte    `json:"-"`
	CnpjEnc          []byte    `json:"-"`
	CnpjHash         []byte    `json:"-"`
	EmailEnc         []byte    `json:"-"`
	PixKeyEnc        []byte    `json:"-"`
	StellarPublicKey string    `json:"stellar_public_key"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
