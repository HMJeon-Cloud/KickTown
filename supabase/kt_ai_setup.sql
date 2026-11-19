-- KICKTOWN · AI로 전술 만들기 — 하루 사용 횟수 집계 (선택)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- Edge Function(kt-tactic-ai)이 서버 권한으로만 호출합니다. 없으면 한도 없이 동작합니다.
create or replace function kt_ai_hit(_day text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into kt_docs (coll, id, data) values ('ai_usage', _day, jsonb_build_object('n', 1))
  on conflict (coll, id) do update
    set data = jsonb_set(kt_docs.data, '{n}', to_jsonb(coalesce((kt_docs.data->>'n')::int, 0) + 1)),
        updated_at = now()
  returning (data->>'n')::int into n;
  return n;
end $$;
revoke execute on function kt_ai_hit(text) from public, anon, authenticated;
grant execute on function kt_ai_hit(text) to service_role;
