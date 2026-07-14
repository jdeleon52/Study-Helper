import type { AppData } from '../types';

const STORAGE_KEY = 'anatomy-study-helper-v1';

const now = () => new Date().toISOString();

export const starterData: AppData = {
  version: 1,
  topics: [
    { id: 'skeletal', name: 'Skeletal System', createdAt: now() },
    { id: 'muscular', name: 'Muscular System', createdAt: now() },
    { id: 'nervous', name: 'Nervous System', createdAt: now() },
  ],
  questions: [
    {
      id: 'q1',
      topicId: 'skeletal',
      prompt: 'What is the longest bone in the human body?',
      answer: 'The femur.',
      notes: 'It is located in the thigh.',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'q2',
      topicId: 'muscular',
      prompt: 'Which muscle is the primary mover for elbow flexion?',
      answer: 'The biceps brachii.',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'q3',
      topicId: 'nervous',
      prompt: 'Which nerve primarily innervates the diaphragm?',
      answer: 'The phrenic nerve.',
      notes: 'Remember C3, C4, C5 keep the diaphragm alive.',
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  attempts: [],
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return starterData;
    const parsed = JSON.parse(raw) as AppData;
    if (parsed.version !== 1 || !Array.isArray(parsed.topics) || !Array.isArray(parsed.questions)) {
      return starterData;
    }
    return { ...parsed, attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [] };
  } catch {
    return starterData;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function validateImport(value: unknown): AppData {
  if (!value || typeof value !== 'object') throw new Error('The file does not contain valid app data.');
  const data = value as Partial<AppData>;
  if (data.version !== 1 || !Array.isArray(data.topics) || !Array.isArray(data.questions)) {
    throw new Error('This does not look like an Anatomy Study Helper export.');
  }
  return {
    version: 1,
    topics: data.topics,
    questions: data.questions,
    attempts: Array.isArray(data.attempts) ? data.attempts : [],
  };
}
