import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  Check,
  ChevronRight,
  CirclePlus,
  Download,
  FileUp,
  History,
  Home,
  ListChecks,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { AppData, Question, QuizAnswer, QuizAttempt, Topic } from './types';
import { loadData, saveData, validateImport } from './lib/storage';
import { buildStudyRoute, getMissedQuestions, getTopicStats, questionTopicName } from './lib/stats';
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import AuthForm from './components/AuthForm';

type View = 'dashboard' | 'questions' | 'quiz-setup' | 'quiz' | 'results' | 'history';

type QuizState = {
  questions: Question[];
  index: number;
  topicId: string | 'all';
  answers: QuizAnswer[];
};

const id = () => crypto.randomUUID();
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<View>('dashboard');
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null);
  const [toast, setToast] = useState<string>('');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => saveData(data), [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /*Track logged-in session */ 
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadStudyDataFromSupabase();
    }
  }, [session]);

  const navigate = (next: View) => {
    if (next !== 'quiz') setQuiz(null);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('Backup exported.');
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      setData(validateImport(parsed));
      navigate('dashboard');
      setToast('Study data imported.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Import failed.');
    }
  };

  const finishQuiz = async (
    answers: QuizAnswer[],
    topicId: string | "all"
  ) => {
    if (!session) {
      setToast("You must be logged in to save quiz results.");
      return;
    }

    const score = answers.filter((answer) => answer.correct).length;

    const { data: savedAttempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: session.user.id,
        topic_id: topicId,
        score,
        total_questions: answers.length,
      })
      .select()
      .single();

    if (attemptError) {
      setToast(`Could not save quiz: ${attemptError.message}`);
      return;
    }

    const answerRows = answers.map((answer) => ({
      attempt_id: savedAttempt.id,
      question_id: answer.questionId,
      was_correct: answer.correct,
      prompt_snapshot: answer.promptSnapshot,
      answer_snapshot: answer.answerSnapshot,
      user_answer: answer.userAnswer,
      topic_id: answer.topicId,
    }));

    const { error: answersError } = await supabase
      .from("quiz_answers")
      .insert(answerRows);

    if (answersError) {
      setToast(`Could not save quiz answers: ${answersError.message}`);
      return;
  }

    const attempt: QuizAttempt = {
      id: savedAttempt.id,
      createdAt: savedAttempt.completed_at,
      topicId: savedAttempt.topic_id,
      score: savedAttempt.score,
      total: savedAttempt.total_questions,
      answers,
    };

  setData((current) => ({
    ...current,
    attempts: [attempt, ...current.attempts],
  }));

  setLastAttempt(attempt);
  setQuiz(null);
  setView("results");
  setToast("Quiz results saved.");
};

  /*Show login screen when nobody is logged in */
  if (authLoading) {
    return <div className="loading-screen">Loading...</div>;
  }
  if (!session) {
    return <AuthForm />;
  }

  /*logout function */
  async function handleLogout() {
    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      setToast(error.message);
    }
  }

  async function loadStudyDataFromSupabase() {
    if (!session) {
      return;
    }

    const [topicsResult, questionsResult, attemptsResult, answersResult] = await Promise.all([
      supabase
        .from("topics")
        .select("*")
        .order("created_at", { ascending: true }),

      supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: true }),

      supabase
        .from("quiz_attempts")
        .select("*")
        .order("created_at", { ascending: true }),

      supabase
        .from("quiz_answers")
        .select("*"),
    ]);

    if (topicsResult.error) {
      setToast(`Could not load topics: ${topicsResult.error.message}`);
      return;
    }

    if (questionsResult.error) {
      setToast(
        `Could not load questions: ${questionsResult.error.message}`
      );
      return;
    }
    
    if (attemptsResult.error) {
      setToast(
        `Could not load quiz history: ${attemptsResult.error.message}`
      );
      return;
    }

    if (answersResult.error) {
      setToast(
        `Could not load quiz answers: ${answersResult.error.message}`
      );
      return;
    }

    const convertedAnswers: Array<
      QuizAnswer & { attemptId: string }
    > = answersResult.data.map((answer) => ({
      attemptId: answer.attempt_id,
      questionId: answer.question_id ?? "",
      promptSnapshot: answer.prompt_snapshot,
      answerSnapshot: answer.answer_snapshot,
      userAnswer: answer.user_answer,
      correct: answer.was_correct,
      topicId: answer.topic_id ?? "",
    }));

    const convertedAttempts: QuizAttempt[] =
      attemptsResult.data.map((attempt) => ({
        id: attempt.id,
        createdAt: attempt.completed_at,
        topicId: attempt.topic_id,
        score: attempt.score,
        total: attempt.total_questions,
        answers: convertedAnswers
          .filter((answer) => answer.attemptId === attempt.id)
          .map(({ attemptId, ...answer }) => answer),
    }));

    const convertedTopics: Topic[] = topicsResult.data.map((topic) => ({
      id: topic.id,
      name: topic.name,
      createdAt: topic.created_at,
    }));

    const convertedQuestions: Question[] = questionsResult.data.map(
      (question) => ({
      id: question.id,
      topicId: question.topic_id,
      prompt: question.question,
      answer: question.answer,
      notes: question.notes ?? "",
      createdAt: question.created_at,
      updatedAt: question.updated_at ?? question.created_at,
      correctCount: question.correct_count ?? 0,
      incorrectCount: question.incorrect_count ?? 0,
      })
    );

    setData((current) => ({
      ...current,
      topics: convertedTopics,
      questions: convertedQuestions,
      attempts: convertedAttempts,
    }));
  }

  return (
    <div className="app-shell">
      <Header onExport={exportData} onImport={importData} />

      <div className="page-layout">
        <div>
          <Sidebar view={view} navigate={navigate} />

          <button className="nav-link logout-button" onClick={handleLogout}>
            Log out
          </button>

        </div>
        <main className="main-content">
          {view === 'dashboard' && <Dashboard data={data} navigate={navigate} />}
          {view === 'questions' && <QuestionManager data={data} setData={setData} notify={setToast} userId={session.user.id} />}
          {view === 'quiz-setup' && (
            <QuizSetup
              data={data}
              onStart={(questions, topicId) => {
                setQuiz({ questions, topicId, index: 0, answers: [] });
                setView('quiz');
              }}
            />
          )}
          {view === 'quiz' && quiz && <QuizRunner data={data} quiz={quiz} setQuiz={setQuiz} finishQuiz={finishQuiz} />}
          {view === 'results' && <Results data={data} attempt={lastAttempt ?? data.attempts[0]} navigate={navigate} />}
          {view === 'history' && <HistoryView data={data} setLastAttempt={setLastAttempt} navigate={navigate} />}
        </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Header({ onExport, onImport }: { onExport: () => void; onImport: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Brain size={23} /></div>
        <div><strong>Study Helper</strong><span>Learn, test, improve.</span></div>
      </div>
      <div className="topbar-actions">
        <button className="button ghost" onClick={() => inputRef.current?.click()}><FileUp size={17} /> Import</button>
        <button className="button ghost" onClick={onExport}><Download size={17} /> Export</button>
        <input ref={inputRef} hidden type="file" accept="application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.target.value = '';
        }} />
      </div>
    </header>
  );
}

function Sidebar({ view, navigate }: { view: View; navigate: (view: View) => void }) {
  const links: { view: View; label: string; icon: typeof Home }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: Home },
    { view: 'questions', label: 'Questions', icon: ListChecks },
    { view: 'quiz-setup', label: 'Start quiz', icon: BookOpenCheck },
    { view: 'history', label: 'History', icon: History },
  ];
  return <aside className="sidebar" aria-label="Main navigation">
    {links.map((link) => <button key={link.view} className={view === link.view ? 'nav-link active' : 'nav-link'} onClick={() => navigate(link.view)}><link.icon size={19} />{link.label}</button>)}
  </aside>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ data, navigate }: { data: AppData; navigate: (view: View) => void }) {
  const stats = getTopicStats(data);
  const missed = getMissedQuestions(data);
  const answered = data.attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const correct = data.attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const route = buildStudyRoute(data);

  return <>
    <PageTitle eyebrow="Dashboard" title="Ready for your next study session?" description="Your questions, results, and recommended next steps all stay private in this browser." action={<button className="button primary" onClick={() => navigate('quiz-setup')}><BookOpenCheck size={18} /> Start a quiz</button>} />
    <section className="stat-grid">
      <StatCard icon={<ListChecks />} label="Questions" value={data.questions.length} detail={`${data.topics.length} topics`} />
      <StatCard icon={<History />} label="Quizzes completed" value={data.attempts.length} detail={`${answered} answers graded`} />
      <StatCard icon={<BarChart3 />} label="Overall accuracy" value={`${accuracy}%`} detail={answered ? `${correct} correct answers` : 'Take a quiz to begin'} />
      <StatCard icon={<RotateCcw />} label="Questions to review" value={missed.length} detail="Missed at least once" />
    </section>
    <section className="dashboard-grid">
      <div className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Performance</p><h2>Accuracy by topic</h2></div></div>
        <div className="topic-stats">
          {stats.map((topic) => <div className="topic-stat" key={topic.id}><div className="topic-stat-line"><strong>{topic.name}</strong><span>{topic.accuracy === null ? 'No attempts' : `${topic.accuracy}%`}</span></div><div className="progress"><div style={{ width: `${topic.accuracy ?? 0}%` }} /></div><small>{topic.answered} answers graded</small></div>)}
          {!stats.length && <EmptyState title="No topics yet" text="Add a topic and a few questions to get started." />}
        </div>
      </div>
      <div className="panel recommendation-panel">
        <div className="panel-heading"><div><p className="eyebrow"><Sparkles size={14} /> Smart study route</p><h2>What to study next</h2></div></div>
        <ol className="route-list">{route.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
        <p className="subtle-note">Recommendations are generated locally from quiz performance. No AI account or API key is required.</p>
      </div>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Review</p><h2>Frequently missed</h2></div><button className="text-button" onClick={() => navigate('questions')}>Open question bank <ChevronRight size={16} /></button></div>
      {missed.length ? <div className="review-list">{missed.slice(0, 5).map(({ question, misses }) => <div key={question.id} className="review-row"><div><strong>{question.prompt}</strong><span>{questionTopicName(data, question)}</span></div><span className="miss-badge">Missed {misses}×</span></div>)}</div> : <EmptyState title="Nothing to review yet" text="Questions you mark incorrect will appear here." />}
    </section>
  </>;
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail: string }) {
  return <article className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function QuestionManager({ data, setData, notify, userId }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; notify: (text: string) => void; userId: string }) {
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [editing, setEditing] = useState<Question | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);

  const filtered = data.questions.filter((question) => {
    const matchesTopic = topicFilter === 'all' || question.topicId === topicFilter;
    const term = search.trim().toLowerCase();
    return matchesTopic && (!term || question.prompt.toLowerCase().includes(term) || question.answer.toLowerCase().includes(term));
  });

  const deleteQuestion = async (question: Question) => {
    if (!window.confirm(`Delete “${question.prompt}”?`)) {
      return;
    }

    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", question.id);

    if (error) {
      notify(`Could not delete question: ${error.message}`);
      return;
    }

    setData((current) => ({
      ...current,
      questions: current.questions.filter(
        (item) => item.id !== question.id
      )
    }));

    notify("Question deleted.");
  };

  const deleteTopic = async (topic: Topic) => {
    const questionCount = data.questions.filter(
      (question) => question.topicId === topic.id
    ).length;

    if (questionCount) {
      notify("Move or delete this topic’s questions first.");
      return;
    }

    if (!window.confirm(`Delete the topic “${topic.name}”?`)) {
      return;
    }

    const { error } = await supabase
      .from("topics")
      .delete()
      .eq("id", topic.id);

    if (error) {
      notify(`Could not delete topic: ${error.message}`);
      return;
    }

    setData((current) => ({
      ...current,
      topics: current.topics.filter((item) => item.id !== topic.id),
    }));

    notify("Topic deleted.");
  };

  return <>
    <PageTitle eyebrow="Question bank" title="Build your study material" description="Create custom topics and keep questions easy to edit, search, back up, and share." action={<div className="button-row"><button className="button secondary" onClick={() => setShowTopicForm(true)}><CirclePlus size={18} /> Add topic</button><button className="button primary" disabled={!data.topics.length} onClick={() => { setEditing(null); setShowQuestionForm(true); }}><CirclePlus size={18} /> Add question</button></div>} />
    <section className="panel compact-panel">
      <div className="filters"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions or answers" /></label><select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="all">All topics</option>{data.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></div>
    </section>
    <section className="topic-chip-row">{data.topics.map((topic) => <div className="topic-chip" key={topic.id}><span>{topic.name}</span><button aria-label={`Delete ${topic.name}`} onClick={() => deleteTopic(topic)}><X size={14} /></button></div>)}</section>
    <section className="question-list">
      {filtered.map((question) => <article className="question-card" key={question.id}><div className="question-card-main"><span className="topic-label">{questionTopicName(data, question)}</span><h3>{question.prompt}</h3><p><strong>Answer:</strong> {question.answer}</p>{question.notes && <small>{question.notes}</small>}</div><div className="card-actions"><button className="icon-button" aria-label="Edit question" onClick={() => { setEditing(question); setShowQuestionForm(true); }}><Pencil size={17} /></button><button className="icon-button danger" aria-label="Delete question" onClick={() => deleteQuestion(question)}><Trash2 size={17} /></button></div></article>)}
      {!filtered.length && <div className="panel"><EmptyState title="No questions found" text={data.questions.length ? 'Try changing your search or topic filter.' : 'Add your first question to begin studying.'} /></div>}
    </section>
  {showQuestionForm && (
    <QuestionModal
      data={data}
      question={editing}
      onClose={() => setShowQuestionForm(false)}
      onSave={async (question) => {
        if (editing) {
          const { data: updatedQuestion, error } = await supabase
            .from("questions")
            .update({
              topic_id: question.topicId,
              question: question.prompt,
              answer: question.answer,
              notes: question.notes || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", question.id)
            .select()
            .single();

          if (error) {
            notify(`Could not update question: ${error.message}`);
            return;
          }

          const convertedQuestion: Question = {
            ...question,
            id: updatedQuestion.id,
            topicId: updatedQuestion.topic_id,
            prompt: updatedQuestion.question,
            answer: updatedQuestion.answer,
            createdAt: updatedQuestion.created_at,
            updatedAt: updatedQuestion.updated_at,
            notes: updatedQuestion.notes ?? "",
          };

          setData((current) => ({
            ...current,
            questions: current.questions.map((item) =>
              item.id === convertedQuestion.id
                ? convertedQuestion
                : item
            ),
          }));

          notify("Question updated.");
        } else {
          const { data: savedQuestion, error } = await supabase
            .from("questions")
            .insert({
              user_id: userId,
              topic_id: question.topicId,
              question: question.prompt,
              answer: question.answer,
              notes: question.notes || null,
            })
            .select()
            .single();

          if (error) {
            notify(`Could not add question: ${error.message}`);
            return;
          }

          const convertedQuestion: Question = {
            ...question,
            id: savedQuestion.id,
            topicId: savedQuestion.topic_id,
            prompt: savedQuestion.question,
            answer: savedQuestion.answer,
            createdAt: savedQuestion.created_at,
            updatedAt: savedQuestion.updated_at,
            notes: savedQuestion.notes ?? "",
          };

          setData((current) => ({
            ...current,
            questions: [convertedQuestion, ...current.questions],
          }));

          notify("Question added.");
        }

        setShowQuestionForm(false);
        setEditing(null);
      }}
    />
  )}
    {showTopicForm && (
    <TopicModal
      onClose={() => setShowTopicForm(false)}
      onSave={async (name) => {
        const { data: savedTopic, error } = await supabase
          .from("topics")
          .insert({
            user_id: userId,
            name,
          })
          .select()
          .single();

        if (error) {
          notify(`Could not add topic: ${error.message}`);
          return;
        }

        const topic: Topic = {
          id: savedTopic.id,
          name: savedTopic.name,
          createdAt: savedTopic.created_at,
        };

        setData((current) => ({
          ...current,
          topics: [...current.topics, topic],
        }));

        setShowTopicForm(false);
        notify("Topic added.");
      }}
    />
  )}
    </>;
}

function QuestionModal({ data, question, onClose, onSave }: { data: AppData; question: Question | null; onClose: () => void; onSave: (question: Question) => void }) {
  const [topicId, setTopicId] = useState(question?.topicId ?? data.topics[0]?.id ?? '');
  const [prompt, setPrompt] = useState(question?.prompt ?? '');
  const [answer, setAnswer] = useState(question?.answer ?? '');
  const [notes, setNotes] = useState(question?.notes ?? '');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    onSave({ id: question?.id ?? id(), topicId, prompt: prompt.trim(), answer: answer.trim(), notes: notes.trim(), createdAt: question?.createdAt ?? timestamp, updatedAt: timestamp });
  };
  return <Modal title={question ? 'Edit question' : 'Add a question'} onClose={onClose}><form onSubmit={submit} className="form-stack"><label>Topic<select required value={topicId} onChange={(event) => setTopicId(event.target.value)}>{data.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><label>Question<textarea required rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: What structure connects muscle to bone?" /></label><label>Correct answer<textarea required rows={3} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Example: A tendon." /></label><label>Notes or memory aid <span>(optional)</span><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context, a mnemonic, or textbook reference" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={!prompt.trim() || !answer.trim() || !topicId}>Save question</button></div></form></Modal>;
}

function TopicModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return <Modal title="Add a topic" onClose={onClose}><form className="form-stack" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave(name.trim()); }}><label>Topic name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Cardiovascular System" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name.trim()}>Add topic</button></div></form></Modal>;
}

function QuizSetup({ data, onStart }: { data: AppData; onStart: (questions: Question[], topicId: string | 'all') => void }) {
  const [topicId, setTopicId] = useState<string | 'all'>('all');
  const available = data.questions.filter((question) => topicId === 'all' || question.topicId === topicId);
  const [count, setCount] = useState(10);
  const actualCount = Math.min(Math.max(1, count), available.length || 1);
  return <>
    <PageTitle eyebrow="Quiz setup" title="Choose what to practice" description="Quiz yourself from one topic or mix questions from your full question bank." />
    <section className="panel quiz-setup-card">
      <div className="form-stack"><label>Question source<select value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="all">All topics</option>{data.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><label>Number of questions<input type="number" min={1} max={Math.max(1, available.length)} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label><div className="setup-summary"><span>{available.length} available question{available.length === 1 ? '' : 's'}</span><span>{available.length ? actualCount : 0} will be selected randomly</span></div><button className="button primary large" disabled={!available.length} onClick={() => onStart(shuffle(available).slice(0, actualCount), topicId)}><BookOpenCheck size={20} /> Begin quiz</button>{!available.length && <p className="warning-text">Add at least one question in this topic before starting a quiz.</p>}</div>
    </section>
  </>;
}

function QuizRunner({ data, quiz, setQuiz, finishQuiz }: { data: AppData; quiz: QuizState; setQuiz: React.Dispatch<React.SetStateAction<QuizState | null>>; finishQuiz: (answers: QuizAnswer[], topicId: string | 'all') => void }) {
  const question = quiz.questions[quiz.index];
  const [userAnswer, setUserAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const submitGrade = (correct: boolean) => {
    const answer: QuizAnswer = { questionId: question.id, promptSnapshot: question.prompt, answerSnapshot: question.answer, userAnswer: userAnswer.trim(), correct, topicId: question.topicId };
    const nextAnswers = [...quiz.answers, answer];
    if (quiz.index === quiz.questions.length - 1) finishQuiz(nextAnswers, quiz.topicId);
    else { setQuiz({ ...quiz, index: quiz.index + 1, answers: nextAnswers }); setUserAnswer(''); setRevealed(false); }
  };
  return <section className="quiz-page">
    <div className="quiz-topline"><div><span>Question {quiz.index + 1} of {quiz.questions.length}</span><strong>{questionTopicName(data, question)}</strong></div><div className="progress quiz-progress"><div style={{ width: `${((quiz.index + 1) / quiz.questions.length) * 100}%` }} /></div></div>
    <article className="quiz-card"><p className="eyebrow">Question</p><h1>{question.prompt}</h1><label>Your answer<textarea rows={5} value={userAnswer} disabled={revealed} onChange={(event) => setUserAnswer(event.target.value)} placeholder="Type what you remember. Exact wording is not required." /></label>
      {!revealed ? <button className="button primary large" onClick={() => setRevealed(true)}>Reveal correct answer</button> : <div className="reveal-area"><div className="answer-box"><span>Correct answer</span><p>{question.answer}</p>{question.notes && <small>{question.notes}</small>}</div><p className="grading-prompt">How did your answer compare?</p><div className="grade-buttons"><button className="button incorrect" onClick={() => submitGrade(false)}><X size={19} /> Mark incorrect</button><button className="button correct" onClick={() => submitGrade(true)}><Check size={19} /> Mark correct</button></div></div>}
    </article>
  </section>;
}

function Results({ data, attempt, navigate }: { data: AppData; attempt?: QuizAttempt; navigate: (view: View) => void }) {
  if (!attempt) return <><PageTitle title="No results yet" description="Complete a quiz to see a detailed breakdown." /><button className="button primary" onClick={() => navigate('quiz-setup')}>Start a quiz</button></>;
  const percentage = Math.round((attempt.score / attempt.total) * 100);
  return <>
    <PageTitle eyebrow="Quiz complete" title={`You scored ${attempt.score} out of ${attempt.total}`} description={`${percentage}% accuracy — review the breakdown below, then try another focused or mixed quiz.`} action={<button className="button primary" onClick={() => navigate('quiz-setup')}><RotateCcw size={18} /> Quiz again</button>} />
    <section className="result-summary panel"><div className="score-ring" style={{ '--score': `${percentage * 3.6}deg` } as React.CSSProperties}><div><strong>{percentage}%</strong><span>accuracy</span></div></div><div><h2>{percentage >= 80 ? 'Strong work.' : percentage >= 60 ? 'Good progress.' : 'This is a useful baseline.'}</h2><p>{attempt.answers.filter((answer) => !answer.correct).length ? 'Focus on the missed questions below before your next attempt.' : 'You marked every answer correct. Try a larger mixed quiz next.'}</p></div></section>
    <section className="results-list">{attempt.answers.map((answer, index) => <article className={answer.correct ? 'result-card right' : 'result-card wrong'} key={`${answer.questionId}-${index}`}><div className="result-status">{answer.correct ? <Check /> : <X />}</div><div><span>{data.topics.find((topic) => topic.id === answer.topicId)?.name ?? 'Topic'}</span><h3>{answer.promptSnapshot}</h3><p><strong>Your answer:</strong> {answer.userAnswer || <em>No written answer</em>}</p><p><strong>Correct answer:</strong> {answer.answerSnapshot}</p></div></article>)}</section>
  </>;
}

function HistoryView({ data, setLastAttempt, navigate }: { data: AppData; setLastAttempt: (attempt: QuizAttempt) => void; navigate: (view: View) => void }) {
  return <>
    <PageTitle eyebrow="History" title="Past quiz attempts" description="Open any attempt to revisit every answer and see where you improved." />
    <section className="history-list">{data.attempts.map((attempt) => { const topic = attempt.topicId === 'all' ? 'Mixed topics' : data.topics.find((item) => item.id === attempt.topicId)?.name ?? 'Deleted topic'; const percent = Math.round((attempt.score / attempt.total) * 100); return <button className="history-row" key={attempt.id} onClick={() => { setLastAttempt(attempt); navigate('results'); }}><div><strong>{topic}</strong><span>{new Date(attempt.createdAt).toLocaleString()}</span></div><div><strong>{attempt.score}/{attempt.total}</strong><span>{percent}%</span></div><ChevronRight /></button>; })}{!data.attempts.length && <div className="panel"><EmptyState title="No quiz history" text="Your completed quizzes will be saved here automatically." /></div>}</section>
  </>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>{children}</div></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><Brain size={30} /><strong>{title}</strong><p>{text}</p></div>;
}
