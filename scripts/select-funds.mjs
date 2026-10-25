// 対象ファンドの見直し用（年1回程度）。各資産クラスで投信とETFの候補を年間総コストの安い順に表示する
//   node scripts/select-funds.mjs
// 結果を見て funds.json の candidates を手で更新する（信託報酬は税込で記入。ETFの証券コードは別途確認）
import { readFile } from 'node:fs/promises';

const SEARCH_URL = 'https://toushin-lib.fwg.ne.jp/FdsWeb/FDST999900/fundDataSearch';
const MIN_ASSETS_OKU = 100; // 純資産（億円）
const MIN_AGE_DAYS = 365;

const classes = {
  日本株: /TOPIX|国内株式/,
  先進国株: /先進国株式|外国株式|海外株式|KOKUSAI|コクサイ/,
  新興国株: /新興国株式|エマージング/,
  日本債券: /国内債券|日本債券|日本国債/,
  先進国債券: /先進国債券|外国債券|海外債券/,
  新興国債券: /新興国債券/,
  日本リート: /Jリート|J-REIT|国内リート|日本リート|東証REIT/i,
  先進国リート: /先進国リート|外国REIT|グローバルREIT|グローバルリート/i,
};
// 一般の個人が買えない・指数が偏っている・為替ヘッジありのものを除く
const exclude = /ラップ|SMA|DC|年金|一任|FW|ヘッジあり|除く米国|Ex-|Core|コア30|高利回り|高配当|グリーン|ロジスティクス|オフィス|レジデンシャル|ホテル|毎月|女性|気候|業種|TOPIX-17|ブル|ベア|レバ|インバース/;

const { costModel } = JSON.parse(await readFile(new URL('../funds.json', import.meta.url), 'utf8'));
const toHalf = s => (s || '')
  .replace(/[Ａ-Ｚａ-ｚ０-９－（）＆]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  .replace(/　/g, ' ');

const res = await fetch(SEARCH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ startNo: 0, draw: 1, searchBtnClickFlg: true, pageSize: '10000' }),
});
const cutoff = new Date(Date.now() - MIN_AGE_DAYS * 864e5).toISOString().slice(0, 10);
const list = (await res.json()).searchResultInfo.resultInfoMapList
  .map(r => {
    const etf = r.isinCd.startsWith('JP3');
    const fee = +r.trustReward * 1.1;
    const cost = fee + (etf ? costModel.etfRoundTrip : costModel.fundRoundTrip) * costModel.tradesPerHoldingYear;
    return { ...r, etf, name: toHalf(r.fundNm), aum: (+r.totalNetAssets || 0) / 100, fee, cost };
  })
  .filter(r => !exclude.test(r.name) && r.dcFundFlg !== '1')
  .filter(r => r.aum >= MIN_ASSETS_OKU && r.establishedDate.slice(0, 10) <= cutoff)
  .filter(r => r.etf || /インデックス|TOPIX/.test(r.name));

for (const [asset, pattern] of Object.entries(classes)) {
  console.log(`\n== ${asset}`);
  for (const etf of [false, true]) {
    list
      .filter(r => r.etf === etf && pattern.test(r.name))
      .sort((a, b) => a.cost - b.cost || b.aum - a.aum)
      .slice(0, 3)
      .forEach(r => console.log(`${etf ? 'ETF ' : '投信'}  総コスト${r.cost.toFixed(3)}%  信託報酬${r.fee.toFixed(4)}%  ${Math.round(r.aum)}億円  ${r.isinCd}  ${r.associFundCd}  ${r.name}`));
  }
}
