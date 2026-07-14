export type Topic = {
  id: string;
  name: string;
  createdAt: string;
};

export type Question = {
  id: string;
  topicId: string;
  prompt: string;
  answer: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuizAnswer = {
  questionId: string;
  promptSnapshot: string;
  answerSnapshot: string;
  userAnswer: string;
  correct: boolean;
  topicId: string;
};

export type QuizAttempt = {
  id: string;
  createdAt: string;
  topicId: string | 'all';
  score: number;
  total: number;
  answers: QuizAnswer[];
};

export type AppData = {
  version: 1;
  topics: Topic[];
  questions: Question[];
  attempts: QuizAttempt[];
};
