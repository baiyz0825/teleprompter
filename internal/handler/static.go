package handler

import (
	"io/fs"
	"net/http"
	"strings"
)

// Static returns a handler that serves frontend files from distFS.
// If index.html is missing in distFS, a placeholder page is shown instead.
func Static(distFS fs.FS) http.Handler {
	// Probe whether a real frontend build exists.
	_, err := distFS.Open("index.html")
	if err != nil {
		// No frontend build -- serve a helpful placeholder.
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>Teleprompter</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;">
<div style="text-align:center">
<h1>前端未构建</h1>
<p>请先运行 <code>cd web && npm run build</code> 构建前端资源，然后重新编译后端。</p>
</div>
</body>
</html>`))
		})
	}

	fileServer := http.FileServer(http.FS(distFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// Serve the file if it exists in the embedded FS.
		if f, err := distFS.Open(path); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback: serve index.html for any unmatched path.
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
