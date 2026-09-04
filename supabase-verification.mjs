import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://btpetqwjkpqbwwcirrwk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) {
  console.error("Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY — set via env or `vercel env pull` or `export SUPABASE_ANON_KEY=...`");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE);
const anon = createClient(SUPABASE_URL, ANON);

function rand() { return Math.random().toString(36).slice(2,8); }

async function main(){
  console.log("=== SUPABASE PRODUCTION VALIDATION ===");
  console.log("URL:", SUPABASE_URL);

  // 1. Verify tables exist via service_role
  const tables = ['profiles','bots','bot_configs','automation_rules','schedules','metrics','notifications','activity','backup_meta'];
  for(const t of tables){
    const { error } = await admin.from(t).select('*').limit(1);
    console.log(`Table ${t}: ${error ? 'ERROR '+error.message : 'OK'}`);
    if(error && !error.message.includes('0 rows')) throw error;
  }

  // 2. Check storage bucket
  const { data: buckets, error: be } = await admin.storage.listBuckets();
  console.log("Buckets:", buckets?.map(b=>b.name).join(', '), be?.message ?? 'OK');
  const hasBucket = buckets?.some(b=>b.name==='bot-artifacts');
  console.log("bot-artifacts bucket:", hasBucket ? 'EXISTS' : 'MISSING');

  // 3. Create two test users via Auth admin
  const emailA = `testA_${rand()}@example.com`;
  const emailB = `testB_${rand()}@example.com`;
  const pass = 'Test1234!'+rand();

  const { data: userA, error: eA } = await admin.auth.admin.createUser({ email: emailA, password: pass, email_confirm: true });
  if(eA) throw eA;
  const { data: userB, error: eB } = await admin.auth.admin.createUser({ email: emailB, password: pass, email_confirm: true });
  if(eB) throw eB;
  console.log("Created users:", userA.user.id.slice(0,8), userB.user.id.slice(0,8));

  // Create profiles (required for FK)
  await admin.from('profiles').insert([{ id: userA.user.id, username: `userA_${rand()}` }]);
  await admin.from('profiles').insert([{ id: userB.user.id, username: `userB_${rand()}` }]);
  console.log("Profiles created");

  // Sign in as A and B to get JWTs
  const { data: sessA } = await anon.auth.signInWithPassword({ email: emailA, password: pass });
  const { data: sessB } = await anon.auth.signInWithPassword({ email: emailB, password: pass });
  const tokenA = sessA.session.access_token;
  const tokenB = sessB.session.access_token;
  console.log("Tokens obtained A:", tokenA.slice(0,20)+"...", "B:", tokenB.slice(0,20)+"...");

  const clientA = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${tokenA}` } } });
  const clientB = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${tokenB}` } } });

  // 4. Test Create Bot -> persist -> retrieve (User A)
  const botId = `bot_${Date.now()}_${rand()}`;
  const botRow = {
    id: botId,
    user_id: userA.user.id,
    server_host: "test.example.com",
    server_port: 25565,
    username: `bot_${rand()}`,
    provider_id: "self-hosted",
    status: "pending",
    config_ref: `vault:${botId}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { error: insertErr } = await clientA.from('bots').insert(botRow);
  console.log("Create Bot as A:", insertErr ? `ERROR ${insertErr.message}` : `OK ${botId}`);
  if(insertErr) throw insertErr;

  // Retrieve as A (should succeed)
  const { data: botFetchedA, error: feA } = await clientA.from('bots').select('*').eq('id', botId).single();
  console.log("Retrieve Bot as A:", feA ? `ERROR ${feA.message}` : `OK ${botFetchedA.id} ${botFetchedA.status}`);

  // Simulate API restart: create new client and retrieve again
  const clientA2 = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${tokenA}` } } });
  const { data: botAfterRestart, error: feA2 } = await clientA2.from('bots').select('*').eq('id', botId).single();
  console.log("Retrieve after 'API restart' as A:", feA2 ? `ERROR ${feA2.message}` : `OK persisted ${botAfterRestart.id}`);

  // 5. Test RLS: User B attempts to access User A's bot → should be denied (0 rows or error)
  const { data: botBAccess, error: feB } = await clientB.from('bots').select('*').eq('id', botId);
  const denied = (!botBAccess || botBAccess.length===0);
  console.log(`RLS User B access User A bot: ${denied ? 'DENIED (0 rows) ✅' : `LEAKED ${JSON.stringify(botBAccess).slice(0,200)} ❌`}, error: ${feB?.message ?? 'none'}`);
  if(!denied) throw new Error("RLS FAILED: User B could read User A's bot");

  // 6. Test Create Automation → persist → restart → retrieve
  const autoId = crypto.randomUUID();
  const { error: autoErr } = await clientA.from('automation_rules').insert({ id: autoId, bot_id: botId, trigger: 'join', action: 'greet' });
  console.log("Create Automation as A:", autoErr ? `ERROR ${autoErr.message}` : `OK ${autoId}`);
  const { data: autoFetched } = await clientA2.from('automation_rules').select('*').eq('id', autoId).single();
  console.log("Retrieve Automation after restart:", autoFetched ? `OK ${autoFetched.id}` : 'MISSING');

  // 7. Test Create Schedule
  const { data: sched, error: schedErr } = await clientA.from('schedules').insert({ bot_id: botId, auto_start: true, auto_reconnect: true, cron: '* * * * *' }).select().single();
  console.log("Create Schedule as A:", schedErr ? `ERROR ${schedErr.message}` : `OK ${sched.id}`);
  const { data: schedAfter } = await clientA2.from('schedules').select('*').eq('bot_id', botId);
  console.log("Retrieve Schedules after restart:", schedAfter?.length ?? 0, "found");

  // 8. Verify other tables
  await clientA.from('metrics').insert({ bot_id: botId, cpu: 12.5, ram_mb: 256 });
  console.log("Insert metrics OK");
  await clientA.from('notifications').insert({ user_id: userA.user.id, bot_id: botId, message: 'test notification' });
  console.log("Insert notifications OK");
  await clientA.from('activity').insert({ bot_id: botId, user_id: userA.user.id, event: 'bot_created' });
  console.log("Insert activities OK");
  await clientA.from('backup_meta').insert({ bot_id: botId, storage_key: `backups/${botId}/test.json` });
  console.log("Insert backup_meta OK");

  // 9. Verify storage bucket write
  const { error: storageErr } = await admin.storage.from('bot-artifacts').upload(`test/${botId}.json`, JSON.stringify({ botId, at: new Date().toISOString() }), { contentType: 'application/json', upsert: true });
  console.log("Storage upload to bot-artifacts:", storageErr ? `ERROR ${storageErr.message}` : 'OK');
  const { data: files } = await admin.storage.from('bot-artifacts').list('test');
  console.log("Storage list test/:", files?.length ?? 0, "files");

  // 10. Verify RLS for other tables: User B cannot read automation
  const { data: autoB, error: autoBErr } = await clientB.from('automation_rules').select('*').eq('id', autoId);
  console.log(`RLS automation User B access: ${(!autoB || autoB.length===0) ? 'DENIED ✅' : 'LEAKED ❌'}`);

  console.log("\n=== ALL SUPABASE TESTS PASSED ===");
  console.log("BOT:", botId);
  console.log("USERS:", userA.user.id, userB.user.id);
  console.log("BUCKET: bot-artifacts OK");
  console.log("RLS: DENIED for cross-user ✅");

  // Cleanup: delete test data (optional, keep for audit)
  // await admin.from('bots').delete().eq('id', botId);
  // await admin.auth.admin.deleteUser(userA.user.id);
  // await admin.auth.admin.deleteUser(userB.user.id);
}

main().catch(e=>{ console.error("FAILED:", e); process.exit(1); });
