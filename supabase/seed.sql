insert into team_members (id, name, team, phone, email) values
  ('11111111-1111-1111-1111-111111111111', 'Ahmed Sales', 'sales', '+923000000001', 'ahmed@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'Fatima Ops', 'operations', '+923000000002', 'fatima@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'Omar Finance', 'finance', '+923000000003', 'omar@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'Sara Admin', 'admin', '+923000000004', 'sara@example.com')
on conflict (id) do nothing;

insert into contacts (id, name, phone, email, metadata) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ali Traders', '+923000000005', 'ali@example.com', '{"business": "furniture"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Clinic Care', '+923000000006', 'clinic@example.com', '{"business": "healthcare"}')
on conflict (id) do nothing;
