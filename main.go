package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"embed"
	"encoding/pem"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"teleprompter/internal/db"
	"teleprompter/internal/handler"
)

//go:embed web/dist/*
var webDist embed.FS

func main() {
	port := flag.Int("port", 8080, "HTTP listen port")
	dbPath := flag.String("db", "teleprompter.db", "SQLite database file path")
	tlsEnabled := flag.Bool("tls", false, "Enable HTTPS with auto-generated self-signed certificate")
	certFile := flag.String("cert", "", "TLS certificate file path (auto-generated if empty with --tls)")
	keyFile := flag.String("key", "", "TLS key file path (auto-generated if empty with --tls)")
	flag.Parse()

	// Allow PORT environment variable override.
	if p := os.Getenv("PORT"); p != "" {
		fmt.Sscanf(p, "%d", port)
	}

	// Open database.
	sqlDB, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer sqlDB.Close()

	// Build the static filesystem.
	distFS, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		log.Fatalf("sub web/dist: %v", err)
	}

	// Root mux.
	mux := http.NewServeMux()

	// Health check.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API routes.
	mux.Handle("/api/scripts/", handler.Scripts(sqlDB))
	mux.Handle("/api/scripts", handler.Scripts(sqlDB))
	mux.Handle("/api/settings", handler.Settings(sqlDB))

	// Static / SPA fallback for everything else.
	mux.Handle("/", handler.Static(distFS))

	addr := fmt.Sprintf(":%d", *port)

	if *tlsEnabled {
		// Determine cert/key paths.
		cert := *certFile
		key := *keyFile
		if cert == "" {
			cert = "cert.pem"
		}
		if key == "" {
			key = "key.pem"
		}

		// Auto-generate self-signed certificate if not found.
		if _, err := os.Stat(cert); os.IsNotExist(err) {
			log.Printf("Generating self-signed certificate: %s, %s", cert, key)
			if err := generateSelfSignedCert(cert, key); err != nil {
				log.Fatalf("generate cert: %v", err)
			}
		}

		log.Printf("Teleprompter listening on https://0.0.0.0%s", addr)
		if err := http.ListenAndServeTLS(addr, cert, key, mux); err != nil {
			log.Fatalf("server: %v", err)
		}
	} else {
		log.Printf("Teleprompter listening on http://0.0.0.0%s", addr)
		if err := http.ListenAndServe(addr, mux); err != nil {
			log.Fatalf("server: %v", err)
		}
	}
}

func generateSelfSignedCert(certPath, keyPath string) error {
	// Generate ECDSA private key.
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("generate key: %w", err)
	}

	// Create certificate template.
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return fmt.Errorf("generate serial: %w", err)
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"Teleprompter"},
			CommonName:   "teleprompter.local",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour), // 1 year
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IPAddresses:           nil, // browsers will show warning but it works
		DNSNames:              []string{"localhost", "teleprompter.local", "*.local"},
	}

	// Self-sign the certificate.
	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return fmt.Errorf("create cert: %w", err)
	}

	// Write certificate PEM.
	certDir := filepath.Dir(certPath)
	if certDir != "." {
		os.MkdirAll(certDir, 0755)
	}

	certOut, err := os.Create(certPath)
	if err != nil {
		return fmt.Errorf("create cert file: %w", err)
	}
	defer certOut.Close()
	pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	// Write private key PEM.
	keyDER, err := x509.MarshalECPrivateKey(privateKey)
	if err != nil {
		return fmt.Errorf("marshal key: %w", err)
	}
	keyOut, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("create key file: %w", err)
	}
	defer keyOut.Close()
	pem.Encode(keyOut, &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	return nil
}
