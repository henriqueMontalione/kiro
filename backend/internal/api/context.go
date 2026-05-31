package api

import (
	"context"
	"time"
)

// contextWithTimeout is a tiny indirection so we can swap the clock in tests
// without dragging in a clock interface. Kept as its own file to keep the
// router.go lean.
func contextWithTimeout(parent context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, d)
}
