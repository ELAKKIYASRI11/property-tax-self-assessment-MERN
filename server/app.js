const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { uploadDir } = require('./middleware/upload');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded grievance proof documents
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    message: 'Property Tax Self-Assessment & Compliance Portal API (Team VEM) is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Ensure a MongoDB connection before any API route runs (cached across invocations)
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ message: 'Database unavailable. Please try again shortly.' });
  }
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/tax', require('./routes/taxRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/grievances', require('./routes/grievanceRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Serve frontend static build if available (local/Docker/Render). On Vercel the CDN serves it.
const clientDistPath = path.join(__dirname, '../client/dist');
if (!process.env.VERCEL && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
