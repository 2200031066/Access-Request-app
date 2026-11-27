// Run: node test.js
const assert = require('assert');
const { createRequest, decide } = require('./server');
const list = [];
assert(createRequest(list, { name: '', system: 'AWS', reason: 'x' }).error);
assert(createRequest(list, { name: 'Asha', system: 'Jira', reason: 'x' }).error);
const { request } = createRequest(list, { name: 'Asha', system: 'AWS', reason: 'Deploy service' });
assert.strictEqual(request.status, 'Pending');
assert.strictEqual(decide(list, request.id, { role: 'Employee', decision: 'Approved' }).code, 403);
assert(decide(list, request.id, { role: 'Manager', decision: 'Rejected', comment: ' ' }).error);
assert.strictEqual(decide(list, request.id, { role: 'Manager', actor: 'Ravi', decision: 'Approved' }).request.status, 'Approved');
assert.strictEqual(decide(list, request.id, { role: 'Manager', decision: 'Rejected', comment: 'no' }).code, 409);
assert.strictEqual(request.history.length, 2);
console.log('All tests passed');
