import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const carol = "00000000-0000-4000-8000-000000000003";
const messageId = "00000000-0000-4000-8000-000000000011";
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id serial primary key,bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      'select (string_to_array(name,''/''))[1:cardinality(string_to_array(name,''/''))-1]';
    grant usage on schema auth,storage,public to anon,authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    grant usage on sequence storage.objects_id_seq to authenticated;
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/001_messenger.sql", import.meta.url), "utf8"));
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("truncate auth.users,profiles,friend_requests,blocks,rooms,room_members,group_invites,messages,typing,storage.objects cascade;");
  for (const [id,name] of [[alice,"alice"],[bob,"bob"],[carol,"carol"]]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await as(id, "select public.save_profile($1,$2)", [name, name.toUpperCase()]);
  }
});
async function as(user, sql, args = []) {
  return db.transaction(async tx => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    return tx.query(sql,args);
  });
}
async function friends(a = alice,b = bob) {
  await as(a,"select request_friend($1)",[b]);
  const {rows} = await db.query("select id from friend_requests where sender_id=$1 and recipient_id=$2",[a,b]);
  await as(b,"select respond_friend($1,true)",[rows[0].id]);
}
async function group() {
  await friends();
  const {rows} = await as(alice,"select create_group('Study group',$1::uuid[]) as id",[[bob]]);
  return rows[0].id;
}
async function join(room) {
  const {rows} = await db.query("select id from group_invites where room_id=$1 and recipient_id=$2",[room,bob]);
  await as(bob,"select respond_invite($1,true)",[rows[0].id]);
}

test("unique usernames are normalized and private profiles are not globally listed", async () => {
  await assert.rejects(as(bob,"select save_profile('ALICE','Bob')"),/already taken/);
  assert.equal((await as(carol,"select * from profiles")).rows.length,1);
  assert.equal((await as(carol,"select * from find_person('Alice')")).rows[0].id,alice);
  await assert.rejects(as(carol,"update profiles set username='stolen' where id=$1",[alice]),/permission denied/);
});
test("only a friend request recipient can accept; private conversations are idempotent", async () => {
  await as(alice,"select request_friend($1)",[bob]);
  const id=(await db.query("select id from friend_requests")).rows[0].id;
  await assert.rejects(as(carol,"select respond_friend($1,true)",[id]),/unavailable/);
  await assert.rejects(as(alice,"select open_direct($1)",[bob]),/Become contacts/);
  await as(bob,"select respond_friend($1,true)",[id]);
  const a=(await as(alice,"select open_direct($1) as id",[bob])).rows[0].id;
  const b=(await as(bob,"select open_direct($1) as id",[alice])).rows[0].id;
  assert.equal(a,b);
});
test("group invites require acceptance and outsiders cannot read or forge membership", async () => {
  const room=await group();
  await as(alice,"select send_message($1,$2,'Hello')",[messageId,room]);
  assert.equal((await as(bob,"select * from messages")).rows.length,0);
  assert.equal((await as(carol,"select room_details($1) as result",[room])).rows[0].result,null);
  await assert.rejects(as(carol,"insert into room_members(room_id,user_id) values($1,$2)",[room,carol]),/permission denied/);
  const invitation=(await db.query("select id from group_invites")).rows[0].id;
  await assert.rejects(as(carol,"select respond_invite($1,true)",[invitation]),/unavailable/);
  await join(room);
  assert.equal((await as(bob,"select * from messages")).rows.length,1);
});
test("sending validates membership and deduplicates retries", async () => {
  const room=await group(); await join(room);
  await assert.rejects(as(carol,"select send_message($1,$2,'Intruder')",[messageId,room]),/cannot send/);
  await as(alice,"select send_message($1,$2,'Hello')",[messageId,room]);
  await as(alice,"select send_message($1,$2,'Hello')",[messageId,room]);
  assert.equal((await as(bob,"select * from get_messages($1)",[room])).rows.length,1);
  assert.equal((await as(bob,"select list_rooms() as inbox")).rows[0].inbox[0].unread,1);
  await as(bob,"select mark_read($1)",[room]);
  assert.equal((await as(bob,"select list_rooms() as inbox")).rows[0].inbox[0].unread,0);
  await assert.rejects(as(bob,"insert into messages(id,room_id,sender_id,kind,body) values(gen_random_uuid(),$1,$2,'text','Fake')",[room,alice]),/permission denied/);
});
test("blocking prevents direct messages and new requests; unblocking does not restore friendship", async () => {
  await friends();
  const room=(await as(alice,"select open_direct($1) as id",[bob])).rows[0].id;
  await as(bob,"select set_block($1,true)",[alice]);
  await assert.rejects(as(alice,"select send_message($1,$2,'Hello')",[messageId,room]),/cannot send/);
  await assert.rejects(as(alice,"select request_friend($1)",[bob]),/Cannot send/);
  await as(bob,"select set_block($1,false)",[alice]);
  await assert.rejects(as(alice,"select send_message($1,$2,'Hello')",[messageId,room]),/cannot send/);
});
test("only admins remove members, and removal revokes history and file access", async () => {
  const room=await group(); await join(room);
  const path=`${room}/${alice}/${messageId}/photo.png`;
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('chat-media',$1,$2)",[path,{size:1024,mimetype:"image/png"}]);
  await as(alice,"select send_message($1,$2,'Photo','image',$3,'photo.png')",[messageId,room,path]);
  assert.equal((await as(bob,"select * from storage.objects")).rows.length,1);
  await assert.rejects(as(bob,"select manage_group($1,$2,'remove')",[room,alice]),/not allowed/);
  await as(alice,"select manage_group($1,$2,'remove')",[room,bob]);
  assert.equal((await as(bob,"select * from messages")).rows.length,0);
  assert.equal((await as(bob,"select * from storage.objects")).rows.length,0);
  await assert.rejects(as(bob,"select send_message(gen_random_uuid(),$1,'Hello')",[room]),/cannot send/);
});
test("uploads check identity, membership, file sizes, and owner leaving transfers ownership", async () => {
  const room=await group(); await join(room);
  const path=`${room}/${alice}/${messageId}/photo.png`;
  await assert.rejects(as(carol,"insert into storage.objects(bucket_id,name,metadata) values('chat-media',$1,$2)",[path,{size:100,mimetype:"image/png"}]),/row-level security/);
  await assert.rejects(as(alice,"insert into storage.objects(bucket_id,name,metadata) values('chat-media',$1,$2)",[path,{size:6000000,mimetype:"image/png"}]),/row-level security/);
  await as(alice,"select manage_group($1,null,'leave')",[room]);
  assert.equal((await as(bob,"select * from room_members where user_id=$1",[bob])).rows[0].role,"owner");
});
test("media cannot be sent before upload and anonymous RPC access is denied", async () => {
  const room=await group();
  await assert.rejects(as(alice,"select send_message($1,$2,'','image',$3,'photo.png')",[messageId,room,`${room}/${alice}/${messageId}/photo.png`]),/Upload the attachment/);
  await assert.rejects(db.transaction(async tx => { await tx.exec("set local role anon"); return tx.query("select list_rooms()"); }),/permission denied/);
});
