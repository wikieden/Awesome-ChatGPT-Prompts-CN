#!/usr/bin/env node
/*
 * build.js —— 从单一数据源生成中英文 README。
 * 用法: node scripts/build.js
 *   - README.md     : 保留原有头部（捐赠/交流群/介绍），自动重建提示词列表部分
 *   - README_EN.md  : 生成英文版（英文缺失时回退中文）
 * 提示词部分包在 AUTO 标记之间，可反复重建，幂等。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "web", "data", "prompts.js");
const README = path.join(ROOT, "README.md");
const README_EN = path.join(ROOT, "README_EN.md");

const SITE = "https://wikieden.github.io/Awesome-ChatGPT-Prompts-CN/";
const START = "<!-- AUTO-PROMPTS:START （以下由 scripts/build.js 自动生成，勿手改） -->";
const END = "<!-- AUTO-PROMPTS:END -->";

global.window = {};
require(DATA);
const CATS = window.CATEGORIES;
const PROMPTS = window.PROMPTS;

function section(lang) {
  const L = lang === "en";
  const lines = [];
  lines.push(START);
  lines.push("");
  lines.push(L ? `> 🌐 **Live site (search · copy · ⭐):** ${SITE}` : `> 🌐 **在线版（搜索 · 一键复制 · ⭐）：** ${SITE}`);
  lines.push("");
  // 目录
  lines.push(L ? "### Categories" : "### 板块目录");
  lines.push("");
  for (const c of CATS) {
    const n = PROMPTS.filter(p => p.category === c.id).length;
    const label = L ? c.en : c.zh;
    lines.push(`- ${c.icon} **${label}** (${n})`);
  }
  lines.push("");
  // 分板块列表
  for (const c of CATS) {
    const items = PROMPTS.filter(p => p.category === c.id);
    if (!items.length) continue;
    lines.push(`## ${c.icon} ${L ? c.en : c.zh}`);
    lines.push("");
    for (const p of items) {
      const title = L ? (p.title_en || p.title_zh) : p.title_zh;
      const body = L ? (p.body_en || p.body_zh) : p.body_zh;
      const lvl = { beginner: L ? "🟢 Beginner" : "🟢 新手", intermediate: L ? "🟡 Intermediate" : "🟡 进阶", advanced: L ? "🔴 Advanced" : "🔴 高级" }[p.level] || "";
      lines.push(`### ${title}`);
      const meta = [lvl, (p.models || []).join(" · ")].filter(Boolean).join(" ｜ ");
      if (meta) lines.push(`\`${meta}\`` + (p.source ? `  ·  ${p.source}` : ""));
      lines.push("");
      lines.push("> " + body.replace(/\n/g, "\n> "));
      lines.push("");
    }
  }
  lines.push(END);
  return lines.join("\n");
}

// ---- README.md：保留头部，替换提示词区 ----
let head = "";
if (fs.existsSync(README)) {
  const cur = fs.readFileSync(README, "utf8");
  if (cur.includes(START)) {
    head = cur.slice(0, cur.indexOf(START)).replace(/\s+$/, "") + "\n\n";
  } else {
    // 首次：保留 "# **提示**" 之前的全部内容作为头部
    const idx = cur.search(/^#\s*\*?\*?提示\*?\*?\s*$/m);
    head = (idx > -1 ? cur.slice(0, idx) : cur).replace(/\s+$/, "") + "\n\n";
  }
}
fs.writeFileSync(README, head + section("zh") + "\n", "utf8");

// ---- README_EN.md：英文头部 + 英文列表 ----
const enHead = `# 🧠 Awesome ChatGPT Prompts (CN) — Bilingual AI Prompt Hub

A beginner-friendly, **bilingual (中文 / English)** collection of AI prompts, image/video generation tips, and agent skills — covering GPT, Claude, Gemini, and Chinese models (DeepSeek, Kimi, Doubao, etc.). Updated frequently.

🌐 **Live site:** ${SITE}
🇨🇳 中文版见 [README.md](README.md)

`;
fs.writeFileSync(README_EN, enHead + section("en") + "\n", "utf8");

console.log(`已生成 README.md 与 README_EN.md（共 ${PROMPTS.length} 条，${CATS.length} 个板块）`);
