import type { AppData, Question } from '../types';

export function getTopicStats(data: AppData) {
  return data.topics.map((topic) => {
    const answers = data.attempts.flatMap((attempt) => attempt.answers).filter((answer) => answer.topicId === topic.id);
    const correct = answers.filter((answer) => answer.correct).length;
    return {
      ...topic,
      answered: answers.length,
      correct,
      accuracy: answers.length ? Math.round((correct / answers.length) * 100) : null,
    };
  });
}

export function getMissedQuestions(data: AppData) {
  const misses = new Map<string, number>();
  const successes = new Map<string, number>();
  data.attempts.flatMap((attempt) => attempt.answers).forEach((answer) => {
    const map = answer.correct ? successes : misses;
    map.set(answer.questionId, (map.get(answer.questionId) ?? 0) + 1);
  });

  return data.questions
    .map((question) => ({
      question,
      misses: misses.get(question.id) ?? 0,
      successes: successes.get(question.id) ?? 0,
    }))
    .filter((item) => item.misses > 0)
    .sort((a, b) => b.misses - a.misses || a.successes - b.successes);
}

export function buildStudyRoute(data: AppData): string[] {
  if (!data.attempts.length) {
    return [
      'Take a mixed quiz to establish a baseline.',
      'Review any missed answers immediately after the quiz.',
      'Repeat the weakest topic with a short focused quiz.',
    ];
  }

  const topicStats = getTopicStats(data)
    .filter((topic) => topic.answered > 0)
    .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));
  const missed = getMissedQuestions(data);
  const route: string[] = [];

  if (topicStats[0]) {
    route.push(`Start with ${topicStats[0].name}; current accuracy is ${topicStats[0].accuracy}%.`);
  }
  if (missed.length) {
    route.push(`Review your ${Math.min(missed.length, 5)} most frequently missed question${missed.length === 1 ? '' : 's'}.`);
  }
  if (topicStats[1]) {
    route.push(`Next, take a short quiz on ${topicStats[1].name}.`);
  }
  route.push('Finish with a mixed quiz and aim to beat your most recent score.');
  return route;
}

export function questionTopicName(data: AppData, question: Question) {
  return data.topics.find((topic) => topic.id === question.topicId)?.name ?? 'Unknown topic';
}
