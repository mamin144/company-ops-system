import { createApp } from './app';

const port = Number(process.env.PORT ?? 4001);

createApp().then((app) => {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API running on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
