FROM python:3.10-slim

# Install system dependencies required for OpenCV headless, GDAL/rasterio, and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up user named "user" with user ID 1000
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH" \
    PORT=7860 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements from backend directory
COPY --chown=user backend/requirements.txt requirements.txt

RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy all backend application files into /app
COPY --chown=user backend/ .

EXPOSE 7860

# Dynamically bind to cloud-injected $PORT (Render/Railway), fallback to 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
