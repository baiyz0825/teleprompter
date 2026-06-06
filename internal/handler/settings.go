package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"teleprompter/internal/db"
	"teleprompter/internal/model"
)

// Settings returns handlers for the /api/settings routes.
func Settings(database *sql.DB) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/settings", func(w http.ResponseWriter, r *http.Request) {
		s, err := db.GetSettings(database)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, s)
	})

	mux.HandleFunc("PUT /api/settings", func(w http.ResponseWriter, r *http.Request) {
		var s model.Settings
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if err := db.UpdateSettings(database, &s); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, s)
	})

	return mux
}
