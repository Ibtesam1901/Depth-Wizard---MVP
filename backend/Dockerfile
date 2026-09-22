FROM python:3.10-slim

# Install system dependencies required for OpenCV, GDAL/rasterio, and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up a user named "user" with user ID 1000 (required for Hugging Face Spaces security)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH" \
    PORT=7860 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --chown=user requirements.txt .

RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Pre-download and cache model weights during image build so runtime requests never block on download
RUN python -c "from transformers import pipeline; pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf')" || true

COPY --chown=user . .

EXPOSE 7860

# Dynamically bind to $PORT provided by cloud hosts (Render/Railway), fallback to 7860 (Hugging Face)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
