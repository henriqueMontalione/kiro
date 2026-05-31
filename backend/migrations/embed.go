// Package migrations embeds the .sql migration files so the binary is
// self-contained — no need for the operator to ship the SQL files
// alongside the executable or install the `migrate` CLI on the host.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
