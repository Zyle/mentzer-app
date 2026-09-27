// PreToolUse hook for the Chrome browser tool (mcp__claude-in-chrome__navigate).
//
// Inside ArbanDimak, previews belong on its Preview screen, not in Chrome. Agents are told
// this in their startup prompt, but sessions started before that instruction existed (or
// that never saw it) reach for Chrome instead. When such an agent opens a local dev
// server (localhost / 127.0.0.1) in Chrome, this puts the agent's app on the Preview
// screen instead (the same request as ArbanDimak's `hook.js show app`) and blocks the
// Chrome navigation with a message saying so.
//
// Outside ArbanDimak (no ARBAN_* env), for non-local URLs, or if ArbanDimak can't be
// reached, it does nothing and Chrome works as normal. Never fails the tool call.
const http = require('http');

const { ARBAN_PORT, ARBAN_TOKEN, ARBAN_AGENT } = process.env;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

const pass = () => process.exit(0);

function isLocal(url) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : `http://${url}`);
    return LOCAL_HOSTS.has(u.hostname) || u.hostname.endsWith('.localhost');
  } catch { return false; }
}

function showOnPreview(cwd) {
  return new Promise(resolve => {
    const body = JSON.stringify({ token: ARBAN_TOKEN, agent: ARBAN_AGENT, what: 'app', file: '', title: '', cwd });
    const req = http.request({
      host: '127.0.0.1', port: Number(ARBAN_PORT), path: '/show', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 100e3,
    }, res => {
      let out = '';
      res.on('data', d => { out += d; });
      res.on('end', () => resolve(res.statusCode === 200 ? out.trim() : null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end(body);
  });
}

let input = '';
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', async () => {
  if (!ARBAN_PORT || !ARBAN_AGENT) return pass();
  let event;
  try { event = JSON.parse(input); } catch { return pass(); }
  const url = event?.tool_input?.url;
  if (typeof url !== 'string' || !isLocal(url)) return pass();

  const answer = await showOnPreview(event.cwd || process.cwd());
  if (!answer || /^(Unknown agent|Couldn't)/i.test(answer)) return pass(); // let Chrome be the fallback

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Not opened in Chrome: in this project previews go on ArbanDimak's Preview screen. ` +
        `ArbanDimak says: "${answer}" Tell the user it's on the Preview screen. ` +
        `Next time, put your app there directly with ArbanDimak's \`hook.js show app\` command.`,
    },
  }));
  process.exit(0);
});
