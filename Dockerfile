# CareTrail server for Render, Hugging Face Spaces or any container host.
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY server ./server
COPY web ./web
COPY data/rules.json data/demo_families.json data/population.json.gz ./data/
ENV PORT=7860 DB_PATH=/tmp/caretrail.db NODE_NO_WARNINGS=1
EXPOSE 7860
USER node
CMD ["node", "--max-old-space-size=380", "server/index.mjs"]
