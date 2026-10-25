import { calculateScore } from '../src/core/scoring';
import { normalizeLetter } from '../src/core/input';
import { CountdownTimer } from '../src/core/engine/CountdownTimer';

describe('calculateScore', () => {
  const points = { base: 100, timeBonus: 2, hintPenalty: 10 };

  it('soma base + bônus de tempo - penalidade por dica', () => {
    expect(calculateScore(points, 299, 1)).toBe(100 + 598 - 10);
  });

  it('nunca fica negativa', () => {
    expect(calculateScore(points, 0, 50)).toBe(0);
  });
});

describe('normalizeLetter', () => {
  it.each([
    ['a', 'A'],
    ['Z', 'Z'],
    ['ç', 'C'],
    ['Á', 'A'],
    ['ã', 'A'],
  ])('%s -> %s', (key, expected) => {
    expect(normalizeLetter(key)).toBe(expected);
  });

  it.each(['1', ' ', 'Enter', 'ArrowLeft', '-'])('ignora %s', (key) => {
    expect(normalizeLetter(key)).toBeNull();
  });
});

describe('CountdownTimer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('conta pelo relógio e avisa quando o tempo acaba', () => {
    const ticks: number[] = [];
    const onExpire = jest.fn();
    const timer = new CountdownTimer((s) => ticks.push(s), onExpire);

    timer.start(3);
    jest.advanceTimersByTime(3000);

    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stop congela o tempo restante', () => {
    const timer = new CountdownTimer(() => {}, () => {});
    timer.start(10);
    jest.advanceTimersByTime(4000);
    timer.stop();
    jest.advanceTimersByTime(5000);
    expect(timer.secondsLeft()).toBe(6);
  });
});
