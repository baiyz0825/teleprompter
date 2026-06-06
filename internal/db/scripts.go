package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"teleprompter/internal/model"
)

// newUUID returns a random UUID-like string (32 hex chars).
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// ListScripts returns all scripts ordered by sort_order then updated_at descending.
func ListScripts(db *sql.DB) ([]model.Script, error) {
	rows, err := db.Query(`SELECT id, title, content, cover_image, sort_order, created_at, updated_at FROM scripts ORDER BY sort_order ASC, updated_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list scripts: %w", err)
	}
	defer rows.Close()

	var scripts []model.Script
	for rows.Next() {
		var s model.Script
		if err := rows.Scan(&s.ID, &s.Title, &s.Content, &s.CoverImage, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan script: %w", err)
		}
		scripts = append(scripts, s)
	}
	if scripts == nil {
		scripts = []model.Script{}
	}
	return scripts, rows.Err()
}

// GetScript returns a single script by id.
func GetScript(db *sql.DB, id string) (*model.Script, error) {
	var s model.Script
	err := db.QueryRow(`SELECT id, title, content, cover_image, sort_order, created_at, updated_at FROM scripts WHERE id = ?`, id).
		Scan(&s.ID, &s.Title, &s.Content, &s.CoverImage, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get script %s: %w", id, err)
	}
	return &s, nil
}

// CreateScript inserts a new script with a generated UUID and timestamps.
func CreateScript(db *sql.DB, s *model.Script) error {
	now := time.Now().UTC()
	s.ID = newUUID()
	s.CreatedAt = now
	s.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO scripts (id, title, content, cover_image, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.Title, s.Content, s.CoverImage, s.SortOrder, s.CreatedAt, s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create script: %w", err)
	}
	return nil
}

// UpdateScript updates an existing script. UpdatedAt is refreshed automatically.
func UpdateScript(db *sql.DB, s *model.Script) error {
	s.UpdatedAt = time.Now().UTC()
	res, err := db.Exec(`UPDATE scripts SET title = ?, content = ?, cover_image = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
		s.Title, s.Content, s.CoverImage, s.SortOrder, s.UpdatedAt, s.ID)
	if err != nil {
		return fmt.Errorf("update script: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("script not found")
	}
	return nil
}

// DeleteScript removes a script by id.
func DeleteScript(db *sql.DB, id string) error {
	res, err := db.Exec(`DELETE FROM scripts WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete script: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("script not found")
	}
	return nil
}
