import test from 'node:test';
import assert from 'node:assert/strict';
import {createId} from '../dist/ids.js';
test('安全来源继续使用原生UUID',()=>assert.equal(createId({randomUUID:()=> 'native-id'}),'native-id'));
test('局域网HTTP缺少randomUUID时仍生成合法UUID',()=>assert.match(createId({getRandomValues:bytes=>bytes.fill(42)}),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/));
