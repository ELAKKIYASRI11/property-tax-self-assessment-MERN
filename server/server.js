const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB().catch(() => process.exit(1));

app.listen(PORT, () => {
  console.log(`Property Tax Server running on http://localhost:${PORT}`);
});
