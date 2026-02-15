FROM python:3.12-slim

WORKDIR /app

# Install build dependencies for web3/native extensions
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Railway sets PORT automatically; fallback to 8001 for local dev
ENV PORT=8001

EXPOSE ${PORT}

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
