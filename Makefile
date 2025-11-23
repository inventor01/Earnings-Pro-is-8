.PHONY: init api web migrate seed test

init:
	pip install -r requirements.txt
	cd frontend && npm install

api:
	uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload

web:
	cd frontend && npm run dev -- --host 0.0.0.0 --port 5000

migrate:
	python -c "from backend.db import Base, engine; Base.metadata.create_all(bind=engine)"

seed:
	python backend/scripts/seed.py

test:
	pytest backend/tests -v
	cd frontend && npm run test
