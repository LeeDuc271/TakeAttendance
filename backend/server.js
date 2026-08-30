require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const routes = require('./src/routes/routes');
require('./src/config/cron'); // start cron jobs

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Trust proxy (Nginx) so rate limiter gets correct IP
app.set('trust proxy', 1);

// Security: Use Helmet for secure HTTP headers
app.use(helmet());

// Security: Global Rate Limiter
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Limit each IP to 2000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests, please try again later.' }
});
// Apply global limiter to API routes
app.use('/api', globalLimiter);

// Security: CORS - Only allow specific origins or regex (e.g. localhost, ngrok)
app.use(cors({
    origin: [/localhost/, /127\.0\.0\.1/, /ngrok-free\.app/, /ngrok\.io/],
    credentials: true
}));

// Security: Payload Limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
