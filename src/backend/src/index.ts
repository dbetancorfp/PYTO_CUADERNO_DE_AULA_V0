import { createApp } from './app';

const backend = process.env.DATA_BACKEND === 'postgres' ? 'postgres' : 'memory';
const databaseUrl = process.env.DATABASE_URL;
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp({ backend, databaseUrl });

app.listen(port, () => {
  console.log(`Backend listening on port ${port} (DATA_BACKEND=${backend})`);
});
