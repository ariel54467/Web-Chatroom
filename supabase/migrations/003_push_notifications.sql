-- Run after 002_media_upload_policy.sql. Stores each device's Web Push subscription, and tells the
-- "push" Edge Function whom to notify about a new message.
begin;

create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriber on public.push_subscriptions (user_id);
-- One row per message that has been pushed, so a retried send never notifies twice.
create table public.push_log (
  message_id uuid primary key,
  created_at timestamptz not null default now()
);
-- No policies: only the functions below read or write these tables.
alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
revoke all on public.push_subscriptions, public.push_log from anon, authenticated;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  -- A shared device notifies whoever turned notifications on there last.
  insert into push_subscriptions(endpoint,user_id,p256dh,auth) values(p_endpoint,auth.uid(),p_p256dh,p_auth)
    on conflict(endpoint) do update set user_id=excluded.user_id, p256dh=excluded.p256dh,
      auth=excluded.auth, created_at=now();
  -- Keep the 10 newest devices; older ones are usually cleared browsers.
  delete from push_subscriptions where endpoint in (select endpoint from push_subscriptions
    where user_id=auth.uid() order by created_at desc offset 10);
end; $$;
create function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from push_subscriptions where endpoint=p_endpoint and user_id=auth.uid();
$$;

-- Called with the sender's session right after they send. Returns the notification and the
-- recipients' devices once per message, or null.
create function public.claim_push(p_message uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m messages; r rooms; sender text; preview text;
begin
  select * into m from messages where id=p_message;
  if m.id is null or m.sender_id<>auth.uid() or m.created_at<now()-interval '5 minutes' then return null; end if;
  delete from push_log where created_at<now()-interval '1 day';
  insert into push_log(message_id) values(p_message) on conflict do nothing;
  if not found then return null; end if;
  select * into r from rooms where id=m.room_id and not archived;
  if r.id is null then return null; end if;
  select display_name into sender from profiles where id=m.sender_id;
  preview := case m.kind when 'image' then '📷 Photo' when 'video' then '🎬 Video' when 'gif' then 'GIF' end;
  preview := left(concat_ws(' ', preview, nullif(m.body,'')), 140);
  return jsonb_build_object(
    'title', case when r.kind='group' then r.name else sender end,
    'body', case when r.kind='group' then sender || ': ' || preview else preview end,
    'room', r.id,
    'url', '/chat?chat=' || r.id,
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth))
      from room_members rm join push_subscriptions s on s.user_id=rm.user_id
      where rm.room_id=r.id and rm.active and rm.user_id<>m.sender_id), '[]'));
end; $$;
-- The Edge Function removes devices the push service reports as gone.
create function public.forget_push_subscriptions(p_endpoints text[]) returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from push_subscriptions where endpoint = any(p_endpoints);
$$;

revoke execute on function public.save_push_subscription(text,text,text), public.delete_push_subscription(text),
  public.claim_push(uuid), public.forget_push_subscriptions(text[]) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text,text,text), public.delete_push_subscription(text),
  public.claim_push(uuid) to authenticated;
grant execute on function public.forget_push_subscriptions(text[]) to service_role;

commit;
