-- Run once in a new Supabase project's SQL editor.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default 'Member' check (char_length(display_name) between 1 and 60),
  avatar_path text,
  created_at timestamptz not null default now()
);
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index friend_pair on public.friend_requests
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id));
create table public.blocks (
  blocker_id uuid not null references public.profiles(id),
  blocked_id uuid not null references public.profiles(id),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct','group')),
  name text not null check (char_length(name) between 1 and 60),
  avatar_path text,
  direct_key text unique,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  role text not null default 'member' check (role in ('owner','admin','member')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index member_inbox on public.room_members (user_id, active);
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  created_at timestamptz not null default now(),
  unique (room_id, recipient_id)
);
create table public.messages (
  id uuid primary key,
  room_id uuid not null references public.rooms(id),
  sender_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('text','image','gif','video')),
  body text not null default '' check (char_length(body) <= 4000),
  storage_path text,
  external_url text,
  file_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  check ((kind = 'text' and char_length(trim(body)) > 0 and storage_path is null and external_url is null)
      or (kind <> 'text' and storage_path is not null and external_url is null)
      or (kind = 'gif' and storage_path is null and external_url is not null))
);
create index message_history on public.messages (room_id, created_at desc, id desc);
create table public.typing (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  primary key (room_id, user_id)
);

create function public.initialize_profile() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into profiles(id, display_name) values(new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Member'), 60));
  return new;
end; $$;
create trigger initialize_profile after insert on auth.users
  for each row execute function public.initialize_profile();
-- Covers accounts made before this migration is applied.
insert into public.profiles(id, display_name)
select id, left(coalesce(nullif(raw_user_meta_data->>'display_name',''),
  nullif(raw_user_meta_data->>'full_name',''), 'Member'),60) from auth.users
on conflict(id) do nothing;

create function public.is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from room_members m join rooms r on r.id=m.room_id
    where m.room_id=p_room and m.user_id=auth.uid() and m.active and not r.archived);
$$;
create function public.is_admin(p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from room_members where room_id=p_room
    and user_id=auth.uid() and active and role in ('owner','admin'));
$$;
create function public.blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from blocks where (blocker_id=a and blocked_id=b)
    or (blocker_id=b and blocked_id=a));
$$;
create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not blocked_pair(a,b) and exists(select 1 from friend_requests where status='accepted'
    and ((sender_id=a and recipient_id=b) or (sender_id=b and recipient_id=a)));
$$;
create function public.can_view_profile(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid()=p_user or exists(
    select 1 from friend_requests where
      (sender_id=auth.uid() and recipient_id=p_user) or (recipient_id=auth.uid() and sender_id=p_user)
  ) or exists(select 1 from room_members a join room_members b on a.room_id=b.room_id
    where a.user_id=auth.uid() and b.user_id=p_user and a.active and b.active)
  or exists(select 1 from group_invites where recipient_id=auth.uid() and sender_id=p_user);
$$;
create function public.can_send(p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select is_member(p_room) and exists(select 1 from profiles where id=auth.uid() and username is not null)
    and (exists(select 1 from rooms where id=p_room and kind='group')
      or exists(select 1 from room_members where room_id=p_room
        and user_id<>auth.uid() and active and are_friends(auth.uid(),user_id)));
$$;
create function public.can_delete_media(p_path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select (split_part(p_path,'/',2)=auth.uid()::text or case
      when split_part(p_path,'/',3)='group-avatar'
        and split_part(p_path,'/',1) ~ '^[0-9a-fA-F-]{36}$'
      then is_admin(split_part(p_path,'/',1)::uuid) else false end)
    and not exists(select 1 from messages where storage_path=p_path)
    and not exists(select 1 from rooms where avatar_path=p_path);
$$;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.messages enable row level security;
alter table public.typing enable row level security;
create policy profile_read on public.profiles for select to authenticated using (can_view_profile(id));
create policy requests_read on public.friend_requests for select to authenticated
  using (auth.uid() in (sender_id,recipient_id));
create policy blocks_read on public.blocks for select to authenticated using (blocker_id=auth.uid());
create policy rooms_read on public.rooms for select to authenticated using (is_member(id));
create policy members_read on public.room_members for select to authenticated
  using (user_id=auth.uid() or is_member(room_id));
create policy invites_read on public.group_invites for select to authenticated
  using (auth.uid() in (sender_id,recipient_id) or is_admin(room_id));
create policy messages_read on public.messages for select to authenticated using (is_member(room_id));
create policy typing_read on public.typing for select to authenticated using (is_member(room_id));

create function public.save_profile(p_username text, p_display_name text, p_avatar_path text default null)
returns public.profiles language plpgsql security definer set search_path=public,pg_temp as $$
declare result profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_avatar_path is not null and (split_part(p_avatar_path,'/',1)<>auth.uid()::text
    or not exists(select 1 from storage.objects where bucket_id='avatars' and name=p_avatar_path))
    then raise exception 'Invalid avatar.'; end if;
  update profiles set username=lower(trim(p_username)), display_name=trim(p_display_name),
    avatar_path=p_avatar_path where id=auth.uid() returning * into result;
  return result;
exception when unique_violation then raise exception 'That username is already taken.';
end; $$;
create function public.find_person(p_username text) returns setof public.profiles
language sql stable security definer set search_path=public,pg_temp as $$
  select * from profiles where auth.uid() is not null and id<>auth.uid()
    and username=lower(trim(p_username)) and not blocked_pair(auth.uid(),id);
$$;
create function public.request_friend(p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or p_user=auth.uid() or blocked_pair(auth.uid(),p_user)
    or not exists(select 1 from profiles where id=auth.uid() and username is not null)
    or not exists(select 1 from profiles where id=p_user and username is not null)
    then raise exception 'Cannot send this friend request.'; end if;
  if (select count(*) from friend_requests where sender_id=auth.uid()
    and created_at>now()-interval '1 day') >= 30 then raise exception 'Daily request limit reached.'; end if;
  insert into friend_requests(sender_id,recipient_id) values(auth.uid(),p_user)
    on conflict(least(sender_id,recipient_id), greatest(sender_id,recipient_id))
    do update set sender_id=excluded.sender_id, recipient_id=excluded.recipient_id,
      status='pending',created_at=now() where friend_requests.status='declined';
end; $$;
create function public.respond_friend(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r friend_requests;
begin
  select * into r from friend_requests where id=p_request for update;
  if r.id is null or r.recipient_id<>auth.uid() or r.status<>'pending'
    or blocked_pair(r.sender_id,r.recipient_id) then raise exception 'Request is unavailable.'; end if;
  update friend_requests set status=case when p_accept then 'accepted' else 'declined' end where id=r.id;
end; $$;
create function public.cancel_friend(p_request uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update friend_requests set status='declined' where id=p_request and sender_id=auth.uid() and status='pending';
  if not found then raise exception 'Request is unavailable.'; end if;
end; $$;
create function public.set_block(p_user uuid, p_block boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or auth.uid()=p_user then raise exception 'Invalid user.'; end if;
  if p_block then
    insert into blocks values(auth.uid(),p_user) on conflict do nothing;
    update friend_requests set status='declined' where
      (sender_id=auth.uid() and recipient_id=p_user) or (sender_id=p_user and recipient_id=auth.uid());
    update group_invites set status='revoked' where status='pending' and
      ((sender_id=auth.uid() and recipient_id=p_user) or (sender_id=p_user and recipient_id=auth.uid()));
  else delete from blocks where blocker_id=auth.uid() and blocked_id=p_user;
  end if;
end; $$;

create function public.open_direct(p_user uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; pair text;
begin
  if not are_friends(auth.uid(),p_user) then raise exception 'Become contacts before starting a chat.'; end if;
  pair := least(auth.uid(),p_user)::text || ':' || greatest(auth.uid(),p_user)::text;
  insert into rooms(kind,name,direct_key) values('direct','Private chat',pair)
    on conflict(direct_key) do update set archived=false returning id into result;
  insert into room_members(room_id,user_id) values(result,auth.uid()),(result,p_user)
    on conflict(room_id,user_id) do update set active=true;
  return result;
end; $$;
create function public.invite_members(p_room uuid, p_users uuid[]) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare person uuid;
begin
  perform 1 from rooms where id=p_room and kind='group' and not archived for update;
  if not found or not is_admin(p_room) then raise exception 'Only group administrators can invite.'; end if;
  if coalesce(array_length(p_users,1),0)>50 then raise exception 'Invite up to 50 contacts at a time.'; end if;
  foreach person in array p_users loop
    if not are_friends(auth.uid(),person) then raise exception 'Invite accepted contacts only.'; end if;
    if not exists(select 1 from room_members where room_id=p_room and user_id=person and active) then
      insert into group_invites(room_id,sender_id,recipient_id) values(p_room,auth.uid(),person)
        on conflict(room_id,recipient_id) do update set status='pending',sender_id=auth.uid(),created_at=now();
    end if;
  end loop;
end; $$;
create function public.create_group(p_name text, p_users uuid[]) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
  if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and username is not null)
    then raise exception 'Complete your profile first.'; end if;
  if coalesce(array_length(p_users,1),0)=0 then raise exception 'Choose at least one contact.'; end if;
  insert into rooms(kind,name) values('group',trim(p_name)) returning id into result;
  insert into room_members(room_id,user_id,role) values(result,auth.uid(),'owner');
  perform invite_members(result,p_users);
  return result;
end; $$;
create function public.respond_invite(p_invite uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare r group_invites;
begin
  select * into r from group_invites where id=p_invite for update;
  if r.id is null or r.recipient_id<>auth.uid() or r.status<>'pending'
    or blocked_pair(r.sender_id,r.recipient_id) then raise exception 'Invitation is unavailable.'; end if;
  perform 1 from rooms where id=r.room_id and not archived for update;
  if not found or not exists(select 1 from room_members where room_id=r.room_id
    and user_id=r.sender_id and active and role in ('owner','admin'))
    then raise exception 'Invitation is no longer valid.'; end if;
  update group_invites set status=case when p_accept then 'accepted' else 'declined' end where id=r.id;
  if p_accept then
    insert into room_members(room_id,user_id) values(r.room_id,auth.uid())
      on conflict(room_id,user_id) do update set active=true,role='member',joined_at=now(),last_read_at=now();
  end if;
  return r.room_id;
end; $$;
create function public.manage_group(p_room uuid, p_user uuid default null, p_action text default 'rename',
  p_name text default null, p_avatar_path text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare my_role text; target_role text; successor uuid;
begin
  perform 1 from rooms where id=p_room and kind='group' and not archived for update;
  if not found or not is_member(p_room) then raise exception 'Group is unavailable.'; end if;
  select role into my_role from room_members where room_id=p_room and user_id=auth.uid() and active;
  select role into target_role from room_members where room_id=p_room and user_id=p_user and active;
  if p_action='leave' then
    if my_role='owner' then
      select user_id into successor from room_members where room_id=p_room and active
        and user_id<>auth.uid() order by joined_at,user_id limit 1;
      if successor is null then
        update rooms set archived=true where id=p_room;
        update group_invites set status='revoked' where room_id=p_room and status='pending';
      else update room_members set role='owner' where room_id=p_room and user_id=successor;
      end if;
    end if;
    update room_members set active=false where room_id=p_room and user_id=auth.uid();
  elsif p_action='rename' and my_role in ('owner','admin') then
    update rooms set name=trim(p_name) where id=p_room;
  elsif p_action='avatar' and my_role in ('owner','admin') then
    if p_avatar_path is not null and (
      split_part(p_avatar_path,'/',1)<>p_room::text
      or split_part(p_avatar_path,'/',2)<>auth.uid()::text
      or split_part(p_avatar_path,'/',3)<>'group-avatar'
      or not exists(select 1 from storage.objects where bucket_id='chat-media' and name=p_avatar_path
        and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
        and coalesce((metadata->>'size')::bigint,0) between 1 and 2097152)
    ) then raise exception 'Invalid group picture.'; end if;
    update rooms set avatar_path=p_avatar_path where id=p_room;
  elsif p_action='remove' and my_role in ('owner','admin') and target_role is not null
    and target_role<>'owner' and p_user<>auth.uid()
    and (my_role='owner' or target_role='member') then
    update room_members set active=false where room_id=p_room and user_id=p_user;
    update group_invites set status='revoked' where room_id=p_room and recipient_id=p_user;
  elsif p_action in ('promote','demote') and my_role='owner' and target_role is not null and p_user<>auth.uid() then
    update room_members set role=case when p_action='promote' then 'admin' else 'member' end
      where room_id=p_room and user_id=p_user;
  else raise exception 'This action is not allowed.';
  end if;
end; $$;

create function public.send_message(p_id uuid, p_room uuid, p_body text, p_kind text default 'text',
  p_storage_path text default null, p_file_name text default null, p_external_url text default null)
returns public.messages language plpgsql security definer set search_path=public,pg_temp as $$
declare result messages; meta jsonb; mime text; bytes bigint;
begin
  perform 1 from rooms where id=p_room for update;
  if not can_send(p_room) then raise exception 'You cannot send messages to this chat.'; end if;
  select * into result from messages where id=p_id;
  if found then
    if result.sender_id=auth.uid() and result.room_id=p_room then return result;
    else raise exception 'Message ID is already used.'; end if;
  end if;
  if p_kind='gif' and p_external_url is not null then
    if p_storage_path is not null
      or char_length(p_external_url)>1000
      or p_external_url !~ '^https://(media[0-9]*|i)\.giphy\.com/media/[A-Za-z0-9_-]+/[^[:space:]]+$'
      then raise exception 'Invalid GIF URL.'; end if;
    mime := 'image/gif';
  elsif p_kind<>'text' then
    if p_storage_path is null or split_part(p_storage_path,'/',1)<>p_room::text
      or split_part(p_storage_path,'/',2)<>auth.uid()::text or split_part(p_storage_path,'/',3)<>p_id::text
      then raise exception 'Invalid attachment path.'; end if;
    select metadata into meta from storage.objects where bucket_id='chat-media' and name=p_storage_path;
    if not found then raise exception 'Upload the attachment first.'; end if;
    mime := meta->>'mimetype'; bytes := (meta->>'size')::bigint;
    if bytes is null or bytes<1 or bytes>10485760
      or (p_kind='video' and mime<>'video/mp4')
      or (p_kind='gif' and mime<>'image/gif')
      or (p_kind='image' and mime not in ('image/jpeg','image/png','image/webp'))
      or (p_kind<>'video' and bytes>5242880)
      then raise exception 'Unsupported file type or size.'; end if;
  end if;
  insert into messages(id,room_id,sender_id,kind,body,storage_path,external_url,file_name,mime_type,file_size)
    values(p_id,p_room,auth.uid(),p_kind,trim(p_body),p_storage_path,p_external_url,left(p_file_name,200),mime,bytes)
    returning * into result;
  return result;
end; $$;
create function public.mark_read(p_room uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not is_member(p_room) then raise exception 'Chat is unavailable.'; end if;
  update room_members set last_read_at=now() where room_id=p_room and user_id=auth.uid()
    and last_read_at < coalesce((select max(created_at) from messages where room_id=p_room),last_read_at);
end; $$;
create function public.set_typing(p_room uuid, p_typing boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not can_send(p_room) then return; end if;
  insert into typing values(p_room,auth.uid(),case when p_typing then now()+interval '6 seconds' else now() end)
    on conflict(room_id,user_id) do update set expires_at=excluded.expires_at;
end; $$;
create function public.get_messages(p_room uuid, p_before timestamptz default null, p_before_id uuid default null)
returns setof public.messages language sql stable security definer set search_path=public,pg_temp as $$
  select * from messages where room_id=p_room and is_member(p_room)
    and (p_before is null or (created_at,id)<(p_before,p_before_id))
    order by created_at desc,id desc limit 40;
$$;
create function public.list_rooms() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(item order by activity desc),'[]') from (
    select jsonb_build_object('id',r.id,'kind',r.kind,
      'name',case when r.kind='direct' then coalesce(peer.display_name,'Private chat') else r.name end,
      'avatar_path',case when r.kind='direct' then peer.avatar_path else r.avatar_path end,
      'peer_id',peer.id,'last_message',coalesce(nullif(latest.body,''),initcap(latest.kind),'No messages yet'),
      'updated_at',coalesce(latest.created_at,r.created_at),
      'unread',(select count(*) from messages where room_id=r.id and created_at>mine.last_read_at and sender_id<>auth.uid()),
      'member_count',(select count(*) from room_members where room_id=r.id and active)) as item,
      coalesce(latest.created_at,r.created_at) as activity
    from rooms r join room_members mine on mine.room_id=r.id and mine.user_id=auth.uid() and mine.active
    left join lateral (select p.* from room_members m join profiles p on p.id=m.user_id
      where m.room_id=r.id and m.user_id<>auth.uid() and m.active limit 1) peer on r.kind='direct'
    left join lateral (select * from messages where room_id=r.id order by created_at desc,id desc limit 1) latest on true
    where not r.archived
  ) result;
$$;
create function public.room_details(p_room uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('room',to_jsonb(r),'can_send',can_send(p_room),
    'members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('profile',to_jsonb(p)))
      from room_members m join profiles p on p.id=m.user_id where m.room_id=p_room and m.active),'[]'),
    'invites',case when is_admin(p_room) then coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('profile',to_jsonb(p)))
      from group_invites i join profiles p on p.id=i.recipient_id where i.room_id=p_room and i.status='pending'),'[]') else '[]'::jsonb end,
    'typing',coalesce((select jsonb_agg(to_jsonb(t)) from typing t
      where t.room_id=p_room and t.user_id<>auth.uid() and t.expires_at>now()),'[]'))
    from rooms r where r.id=p_room and is_member(p_room);
$$;
create function public.social_state() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'contacts',coalesce((select jsonb_agg(to_jsonb(p)) from profiles p
      where p.id<>auth.uid() and are_friends(auth.uid(),p.id)),'[]'),
    'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('profile',to_jsonb(p)))
      from friend_requests r join profiles p on p.id=case when r.sender_id=auth.uid() then r.recipient_id else r.sender_id end
      where auth.uid() in(r.sender_id,r.recipient_id) and r.status='pending'),'[]'),
    'invites',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('room_name',r.name,'profile',to_jsonb(p)))
      from group_invites i join rooms r on r.id=i.room_id join profiles p on p.id=i.sender_id
      where i.recipient_id=auth.uid() and i.status='pending' and not r.archived),'[]'),
    'blocked',coalesce((select jsonb_agg(to_jsonb(p)) from blocks b join profiles p on p.id=b.blocked_id
      where b.blocker_id=auth.uid()),'[]')
  );
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('chat-media','chat-media',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','video/mp4']),
 ('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy media_read on storage.objects for select to authenticated using(
  bucket_id='chat-media' and public.is_member((storage.foldername(name))[1]::uuid));
create policy media_upload on storage.objects for insert to authenticated with check(
  bucket_id='chat-media' and (storage.foldername(name))[2]=auth.uid()::text
  and public.can_send((storage.foldername(name))[1]::uuid)
  and coalesce((metadata->>'size')::bigint,0)>0
  and (metadata->>'mimetype'='video/mp4' or (metadata->>'size')::bigint<=5242880));
create policy media_cleanup on storage.objects for delete to authenticated using(
  bucket_id='chat-media' and public.can_delete_media(name));
create policy avatar_read on storage.objects for select to authenticated using(
  bucket_id='avatars' and public.can_view_profile((storage.foldername(name))[1]::uuid));
create policy avatar_upload on storage.objects for insert to authenticated with check(
  bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_cleanup on storage.objects for delete to authenticated using(
  bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text
  and not exists(select 1 from public.profiles where avatar_path=name));

-- Mutations go through checked, transactional functions. No browser table writes.
revoke all on public.profiles,public.friend_requests,public.blocks,public.rooms,
  public.room_members,public.group_invites,public.messages,public.typing from anon,authenticated;
grant select on public.profiles,public.friend_requests,public.blocks,public.rooms,
  public.room_members,public.group_invites,public.messages,public.typing to authenticated;
-- Revoke default PUBLIC execution without touching other applications' functions.
do $$
declare f record;
begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace
    and proname in ('initialize_profile','is_member','is_admin','blocked_pair','are_friends','can_view_profile',
      'can_send','can_delete_media','save_profile','find_person','request_friend','respond_friend','cancel_friend','set_block',
      'open_direct','invite_members','create_group','respond_invite','manage_group','send_message','mark_read',
      'set_typing','get_messages','list_rooms','room_details','social_state')
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
    if f.signature::text not like 'initialize_profile(%' and f.signature::text not like 'blocked_pair(%'
      and f.signature::text not like 'are_friends(%' then
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
end; $$;
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['profiles','friend_requests','blocks','rooms','room_members','group_invites','messages','typing'] loop
      execute format('alter publication supabase_realtime add table public.%I',t);
    end loop;
  end if;
end; $$;
commit;
