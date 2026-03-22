/**
 * Единый шаблон чек-листа (4 блока, теги без LONG/SHORT).
 * Подключается в index.html до app.js и на сервере через require (см. server.js).
 */
const CHECKLIST_TEMPLATE_BLOCKS = [
  {
    order: 1,
    title: 'Контекст рынка (The Map)',
    goal: 'Понять, в какой «игре» мы сейчас находимся.',
    blockHintHtml: `<div class="mapContextHint">
  <p class="mapContextHintLead">🗺 Контекст рынка (The Map)</p>
  <p class="mapContextHintMeta">Таймфрейм: <span class="workflowTf">H1</span> (1 час) — основной; <span class="workflowTf">M15</span> (15 минут) — уточняющий.</p>

  <section class="mapContextStage mapContextStage--trend">
    <h4 class="mapContextStageTitle">LONG / SHORT TREND (Тренд)</h4>
    <dl class="mapContextDl">
      <dt>Сколько свечей</dt>
      <dd>Последние 24–48 свечей на H1 (т.е. последние 1–2 суток).</dd>
      <dt>Индикация</dt>
      <dd>Визуальная «лесенка». Для лонга — каждый следующий значимый минимум (лоу) выше предыдущего. Для шорта — каждый хай ниже предыдущего.</dd>
      <dt>Правило</dt>
      <dd>Торгуем только «Захват» ликвидности по направлению этой лесенки.</dd>
    </dl>
  </section>

  <section class="mapContextStage mapContextStage--range">
    <h4 class="mapContextStageTitle">RANGE (Боковик)</h4>
    <dl class="mapContextDl">
      <dt>Сколько свечей</dt>
      <dd>От 12 до 24 свечей на H1.</dd>
      <dt>Индикация</dt>
      <dd>Цена зажата в «коридоре», границы которого тестировались минимум по 2 раза сверху и снизу.</dd>
      <dt>Правило</dt>
      <dd>Торгуем «Отскок» от обеих границ внутрь канала.</dd>
    </dl>
  </section>

  <section class="mapContextStage mapContextStage--breakout">
    <h4 class="mapContextStageTitle">BREAKOUT (Поджатие)</h4>
    <dl class="mapContextDl">
      <dt>Таймфрейм</dt>
      <dd>Переходим на <span class="workflowTf">M15</span>.</dd>
      <dt>Сколько свечей</dt>
      <dd>Последние 10–15 свечей.</dd>
      <dt>Индикация</dt>
      <dd>Цена «прилипла» к уровню (границе боковика или тренда) и не откатывает. Свечи становятся мелкими, а лои/хаи поджимаются к линии пробоя.</dd>
      <dt>Правило</dt>
      <dd>Заходим на импульс в сторону пробоя, не ждём отскока.</dd>
    </dl>
  </section>
</div>`,
    groups: [
      {
        id: 'map-structure',
        label: 'Теги структуры',
        tags: [
          {
            id: 'map-structure-long',
            label: 'Long Trend',
            hintImage: '/images/map-long.png',
          },
          {
            id: 'map-structure-short',
            label: 'Short Trend',
            hintImage: '/images/map-short.png',
          },
          {
            id: 'map-structure-range',
            label: 'Range (боковик)',
            hintImage: '/images/map-range.png',
          },
          {
            id: 'map-structure-breakout',
            label: 'Breakout (поджатие)',
            hintImage: '/images/map-breakout.png',
          },
        ],
      },
    ],
  },
  {
    order: 2,
    title: 'Ликвидность (The Fuel)',
    goal: 'Найти магнит для цены и понять силу зоны.',
    groups: [
      {
        id: 'liq-place',
        label: 'Расположение',
        tags: [
          {
            id: 'liq-place-top',
            label: 'Liquidation Top',
            hintImage: '/images/liq-top.png',
          },
          {
            id: 'liq-place-bottom',
            label: 'Liquidation Bottom',
            hintImage: '/images/liq-bottom.png',
          },
          {
            id: 'liq-place-both',
            label: 'Both Sides (с двух сторон)',
            hintImage: '/images/liq-both.png',
          },
        ],
      },
      {
        id: 'liq-density',
        label: 'Плотность зоны (CoinGlass 5m)',
        groupHint:
          'Плотность на теплокарте считается значимой, если суммарный объём в зоне больше 100k (100 000+). Ниже этого порога зону как «плотность» не используем.',
        tags: [
          {
            id: 'liq-density-heavy',
            label: 'Heavy (яркая/жирная)',
            hintImage: '/images/liq-heavy.png',
          },
          {
            id: 'liq-density-thin',
            label: 'Thin (размытая)',
            hintImage: '/images/liq-thin.png',
          },
          {
            id: 'liq-density-fresh',
            label: 'Fresh (свежая)',
            hintImage: '/images/liq-fresh.png',
          },
        ],
      },
    ],
  },
  {
    order: 3,
    title: 'Энергия движения (The Engine)',
    goal: 'Понять, заходят деньги в рынок или выходят.',
    groups: [
      {
        id: 'eng-oi',
        label: 'Открытый интерес (OI)',
        groupHint: 'Таймфрейм: 5m (смотрим последние 6–10 свечей / 30–50 мин).',
        tags: [
          {
            id: 'eng-oi-rise',
            label: 'OI Rising (набор позиций)',
            hint:
              'В рынок заходят новые деньги, открываются новые контракты (и лонги, и шорты). В скальпинге: тренд подтверждён; если цена идёт к зоне на росте OI — зону, скорее всего, прошьют. Не стой против танка.',
          },
          {
            id: 'eng-oi-fall',
            label: 'OI Falling (закрытие позиций)',
            hint:
              'Трейдеры закрывают позиции (выходят в кэш или по стопам), топливо кончается. В скальпинге: если цена влетает в зону и OI падает — это «вытряхивание»; хорошо для отскока.',
          },
          {
            id: 'eng-oi-flat',
            label: 'OI Flat (застой)',
            hint:
              'Затишье: новых игроков нет, старые массово не выходят. В скальпинге: боковик, цена вяло липнет к уровням — ищи микродвижения, не жди сильных импульсов.',
          },
        ],
      },
      {
        id: 'eng-fund',
        label: 'Фандинг (Funding)',
        groupHint:
          'Таймфрейм: 5m (смотрим последние 3–5 свечей / 15–25 мин).\n\nPositive 🔴 > +0,16%\nNeutral ⚪ −0,15% — +0,15%\nNegative ❇️ < −0,15%',
        tags: [
          {
            id: 'eng-fund-pos',
            label: 'Positive (перегруз лонгов)',
            hint:
              'Лонгисты платят шортистам — перекос в сторону покупок. В скальпинге: опасно для лонга; при сильном положительном фандинге маркетмейкеру выгодно «сходить вниз», чтобы побрить перегруженную толпу лонгов.',
          },
          {
            id: 'eng-fund-neg',
            label: 'Negative (перегруз шортов)',
            hint:
              'Шортисты платят лонгистам — перекос в сторону продаж. В скальпинге: топливо для движения вверх; при сильном минусовом фандинге любой задёрг цены вверх может вызвать каскад закрытий шортов.',
          },
          {
            id: 'eng-fund-neu',
            label: 'Neutral',
            hint:
              'Фандинг около нуля — нет выраженного перекоса лонгов или шортов по выплатам. Сам по себе слабый сигнал; опирайся на OI, зону ликвидности и ленту.',
          },
        ],
      },
    ],
  },
  {
    order: 4,
    title: 'Стакан и лента (The Trigger)',
    goal: 'Найти точку опоры в Tiger.Trade.',
    groups: [
      {
        id: 'trig-l2',
        label: 'Плотность (Level 2)',
        tags: [
          {
            id: 'trig-l2-wall',
            label: 'Real Wall (долгая)',
            hint:
              'Крупная лимитная заявка стоит долго и почти не двигается при подходе цены. Действия: опора — ставь лимитки чуть перед стеной; это щит, об который цена должна удариться и отскочить.',
          },
          {
            id: 'trig-l2-spoof',
            label: 'Spoofing (мелькает)',
            hint:
              'Огромная заявка появляется и исчезает или убегает от цены. Действия: обман — MM пугает толпу, чтобы загнать в нужную сторону; на эту «стену» не рассчитывай, уберут в момент касания.',
          },
          {
            id: 'trig-l2-nowalls',
            label: 'No Walls',
            hint:
              'Стакан дырявый, крупных лимиток нет. Действия: полёт на ленте — цена рывками; опирайся на кластеры и ленту, не на глубину стакана.',
          },
        ],
      },
      {
        id: 'trig-tape',
        label: 'Лента (Tape)',
        tags: [
          {
            id: 'trig-tape-agg',
            label: 'Aggressive (сквиз)',
            hint:
              'В Tiger Trade: лента летит, крупные рыночные принты подряд. Психология: сильный импульс — кто-то срочно покупает или продаёт. Лимитки на отскок в такой фазе — повышенный риск.',
          },
          {
            id: 'trig-tape-exh',
            label: 'Exhaustion (затухание)',
            hint:
              'В Tiger Trade: лента редеет, вместо «пулемёта» — редкие сделки. Психология: истощение стороны. Если это у зоны ликвидаций — сильный сигнал на разворот.',
          },
          {
            id: 'trig-tape-ice',
            label: 'Iceberg (скрытый объём)',
            hint:
              'В Tiger Trade: лента активна (например продажи), а цена не уходит ни на тик. Психология: скрытый крупный лимит. Входи в сторону этого игрока, когда лента начнёт затухать.',
          },
        ],
      },
      {
        id: 'trig-clust',
        label: 'Кластеры',
        tags: [
          {
            id: 'trig-clust-buy',
            label: 'Buy Imbalance',
            hint:
              'Покупатели бьют по рынку (Market Buy) гораздо сильнее, чем продавцы по лимиткам — агрессия вверх. В Tiger Trade: ярко-зелёные цифры в кластере (превышение покупок над продажами, например, на 300%).',
          },
          {
            id: 'trig-clust-sell',
            label: 'Sell Imbalance',
            hint:
              'Продавцы агрессивно сливают по рынку (Market Sell) — агрессия вниз. В Tiger Trade: ярко-красные цифры в кластере.',
          },
          {
            id: 'trig-clust-abs',
            label: 'Absorption (поглощение)',
            hint:
              'Рыночные ордера бьют в одну точку, но там стоит огромная лимитная заявка, которая «съедает» весь объём, и цена не идёт дальше. В Tiger Trade: огромный серый или цветной квадрат (Volume) на хвосте свечи, при этом цена разворачивается.',
          },
        ],
      },
    ],
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHECKLIST_TEMPLATE_BLOCKS };
}
if (typeof globalThis !== 'undefined') {
  globalThis.CHECKLIST_TEMPLATE_BLOCKS = CHECKLIST_TEMPLATE_BLOCKS;
}
