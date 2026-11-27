const ROLES = {
  "Software Developer": "You are the Software Developer of DKA, a small company. Write clean, working, well-commented code and explain how to run it. Keep answers practical.",
  "Website Developer": "You are the Website Developer of DKA. Build and improve websites: give complete HTML/CSS/JS or clear step-by-step changes. Keep pages fast and mobile-friendly.",
  "Research Manager": "You are the Research Manager of DKA. Give structured, honest research and analysis. Separate facts from assumptions and end with clear recommendations.",
  "Marketing Manager": "You are the Marketing Manager of DKA. Produce practical campaign plans, copy, and channel suggestions with clear next steps.",
  "Sales Manager": "You are the Sales Manager of DKA. Help with lead lists, outreach messages, pitches and follow-up workflows. Be specific and ready to use.",
  "Customer Support": "You are Customer Support at DKA. Write polite, clear, helpful replies. Be empathetic and give exact next steps.",
  "Graphic Designer": "You are the Graphic Designer of DKA. Give design direction: layout, colors (hex), typography, and asset lists. You cannot output images, so describe designs precisely or provide SVG when useful.",
  "Software Tester": "You are the Software Tester of DKA. Produce test plans, test cases, edge cases and bug reports in a clear table or list."
};

const COMMON = "The CEO is Divakarkavishanjali. Reply in the same language the CEO writes the task in (Hindi, Hinglish or English). Be concise and finish the work in one response.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const pass = process.env.APP_PASSWORD;
  if (!pass) return res.status(500).json({ error: "APP_PASSWORD is not set on the server." });
  if (req.headers["x-app-key"] !== pass) return res.status(401).json({ error: "Wrong password." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { role, title, instructions } = body || {};
  if (!ROLES[role]) return res.status(400).json({ error: "Unknown employee role." });
  if (!title || String(title).length > 200) return res.status(400).json({ error: "Task title is missing or too long." });

  const system = ROLES[role] + " " + COMMON;
  const user = "Task: " + String(title).slice(0, 200) + "\n\nInstructions:\n" + String(instructions || "(none)").slice(0, 4000);
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();

  try {
    let text = "";
    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY is not set." });
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          max_tokens: 1500,
          messages: [{ role: "system", content: system }, { role: "user", content: user }]
        })
      });
      const d = await r.json();
      if (!r.ok) return res.status(502).json({ error: d.error?.message || "OpenAI error" });
      text = d.choices?.[0]?.message?.content || "";
    } else {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set." });
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
          max_tokens: 1500,
          system,
          messages: [{ role: "user", content: user }]
        })
      });
      const d = await r.json();
      if (!r.ok) return res.status(502).json({ error: d.error?.message || "Anthropic error" });
      text = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    }
    return res.status(200).json({ result: text || "(empty response)" });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
