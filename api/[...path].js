// Vercel serverless entry: every /api/* request lands here.
import { makeStore } from '../server/store.js';
import { createApp } from '../server/app.js';

let handler;
export default function (req, res) {
  if (!handler) handler = createApp(makeStore());
  return handler(req, res);
}
export const config = { maxDuration: 30 };
