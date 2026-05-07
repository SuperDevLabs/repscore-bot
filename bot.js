// ============================================================
// RepScore Telegram Bot
// Commands: /score, /token, /help, /about
// ============================================================

import TelegramBot from "node-telegram-bot-api";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL   = process.env.REPSCORE_API_URL || "https://repscore-engine.onrender.com";
const SITE_URL  = "https://repscore.xyz";

if (!BOT_TOKEN) {
  console.error("✗ TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🤖 RepScore Bot starting...");

// ── Tier config ───────────────────────────────────────────────
const TIERS = {
  LEGEND:      { emoji:"✦", label:"Legend",      bar:"🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩" },
  VERIFIED:    { emoji:"✓", label:"Verified",     bar:"🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜" },
  ESTABLISHED: { emoji:"◈", label:"Established",  bar:"🟨🟨🟨🟨🟨🟨🟨⬜⬜⬜" },
  UNPROVEN:    { emoji:"◌", label:"Unproven",     bar:"🟦🟦🟦🟦🟦⬜⬜⬜⬜⬜" },
  FLAGGED:     { emoji:"⚑", label:"Flagged",      bar:"🟧🟧🟧🟧⬜⬜⬜⬜⬜⬜" },
  BLACKLISTED: { emoji:"✕", label:"Blacklisted",  bar:"🟥🟥🟥⬜⬜⬜⬜⬜⬜⬜" },
};

const FLAG_EMOJI = { CRITICAL:"🔴", HIGH:"🟠", MEDIUM:"🟡", LOW:"🔵" };

// ── Helpers ───────────────────────────────────────────────────
function isValidWallet(addr) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function short(str) {
  return str.slice(0,4) + "..." + str.slice(-4);
}

function formatHours(h) {
  if (!h || h === 0) return "—";
  if (h < 24)  return `${Math.round(h)}h`;
  if (h < 168) return `${(h/24).toFixed(1)}d`;
  return `${(h/168).toFixed(1)}w`;
}

// ── Fetch score ───────────────────────────────────────────────
async function fetchScore(wallet) {
  const res  = await fetch(`${API_URL}/v1/score/${wallet}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Score unavailable");
  return json.data;
}

async function fetchToken(mint) {
  const res  = await fetch(`${API_URL}/v1/token/${mint}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Token not found");
  return json;
}

// ── Format score message ──────────────────────────────────────
function formatScore(data, wallet) {
  const { score, tier, role, components, flags, metadata } = data;
  const t = TIERS[tier] || TIERS.UNPROVEN;

  const compLines = [
    ["Launch History",   components.launchHistory?.raw    ?? 0],
    ["Liquidity",        components.liquidityBehavior?.raw ?? 0],
    ["Holder Retention", components.holderRetention?.raw  ?? 0],
    ["Community",        components.communitySignals?.raw ?? 0],
    ["Wallet History",   components.walletHistory?.raw    ?? 0],
  ].map(([label, val]) => {
    const bar = "█".repeat(Math.round(val/10)) + "░".repeat(10 - Math.round(val/10));
    return `  ${label.padEnd(16)} ${bar} ${val}`;
  }).join("\n");

  const flagLines = flags.length > 0
    ? flags.map(f => `  ${FLAG_EMOJI[f.severity] || "⚪"} [${f.severity}] ${f.code}`).join("\n")
    : "  ✅ No flags detected";

  const meta = [
    `Launches: ${metadata.totalLaunches}`,
    `Graduated: ${metadata.graduatedCount}`,
    `Wallet age: ${metadata.walletAgeDays}d`,
    `Volume: ${metadata.totalVolumeSol.toFixed(1)} SOL`,
  ].join(" · ");

  return `🧬 *RepScore — ${short(wallet)}*

${t.bar}
*${score}/1000* — ${t.emoji} ${t.label} · ${role}

📊 *Breakdown*
\`\`\`
${compLines}
\`\`\`

🚩 *Flags*
${flagLines}

📋 *${meta}*

🔗 [Full breakdown](${SITE_URL}/score?wallet=${wallet}) · [Share card](${SITE_URL}/share?wallet=${wallet})
_repscore.xyz_`;
}

// ── /start ────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🧬 *RepScore Bot*

The on-chain reputation score for Solana wallets.

*Commands:*
/score \`WALLET\` — Score any wallet
/token \`MINT\` — Look up token dev score
/help — All commands
/about — About RepScore

_repscore.xyz_
  `, { parse_mode: "Markdown" });
});

// ── /help ─────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🧬 *RepScore Commands*

/score \`WALLET\` — Score any Solana wallet
/token \`MINT\` — Look up token and see dev score
/about — What is RepScore?
/help — This message

*Score Tiers:*
✦ Legend (1000) — Elite
✓ Verified (850+) — Proven
◈ Established (600+) — Decent history
◌ Unproven (400+) — New wallet
⚑ Flagged (200+) — Suspicious
✕ Blacklisted (0-199) — Confirmed bad actor

_repscore.xyz_
  `, { parse_mode: "Markdown" });
});

// ── /about ────────────────────────────────────────────────────
bot.onText(/\/about/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🧬 *About RepScore*

The first on-chain reputation scoring system for Solana wallets.

We score devs 0-1000 based on:
• Launch history & token longevity
• Token lock behavior (Streamflow)
• Holder retention at 7d, 30d, 90d
• Bundle/self-snipe detection
• Raydium graduation detection

No self-reporting. No manipulation. Just chain data.

Built by Super Dev Labs
🔗 repscore.xyz
  `, { parse_mode: "Markdown" });
});

// ── /score ────────────────────────────────────────────────────
bot.onText(/\/score(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const wallet = match[1]?.trim();

  if (!wallet) {
    bot.sendMessage(chatId, "Please provide a wallet:\n`/score YOUR_WALLET`", { parse_mode: "Markdown" });
    return;
  }

  if (!isValidWallet(wallet)) {
    bot.sendMessage(chatId, "⚠️ Invalid Solana wallet address.");
    return;
  }

  bot.sendChatAction(chatId, "typing");
  const loading = await bot.sendMessage(chatId, `🔍 Scanning \`${short(wallet)}\`...`, { parse_mode: "Markdown" });

  try {
    const data = await fetchScore(wallet);
    await bot.editMessageText(formatScore(data, wallet), {
      chat_id: chatId,
      message_id: loading.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  } catch (err) {
    await bot.editMessageText(`⚠️ ${err.message}`, {
      chat_id: chatId,
      message_id: loading.message_id,
    });
  }
});

// ── /token ────────────────────────────────────────────────────
bot.onText(/\/token(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const mint   = match[1]?.trim();

  if (!mint) {
    bot.sendMessage(chatId, "Please provide a token mint:\n`/token MINT_ADDRESS`", { parse_mode: "Markdown" });
    return;
  }

  bot.sendChatAction(chatId, "typing");
  const loading = await bot.sendMessage(chatId, `🪙 Looking up token \`${short(mint)}\`...`, { parse_mode: "Markdown" });

  try {
    const result  = await fetchToken(mint);
    const data    = result.score;
    const deployer = result.deployer;
    const t = TIERS[data.tier] || TIERS.UNPROVEN;

    const message = `🪙 *Token Lookup — ${short(mint)}*

👨‍💻 *Deployer:* \`${short(deployer)}\`

${t.bar}
*${data.score}/1000* — ${t.emoji} ${t.label}

${data.flags.length > 0
  ? data.flags.slice(0,3).map(f => `${FLAG_EMOJI[f.severity]} ${f.code}`).join("\n")
  : "✅ No flags on this dev wallet"}

🔗 [Dev score](${SITE_URL}/score?wallet=${deployer}) · [Token page](${SITE_URL}/token?mint=${mint})
_repscore.xyz_`;

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: loading.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  } catch (err) {
    await bot.editMessageText(`⚠️ ${err.message}`, {
      chat_id: chatId,
      message_id: loading.message_id,
    });
  }
});

// ── Auto-detect wallet addresses in private chat ──────────────
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  if (msg.chat.type !== "private") return;

  const words  = msg.text.trim().split(/\s+/);
  const wallet = words.find(w => isValidWallet(w) && w.length >= 32);
  if (!wallet) return;

  const chatId = msg.chat.id;
  bot.sendChatAction(chatId, "typing");
  const loading = await bot.sendMessage(chatId, `🔍 Detected wallet — scanning \`${short(wallet)}\`...`, { parse_mode: "Markdown" });

  try {
    const data = await fetchScore(wallet);
    await bot.editMessageText(formatScore(data, wallet), {
      chat_id: chatId,
      message_id: loading.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  } catch {
    bot.deleteMessage(chatId, loading.message_id);
  }
});

// ── Error handling ────────────────────────────────────────────
bot.on("polling_error", (err) => console.error("[Bot] Polling error:", err.message));
bot.on("error", (err) => console.error("[Bot] Error:", err.message));

console.log("✓ RepScore Bot running");

