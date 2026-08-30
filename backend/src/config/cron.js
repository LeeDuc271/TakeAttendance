const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Run every hour to clean up files older than 1 hour
cron.schedule('0 * * * *', () => {
    console.log('Running cron job to clean up uploads directory...');
    fs.readdir(UPLOADS_DIR, (err, files) => {
        if (err) {
            console.error('Failed to read uploads directory for cleanup', err);
            return;
        }

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(UPLOADS_DIR, file);
            // Skip .gitkeep or other non-temp files if needed
            if (file === '.gitkeep') return;

            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Failed to get stats for file ${file}`, err);
                    return;
                }

                // If file is older than 1 hour (3600000 ms), delete it
                if (now - stats.mtimeMs > 3600000) {
                    fs.unlink(filePath, err => {
                        if (err) console.error(`Failed to delete file ${file}`, err);
                        else console.log(`Deleted stale upload file: ${file}`);
                    });
                }
            });
        });
    });
});

module.exports = cron;
