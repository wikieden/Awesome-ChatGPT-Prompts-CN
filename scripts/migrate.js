#!/usr/bin/env node
/*
 * migrate.js —— 一次性：把旧 README.md 里的全部角色提示词解析进数据源。
 * 用法: node scripts/migrate.js
 * 行为: 读 README.md + web/data/prompts.js，合并去重后重写 web/data/prompts.js。
 *   - 已有的精选条目（带英文）保留不动
 *   - 新迁移条目：中文完整，英文留空 + needs_en:true（交给每日流水线回填）
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const README = path.join(ROOT, "README.md");
const DATA = path.join(ROOT, "web", "data", "prompts.js");

// 载入现有数据
global.window = {};
require(DATA);
const CATEGORIES = window.CATEGORIES;
const existing = window.PROMPTS;
const existingTitles = new Set(existing.map(p => p.title_zh.replace(/\s/g, "")));

// 解析 README：提示词区从 "# **提示**" 开始
const md = fs.readFileSync(README, "utf8");
const lines = md.split("\n");
let startIdx = lines.findIndex(l => /^#\s*\*?\*?提示\*?\*?\s*$/.test(l));
if (startIdx === -1) startIdx = lines.findIndex(l => l.includes("充当 Linux 终端"));
const region = lines.slice(startIdx);

const cleanTitle = h => h
  .replace(/^#+\s*/, "")
  .replace(/\*\*/g, "")
  .replace(/✂️/g, "")
  .replace(/`/g, "")
  .trim();

const migrated = [];
let cur = null;
let seq = 1;
const pad = n => String(n).padStart(3, "0");

function flush() {
  if (!cur) return;
  const body = cur.body.join("\n").trim();
  const titleKey = cur.title.replace(/\s/g, "");
  if (body && cur.title && !existingTitles.has(titleKey)) {
    migrated.push({
      id: "role-" + pad(seq++),
      category: "role",
      level: "beginner",
      title_zh: cur.title,
      title_en: "",
      body_zh: body,
      body_en: "",
      needs_en: true,
      models: ["GPT", "Claude", "Gemini", "DeepSeek"],
      tags: [],
      source: cur.source || "",
      updated: "2026-06-07"
    });
    existingTitles.add(titleKey);
  }
  cur = null;
}

for (const raw of region) {
  const line = raw.replace(/\r$/, "");
  if (/^##\s/.test(line)) {              // 新条目标题
    flush();
    cur = { title: cleanTitle(line), body: [], source: "" };
  } else if (cur) {
    if (/^>/.test(line)) {               // 引用块 = 正文
      cur.body.push(line.replace(/^>\s?/, ""));
    } else if (/贡献者|参考|替代|示例/.test(line)) {
      const m = line.match(/@[\w-]+/);
      if (m && !cur.source) cur.source = m[0];
    }
  }
}
flush();

// 重写数据文件
const header = `/*
 * ============================================================
 *  AI 提示词大全 · 结构化数据（单一数据源 / Single Source of Truth）
 * ============================================================
 *  唯一数据源：网站、中英文 README 都从这里自动生成。
 *  日常维护 = 只改本文件 + 跑 scripts/build.js，不要手改 README / HTML。
 *
 *  字段: id / category / level(beginner|intermediate|advanced)
 *        title_zh,title_en / body_zh,body_en / models / tags / source / updated
 *        needs_en:true 表示英文待回填（每日流水线处理）
 * ============================================================
 */
`;
const out = header +
  "\nwindow.CATEGORIES = " + JSON.stringify(CATEGORIES, null, 2) + ";\n" +
  "\nwindow.PROMPTS = " + JSON.stringify(existing.concat(migrated), null, 2) + ";\n";

fs.writeFileSync(DATA, out, "utf8");
console.log(`迁移完成：原有 ${existing.length} 条 + 新增 ${migrated.length} 条 = 共 ${existing.length + migrated.length} 条`);
