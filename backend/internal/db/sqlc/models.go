package sqlc

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID               uuid.UUID `json:"id"`
	PrivyUserID      string    `json:"privy_user_id"`
	StoreName        string    `json:"store_name"`
	Cnpj             string    `json:"cnpj"`
	Email            string    `json:"email"`
	PixKey           string    `json:"pix_key"`
	StellarPublicKey string    `json:"stellar_public_key"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
