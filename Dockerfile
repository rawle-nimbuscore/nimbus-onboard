FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV ONBOARD_BASE=/onboard
RUN npm run build
ENV HOST=0.0.0.0
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
