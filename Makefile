.PHONY: dev build clean run

dev:
	cd web && npm run dev

build:
	cd web && npm run build
	go build -o teleprompter .

run: build
	./teleprompter

clean:
	rm -rf web/dist teleprompter teleprompter.db
