// =============================================================================
// GTV Media Sales — Point d'entrée du serveur Express
// =============================================================================

import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import { buildRouter } from './api/routes';
import { errorHandler } from './api/middleware/errorHandler';

const app = express();
app.use(express.json());

// Pool de connexions PostgreSQL — configuré via variables d'environnement
const db = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'gtv_media_sales',
  user:     process.env.DB_USER,      // [À CONFIGURER]
  password: process.env.DB_PASSWORD,  // [À CONFIGURER]
});

app.use('/api', buildRouter(db));

// Le errorHandler DOIT être le dernier middleware (signature à 4 paramètres)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GTV Media Sales API - port ${PORT} - OK`));

export { app };
