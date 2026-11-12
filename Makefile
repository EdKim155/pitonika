PY := .venv/bin/python

.PHONY: setup deps web build run dev test validate e2e shots clean

setup: deps web build

deps:
	@test -d .venv || python3.12 -m venv .venv
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q -r requirements.txt

web:
	cd web && pnpm install

build:
	cd web && pnpm build

run:
	$(PY) scripts/serve.py

dev:
	./scripts/dev.sh

test:
	$(PY) -m pytest

validate:
	$(PY) scripts/validate_content.py

e2e:
	cd web && pnpm e2e

shots:
	cd web && node scripts/e2e-flow.mjs

clean:
	rm -rf data/app.db data/app.db-wal data/app.db-shm data/runs/*
