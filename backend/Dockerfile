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
    requests

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

EXPOSE 3001

CMD ["node", "index.js"]
