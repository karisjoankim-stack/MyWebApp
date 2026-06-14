FROM node:20-slim

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

EXPOSE 5173

# Expose Vite dev server on all network interfaces
CMD ["npm", "run", "dev", "--", "--host"]
