package db

import (
	"database/sql"
	"fmt"

	"teleprompter/internal/model"
)

// GetSettings reads the application settings from the database.
func GetSettings(db *sql.DB) (*model.Settings, error) {
	rows, err := db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	defer rows.Close()

	s := &model.Settings{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		switch key {
		case "asr_websocket_url":
			s.AsrWebSocketURL = value
		}
	}
	return s, rows.Err()
}

// UpdateSettings upserts all settings fields.
func UpdateSettings(db *sql.DB, s *model.Settings) error {
	if s.AsrWebSocketURL != "" {
		_, err := db.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('asr_websocket_url', ?)`, s.AsrWebSocketURL)
		if err != nil {
			return fmt.Errorf("update asr_websocket_url: %w", err)
		}
	}
	return nil
}
