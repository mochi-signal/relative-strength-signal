// 静的サイト（docs/）のHTMLを組み立てる
import { CASH, TOP_N } from './signal.mjs';

const SITE = 'レラティブストレングス・シグナル';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const fmtMonth = m => `${m.slice(0, 4)}年${+m.slice(5, 7)}月末`;
const pct = (v, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(d)}%`;
const joinJa = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join('、')}と${xs.at(-1)}`);

export function makeText(assets) {
  const byId = Object.fromEntries(assets.map(a => [a.id, a]));
  const name = id => (id === CASH ? '現金' : byId[id].asset);
  const product = id => {
    const p = byId[id].product;
    return p.type === 'ETF' ? `${p.name}（ETF・${p.code}）` : p.name;
  };

  const allocation = sig => sig.portfolio.map(p => `${name(p.id)}に${Math.round(p.weight * 100)}%`).join('、');

  function portfolio(sig) {
    const held = sig.portfolio.filter(p => p.id !== CASH).map(p => name(p.id));
    if (held.length === 0) {
      return `今回は、レラティブストレングス上位${TOP_N}位の資産がいずれも「Sell」のため、すべて現金で保有します。`;
    }
    if (sig.portfolio.some(p => p.id === CASH)) {
      return `今回は、レラティブストレングス上位${TOP_N}位のうち「Buy」は${joinJa(held)}だけのため、${allocation(sig)}配分するポートフォリオを構築します。`;
    }
    return `レラティブストレングス投資では、移動平均シグナルが「Buy」で、かつレラティブストレングス上位${TOP_N}位の資産、つまり${allocation(sig)}配分するポートフォリオを構築します。`;
  }

  function trade({ sells, buys }) {
    const s = joinJa(sells.map(name));
    const b = joinJa(buys.map(name));
    if (!sells.length && !buys.length) return '今回は、トレードは発生しませんでした。前月と同じポートフォリオを継続します。';
    if (sells.length && buys.length) return `今回は、${s}を売り、${b}を買うトレードが発生しました。`;
    if (sells.length) return `今回は、${s}を売るトレードが発生しました。売却した資金は現金で保有します。`;
    return `今回は、${b}を買うトレードが発生しました。買付には現金を充てます。`;
  }

  return { byId, name, product, allocation, portfolio, trade };
}

function layout(page, title, body) {
  const nav = [['index.html', 'シグナル'], ['history.html', '履歴'], ['strategy.html', '戦略の解説']]
    .map(([href, label]) => `<a href="${href}"${href === page ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="site">
<a class="brand" href="index.html">${SITE}</a>
<nav>${nav}</nav>
</header>
<main>
${body}
</main>
<footer>
<p><strong>免責事項</strong></p>
<p>本サイトは情報提供のみを目的としており、特定の金融商品の売買を勧めるものではなく、投資助言ではありません。掲載している情報は正確性・完全性を保証するものではありません。過去の成績は将来の成果を保証しません。投資は自己責任でお願いします。</p>
</footer>
</body>
</html>
`;
}

function signalTable(sig, text, { withFund = true, compact = false } = {}) {
  const rows = sig.ranking.map((r, i) => `<tr>
<td class="num">${i + 1}</td>
<td>${esc(text.name(r.id))}${withFund ? `<span class="sub">${esc(text.product(r.id))}</span>` : ''}</td>
<td class="sig ${r.signal.toLowerCase()}">${r.signal}</td>
${compact ? '' : `<td class="num hide-sm">${pct(r.rs)}</td>
<td class="num hide-sm">${pct(r.price / r.ma - 1)}</td>`}
</tr>`).join('\n');
  return `<table class="signals">
<thead><tr><th class="num">順位</th><th>資産</th><th>シグナル</th>${compact ? '' : '<th class="num hide-sm">RS</th><th class="num hide-sm">移動平均比</th>'}</tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

function chart(points) {
  const W = 320, H = 120, PX = 4, PY = 8;
  const vals = points.flatMap(p => [p.price, p.ma]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const x = i => PX + (i * (W - PX * 2)) / (points.length - 1);
  const y = v => PY + ((hi - v) * (H - PY * 2)) / (hi - lo || 1);
  const line = key => points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="価格と12ヶ月移動平均">
<polyline class="ma" points="${line('ma')}"/>
<polyline class="price" points="${line('price')}"/>
</svg>
<div class="axis"><span>${points[0].month.replace('-', '/')}</span><span>${points.at(-1).month.replace('-', '/')}</span></div>`;
}

export function indexPage({ sig, prev, trade, charts, assets }) {
  const text = makeText(assets);
  const holdings = sig.portfolio.map(p => {
    const fund = p.id === CASH ? '' : `<span class="sub">${esc(text.product(p.id))}（信託報酬 年${text.byId[p.id].product.fee}%）</span>`;
    return `<li><span class="w">${Math.round(p.weight * 100)}%</span><span>${esc(text.name(p.id))}${fund}</span></li>`;
  }).join('\n');
  const prevList = prev.portfolio.map(p => `${text.name(p.id)} ${Math.round(p.weight * 100)}%`).join('、');
  const charts8 = sig.ranking.map(r => `<figure>
<figcaption><span>${esc(text.name(r.id))}</span><span class="sig ${r.signal.toLowerCase()}">${r.signal}</span></figcaption>
${chart(charts[r.id])}
</figure>`).join('\n');

  const body = `<h1>${fmtMonth(sig.month)}のシグナル</h1>
<p>${fmtMonth(sig.month)}のシグナルは以下の通りとなりました。</p>
${signalTable(sig, text)}
<p class="note">順位はレラティブストレングス（過去3・6・12ヶ月リターンの平均、表のRS）が強い順を示しています。前月末の価格が12ヶ月移動平均を上回っているものが「Buy」、下回っているものが「Sell」と表示されています。</p>

<h2>ポートフォリオ</h2>
<p>このシグナルの意味を解説します。${text.portfolio(sig)}</p>
<ul class="holdings">
${holdings}
</ul>

<h2>今回のトレード</h2>
<p>${text.trade(trade)}</p>
<p class="note">前月（${fmtMonth(prev.month)}）のポートフォリオ: ${esc(prevList)}</p>

<h2>価格と12ヶ月移動平均</h2>
<p class="legend"><span class="key price"></span>価格（分配金込み）<span class="key ma"></span>12ヶ月移動平均</p>
<div class="charts">
${charts8}
</div>`;
  return layout('index.html', `${fmtMonth(sig.month)}のシグナル | ${SITE}`, body);
}

export function historyPage({ history, assets }) {
  const text = makeText(assets);
  const items = history.map(h => `<section class="month">
<h2>${fmtMonth(h.month)}</h2>
<p><span class="label">ポートフォリオ</span>${esc(text.allocation(h))}</p>
<p><span class="label">トレード</span>${esc(text.trade(h))}</p>
<details>
<summary>シグナル一覧</summary>
${signalTable(h, text, { withFund: false, compact: true })}
</details>
</section>`).join('\n');
  const body = `<h1>過去のシグナル</h1>
<p class="note">サイト公開後のシグナルを毎月記録しています。</p>
${items}`;
  return layout('history.html', `過去のシグナル | ${SITE}`, body);
}

export function strategyPage({ funds, assets }) {
  const { costModel } = funds;
  const rows = assets.map(a => a.candidates.map((c, i) => `<tr${i === 0 ? ' class="group"' : ''}>
${i === 0 ? `<td rowspan="${a.candidates.length}">${esc(a.asset)}</td>` : ''}
<td>${c === a.product ? '<strong>採用</strong> ' : ''}${esc(c.name)}<span class="sub">${c.type}${c.code ? `・${c.code}` : ''}</span></td>
<td class="num">${c.fee}%</td>
<td class="num">${c.cost.toFixed(3)}%</td>
</tr>`).join('\n')).join('\n');
  const body = `<h1>戦略の解説</h1>

<h2>レラティブストレングス投資とは</h2>
<p>レラティブストレングス（相対的な強さ）投資は、複数の資産のうち、最近の値動きが強い資産に資金を移していく戦略です。強い資産はしばらく強い状態が続きやすいという「モメンタム」の性質を利用します。さらに、価格が長期の移動平均を下回った資産は持たないことで、大きな下落相場を避けることを狙います。</p>

<h2>ルール</h2>
<ol>
<li>毎月末に、8つの資産それぞれの過去3ヶ月・6ヶ月・12ヶ月のリターンを計算し、その平均（レラティブストレングス）が大きい順に順位を付けます。</li>
<li>月末の価格が、直近12ヶ月の月末価格の平均（12ヶ月移動平均）を上回っていれば「Buy」、そうでなければ「Sell」とします。</li>
<li>レラティブストレングス上位${TOP_N}位の資産に50%ずつ配分します。</li>
<li>上位${TOP_N}位の中に「Sell」の資産がある場合、その50%は現金で保有します。</li>
<li>翌月初に、新しいポートフォリオに合わせて売買（リバランス）します。</li>
</ol>

<h2>対象ファンド</h2>
<p>資産ごとに、投資信託とETFのうち年間総コストが最も低いものを採用しています。年間総コストは「信託報酬 ＋ 往復売買コスト × ${costModel.tradesPerHoldingYear}回」で計算しています。</p>
<table class="funds">
<thead><tr><th>資産</th><th>候補</th><th class="num">信託報酬<br>（税込）</th><th class="num">年間<br>総コスト</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<ul class="note">
<li>${esc(costModel.tradesNote)}</li>
<li>${esc(costModel.etfNote)}</li>
<li>${esc(costModel.fundNote)}</li>
<li>選定基準: ${esc(funds.criteria)}（${esc(funds.reviewed.replaceAll('-', '/'))} 時点。年1回程度見直します）</li>
<li>シグナルの判定には、どの資産も投資信託の基準価額（分配金込み）を使っています。</li>
</ul>

<h2>データ</h2>
<p>基準価額は一般社団法人投資信託協会の<a href="https://toushin-lib.fwg.ne.jp/">投信総合検索ライブラリー</a>から取得しています。分配金は再投資したものとして計算しています。毎月初、すべてのファンドの月末基準価額が確定した後に自動で更新します。</p>

<h2>参考</h2>
<ul>
<li><a href="https://qiita.com/hiroshi_ichihara/items/caaff4ddf09c2784473c">レラティブストレングス投資の月次シグナル判定（Qiita）</a> — シグナルの計算方法はこの記事に準拠しています。</li>
<li>Mebane T. Faber, <a href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461">A Quantitative Approach to Tactical Asset Allocation</a>（SSRN）</li>
<li>Mebane T. Faber, <a href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1585517">Relative Strength Strategies for Investing</a>（SSRN）</li>
</ul>`;
  return layout('strategy.html', `戦略の解説 | ${SITE}`, body);
}
