package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type KycProfile struct {
	ID                   uuid.UUID  `json:"id"`
	UserID               uuid.UUID  `json:"user_id"`
	GivenNameEnc         []byte     `json:"-"`
	FamilyNameEnc        []byte     `json:"-"`
	CpfEnc               []byte     `json:"-"`
	CpfHash              []byte     `json:"-"`
	BirthDateEnc         []byte     `json:"-"`
	AddressStreetEnc     []byte     `json:"-"`
	AddressCityEnc       []byte     `json:"-"`
	AddressStateEnc      []byte     `json:"-"`
	AddressPostalCodeEnc []byte     `json:"-"`
	EfCustomerID         *string    `json:"ef_customer_id"`
	DocsUploaded         bool       `json:"docs_uploaded"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

const createKycProfile = `-- name: CreateKycProfile :one
INSERT INTO kyc_profiles (
    id, user_id,
    given_name_enc, family_name_enc,
    cpf_enc, cpf_hash,
    birth_date_enc,
    address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc,
    ef_customer_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
RETURNING id, user_id, given_name_enc, family_name_enc, cpf_enc, cpf_hash, birth_date_enc, address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc, ef_customer_id, docs_uploaded, created_at, updated_at`

type CreateKycProfileParams struct {
	ID                   uuid.UUID `json:"id"`
	UserID               uuid.UUID `json:"user_id"`
	GivenNameEnc         []byte    `json:"-"`
	FamilyNameEnc        []byte    `json:"-"`
	CpfEnc               []byte    `json:"-"`
	CpfHash              []byte    `json:"-"`
	BirthDateEnc         []byte    `json:"-"`
	AddressStreetEnc     []byte    `json:"-"`
	AddressCityEnc       []byte    `json:"-"`
	AddressStateEnc      []byte    `json:"-"`
	AddressPostalCodeEnc []byte    `json:"-"`
	EfCustomerID         *string   `json:"ef_customer_id"`
}

func (q *Queries) CreateKycProfile(ctx context.Context, arg CreateKycProfileParams) (KycProfile, error) {
	row := q.db.QueryRow(ctx, createKycProfile,
		arg.ID, arg.UserID,
		arg.GivenNameEnc, arg.FamilyNameEnc,
		arg.CpfEnc, arg.CpfHash,
		arg.BirthDateEnc,
		arg.AddressStreetEnc, arg.AddressCityEnc, arg.AddressStateEnc, arg.AddressPostalCodeEnc,
		arg.EfCustomerID,
	)
	return scanKycProfile(row)
}

const getKycProfileByUserID = `-- name: GetKycProfileByUserID :one
SELECT id, user_id, given_name_enc, family_name_enc, cpf_enc, cpf_hash, birth_date_enc, address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc, ef_customer_id, docs_uploaded, created_at, updated_at
FROM kyc_profiles WHERE user_id = $1`

func (q *Queries) GetKycProfileByUserID(ctx context.Context, userID uuid.UUID) (KycProfile, error) {
	row := q.db.QueryRow(ctx, getKycProfileByUserID, userID)
	return scanKycProfile(row)
}

const markKycDocsUploaded = `-- name: MarkKycDocsUploaded :one
UPDATE kyc_profiles SET docs_uploaded = TRUE, updated_at = NOW() WHERE user_id = $1
RETURNING id, user_id, given_name_enc, family_name_enc, cpf_enc, cpf_hash, birth_date_enc, address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc, ef_customer_id, docs_uploaded, created_at, updated_at`

func (q *Queries) MarkKycDocsUploaded(ctx context.Context, userID uuid.UUID) (KycProfile, error) {
	row := q.db.QueryRow(ctx, markKycDocsUploaded, userID)
	return scanKycProfile(row)
}

const getEtherfuseConsent = `-- name: GetEtherfuseConsent :one
SELECT id, policy_type, policy_version, action, created_at
FROM consent_logs
WHERE user_id = $1 AND policy_type = 'data_sharing_etherfuse'
ORDER BY created_at DESC LIMIT 1`

type GetEtherfuseConsentRow struct {
	ID            uuid.UUID `json:"id"`
	PolicyType    string    `json:"policy_type"`
	PolicyVersion string    `json:"policy_version"`
	Action        string    `json:"action"`
	CreatedAt     time.Time `json:"created_at"`
}

func (q *Queries) GetEtherfuseConsent(ctx context.Context, userID uuid.UUID) (GetEtherfuseConsentRow, error) {
	row := q.db.QueryRow(ctx, getEtherfuseConsent, userID)
	var r GetEtherfuseConsentRow
	err := row.Scan(&r.ID, &r.PolicyType, &r.PolicyVersion, &r.Action, &r.CreatedAt)
	return r, err
}

func scanKycProfile(row pgx.Row) (KycProfile, error) {
	var k KycProfile
	err := row.Scan(
		&k.ID, &k.UserID,
		&k.GivenNameEnc, &k.FamilyNameEnc,
		&k.CpfEnc, &k.CpfHash,
		&k.BirthDateEnc,
		&k.AddressStreetEnc, &k.AddressCityEnc, &k.AddressStateEnc, &k.AddressPostalCodeEnc,
		&k.EfCustomerID, &k.DocsUploaded,
		&k.CreatedAt, &k.UpdatedAt,
	)
	return k, err
}
