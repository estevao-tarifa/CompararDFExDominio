FROM node:22-slim AS web-build
WORKDIR /build
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=80
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip libreoffice-calc \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY requirements.txt .
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt
COPY . .
COPY --from=web-build /build/dist ./dist
COPY --from=web-build /build/public/app.js ./public/app.js
EXPOSE 80
CMD ["node", "dist/server.js"]
