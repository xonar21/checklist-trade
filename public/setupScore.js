/**
 * Deep Intelligence V4: валидация и глубокий анализ сетапа по выбранным id тегов.
 * @param {string[]} selectedIds
 */
function buildStopStrategy(has) {
  const parts = [];
  if (has('trig-l2-wall')) parts.push('Стоп за плотность + 0.1% запаса');
  if (has('trig-tape-ice')) parts.push('Стоп за айсберг-заявку');
  if (has('map-structure-range')) parts.push('Стоп за локальный экстремум манипуляции');
  return parts.length ? parts.join(' ') : 'За структурой сценария (уточните по графику).';
}

function inferVolumeQuality(has) {
  if (has('eng-oi-rise') && has('trig-tape-agg')) return 'High Conviction';
  if (has('eng-oi-fall') && has('trig-tape-agg')) return 'Weakness';
  return null;
}

function finalizeDeep(partial, has) {
  return {
    ...partial,
    stopStrategy: buildStopStrategy(has),
    volumeQuality: inferVolumeQuality(has),
  };
}

function scoreTradingSetup(selectedIds) {
  const set = new Set(
    (selectedIds || []).filter((id) => typeof id === 'string' && id.length)
  );
  const has = (id) => set.has(id);

  const deep = (riskTier, invalidationPoint, orderType, archetype = null) => ({
    riskTier,
    invalidationPoint,
    orderType,
    archetype,
  });

  // --- Этап 1: Red Flags (классические) ---
  if (has('map-structure-long') && has('liq-place-top') && has('eng-oi-rise')) {
    return {
      status: 'danger',
      score: 0,
      actionType: 'None',
      message:
        'Вход запрещён. Тренд восходящий, ликвидность сверху — магнит, OI растёт. Высокая вероятность импульсного пробоя вверх. Шортить отскок нельзя.',
      deepAnalysis: finalizeDeep(
        deep(
          'High',
          'Сценарий входа отменён: дождитесь смены контекста или подтверждения старшего ТФ.',
          '—',
          null
        ),
        has
      ),
    };
  }

  if (has('map-structure-short') && has('liq-place-bottom') && has('eng-oi-rise')) {
    return {
      status: 'danger',
      score: 0,
      actionType: 'None',
      message:
        'Вход запрещён. Тренд нисходящий, ликвидации снизу притянут цену, OI растёт. Высокая вероятность сквиза вниз. Лонговать отскок нельзя.',
      deepAnalysis: finalizeDeep(
        deep(
          'High',
          'Сценарий входа отменён: не усредняйтесь против импульса и магнита ликвидности.',
          '—',
          null
        ),
        has
      ),
    };
  }

  if (has('trig-l2-spoof') && has('trig-tape-agg')) {
    return {
      status: 'danger',
      score: 0,
      actionType: 'None',
      message:
        'Вход запрещён. Spoofing в стакане + агрессивная лента — стену снесут или разъедят.',
      deepAnalysis: finalizeDeep(
        deep(
          'High',
          'Любое усиление агрессии при «мигании» лимитов — немедленный выход из идеи входа.',
          '—',
          null
        ),
        has
      ),
    };
  }

  // --- V4: Агрессивная абсорбция (Bullish Absorption) ---
  if (
    has('map-structure-long') &&
    has('liq-place-bottom') &&
    has('eng-oi-rise') &&
    has('trig-clust-buy')
  ) {
    const score = 85;
    return {
      status: 'success',
      score,
      actionType: 'Long Bounce',
      message:
        'Внимание: агрессивное поглощение! Шортисты пытаются продавить уровень, но крупный игрок выкупает всё предложение. Идеально для входа в лонг от нижней границы.',
      details: {
        baseScore: score,
        modifiers: [{ label: 'V4: Bullish Absorption', delta: score - 50 }],
        notes: [
          'Цена у нижней зоны, OI↑ при buy imbalance — лимитный покупатель поглощает рыночные продажи.',
        ],
      },
      deepAnalysis: finalizeDeep(
        deep(
          'Low',
          'Инвалидация: новый импульс вниз с объёмом без подтверждения buy-имбаланса в кластерах.',
          'Limit Grid',
          'BullishAbsorption'
        ),
        has
      ),
    };
  }

  // --- V4: Кульминация продаж (Selling Climax) ---
  if (has('liq-place-bottom') && has('trig-tape-agg') && has('eng-oi-fall')) {
    const score = 75;
    return {
      status: 'success',
      score,
      actionType: 'Selling Climax',
      message:
        'Кульминация продаж. Лента летит на стоп-ордерах, новых продавцов нет. Ожидайте резкий отскок.',
      details: {
        baseScore: score,
        modifiers: [{ label: 'V4: Selling Climax', delta: score - 50 }],
        notes: [
          'Сквиз к нижней зоне + агрессивная лента при падении OI — топливо для падения исчерпано.',
        ],
      },
      deepAnalysis: finalizeDeep(
        deep(
          'Medium',
          'Инвалидация: продолжение импульса вниз с набором OI и без отскока ленты.',
          'Limit Grid',
          'SellingClimax'
        ),
        has
      ),
    };
  }

  // --- Супер-сетапы (90–100%) ---
  const superConcrete =
    has('liq-density-heavy') &&
    has('trig-l2-wall') &&
    has('trig-tape-exh') &&
    has('trig-clust-abs');

  if (superConcrete) {
    const score = 96;
    return {
      status: 'success',
      score,
      actionType: 'Бетонная стена',
      message: `Архетип «Бетонная стена»: жирная зона + реальная плотность + затухание ленты + поглощение в кластерах. Уверенность ${score}%.`,
      details: {
        baseScore: score,
        modifiers: [{ label: 'Супер-сетап: Бетонная стена', delta: score - 50 }],
        notes: ['Комбинаторный архетип: стена, которую трудно пробить с первого захода.'],
      },
      deepAnalysis: finalizeDeep(
        deep(
          'Low',
          'Если лента снова станет агрессивной (сквиз) и OI начнёт расти при подходе к плотности — немедленный выход.',
          'Limit Grid',
          'ConcreteWall'
        ),
        has
      ),
    };
  }

  const superVacuum =
    has('map-structure-breakout') &&
    (has('liq-place-top') || has('liq-place-bottom')) &&
    has('eng-oi-rise') &&
    has('trig-tape-agg');

  if (superVacuum) {
    const score = 94;
    return {
      status: 'success',
      score,
      actionType: 'Вакуумный сквиз',
      message: `Архетип «Вакуумный сквиз»: поджатие + магнит ликвидности + рост OI + агрессивная лента. Уверенность ${score}%.`,
      details: {
        baseScore: score,
        modifiers: [{ label: 'Супер-сетап: Вакуумный сквиз', delta: score - 50 }],
        notes: ['Цена «засасывается» в зону ликвидаций.'],
      },
      deepAnalysis: finalizeDeep(
        deep(
          'Medium',
          'Если цена вернулась под/над зону без нового набора OI и лента «затухла» — пробой сомнителен, сокращайте риск.',
          'Market/Stop',
          'VacuumSqueeze'
        ),
        has
      ),
    };
  }

  const sfpTriple = has('map-structure-range') && has('trig-tape-agg') && has('trig-clust-abs');

  // --- Golden Setups (база 50) ---
  /** @type {{ name: string, actionType: string, kind: 'bounce'|'breakout', dir: 'long'|'short'|'neutral' } | null} */
  let golden = null;

  if (has('map-structure-long') && has('liq-place-bottom') && has('eng-oi-fall')) {
    golden = {
      name: 'Trend Continuation LONG',
      actionType: 'Long Bounce',
      kind: 'bounce',
      dir: 'long',
    };
  } else if (has('map-structure-short') && has('liq-place-top') && has('eng-oi-fall')) {
    golden = {
      name: 'Trend Continuation SHORT',
      actionType: 'Short Bounce',
      kind: 'bounce',
      dir: 'short',
    };
  } else if (
    has('map-structure-range') &&
    has('eng-oi-fall') &&
    (has('liq-place-top') || has('liq-place-bottom') || has('liq-place-both'))
  ) {
    let dir = 'neutral';
    if (has('liq-place-top')) dir = 'short';
    else if (has('liq-place-bottom')) dir = 'long';
    golden = {
      name: 'Range Bounce',
      actionType: 'Range Bounce',
      kind: 'bounce',
      dir,
    };
  } else if (
    has('map-structure-breakout') &&
    has('eng-oi-rise') &&
    (has('liq-place-top') || has('liq-place-bottom'))
  ) {
    const dir = has('liq-place-top') ? 'long' : 'short';
    golden = {
      name: 'Breakout',
      actionType: 'Breakout',
      kind: 'breakout',
      dir,
    };
  }

  // SFP / Stop Hunt — отдельный допустимый сценарий без полного Golden
  if (!golden && sfpTriple) {
    golden = {
      name: 'SFP / Stop Hunt',
      actionType: 'Reversal (разворот)',
      kind: 'bounce',
      dir: 'neutral',
    };
  }

  if (!golden) {
    let deductionScore = 0;
    /** @type {{ label: string, delta: number }[]} */
    const dedMods = [];
    /** @type {string[]} */
    const dedNotes = [];

    if (has('eng-fund-neg') && has('liq-place-bottom')) {
      deductionScore += 20;
      dedMods.push({ label: 'Дедукция: фандинг для лонга (нижняя зона)', delta: 20 });
      dedNotes.push('Отрицательный фандинг у нижней зоны: шортисты в ловушке, им больно идти ниже.');
    }
    if (has('liq-place-bottom') && has('trig-clust-buy')) {
      deductionScore += 30;
      dedMods.push({ label: 'Дедукция: buy imbalance у нижней зоны', delta: 30 });
      dedNotes.push('Buy imbalance в зоне ликвидаций снизу — сигнал к отскоку.');
    }
    if (has('liq-place-top') && has('trig-clust-sell')) {
      deductionScore += 30;
      dedMods.push({ label: 'Дедукция: sell imbalance у верхней зоны', delta: 30 });
      dedNotes.push('Sell imbalance в зоне ликвидаций сверху — сигнал к отскоку вниз.');
    }

    if (deductionScore > 0) {
      const cappedDed = Math.min(100, deductionScore);
      return {
        status: 'success',
        score: cappedDed,
        actionType: 'Partial (дедукция)',
        message:
          'Базовый сценарий не собран полностью; оценка по частичным признакам (фандинг и кластеры в зоне ликвидности). ' +
          dedNotes.join(' '),
        details: { baseScore: 0, modifiers: dedMods, notes: dedNotes },
        deepAnalysis: finalizeDeep(
          deep(
            'Medium',
            'Уточните теги по Map / Engine; дедукция — ориентир, не полный сетап.',
            'Limit Grid',
            'Deduction'
          ),
          has
        ),
      };
    }

    return {
      status: 'warning',
      score: 0,
      actionType: 'None',
      message:
        'Неоднозначный контекст: не собран базовый сценарий (Trend / Range / Breakout / SFP) и нет дедуктивных признаков. Добавьте теги или дождитесь ясности.',
      details: { baseScore: 0, modifiers: [] },
      deepAnalysis: finalizeDeep(
        deep(
          'Medium',
          'Пока нет полной картины — не форсируйте вход; дождитесь подтверждения по Map + Liq + Engine.',
          '—',
          null
        ),
        has
      ),
    };
  }

  let score = 50;
  /** @type {{ label: string, delta: number }[]} */
  const modifiers = [];
  /** @type {string[]} */
  const notes = [];

  if (has('trig-tape-agg') && has('trig-tape-exh')) {
    notes.push('Противоречие ленты (агрессия + затухание) в данных — перепроверьте выбор тегов.');
  }

  // V3: Каскад ликвидаций — жирная зона + пробой (CoinGlass: за первой зоной видна вторая)
  if (has('liq-density-heavy') && has('map-structure-breakout')) {
    notes.push(
      'Внимание: возможен каскад ликвидаций. Не ставь короткий тейк — импульс может быть в 2–3 раза сильнее обычного (цена «долетает» до следующей зоны).'
    );
    modifiers.push({ label: 'Каскад ликвидаций (heavy + пробой)', delta: 5 });
    score += 5;
  }

  const bounceLike = golden.kind === 'bounce';
  const synergyZoneWall = has('liq-density-heavy') && has('trig-l2-wall') && bounceLike;
  const synergyTapeAbs = has('trig-tape-exh') && has('trig-clust-abs');

  if (!synergyZoneWall) {
    if (has('liq-density-heavy')) {
      modifiers.push({ label: 'Плотность зоны: Heavy', delta: 15 });
      score += 15;
    } else if (has('liq-density-thin')) {
      modifiers.push({ label: 'Плотность зоны: Thin', delta: -20 });
      score -= 20;
    } else if (has('liq-density-fresh')) {
      modifiers.push({ label: 'Плотность зоны: Fresh', delta: 5 });
      score += 5;
    }
  } else {
    modifiers.push({ label: 'Синергия: Heavy + Real Wall (зона × стакан)', delta: 45 });
    score += 45;
  }

  if (!synergyZoneWall && bounceLike && has('trig-l2-wall')) {
    modifiers.push({ label: 'Стакан: Real Wall (отскок)', delta: 15 });
    score += 15;
  } else if (golden.kind === 'breakout' && has('trig-l2-wall')) {
    modifiers.push({ label: 'Стакан: Real Wall (пробой)', delta: -10 });
    score -= 10;
  }

  if (golden.dir === 'long' && has('eng-fund-neg')) {
    modifiers.push({ label: 'Фандинг (LONG): отрицательный', delta: 10 });
    score += 10;
  } else if (golden.dir === 'short' && has('eng-fund-pos')) {
    modifiers.push({ label: 'Фандинг (SHORT): положительный', delta: 10 });
    score += 10;
  }

  if (synergyTapeAbs) {
    modifiers.push({ label: 'Синергия: Exhaustion + Absorption (лента × кластеры)', delta: 40 });
    score += 40;
  } else {
    if (bounceLike) {
      if (has('trig-tape-exh')) {
        modifiers.push({ label: 'Лента: Exhaustion (отскок)', delta: 15 });
        score += 15;
      }
      if (has('trig-tape-agg') && !sfpTriple) {
        modifiers.push({ label: 'Лента: Aggressive (отскок)', delta: -20 });
        score -= 20;
      }
    } else if (golden.kind === 'breakout') {
      if (has('trig-tape-agg')) {
        modifiers.push({ label: 'Лента: Aggressive (пробой)', delta: 20 });
        score += 20;
      }
      if (has('trig-tape-exh')) {
        modifiers.push({ label: 'Лента: Exhaustion (пробой)', delta: -20 });
        score -= 20;
      }
    }
  }

  if (has('trig-tape-ice')) {
    modifiers.push({ label: 'Лента: Iceberg', delta: 10 });
    score += 10;
  }

  if (!synergyTapeAbs) {
    if (golden.dir === 'long' && (has('trig-clust-abs') || has('trig-clust-buy'))) {
      modifiers.push({ label: 'Кластеры (LONG)', delta: 15 });
      score += 15;
    } else if (golden.dir === 'short' && (has('trig-clust-abs') || has('trig-clust-sell'))) {
      modifiers.push({ label: 'Кластеры (SHORT)', delta: 15 });
      score += 15;
    }
  } else {
    if (golden.dir === 'long' && has('trig-clust-buy')) {
      modifiers.push({ label: 'Кластеры: buy в дополнение к синергии', delta: 5 });
      score += 5;
    } else if (golden.dir === 'short' && has('trig-clust-sell')) {
      modifiers.push({ label: 'Кластеры: sell в дополнение к синергии', delta: 5 });
      score += 5;
    }
  }

  if (sfpTriple) {
    modifiers.push({ label: 'Архетип SFP (Swing Failure Pattern)', delta: 12 });
    score += 12;
  }

  let capped = Math.max(0, Math.min(100, Math.round(score)));

  const divergenceLong =
    has('map-structure-long') &&
    has('eng-oi-fall') &&
    !has('liq-place-bottom');
  const divergenceShort = has('map-structure-short') && has('eng-oi-rise');
  const divergence = divergenceLong || divergenceShort;

  const overLong = has('map-structure-long') && has('eng-fund-pos');
  const overShort = has('map-structure-short') && has('eng-fund-neg');
  const overleverage = overLong || overShort;

  let dirty = false;
  const conflictHints = [];

  if (divergence) {
    const before = capped;
    capped = Math.round(capped * 0.75);
    modifiers.push({ label: 'Диссонанс OI (дивергенция): −25% к скору', delta: capped - before });
    conflictHints.push(
      'Дивергенция OI: тренд выдыхается, движение на закрытии позиций — возможен шорт-сквиз или фиксация. Тренд неустойчив.'
    );
    dirty = true;
  }

  if (overleverage) {
    conflictHints.push(
      'Перегрев фандинга: рынок перегружен в сторону толпы — сценарий shakeout, вероятен глубокий сквиз для сбора стопов.'
    );
    dirty = true;
  }

  // V3: аномалия фандинга (прокси: перекос + OI flat в боковике — «цена не едет»)
  if (
    has('map-structure-range') &&
    has('eng-oi-flat') &&
    (has('eng-fund-pos') || has('eng-fund-neg'))
  ) {
    const before = capped;
    capped = Math.round(capped * 0.5);
    modifiers.push({ label: 'Аномалия фандинга (перекос + OI flat)', delta: capped - before });
    notes.push(
      'Рыночная аномалия: сильный перекос фандинга при застое OI — возможен «вертолёт» (вынос в обе стороны). Снизьте риск на сделку в 2 раза. Экстремальные % фандинга верифицируйте в терминале.'
    );
    dirty = true;
  }

  // V3: спуфинг + OI↑ (не путать с red flag spoof+agg)
  if (has('trig-l2-spoof') && has('eng-oi-rise')) {
    const before = capped;
    capped = Math.round(capped * 0.5);
    modifiers.push({ label: 'Спуфинг + OI↑ (ловушка плотности)', delta: capped - before });
    notes.push(
      'Крупный игрок манипулирует стаканом (спуфинг), параллельно набирая позицию. Не верь одной плотности на экране.'
    );
    dirty = true;
  }

  // V3: пустая зона — thin + агрессивная лента (отскок): сильно режем уверенность
  if (bounceLike && has('liq-density-thin') && has('trig-tape-agg')) {
    const before = capped;
    capped = Math.max(10, Math.min(20, Math.round(capped * 0.15)));
    modifiers.push({ label: 'Пустая зона (thin + агрессия ленты): efficiency', delta: capped - before });
    notes.push(
      'Зона слишком тонкая для торможения: агрессивные ордера пройдут сквозь неё. Ожидайте более глубокого движения.'
    );
    dirty = true;
  }

  // V4: боковик + обе стороны ликвидности
  if (has('map-structure-range') && has('liq-place-both')) {
    if (has('trig-tape-agg') && !has('trig-tape-exh')) {
      notes.push(
        'Range + обе стороны: агрессивная лента — «поиск границы». Не входить, пока лента не успокоится (Exhaustion).'
      );
      dirty = true;
    }
    if (has('trig-tape-exh') && has('trig-l2-wall')) {
      const beforeRg = capped;
      capped = Math.max(capped, 90);
      modifiers.push({ label: 'V4: идеальный range (exh + wall)', delta: capped - beforeRg });
      notes.push(
        'Range + обе стороны: затухание ленты + реальная плотность — высокая вероятность удачного входа (~90%).'
      );
    }
  }

  if (has('liq-place-both')) {
    if (has('eng-oi-rise')) {
      notes.push(
        'Обе стороны ликвидности + рост OI: накопление перед выходом, не «чистый» боковик.'
      );
    } else if (has('eng-oi-fall')) {
      notes.push(
        'Обе стороны + падение OI: удобный «пил» для скальпа от краёв с коротким тейком.'
      );
    }
  }

  const dirHint =
    golden.dir === 'long'
      ? 'Уклон сетапа: лонг.'
      : golden.dir === 'short'
        ? 'Уклон сетапа: шорт.'
        : 'Направление по зоне нейтральное (боковик / обе стороны).';

  let liqHint = '';
  if (has('liq-place-top')) {
    liqHint = 'Ликвидации сверху: цена под зоной — шорт-отскок или лонг-пробой.';
  } else if (has('liq-place-bottom')) {
    liqHint = 'Ликвидации снизу: цена над зоной — лонг-отскок или шорт-пробой.';
  } else if (has('liq-place-both')) {
    liqHint = 'Ликвидность с двух сторон — оценивайте OI: рост OI = накопление, падение OI = скальп от краёв.';
  }

  let actionTypeOut = golden.actionType;
  let sfpBlock = '';
  if (sfpTriple) {
    actionTypeOut = 'Reversal (разворот)';
    sfpBlock =
      'Ловушка специалистов (SFP): агрессивный вынос за границу боковика поглощён лимитным объёмом (absorption). Идея: ложный пробой, вход обратно в канал. ';
  }

  const message = [
    sfpBlock,
    `Сетап: ${golden.name} → ${actionTypeOut}. ${dirHint}`,
    liqHint,
    conflictHints.join(' '),
    `Итоговая уверенность: ${capped}% (0–100).`,
  ]
    .filter(Boolean)
    .join(' ');

  let riskTier = 'Medium';
  if (divergence || overleverage) riskTier = 'High';
  else if (synergyZoneWall || synergyTapeAbs) riskTier = 'Low';

  if (sfpTriple) riskTier = 'Medium';
  if (notes.some((n) => n.includes('Аномалия фандинга'))) riskTier = 'High';

  const orderType = bounceLike ? 'Limit Grid' : 'Market/Stop';

  let invalidationPoint =
    golden.kind === 'breakout'
      ? 'Если цена вернулась за зону ликвидаций без нового импульса ленты и OI — пробой считать ложным.'
      : 'Если лента ускорится и OI начнёт расти при подходе к плотности — немедленный выход.';

  if (dirty) {
    invalidationPoint +=
      ' При диссонансе/перегреве/аномалиях ужесточайте стоп и уменьшайте объём.';
  }

  if (sfpTriple) {
    invalidationPoint +=
      ' Для SFP: инвалидация — новый импульс за границу с ростом OI и без поглощения.';
  }

  const details = { baseScore: 50, modifiers, notes: notes.length ? notes : undefined };

  const archetypeOut = sfpTriple ? 'SFP' : null;

  return {
    status: dirty ? 'warning' : 'success',
    score: capped,
    actionType: actionTypeOut,
    message,
    details,
    deepAnalysis: finalizeDeep(
      deep(riskTier, invalidationPoint, orderType, archetypeOut),
      has
    ),
  };
}

function calculateSetup(selectedIds) {
  return scoreTradingSetup(selectedIds);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreTradingSetup, calculateSetup, buildStopStrategy, inferVolumeQuality };
}
if (typeof globalThis !== 'undefined') {
  globalThis.scoreTradingSetup = scoreTradingSetup;
  globalThis.calculateSetup = calculateSetup;
}
if (typeof window !== 'undefined') {
  window.scoreTradingSetup = scoreTradingSetup;
  window.calculateSetup = calculateSetup;
}
