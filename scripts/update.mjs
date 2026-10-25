// 基準価額を取得して最新の月次シグナルを判定し、履歴とサイト（docs/）を更新する
//   node scripts/update.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chooseProducts, fetchNav, toMonthly, latestCompleteMonth, prevMonth, evaluate, trades, chartSeries } from './signal.mjs';
import { indexPage, historyPage, strategyPage, fmtMonth } from './render.mjs';

const root = new URL('../', import.meta.url);
const path = p => new URL(p, root);
const readJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(path(p), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
};

const funds = await readJson('funds.json');
// シグナル判定には各資産の投信（isin/assoc）の基準価額を使い、買付対象は総コストが最も低い商品にする
const assets = chooseProducts(funds);

const series = {};
for (const a of assets) {
  series[a.id] = toMonthly(await fetchNav(a));
}

const month = latestCompleteMonth(series);
const sig = evaluate(series, assets, month);
const prev = evaluate(series, assets, prevMonth(month));
const trade = trades(prev, sig);
const charts = Object.fromEntries(assets.map(a => [a.id, chartSeries(series, a.id, month, 36)]));

// 履歴は公開後の分だけを蓄積する（新しい月が先頭）
const history = await readJson('data/history.json', []);
if (!history.some(h => h.month === month)) {
  history.unshift({
    month,
    ranking: sig.ranking.map(r => ({ id: r.id, rs: +r.rs.toFixed(6), signal: r.signal })),
    portfolio: sig.portfolio,
    ...trade,
  });
  history.sort((a, b) => b.month.localeCompare(a.month));
}

await mkdir(path('data/'), { recursive: true });
await mkdir(path('docs/'), { recursive: true });
await writeFile(path('data/history.json'), JSON.stringify(history, null, 2) + '\n');
await writeFile(path('docs/index.html'), indexPage({ sig, prev, trade, charts, assets }));
await writeFile(path('docs/history.html'), historyPage({ history, assets }));
await writeFile(path('docs/strategy.html'), strategyPage({ funds, assets }));

console.log(`${fmtMonth(month)}のシグナル`);
sig.ranking.forEach((r, i) => console.log(`${i + 1}\t${assets.find(a => a.id === r.id).asset}\t${r.signal}`));
console.log('ポートフォリオ:', sig.portfolio.map(p => `${p.id} ${p.weight * 100}%`).join(', '));
