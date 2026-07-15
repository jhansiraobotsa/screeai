import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { scoreApplication } from "./scoring.js";
import { generateInterviewQuestions } from "./questionGen.js";

// BullMQ needs maxRetriesPerRequest: null. In production use REDIS_URL
// (Render/Upstash); locally fall back to 127.0.0.1:6379.
const connection: ConnectionOptions = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL, maxRetriesPerRequest: null }
  : { host: "127.0.0.1", port: 6379 };

const SCORING_QUEUE = "resume-scoring";
const QUESTION_QUEUE = "question-gen";

export const scoringQueue = new Queue(SCORING_QUEUE, { connection });
export const questionQueue = new Queue(QUESTION_QUEUE, { connection });

// Enqueue resume-based question generation for an interview.
export async function enqueueQuestionGen(interviewId: string) {
  await questionQueue.add(
    "generate",
    { interviewId },
    {
      jobId: `qgen-${interviewId}`,
      attempts: 4,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  );
}

// Enqueue a scoring job for an application. Deduped by applicationId so a
// re-submit/re-score doesn't pile up duplicates.
export async function enqueueScoring(applicationId: string) {
  await scoringQueue.add(
    "score",
    { applicationId },
    {
      jobId: `score-${applicationId}`,
      attempts: 4,
      backoff: { type: "exponential", delay: 5000 }, // 5s, 10s, 20s...
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  );
}

// Worker processes scoring jobs in the background with retries.
export const scoringWorker = new Worker(
  SCORING_QUEUE,
  async job => {
    const { applicationId } = job.data as { applicationId: string };
    const result = await scoreApplication(applicationId);
    return result;
  },
  { connection, concurrency: 2 }
);

scoringWorker.on("completed", (job, result) => {
  console.log(`[Queue] scored ${job.data.applicationId}:`, result?.scored ? `${result.score}%` : `skipped (${result?.reason})`);
});
scoringWorker.on("failed", (job, err) => {
  console.error(`[Queue] scoring failed for ${job?.data?.applicationId} (attempt ${job?.attemptsMade}):`, err.message);
});

// Worker: generate resume-based interview questions.
export const questionWorker = new Worker(
  QUESTION_QUEUE,
  async job => {
    const { interviewId } = job.data as { interviewId: string };
    return generateInterviewQuestions(interviewId);
  },
  { connection, concurrency: 2 }
);

questionWorker.on("completed", (job, result) => {
  console.log(`[Queue] questions generated for ${job.data.interviewId}:`, result?.count ?? 0);
});
questionWorker.on("failed", (job, err) => {
  console.error(`[Queue] question-gen failed for ${job?.data?.interviewId} (attempt ${job?.attemptsMade}):`, err.message);
});