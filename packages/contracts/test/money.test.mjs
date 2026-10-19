import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, yuanToCents } from '../dist/index.js';

test('人民币金额转换精确，不引入浮点误差', () => {
  assert.equal(yuanToCents('0.29'), 29);
  assert.equal(yuanToCents(0.1), 10);
  assert.equal(yuanToCents('28.50'), 2850);
  assert.equal(yuanToCents('0'), 0);
  assert.equal(formatMoney(30), '0.30');
});

test('拒绝超过两位小数、负数、无效金额和超大金额', () => {
  for (const value of ['1.001', '-1', '', 'NaN', 'Infinity', '1e3', '100000.01']) {
    assert.throws(() => yuanToCents(value));
  }
});
