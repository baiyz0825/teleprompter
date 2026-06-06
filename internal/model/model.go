package model

import "time"

// Script represents a teleprompter script document.
type Script struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Content    string    `json:"content"`
	CoverImage string    `json:"coverImage"`
	SortOrder  int       `json:"sortOrder"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// Settings holds application-wide configuration.
type Settings struct {
	AsrWebSocketURL string `json:"asrWebSocketURL"` // e.g. ws://localhost:7860/ws/stream
}
