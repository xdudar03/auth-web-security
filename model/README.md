# Model

FastAPI model service for privacy-preserving face recognition. It trains from stored embeddings, predicts users, verifies claimed users, and supports DP-SVD anonymization.

## Setup

Use Python 3.12.

```bash
./setup.sh
source venv/bin/activate
```

## Run API

```bash
uvicorn mok.api.server:app --host 0.0.0.0 --port 5000
```

The API runs on `http://localhost:5000`.

Useful endpoints:

- `GET /health` - health check
- `GET /status` - model status
- `POST /initial_training` - train from DB embeddings
- `POST /predict` - predict a user from embeddings
- `POST /verify` - verify embeddings for a claimed user
- `POST /add_embedding` - add an embedding and schedule retraining

## Docker

```bash
docker build -t auth-model .
docker run -p 5000:5000 auth-model
```

In Docker Compose, the root startup scripts wire this service to the server and shared SQLite data.
