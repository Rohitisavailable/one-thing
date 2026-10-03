import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
let SUPABASE_URL = '', SUPABASE_ANON_KEY = '';
try { ({ SUPABASE_URL, SUPABASE_ANON_KEY } = await import('./config.js')); } catch { /* Show the setup message when config.js is not installed. */ }

const $ = (id) => document.getElementById(id);
const missingConfig = !SUPABASE_URL || SUPABASE_URL.includes('YOUR_') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_');
const supabase = missingConfig ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let activePlan = null;

function setStatus(message, error = false, target = 'status') {
  const node = $(target); node.textContent = message; node.className = `status${error ? ' error' : ''}`;
}
function escapeName(text) { return String(text || '').slice(0, 70); }
function showAuth() { $('auth').classList.remove('off'); $('workspace').classList.add('off'); }
function showWorkspace() { $('auth').classList.add('off'); $('workspace').classList.remove('off'); }

async function setSession(session) {
  currentUser = session?.user || null;
  activePlan = null;
  if (!currentUser) {
    $('account').textContent = '';
    $('auth-title').textContent = 'Sign in to your private space';
    $('signin').textContent = 'Sign in';
    $('signup').classList.remove('off');
    showAuth();
    return;
  }
  $('account').replaceChildren(document.createTextNode(currentUser.email || 'Signed in'));
  const signout = document.createElement('button'); signout.className = 'link-button'; signout.textContent = 'Sign out';
  signout.addEventListener('click', async () => { await supabase.auth.signOut(); });
  $('account').append(signout);
  showWorkspace();
  await loadPlans();
}

async function loadPlans(selectId = null) {
  $('plans').replaceChildren();
  const { data, error } = await supabase.from('plans').select('id,title,task,plan,time_budget,energy_level,model_provider,model_name,backboard_thread_id,created_at').order('created_at', { ascending: false });
  if (error) { setStatus('Could not load your plans: ' + error.message, true); return; }
  if (!data.length) {
    const empty = document.createElement('li'); empty.className = 'hint'; empty.textContent = 'No saved plans yet. Your plans will appear here.'; $('plans').append(empty); return;
  }
  for (const row of data) {
    const li = document.createElement('li'); li.className = 'plan-row';
    const pick = document.createElement('button'); pick.className = 'plan-pick'; pick.textContent = escapeName(row.title || row.task);
    const date = document.createElement('span'); date.className = 'date'; date.textContent = new Date(row.created_at).toLocaleString();
    pick.append(date); pick.addEventListener('click', () => renderPlan(row)); li.append(pick); $('plans').append(li);
  }
  const rows = data;
  const allButton = $('export-all'); allButton.disabled = false;
  if (selectId) { const selected = rows.find((row) => row.id === selectId); if (selected) renderPlan(selected); }
}

function renderPlan(row) {
  activePlan = row;
  const plan = row.plan || {};
  $('result-title').textContent = escapeName(plan.title || row.title || 'Start with one thing');
  $('opening').textContent = plan.encouragement || 'One small step is enough to begin.';
  $('opening').classList.remove('placeholder');
  $('steps').replaceChildren();
  for (const text of (Array.isArray(plan.steps) ? plan.steps : [])) { const li = document.createElement('li'); li.textContent = text; $('steps').append(li); }
  $('stop').textContent = 'Enough for now: ' + (plan.stopping_point || 'pause and decide what you need next.');
  $('stop').classList.remove('off'); $('result-actions').classList.remove('off');
}

function download(filename, content, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function exportPlan(row, format = 'md') {
  const p = row.plan || {};
  if (format === 'json') download(`one-thing-${row.id}.json`, JSON.stringify({ title: row.title, task: row.task, plan: p, model_provider: row.model_provider, model_name: row.model_name, created_at: row.created_at }, null, 2), 'application/json');
  else download(`one-thing-${row.id}.md`, `# ${p.title || row.title}\n\n${p.encouragement || ''}\n\n${(p.steps || []).map((s) => `- ${s}`).join('\n')}\n\n**Enough for now:** ${p.stopping_point || ''}\n\n_Task:_ ${row.task}\n`, 'text/markdown');
}

async function generate() {
  const task = $('thoughts').value.trim();
  if (!task) { setStatus('Add a task or thought first.'); $('thoughts').focus(); return; }
  const button = $('go'); button.disabled = true; button.textContent = 'Making room to think…';
  setStatus('Asking Backboard for a small, realistic plan.');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ task, time_budget: $('time').value.trim(), energy_level: $('energy').value.trim() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Plan generation failed.');
    if (!result.saved_plan) throw new Error('The plan was generated but could not be saved to your account.');
    renderPlan(result.saved_plan); $('thoughts').value = ''; await loadPlans(result.saved_plan.id); setStatus('Your plan is saved to your account.');
  } catch (error) { setStatus(error.message || 'Something went wrong. Try again.', true); }
  finally { button.disabled = false; button.textContent = 'Find one small step'; }
}

async function deletePlan() {
  if (!activePlan) return;
  if (!window.confirm('Delete this plan from your account and remove its Backboard conversation? This cannot be undone.')) return;
  try {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Sign in again to delete this plan.');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ plan_id: activePlan.id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not delete the plan.');
    activePlan = null; $('result-title').textContent = 'You don’t have to do it all at once.'; $('opening').textContent = 'Choose a saved plan or make a new one.'; $('steps').replaceChildren(); $('stop').classList.add('off'); $('result-actions').classList.add('off');
    setStatus('Plan deleted from your account and Backboard.'); await loadPlans();
  } catch (error) { setStatus(error.message || 'Could not delete the plan.', true); }
}

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  setStatus(error ? error.message : 'Signed in.', !!error, 'auth-status');
});
$('signup').addEventListener('click', async () => {
  if (!$('auth-form').reportValidity()) return;
  const { data, error } = await supabase.auth.signUp({ email: $('email').value.trim(), password: $('password').value });
  if (error) setStatus(error.message, true, 'auth-status');
  else if (!data.session) setStatus('Check your email to confirm your account, then sign in.', false, 'auth-status');
  else setStatus('Account created.', false, 'auth-status');
});
$('go').addEventListener('click', generate);
$('export-one').addEventListener('click', () => { if (activePlan) exportPlan(activePlan); });
$('delete-one').addEventListener('click', deletePlan);
$('export-all').addEventListener('click', async () => {
  const { data, error } = await supabase.from('plans').select('id,title,task,plan,model_provider,model_name,created_at').order('created_at', { ascending: false });
  if (error) { setStatus('Could not export your plans: ' + error.message, true); return; }
  download('one-thing-plans.json', JSON.stringify(data, null, 2), 'application/json');
});

if (missingConfig) {
  showAuth(); $('auth-actions').classList.add('off'); setStatus('Set your Supabase URL and publishable key in config.js to enable accounts.', true, 'auth-status');
} else {
  supabase.auth.onAuthStateChange((_event, session) => { queueMicrotask(() => setSession(session)); });
  const { data: { session } } = await supabase.auth.getSession();
  await setSession(session);
}
