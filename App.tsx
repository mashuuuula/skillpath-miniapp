

import { useState } from "react";
import "./App.css";

type Screen = "home" | "lesson" | "game" | "chat" | "profile";

type Question = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

const defaultQuestions: Question[] = [
  {
    question: "Зачем нужно практиковаться после изучения новой темы?",
    options: [
      "Чтобы быстрее забыть материал",
      "Чтобы проверить понимание и закрепить знания",
      "Чтобы пропустить следующий урок",
      "Практика вообще не нужна",
    ],
    answer: 1,
    explanation:
      "Практика помогает проверить, понял ли ты материал, и научиться применять его самостоятельно.",
  },
  {
    question: "Что лучше сделать, если ты допустил ошибку?",
    options: [
      "Бросить обучение",
      "Всегда угадывать ответы",
      "Разобраться, почему ответ неверный",
      "Пропустить все сложные темы",
    ],
    answer: 2,
    explanation:
      "Ошибки — часть обучения. Когда ты понимаешь причину ошибки, ты действительно учишься.",
  },
];

const initialMessage =
  "Привет! 👋 Я твой персональный ИИ-репетитор SkillPath AI. Напиши, чему ты хочешь научиться, а я помогу составить маршрут обучения.";

async function askAI(
  messages: { role: string; content: string }[],
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
    throw new Error(data.error || "Не удалось получить ответ ИИ");
  }

  if (typeof data.reply !== "string" || !data.reply.trim()) {
    throw new Error("ИИ вернул пустой ответ");
  }

  return data.reply;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [goal, setGoal] = useState("");
  const [track, setTrack] = useState("ИИ и код");
  const [lesson, setLesson] = useState("");
  const [lessonTitle, setLessonTitle] = useState("Твоя первая миссия");
  const [questions, setQuestions] =
    useState<Question[]>(defaultQuestions);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [xp, setXp] = useState(0);
  const [completedLessons, setCompletedLessons] = useState(0);
  const [hint, setHint] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: string; content: string }[]
  >([{ role: "assistant", content: initialMessage }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startLearning() {
    if (!goal.trim() || loading) return;

    setLoading(true);
    setError("");
    setScreen("lesson");
    setLesson("");

    const prompt = `
Ты — доброжелательный персональный ИИ-репетитор для начинающего.
Цель ученика: ${goal}.
Направление: ${track}.

Составь начало персонального обучения.
1. Поздоровайся и поддержи ученика.
2. Назови первую конкретную тему.
3. Объясни её простыми словами, короткими абзацами.
4. Покажи понятный пример.
5. Дай небольшое задание, которое ученик сможет выполнить.
6. Не переходи к сложным темам, пока ученик не освоил основы.
7. В конце предложи нажать кнопку для интерактивной игровой практики.

Не выдумывай, что ученик уже знает материал. Пиши понятно и дружелюбно.
`;

    try {
      const reply = await askAI(
        [{ role: "user", content: prompt }],
        goal,
        "lesson"
      );

      setLesson(reply);

      const firstLine = reply
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      setLessonTitle(
        firstLine?.replace(/^#+\s*/, "").slice(0, 70) ||
          "Твой первый урок"
      );

      setChatMessages([
        { role: "assistant", content: initialMessage },
        { role: "user", content: `Я хочу научиться: ${goal}` },
        { role: "assistant", content: reply },
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось загрузить урок. Попробуй ещё раз."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    setScreen("game");
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setChecked(false);
    setGameFinished(false);
    setHint("");
    setError("");

    if (!goal.trim() || !lesson) return;

    setLoading(true);

    const prompt = `
Ты создаёшь интерактивную учебную игру для начинающего.
Цель ученика: ${goal}.
Изученный материал:
${lesson}

Составь ровно 4 вопроса для закрепления именно этого материала.
Каждый вопрос должен иметь 4 варианта ответа и один правильный ответ.
Включи краткое объяснение правильного ответа.

Верни только корректный JSON без Markdown и без текста вокруг:
{
  "questions": [
    {
      "question": "Текст вопроса",
      "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
      "answer": 0,
      "explanation": "Объяснение"
    }
  ]
}

answer — номер правильного варианта, начиная с 0.
Не создавай вопросы по материалу, который ещё не объяснялся.
`;

    try {
      const reply = await askAI(
        [{ role: "user", content: prompt }],
        goal,
        "game"
      );

      const cleaned = reply
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      const generated = parsed.questions;

      if (
        !Array.isArray(generated) ||
        generated.length === 0 ||
        !generated.every(
          (q: Question) =>
            typeof q.question === "string" &&
            Array.isArray(q.options) &&
            q.options.length >= 2 &&
            Number.isInteger(q.answer) &&
            q.answer >= 0 &&
            q.answer < q.options.length &&
            typeof q.explanation === "string"
        )
      ) {
        throw new Error("ИИ создал вопросы в неожиданном формате");
      }

      setQuestions(generated);
    } catch {
      setQuestions(defaultQuestions);
      setError(
        "Не удалось создать игру по уроку. Пока доступна тренировочная миссия."
      );
    } finally {
      setLoading(false);
    }
  }

  function checkAnswer() {
    if (selectedAnswer === null || checked) return;

    setChecked(true);

    if (selectedAnswer === questions[questionIndex].answer) {
      setXp((current) => current + 10);
    }
  }

  function nextQuestion() {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      setSelectedAnswer(null);
      setChecked(false);
      setHint("");
    } else {
      setGameFinished(true);
      setCompletedLessons((current) => current + 1);
      setXp((current) => current + 20);
    }
  }

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || loading) return;

    const nextHistory = [
      ...chatMessages,
      { role: "user", content: text },
    ];

    setChatMessages(nextHistory);
    setChatInput("");
    setLoading(true);
    setError("");

    try {
      const reply = await askAI(nextHistory, goal, "tutor");
      setChatMessages([
        ...nextHistory,
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

  const currentQuestion = questions[questionIndex];

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" onClick={() => setScreen("home")}>
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
              Ставь цель, изучай темы с ИИ и закрепляй знания в
              интерактивных играх.
            </p>

            <h3>Чему хочешь научиться?</h3>

            <div className="track-grid">
              {["ИИ и код", "Языки", "Школа"].map((item) => (
                <button
                  key={item}
                  className={`track-button ${
                    track === item ? "selected" : ""
                  }`}
                  onClick={() => setTrack(item)}
                >
                  {item === "ИИ и код"
                    ? "🤖"
                    : item === "Языки"
                      ? "🌍"
                      : "📚"}
                  <span>{item}</span>
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="goal">
              Твоя цель
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Например: хочу научиться Python с нуля и создавать ИИ-агентов..."
              rows={3}
            />

            <button
              className="primary-button"
              onClick={startLearning}
              disabled={!goal.trim() || loading}
            >
              {loading ? "Готовим обучение..." : "Создать мой маршрут →"}
            </button>

            <div className="feature-row">
              <span>🎯 Личный план</span>
              <span>🎮 Игровая практика</span>
              <span>✨ Поддержка ИИ</span>
            </div>
          </section>
        )}

        {screen === "lesson" && (
          <section className="panel">
            <button
              className="back-button"
              onClick={() => setScreen("home")}
            >
              ← На главную
            </button>

            <span className="eyebrow">ТВОЙ УРОК</span>
            <h1>{lessonTitle}</h1>

            {loading && !lesson && (
              <p>ИИ готовит твой первый урок… ✨</p>
            )}

            {lesson && (
              <div className="lesson-content">{lesson}</div>
            )}

            {lesson && (
              <div className="lesson-actions">
                <button
                  className="primary-button"
                  onClick={startGame}
                  disabled={loading}
                >
                  {loading ? "Создаём игру..." : "🎮 Перейти к игре"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setScreen("chat")}
                >
                  💬 Задать вопрос ИИ
                </button>
              </div>
            )}
          </section>
        )}

        {screen === "game" && (
          <section className="panel game-panel">
            <button
              className="back-button"
              onClick={() => setScreen("lesson")}
            >
              ← Вернуться к уроку
            </button>

            <span className="eyebrow">ИНТЕРАКТИВНАЯ МИССИЯ</span>

            {loading && <p>ИИ придумывает задания по твоему уроку…</p>}

            {!loading && gameFinished && (
              <div className="result-screen">
                <div className="result-icon">🏆</div>
                <h1>Миссия пройдена!</h1>
                <p>
                  Ты завершил тренировку. Продолжай — новые знания
                  складываются из маленьких побед.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setScreen("profile")}
                >
                  Посмотреть прогресс →
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setScreen("lesson")}
                >
                  Вернуться к уроку
                </button>
              </div>
            )}

            {!loading && !gameFinished && currentQuestion && (
              <>
                <div className="question-progress">
                  <span>
                    Вопрос {questionIndex + 1} из {questions.length}
                  </span>
                  <span>+10 XP за правильный ответ</span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        ((questionIndex + 1) / questions.length) * 100
                      }%`,
                    }}
                  />
                </div>

                <h2>{currentQuestion.question}</h2>

                <div className="answer-list">
                  {currentQuestion.options.map((option, index) => {
                    let className = "answer-button";

                    if (selectedAnswer === index) {
                      className += " answer-selected";
                    }

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
                        onClick={() =>
                          !checked && setSelectedAnswer(index)
                        }
                        disabled={checked}
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
                        ? "Отлично! +10 XP 🎉"
                        : "Ничего страшного! Учимся на ошибках 💡"}
                    </strong>
                    <p>{currentQuestion.explanation}</p>
                  </div>
                )}

                {hint && <div className="hint-box">{hint}</div>}

                {!checked ? (
                  <div className="game-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setHint(
                          `Подсказка: ${currentQuestion.explanation}`
                        )
                      }
                    >
                      💡 Подсказка
                    </button>
                    <button
                      className="primary-button"
                      onClick={checkAnswer}
                      disabled={selectedAnswer === null}
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
            <span className="eyebrow">ТВОЙ ИИ-РЕПЕТИТОР</span>
            <h1>Разберёмся вместе 💬</h1>
            <p>Спрашивай, проси примеры или объяснение попроще.</p>

            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`chat-bubble ${
                    message.role === "user" ? "user-bubble" : "ai-bubble"
                  }`}
                >
                  <strong>
                    {message.role === "user" ? "Ты" : "SkillPath AI"}
                  </strong>
                  <p>{message.content}</p>
                </div>
              ))}
              {loading && <p className="loading-text">ИИ думает… ✨</p>}
            </div>

            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
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
            <h1>Ты уже на пути 🚀</h1>
            <p>Каждая пройденная тема приближает тебя к цели.</p>

            <div className="stats-grid">
              <div className="stat-card">
                <span>⚡</span>
                <strong>{xp}</strong>
                <small>Всего XP</small>
              </div>
              <div className="stat-card">
                <span>🎯</span>
                <strong>{completedLessons}</strong>
                <small>Миссий пройдено</small>
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
              onClick={() => setScreen(lesson ? "lesson" : "home")}
            >
              Продолжить обучение →
            </button>
          </section>
        )}

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Закрыть">
              ×
            </button>
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        {(
          [
            ["home", "⌂", "Главная"],
            ["lesson", "▤", "Урок"],
            ["game", "✦", "Игра"],
            ["chat", "◌", "ИИ-чат"],
            ["profile", "♙", "Профиль"],
          ] as [Screen, string, string][]
        ).map(([id, symbol, label]) => (
          <button
            key={id}
            className={`nav-item ${screen === id ? "nav-active" : ""}`}
            onClick={() => {
              if (id === "lesson" && !lesson) {
                setScreen("home");
              } else if (id === "game" && !lesson) {
                setScreen("home");
                setError("Сначала создай маршрут и пройди первый урок.");
              } else {
                setScreen(id);
              }
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
