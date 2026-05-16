# SIGMA

SIGMA (Stock Intelligence Gathering & Multi-source Analyzer) collects multi-source stock-market intelligence, analyzes it with LLMs, and presents reports in a minimalist web interface.

## Local development

1. Copy `.env.example` to `.env` and set local secrets.
2. Install backend dependencies with `cd sigma-backend && python -m pip install -e ".[dev]"`.
3. Install frontend dependencies with `cd sigma-frontend && npm install`.
4. Run everything with `docker compose up --build`.

