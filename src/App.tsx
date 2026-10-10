

import { useEffect, useState } from "react";
import "./App.css";

type Lesson = {
  title: string;
  description: string;
  task: string;
  reward: number;
};

type LearningPlan = {
  goal: string;
  level: string;
  lessons: Lesson[];
};

const defaultLessons: Lesson[] = [
  {
    title: "Разведка",
    description: "Разберись в основах своей новой цели и пойми, что уже знаешь.",
    task: "Объясни своими словами, чему хочешь научиться и зачем.",
    reward: 20,
  },
  {
    title: "Первый навык",
    description: "Освой один небольшой элемент, который приблизит тебя к результату.",
    task: "Попробуй применить новое знание на простом примере.",
    reward: 30,
  },
  {
    title: "Практика",
    description: "Переходи от теории к самостоятельному действию.",
    task: "Выполни небольшое практическое задание и оцени результат.",
    reward: 40,
  },
  {
    title: "Проверка уровня",
    description: "Проверь, что получилось, найди ошибки и выбери следующий шаг.",
    task: "Расскажи, что получилось, а что пока вызывает трудности.",
    reward: 50,
  },
];

const examples = [
  "Научиться играть на гитаре",
  "Освоить Python с нуля",
  "Подтянуть английский",
  "Научиться кататься на скейте",
  "Разобраться в математике",
];

function makePlan(goal: string): LearningPlan {
  return {
    goal,
    level: "Начинающий",
    lessons: defaultLessons.map((lesson, index) => ({
      ...lesson,
      title: [
        "Знакомство с целью",
        "Первые основы",
        "Практическая миссия",
        "Проверка результата",
      ][index],
    })),
  };
}

function App() {
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<"learner" | "parent">("learner");
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [activeLesson, setActiveLesson] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [xp, setXp] = useState(0);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<string[]>([]);
  const [showExamples, setShowExamples] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("skillpath-progress");
      if (saved) {
        const data = JSON.parse(saved);
        setXp(data.xp ?? 0);
        setCompleted(data.completed ?? []);
        setGoal(data.goal ?? "");
        setMode(data.mode ?? "learner");
      }
    } catch {
      // Если сохранённых данных нет, начинаем с чистого профиля.
    }

    const telegram = window as Window & {
      Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } };
    };
    telegram.Telegram?.WebApp?.ready?.();
    telegram.Telegram?.WebApp?.expand?.();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "skillpath-progress",
      JSON.stringify({ xp, completed, goal, mode }),
    );
  }, [xp, completed, goal, mode]);

  function startLearning(value = goal) {
    const cleanGoal = value.trim();
    if (!cleanGoal) return;

    setGoal(cleanGoal);
    setPlan(makePlan(cleanGoal));
    setActiveLesson(0);
    setChat([
      `Моя цель: ${cleanGoal}`,
      "План создан! Пока это демонстрационный маршрут. Следующим этапом подключим ИИ, который будет адаптировать уроки под твои ответы.",
    ]);
    setShowExamples(false);
  }

  function finishLesson() {
    if (!plan || completed.includes(activeLesson)) return;

    const nextCompleted = [...completed, activeLesson];
    setCompleted(nextCompleted);
    setXp((current) => current + plan.lessons[activeLesson].reward);

    if (activeLesson < plan.lessons.length - 1) {
      setActiveLesson(activeLesson + 1);
    }
  }

  function sendMessage() {
    const clean = message.trim();
    if (!clean) return;

    setChat((current) => [
      ...current,
      `Ты: ${clean}`,
      "ИИ-репетитор: я получил твой ответ. Для полноценного разбора, проверки ошибок и персональных объяснений нужно подключить наш сервер нейросети. Пока здесь работает демонстрационный режим.",
    ]);
    setMessage("");
  }

  const level = Math.floor(xp / 100) + 1;
  const progress = plan
    ? Math.round((completed.length / plan.lessons.length) * 100)
    : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setPlan(null)}>
          <span className="brand-icon">✦</span>
          <span>
            <strong>SkillPath</strong>
            <small>AI LEARNING COMPANION</small>
          </span>
        </button>
        <div className="level-pill">
          <span>⚡</span> {xp} XP
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span className="live-dot" />
          ТВОЙ ПУТЬ НАЧИНАЕТСЯ ЗДЕСЬ
        </div>
        <h1>
          Учись чему угодно.
          <br />
          <span>Становись кем угодно.</span>
        </h1>
        <p className="hero-text">
          Твоя цель — твои правила. От школьных предметов до новых навыков
          и больших мечтаний.
        </p>

        <div className="mode-switch">
          <button
            className={mode === "learner" ? "mode active" : "mode"}
            onClick={() => setMode("learner")}
          >
            🚀 Я хочу учиться
          </button>
          <button
            className={mode === "parent" ? "mode active" : "mode"}
            onClick={() => setMode("parent")}
          >
            💜 Я родитель
          </button>
        </div>
      </section>

      {!plan ? (
        <section className="goal-card">
          <div className="section-kicker">01 / ТВОЯ МИССИЯ</div>
          <h2>
            {mode === "parent"
              ? "Чему нужно научиться вашему ребёнку?"
              : "Что ты хочешь освоить?"}
          </h2>
          <p className="muted">
            Не нужно выбирать из готового списка. Просто напиши свою цель.
          </p>

          <form
            className="goal-form"
            onSubmit={(event) => {
              event.preventDefault();
              startLearning();
            }}
          >
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder={
                mode === "parent"
                  ? "Например: помочь ребёнку 10 лет понять дроби..."
                  : "Например: хочу научиться играть на гитаре..."
              }
              rows={3}
            />
            <button className="primary-button" type="submit">
              Создать мой путь <span>↗</span>
            </button>
          </form>

          {showExamples && (
            <div className="examples">
              <span className="muted small">ИЛИ ПОПРОБУЙ:</span>
              <div className="example-list">
                {examples.map((example) => (
                  <button
                    className="example-chip"
                    key={example}
                    onClick={() => {
                      setGoal(example);
                      startLearning(example);
                    }}
                  >
                    {example} <span>↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="promise-row">
            <span>✦ Любой навык</span>
            <span>✦ Свой темп</span>
            <span>✦ Практика без скуки</span>
          </div>
        </section>
      ) : (
        <>
          <section className="plan-card">
            <button className="back-button" onClick={() => setPlan(null)}>
              ← Изменить цель
            </button>
            <div className="section-kicker">ТВОЙ УЧЕБНЫЙ МАРШРУТ</div>
            <h2>{plan.goal}</h2>
            <div className="plan-meta">
              <span>🌱 {plan.level}</span>
              <span>🎯 {plan.lessons.length} этапа</span>
              <span>⚡ Уровень {level}</span>
            </div>
            <div className="progress-heading">
              <span>Прогресс миссии</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="lesson-list">
              {plan.lessons.map((lesson, index) => {
                const isDone = completed.includes(index);
                const isActive = activeLesson === index;
                return (
                  <button
                    className={`lesson-item ${isActive ? "selected" : ""} ${
                      isDone ? "done" : ""
                    }`}
                    key={lesson.title}
                    onClick={() => setActiveLesson(index)}
                  >
                    <span className="lesson-number">
                      {isDone ? "✓" : `0${index + 1}`}
                    </span>
                    <span className="lesson-copy">
                      <strong>{lesson.title}</strong>
                      <small>{lesson.description}</small>
                    </span>
                    <span className="lesson-xp">+{lesson.reward} XP</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mission-card">
            <div className="mission-topline">
              <span className="mission-icon">✧</span>
              <span className="section-kicker">АКТИВНОЕ ЗАДАНИЕ</span>
              <span className="mission-xp">
                +{plan.lessons[activeLesson].reward} XP
              </span>
            </div>
            <h2>{plan.lessons[activeLesson].title}</h2>
            <p>{plan.lessons[activeLesson].description}</p>
            <div className="task-box">
              <span>ТВОЁ ЗАДАНИЕ</span>
              <p>{plan.lessons[activeLesson].task}</p>
            </div>
            <button
              className="primary-button"
              onClick={finishLesson}
              disabled={completed.includes(activeLesson)}
            >
              {completed.includes(activeLesson)
                ? "✓ Этап завершён"
                : "Завершить этап"}
              <span>↗</span>
            </button>
            {progress === 100 && (
              <p className="success-message">
                🎉 Все этапы демонстрационного маршрута пройдены! Теперь можно
                создать новую цель.
              </p>
            )}
          </section>

          <section className="mentor-card">
            <div className="mentor-header">
              <div className="mentor-avatar">✦</div>
              <div>
                <h3>Твой AI-напарник</h3>
                <p>Задай вопрос или расскажи о трудностях</p>
              </div>
            </div>
            <div className="chat-messages">
              {chat.map((item, index) => (
                <div className="chat-line" key={`${index}-${item}`}>
                  {item}
                </div>
              ))}
            </div>
            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Напиши сообщение..."
              />
              <button type="submit" aria-label="Отправить сообщение">
                ↑
              </button>
            </form>
          </section>
        </>
      )}

      <section className="features">
        <div className="section-kicker">НЕ ПРОСТО УРОКИ</div>
        <h2>Учёба, которая подстраивается под тебя.</h2>
        <div className="feature-grid">
          <article className="feature">
            <span>🧠</span>
            <h3>Объясняет понятно</h3>
            <p>Сложные вещи — простым языком и с примерами.</p>
          </article>
          <article className="feature">
            <span>🎮</span>
            <h3>Превращает в игру</h3>
            <p>Маленькие задания, достижения и ощущение прогресса.</p>
          </article>
          <article className="feature">
            <span>👨‍👩‍👧</span>
            <h3>Помогает родителям</h3>
            <p>Планы занятий и помощь в объяснении сложных тем детям.</p>
          </article>
        </div>
      </section>

      <footer className="footer">
        <span className="brand-icon">✦</span> SkillPath AI
        <p>Твой следующий уровень начинается с одного шага.</p>
      </footer>
    </main>
  );
}

export default App;
