FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=5000 \
    EXPRESS_BASE_URL=http://server:4000

WORKDIR /app

# System deps for scientific stack and opencv
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libglib2.0-0 \
    libgl1 \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy app source
COPY src ./src
# COPY data\gui_database.db ./data/gui_database.db

EXPOSE 5000

# Gunicorn for production
ENV GUNICORN_CMD_ARGS="--bind 0.0.0.0:5000 --workers 2 --threads 2 --timeout 60"
CMD ["gunicorn", "-k", "gthread", "-w", "2", "-b", "0.0.0.0:5000", "src.app:app"]


