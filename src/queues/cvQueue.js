const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Default to localhost if REDIS_URI is not present
const connection = new IORedis(process.env.REDIS_URI || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null // Required by bullmq
});

const cvQueue = new Queue('cvParsingQueue', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000 // 5s, 25s, 125s
        },
        removeOnComplete: true, // Keep redis clean
        removeOnFail: 100 // Keep last 100 failed jobs for debugging
    }
});

module.exports = {
    cvQueue,
    connection
};
