const { createApp } = require('./app');

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.DB_PATH;

const { server } = createApp({ dbPath });

server.listen(port, () => {
  // Keep this log concise for test harnesses and developer scripts.
  console.log(`Travel booking app listening on http://localhost:${port}`);
});
