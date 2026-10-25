// レラティブストレングス投資の月次シグナル計算
// ロジックは Qiita「レラティブストレングス投資の月次シグナルを判定する」に準拠:
//   RS = 3・6・12ヶ月リターンの単純平均（大きい順に順位付け）
//   月末の価格 > 12ヶ月移動平均（当月を含む直近12ヶ月の月末値の平均）なら Buy、それ以外は Sell
// 配分: RS上位2資産に50%ずつ。上位2資産のうち Sell のものの枠は現金（Faber 2007/2010 と同じ考え方）

const NAV_URL = 'https://toushin-lib.fwg.ne.jp/FdsWeb/FDST030000/csv-file-download';

export const CASH = 'CASH';
export const TOP_N = 2;

// 年間総コスト（保有1年あたり）= 信託報酬 + 往復売買コスト × 保有1年あたりの売買回数
// 資産ごとに投信とETFを比べ、最も低いものを買付対象にする（etftrendfollow.seesaa.net の方式）
export function chooseProducts(funds) {
  const { tradesPerHoldingYear, etfRoundTrip, fundRoundTrip } = funds.costModel;
  return funds.assets.map(a => {
    const candidates = a.candidates.map(c => ({
      ...c,
      cost: c.fee + (c.type === 'ETF' ? etfRoundTrip : fundRoundTrip) * tradesPerHoldingYear,
    }));
    const product = candidates.reduce((best, c) => (c.cost < best.cost ? c : best));
    return { ...a, candidates, product };
  });
}

// 投信総合検索ライブラリーから設定来の日次基準価額を取得（CSVは Shift_JIS）
export async function fetchNav(fund) {
  const url = `${NAV_URL}?isinCd=${fund.isin}&associFundCd=${fund.assoc}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${fund.asset}: 基準価額の取得に失敗 (HTTP ${res.status})`);
  const text = new TextDecoder('shift_jis').decode(await res.arrayBuffer());
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, nav, , dist] = line.split(',');
    const m = date.match(/(\d{4})年(\d{2})月(\d{2})日/);
    if (!m || !(+nav > 0)) continue;
    rows.push({ date: `${m[1]}-${m[2]}-${m[3]}`, nav: +nav, dist: +dist || 0 });
  }
  if (rows.length === 0) throw new Error(`${fund.asset}: 基準価額データが空です`);
  return rows;
}

// 分配金を再投資した日次の指数を作り、各月の最終営業日の値を取り出す
export function toMonthly(rows) {
  const monthly = new Map();
  let idx = rows[0].nav;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) idx *= (rows[i].nav + rows[i].dist) / rows[i - 1].nav;
    monthly.set(rows[i].date.slice(0, 7), idx);
  }
  // 最後の月はまだ月末を迎えていない可能性があるので除外する
  const months = [...monthly.keys()].slice(0, -1);
  return { months, values: months.map(m => monthly.get(m)) };
}

// 全資産で月末値が確定している最新の月
export function latestCompleteMonth(series) {
  return Object.values(series).map(s => s.months.at(-1)).sort()[0];
}

export function prevMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

// 指定月のシグナル。ranking は RS の強い順
export function evaluate(series, assets, month) {
  const ranking = assets.map(a => {
    const { months, values } = series[a.id];
    const i = months.indexOf(month);
    if (i < 12) throw new Error(`${a.asset}: ${month} の判定に必要な12ヶ月分のデータがありません`);
    const ret = n => values[i] / values[i - n] - 1;
    const ma = values.slice(i - 11, i + 1).reduce((s, v) => s + v, 0) / 12;
    return {
      id: a.id,
      rs: (ret(3) + ret(6) + ret(12)) / 3,
      price: values[i],
      ma,
      signal: values[i] > ma ? 'Buy' : 'Sell',
    };
  }).sort((a, b) => b.rs - a.rs);

  const weight = 1 / TOP_N;
  const portfolio = [];
  for (const r of ranking.slice(0, TOP_N)) {
    const id = r.signal === 'Buy' ? r.id : CASH;
    const held = portfolio.find(p => p.id === id);
    if (held) held.weight += weight;
    else portfolio.push({ id, weight });
  }
  return { month, ranking, portfolio };
}

// 前月のポートフォリオとの差分（現金は売買の対象に含めない）
export function trades(prev, curr) {
  const ids = p => p.portfolio.map(x => x.id).filter(id => id !== CASH);
  const before = ids(prev);
  const after = ids(curr);
  return {
    sells: before.filter(id => !after.includes(id)),
    buys: after.filter(id => !before.includes(id)),
  };
}

// 過去の各月末の価格と12ヶ月移動平均（チャート用）
export function chartSeries(series, id, month, length) {
  const { months, values } = series[id];
  const end = months.indexOf(month);
  const points = [];
  for (let i = Math.max(11, end - length + 1); i <= end; i++) {
    const ma = values.slice(i - 11, i + 1).reduce((s, v) => s + v, 0) / 12;
    points.push({ month: months[i], price: values[i], ma });
  }
  return points;
}
