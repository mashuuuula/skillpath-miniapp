export default async (request) => {

  if (request.method !== "POST") {

    return new Response(

      JSON.stringify({ error: "Используй POST-запрос" }),

      { status: 405 }

    );

  }

  try {

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {

      return new Response(

        JSON.stringify({ error: "Не настроен ключ OpenRouter в Netlify" }),

        { status: 500 }

      );

    }

    const body = await request.json();

    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {

      return new Response(

        JSON.stringify({ error: "Сообщение пустое" }),

        { status: 400 }

      );

    }

    const response = await fetch(

      "https://openrouter.ai/api/v1/chat/completions",

      {

        method: "POST",

        headers: {

          Authorization: `Bearer ${apiKey}`,

          "Content-Type": "application/json",

          "X-Title": "SkillPath AI",

        },

        body: JSON.stringify({

          model: "openrouter/free",

          messages: [

            {

              role: "system",

              content:

                "Ты SkillPath AI — дружелюбный ИИ-напарник для новичков. Объясняй простым языком, короткими шагами. Помогай учиться программированию и создавать мини-игры на Python. Давай рабочие примеры кода, объясняй ошибки и предлагай небольшие игровые задания. Если пользователь просит создать игру, помоги сделать её пошагово.",

            },

            ...messages.slice(-12),

          ],

        }),

      }

    );

    const data = await response.json();

    if (!response.ok) {

      return new Response(

        JSON.stringify({

          error: data.error?.message || "Ошибка OpenRouter",

        }),

        { status: response.status }

      );

    }

    return new Response(

      JSON.stringify({

        reply: data.choices?.[0]?.message?.content || "Попробуй спросить ещё раз!",

      }),

      {

        status: 200,

        headers: { "Content-Type": "application/json" },

      }

    );

  } catch {

    return new Response(

      JSON.stringify({ error: "Не удалось связаться с ИИ. Попробуй ещё раз." }),

      { status: 500 }

    );

  }

};
