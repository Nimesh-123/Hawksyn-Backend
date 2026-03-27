/**
 * HAWKSYN — Global AI Concurrency Control
 * Limits simultaneous LLM calls to prevent Gemini/OpenAI 429 Errors.
 */

class Semaphore {
    constructor(max) {
        this.max = max;
        this.running = 0;
        this.queue = [];
    }

    async acquire() {
        if (this.running < this.max) {
            this.running++;
            return;
        }
        return new Promise(resolve => this.queue.push(resolve));
    }

    release() {
        this.running--;
        if (this.queue.length > 0) {
            this.running++;
            const next = this.queue.shift();
            next();
        }
    }
}

// Global shared limit for all AI tasks (CV Parsing, Report Generation, etc.)
// 20 is a safe upper bound for Paid Tier burst stability.
const aiSemaphore = new Semaphore(20);

module.exports = { aiSemaphore };
