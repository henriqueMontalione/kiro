// Package migrate runs the embedded migrations on startup. We use
// golang-migrate's iofs source so the operator doesn't need the `migrate` CLI
// installed on the production host.
package migrate

import (
	"errors"
	"fmt"
	"io/fs"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// Up runs all pending migrations against the database URL. No-op when the
// schema is already at the latest version.
//
// `files` is expected to be the embedded FS rooted directly at the SQL files
// (i.e. `0001_init.up.sql` lives at "." inside the FS), as produced by the
// migrations package's `//go:embed *.sql` directive.
func Up(databaseURL string, files fs.FS) error {
	d, err := iofs.New(files, ".")
	if err != nil {
		return fmt.Errorf("migrate source: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", d, databaseURL)
	if err != nil {
		return fmt.Errorf("migrate init: %w", err)
	}
	defer func() { _, _ = m.Close() }()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}
