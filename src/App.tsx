

import { useEffect, useState } from "react";
import "./App.css";

type Screen = "home" | "course" | "lesson" | "game" | "chat" | "profile";

type CourseLesson = {
  id: number;
  title: string;
  objective: string;
  content?: string;
  completed: boolean;
};

type Question = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type SavedState = {
  goal: string;
  track: string;
  course: CourseLesson[];
  xp: number;
  completedIds: number[];
  activeLessonId: number;
  streak: number;
};

const STORAGE_KEY = "skillpath-ai-v2";


const starterQuestions: Question[] = [
  {
    question: "Как лучше всего закреплять новую тему?",
    options: [
      "Только перечитывать её",
      "Применять знания на практике",
      "Пропускать сложные места",
      "Запоминать ответы без понимания",
    ],
    answer: 1,
    explanation: "Практика помогает понять, как использовать знания самостоятельно.",
  },
];

function readSavedState(): Partial<SavedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function parseAIJson<T>(text: string): T {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("ИИ вернул ответ в неожиданном формате.");
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function askAI(
  messages: Message[],
  goal: string,
  mode: string
): Promise<string> {
  const response = await fetch("/.netlify/functions/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, goal, mode }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Не удалось получить ответ ИИ."
    );
  }

  if (typeof data.reply !== "string" || !data.reply.trim()) {
    throw new Error("ИИ вернул пустой ответ.");
  }

  return data.reply.trim();
}



export default function App() {
  const [saved] = useState<Partial<SavedState>>(readSavedState);

  const [screen, setScreen] = useState<Screen>("home");
  const [goal, setGoal] = useState(saved.goal ?? "");
  const [track, setTrack] = useState(saved.track ?? "ИИ и код");
  const [course, setCourse] = useState<CourseLesson[]>(
    saved.course ?? []
  );
  const [xp, setXp] = useState(saved.xp ?? 0);
  const [completedIds, setCompletedIds] = useState<number[]>(
    saved.completedIds ?? []
  );
  const [activeLessonId, setActiveLessonId] = useState(
    saved.activeLessonId ?? 1
  );
  const [streak] = useState(saved.streak ?? 0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeLesson = course.find(
    (item) => item.id === activeLessonId
  );

  const currentQuestion = questions[questionIndex];

  useEffect(() => {
    try {
      const data: SavedState = {
        goal,
        track,
        course,
        xp,
        completedIds,
        activeLessonId,
        streak,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Приложение продолжит работать, даже если хранилище недоступно.
    }
  }, [goal, track, course, xp, completedIds, activeLessonId, streak]);

  useEffect(() => {
    const telegram = (
      window as Window & {
        Telegram?: {
          WebApp?: {
            ready?: () => void;
            expand?: () => void;
          };
        };
      }
    ).Telegram?.WebApp;

    telegram?.ready?.();
    telegram?.expand?.();
  }, []);

  function navigate(next: Screen) {
    setError("");
    setNotice("");
    setScreen(next);
  }

  async function createCourse() {
    if (!goal.trim() || loading) return;

    setLoading(true);
    setError("");
    setNotice("");

    const prompt = `
Ты — персональный ИИ-репетитор образовательного приложения SkillPath AI.

Цель ученика: "${goal}".
Направление: "${track}".

Составь персональный учебный маршрут для новичка из 6 последовательных уроков.
Маршрут должен двигаться от простого к сложному.
Названия и цели уроков должны конкретно соответствовать цели ученика.
Не включай темы, которые не нужны для его цели.

Верни только JSON такого формата:
{
  "welcome": "Короткое дружелюбное приветствие",
  "courseTitle": "Название курса",
  "lessons": [
    {
      "title": "Название урока",
      "objective": "Что ученик сможет делать после урока"
    }
  ]
}

Ровно 6 уроков. Не используй Markdown вокруг JSON.
Пиши по-русски, понятно и дружелюбно.
`;

    try {
      const reply = await askAI(
        [{ role: "user", content: prompt }],
        goal,
        "course"
      );

      const result = parseAIJson<{
        welcome?: string;
        courseTitle?: string;
        lessons: { title: string; objective: string }[];
      }>(reply);

      if (
        !Array.isArray(result.lessons) ||
        result.lessons.length < 3 ||
        !result.lessons.every(
          (item) =>
            typeof item.title === "string" &&
            typeof item.objective === "string"
        )
      ) {
        throw new Error("ИИ не создал корректный учебный маршрут.");
      }

      const newCourse: CourseLesson[] = result.lessons.map(
        (item, index) => ({
          id: index + 1,
          title: item.title,
          objective: item.objective,
          completed: false,
        })
      );

      setCourse(newCourse);
      setCompletedIds([]);
      setActiveLessonId(1);
      setXp(0);
      setLessonContent("");
      setMessages([
        {
          role: "assistant",
          content:
            result.welcome ||
            `Отлично! Мы будем изучать «${goal}» постепенно. Я подготовил твой учебный маршрут. Начнём с первой темы!`,
        },
      ]);
      setNotice(result.courseTitle || "Твой персональный курс готов!");
      setScreen("course");
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} Попробуй ещё раз.`
          : "Не удалось создать курс."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openLesson(lessonId: number) {
    const item = course.find((lesson) => lesson.id === lessonId);
    if (!item || loading) return;

    const firstIncomplete = course.find(
      (lesson) => !completedIds.includes(lesson.id)
    );

    if (
      firstIncomplete &&
      item.id > firstIncomplete.id
    ) {
      setNotice("Сначала пройди предыдущую тему — так знания будут складываться последовательно.");
      return;
    }

    setActiveLessonId(lessonId);
    setError("");
    setNotice("");

    if (item.content) {
      setLessonContent(item.content);
      setScreen("lesson");
      return;
    }

    setLoading(true);
    setScreen("lesson");
    setLessonContent("");

    const prompt = `
Ты — личный ИИ-репетитор.

Цель ученика: ${goal}
Направление: ${track}
Текущий урок: ${item.title}
Цель урока: ${item.objective}

Обучи ученика именно этой теме.
Структура:
1. Короткое дружелюбное вступление.
2. Объяснение простыми словами, без ненужного жаргона.
3. Несколько небольших примеров.
4. Пошаговый разбор одного примера.
5. Одно задание, которое ученик попробует выполнить сам.
6. Короткое резюме того, что важно запомнить.

Не выдавай ответ на практическое задание сразу.
Не утверждай, что ученик уже освоил тему.
Пиши на русском, разбивай текст на короткие абзацы.
Не делай вид, что задание уже проверено.
`;

    try {
      const reply = await askAI(
        [{ role: "user", content: prompt }],
        goal,
        "lesson"
      );

      setLessonContent(reply);
      setCourse((current) =>
        current.map((lesson) =>
          lesson.id === lessonId
            ? { ...lesson, content: reply }
            : lesson
        )
      );
      setMessages((current) => [
        ...current,
        { role: "assistant", content: reply },
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось загрузить урок."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    if (!lessonContent || loading) return;

    setLoading(true);
    setError("");
    setNotice("");
    setGameFinished(false);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setChecked(false);
    setHint("");
    setScreen("game");

    const prompt = `
Создай интерактивную обучающую игру по уроку ниже.

Цель ученика: ${goal}
Урок: ${activeLesson?.title}
Материал урока:
${lessonContent}

Создай 5 вопросов именно по изученному материалу.
Вопросы должны идти от простого к более сложному.
У каждого вопроса 4 варианта ответа и ровно один правильный ответ.
Не задавай вопросы по темам, которые не объяснялись.

Верни только JSON:
{
  "questions": [
    {
      "question": "Текст вопроса",
      "options": ["Первый вариант", "Второй вариант", "Третий вариант", "Четвёртый вариант"],
      "answer": 0,
      "explanation": "Понятное объяснение ответа"
    }
  ]
}

answer — индекс правильного варианта, начиная с 0.
Ровно 5 вопросов. Без Markdown и текста за пределами JSON.
`;

    try {
      const reply = await askAI(
        [{ role: "user", content: prompt }],
        goal,
        "game"
      );

      const result = parseAIJson<{ questions: Question[] }>(reply);

      if (
        !Array.isArray(result.questions) ||
        result.questions.length < 3 ||
        !result.questions.every(
          (q) =>
            typeof q.question === "string" &&
            Array.isArray(q.options) &&
            q.options.length >= 2 &&
            q.options.every((option) => typeof option === "string") &&
            Number.isInteger(q.answer) &&
            q.answer >= 0 &&
            q.answer < q.options.length &&
            typeof q.explanation === "string"
        )
      ) {
        throw new Error("ИИ создал задания в неожиданном формате.");
      }

      setQuestions(result.questions);
    } catch (e) {
      setQuestions(starterQuestions);
      setError(
        (e instanceof Error ? e.message : "Не удалось создать игру.") +
          " Пока доступна короткая тренировочная миссия."
      );
    } finally {
      setLoading(false);
    }
  }

  function checkAnswer() {
    if (selectedAnswer === null || checked || !currentQuestion) return;

    setChecked(true);

    if (selectedAnswer === currentQuestion.answer) {
      setXp((current) => current + 10);
    }
  }

  function nextQuestion() {
    if (!checked) return;

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      setSelectedAnswer(null);
      setChecked(false);
      setHint("");
      return;
    }

    setGameFinished(true);

    if (!completedIds.includes(activeLessonId)) {
      setCompletedIds((current) => [...current, activeLessonId]);
      setCourse((current) =>
        current.map((lesson) =>
          lesson.id === activeLessonId
            ? { ...lesson, completed: true }
            : lesson
        )
      );
      setXp((current) => current + 20);
      setNotice("Миссия завершена! Ты получил 20 XP за прохождение.");
    }
  }

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || loading) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];

    setMessages(nextMessages);
    setChatInput("");
    setLoading(true);
    setError("");

    try {
      const context = activeLesson
        ? `Текущий урок: ${activeLesson.title}\nМатериал урока: ${lessonContent}`
        : "Ученик находится вне конкретного урока.";

      const reply = await askAI(
        [
          {
            role: "user",
            content: `Ты — личный ИИ-репетитор SkillPath AI.
Цель ученика: ${goal || "пока не выбрана"}.
Направление: ${track}.
${context}
Объясняй понятно, помогай разобраться, не стыди за ошибки.
Если ученик просит проверить ответ, объясни ход решения.
Ниже история разговора.`,
          },
          ...nextMessages,
        ],
        goal,
        "tutor"
      );

      setMessages([
        ...nextMessages,
        { role: "assistant", content: reply },
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Сообщение не отправилось. Попробуй ещё раз."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetCourse() {
    if (
      !window.confirm(
        "Создать новый курс? Текущий маршрут и его прогресс будут заменены."
      )
    ) {
      return;
    }

    setCourse([]);
    setCompletedIds([]);
    setLessonContent("");
    setMessages([]);
    setXp(0);
    setGoal("");
    setScreen("home");
    setError("");
    setNotice("");
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-icon">✦</span>
          <span>
            <strong>SkillPath</strong>
            <small>AI TUTOR</small>
          </span>
        </button>
        <div className="xp-badge">⚡ {xp} XP</div>
      </header>

      <main className="app-main">
        {screen === "home" && (
          <section className="panel hero">
            <span className="eyebrow">ТВОЙ ЛИЧНЫЙ ИИ-РЕПЕТИТОР</span>
            <h1>
              Учись своему.
              <br />
              <span>В своём темпе.</span>
            </h1>
            <p>
              Выбери цель. ИИ составит маршрут, объяснит темы и
              подготовит игровые миссии для практики.
            </p>

            <h3>Чему хочешь научиться?</h3>
            <div className="track-grid">
              {["ИИ и код", "Языки", "Школа"].map((item) => (
                <button
                  key={item}
                  className={`track-button ${track === item ? "selected" : ""}`}
                  onClick={() => setTrack(item)}
                >
                  {item === "ИИ и код" ? "🤖" : item === "Языки" ? "🌍" : "📚"}
                  <span>{item}</span>
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="goal">
              Опиши свою цель
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Например: хочу изучить Python с нуля и создавать ИИ-агентов..."
              rows={3}
            />

            <button
              className="primary-button"
              onClick={createCourse}
              disabled={!goal.trim() || loading}
            >
              {loading ? "Создаём твой маршрут..." : "Создать мой маршрут →"}
            </button>

            {course.length > 0 && (
              <button
                className="secondary-button full-width-button"
                onClick={() => navigate("course")}
              >
                Продолжить мой курс →
              </button>
            )}

            <div className="feature-row">
              <span>🎯 Личный план</span>
              <span>🎮 Игровая практика</span>
              <span>✨ Поддержка ИИ</span>
            </div>
          </section>
        )}

        {screen === "course" && (
          <section className="panel">
            <button className="back-button" onClick={() => navigate("home")}>
              ← На главную
            </button>
            <span className="eyebrow">ТВОЙ УЧЕБНЫЙ МАРШРУТ</span>
            <h1>Идём к твоей цели 🚀</h1>
            <p>{goal}</p>

            <div className="course-summary">
              <strong>
                {completedIds.length} из {course.length}
              </strong>
              <span>уроков завершено</span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      course.length
                        ? (completedIds.length / course.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="course-list">
              {course.map((item, index) => {
                const unlocked =
                  index === 0 ||
                  completedIds.includes(course[index - 1]?.id);

                return (
                  <button
                    key={item.id}
                    className={`course-item ${
                      item.completed ? "course-completed" : ""
                    }`}
                    onClick={() => {
                      if (unlocked) void openLesson(item.id);
                      else setNotice("Пройди предыдущий урок, чтобы открыть этот.");
                    }}
                  >
                    <span className="course-number">
                      {item.completed ? "✓" : unlocked ? index + 1 : "🔒"}
                    </span>
                    <span className="course-item-text">
                      <strong>{item.title}</strong>
                      <small>{item.objective}</small>
                    </span>
                    <span className="course-arrow">
                      {item.completed ? "✓" : unlocked ? "→" : "·"}
                    </span>
                  </button>
                );
              })}
            </div>

            {completedIds.length === course.length && course.length > 0 && (
              <div className="explanation">
                <strong>🎉 Ты завершил весь маршрут!</strong>
                <p>Можно попросить ИИ составить следующий курс по твоей цели.</p>
              </div>
            )}

            <button
              className="secondary-button full-width-button"
              onClick={() => navigate("profile")}
            >
              Посмотреть прогресс
            </button>
          </section>
        )}

        {screen === "lesson" && (
          <section className="panel">
            <button className="back-button" onClick={() => navigate("course")}>
              ← К учебному маршруту
            </button>
            <span className="eyebrow">УРОК {activeLessonId}</span>
            <h1>{activeLesson?.title || "Твой урок"}</h1>
            <p>{activeLesson?.objective}</p>

            {loading && !lessonContent && (
              <p>ИИ готовит объяснение для тебя… ✨</p>
            )}

            {lessonContent && (
              <div className="lesson-content">{lessonContent}</div>
            )}

            {lessonContent && (
              <div className="lesson-actions">
                <button className="primary-button" onClick={startGame} disabled={loading}>
                  🎮 Играть и закрепить
                </button>
                <button className="secondary-button" onClick={() => navigate("chat")}>
                  💬 Задать вопрос ИИ
                </button>
                {completedIds.includes(activeLessonId) && (
                  <button
                    className="secondary-button"
                    onClick={() => navigate("course")}
                  >
                    ✓ Урок завершён — к маршруту
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {screen === "game" && (
          <section className="panel game-panel">
            <button className="back-button" onClick={() => navigate("lesson")}>
              ← Вернуться к уроку
            </button>
            <span className="eyebrow">ИГРОВАЯ МИССИЯ</span>

            {loading && <p>ИИ создаёт задания по твоему уроку… 🎮</p>}

            {!loading && gameFinished && (
              <div className="result-screen">
                <div className="result-icon">🏆</div>
                <h1>Миссия пройдена!</h1>
                <p>
                  Ты закрепил тему «{activeLesson?.title}».
                  Загляни в маршрут, чтобы продолжить обучение.
                </p>
                <button className="primary-button" onClick={() => navigate("course")}>
                  К следующему уроку →
                </button>
                <button className="secondary-button" onClick={() => navigate("lesson")}>
                  Повторить материал
                </button>
              </div>
            )}

            {!loading && !gameFinished && currentQuestion && (
              <>
                <div className="question-progress">
                  <span>Вопрос {questionIndex + 1} из {questions.length}</span>
                  <span>⚡ +10 XP за правильный ответ</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${((questionIndex + 1) / questions.length) * 100}%`,
                    }}
                  />
                </div>

                <h2>{currentQuestion.question}</h2>

                <div className="answer-list">
                  {currentQuestion.options.map((option, index) => {
                    let className = "answer-button";

                    if (selectedAnswer === index) className += " answer-selected";

                    if (checked && index === currentQuestion.answer) {
                      className += " answer-correct";
                    } else if (
                      checked &&
                      selectedAnswer === index &&
                      index !== currentQuestion.answer
                    ) {
                      className += " answer-wrong";
                    }

                    return (
                      <button
                        key={`${questionIndex}-${index}`}
                        className={className}
                        disabled={checked}
                        onClick={() => setSelectedAnswer(index)}
                      >
                        <span className="answer-letter">
                          {String.fromCharCode(65 + index)}
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>

                {checked && (
                  <div className="explanation">
                    <strong>
                      {selectedAnswer === currentQuestion.answer
                        ? "Верно! +10 XP 🎉"
                        : "Разберём ошибку 💡"}
                    </strong>
                    <p>{currentQuestion.explanation}</p>
                  </div>
                )}

                {hint && <div className="hint-box">{hint}</div>}

                {!checked ? (
                  <div className="game-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setHint(currentQuestion.explanation)}
                    >
                      💡 Подсказка
                    </button>
                    <button
                      className="primary-button"
                      disabled={selectedAnswer === null}
                      onClick={checkAnswer}
                    >
                      Проверить ответ
                    </button>
                  </div>
                ) : (
                  <button className="primary-button" onClick={nextQuestion}>
                    {questionIndex < questions.length - 1
                      ? "Следующий вопрос →"
                      : "Завершить миссию →"}
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {screen === "chat" && (
          <section className="panel chat-panel">
            <button className="back-button" onClick={() => navigate(activeLesson ? "lesson" : "course")}>
              ← Назад
            </button>
            <span className="eyebrow">ТВОЙ ИИ-РЕПЕТИТОР</span>
            <h1>Разберёмся вместе 💬</h1>
            <p>Спрашивай, проси примеры или объяснение попроще.</p>

            <div className="chat-messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`chat-bubble ${
                    message.role === "user" ? "user-bubble" : "ai-bubble"
                  }`}
                >
                  <strong>{message.role === "user" ? "Ты" : "SkillPath AI"}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
              {loading && <p className="loading-text">ИИ думает… ✨</p>}
            </div>

            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Напиши свой вопрос..."
                rows={2}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={!chatInput.trim() || loading}
              >
                Отправить ↑
              </button>
            </form>
          </section>
        )}

        {screen === "profile" && (
          <section className="panel profile-panel">
            <span className="eyebrow">ТВОЙ ПРОГРЕСС</span>
            <h1>Каждый шаг имеет значение ✨</h1>
            <p>Продолжай учиться — даже маленькие шаги складываются в результат.</p>

            <div className="stats-grid">
              <div className="stat-card">
                <span>⚡</span>
                <strong>{xp}</strong>
                <small>Всего XP</small>
              </div>
              <div className="stat-card">
                <span>🎯</span>
                <strong>{completedIds.length}</strong>
                <small>Уроков завершено</small>
              </div>
              <div className="stat-card">
                <span>🌱</span>
                <strong>{Math.floor(xp / 100) + 1}</strong>
                <small>Уровень</small>
              </div>
            </div>

            <div className="goal-card">
              <strong>Твоя цель</strong>
              <p>{goal || "Пока не выбрана"}</p>
              <span>Направление: {track}</span>
            </div>

            <button
              className="primary-button"
              onClick={() => navigate(course.length ? "course" : "home")}
            >
              Продолжить обучение →
            </button>
            <button className="secondary-button full-width-button" onClick={resetCourse}>
              Создать новый курс
            </button>
          </section>
        )}

        {notice && (
          <div className="notice-message">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Закрыть">×</button>
          </div>
        )}

        {error && (
          <div className="error-message" role="alert">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Закрыть">×</button>
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        {(
          [
            ["home", "⌂", "Главная"],
            ["course", "▤", "Мой курс"],
            ["game", "✦", "Игра"],
            ["chat", "◌", "ИИ-чат"],
            ["profile", "♙", "Профиль"],
          ] as [Screen, string, string][]
        ).map(([id, symbol, label]) => (
          <button
            key={id}
            className={`nav-item ${screen === id ? "nav-active" : ""}`}
            onClick={() => {
              if (id === "course" && !course.length) {
                setNotice("Сначала создай свой учебный маршрут.");
                return;
              }
              if (id === "game" && !lessonContent) {
                setNotice("Сначала открой урок, чтобы создать игру по материалу.");
                return;
              }
              if (id === "chat" && !messages.length) {
                setMessages([
                  {
                    role: "assistant",
                    content: "Привет! Расскажи, чему хочешь научиться, и мы начнём.",
                  },
                ]);
              }
              navigate(id);
            }}
          >
            <span>{symbol}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

