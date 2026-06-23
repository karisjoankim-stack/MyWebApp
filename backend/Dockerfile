# Start with python base image to easily install heavy ML/Data libraries
FROM python:3.11-slim

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install required Python libraries
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    pillow \
    scipy \
    scikit-learn \
    requests \
    phetk \
    statsmodels

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Create a non-root system user
RUN useradd -u 8888 -m appuser

# Copy application files
COPY . .

# Adjust permissions for non-root user
RUN chown -R appuser:appuser /app

EXPOSE 3002

# Run as non-root user
USER appuser

CMD ["node", "index.js"]
