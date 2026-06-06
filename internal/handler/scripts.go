package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"teleprompter/internal/db"
	"teleprompter/internal/model"
)

// Scripts returns handlers for the /api/scripts routes.
func Scripts(database *sql.DB) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/scripts", func(w http.ResponseWriter, r *http.Request) {
		scripts, err := db.ListScripts(database)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, scripts)
	})

	mux.HandleFunc("POST /api/scripts", func(w http.ResponseWriter, r *http.Request) {
		var s model.Script
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if err := db.CreateScript(database, &s); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, s)
	})

	mux.HandleFunc("GET /api/scripts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		s, err := db.GetScript(database, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if s == nil {
			writeError(w, http.StatusNotFound, "script not found")
			return
		}
		writeJSON(w, http.StatusOK, s)
	})

	mux.HandleFunc("PUT /api/scripts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var s model.Script
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		s.ID = id
		if err := db.UpdateScript(database, &s); err != nil {
			if err.Error() == "script not found" {
				writeError(w, http.StatusNotFound, "script not found")
				return
			}
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, s)
	})

	mux.HandleFunc("DELETE /api/scripts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if err := db.DeleteScript(database, id); err != nil {
			if err.Error() == "script not found" {
				writeError(w, http.StatusNotFound, "script not found")
				return
			}
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})

	return mux
}
