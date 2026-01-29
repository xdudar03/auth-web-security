# Privacy-preserving face recognition

## Description

This project explores the intersection of Machine Learning (ML) and data privacy.
We have investigated data anonymization techniques, such as differential privacy and k-anonymity, to enhance the privacy of ML models for facial recognition.
The aim of the project is the development of a prototype that takes a photo and matches it with one in the anonymized database.

## Setup

Use Python 3.12 (https://www.python.org/downloads/)

```shell
git clone https://github.com/Deauthorize/Privacy_preserving_face_recognition
cd Privacy_Preserving_Face_Recognition_Project/
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

### Training Pipeline

Run the full anonymization and training pipeline:

```shell
# Using PEEP anonymization (default)
python -m mok.pipeline.pipeline --method peep

# Using DP-SVD anonymization
python -m mok.pipeline.pipeline --method dp_svd

# Using K-Same-Pixel anonymization
python -m mok.pipeline.pipeline --method k_same_pixel
```

### Prediction

Run predictions on trained models:

```shell
python -m mok.pipeline.predict --method peep
```

### Available Options

```shell
python -m mok.pipeline.pipeline --help
```

Key arguments:

- `--method`: Anonymization method (`peep`, `dp_svd`, `k_same_pixel`)
- `--input-dir`: Directory containing original images
- `--output-dir`: Directory for anonymized images
- `--img-width`, `--img-height`: Target image dimensions
- `--epsilon-*`: Differential privacy parameters

## API Server

Start the FastAPI server for face recognition:

```shell
# Direct
python -m mok.api.server

# Or with uvicorn
uvicorn mok.api.server:app --host 0.0.0.0 --port 5000
```

### API Endpoints

- `GET /` - Health check
- `GET /health` - Health check
- `GET /status` - Model status and configuration
- `POST /predict` - Predict identity from face embedding
- `POST /verify` - Verify if embedding matches a specific user

### Example Request

```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"embedding": [0.1, 0.2, ...], "user_id": "optional-user-id"}'
```

## Docker

Build and run the model container:

```shell
docker build -t model .
docker run -p 5000:5000 model

# Run training pipeline instead of API:
docker run model python -m mok.pipeline.pipeline --method peep
```

## Project Structure

The `mok/` folder contains:

- `config/` - Configuration settings
- `data/` - Data loading utilities
- `models/` - ML model architectures (CNN, eigenfaces)
- `persistence/` - Database controller
- `pipeline/` - Main training and prediction pipelines
- `preprocessing/` - Image preprocessing utilities
- `privacy/` - Anonymization methods (PEEP, DP-SVD, K-Same-Pixel)
- `scripts/` - Standalone scripts for each anonymization method
