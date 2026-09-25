-- Supabase Database Schema for i.luxe Perfume
-- Run this in Supabase Dashboard > SQL Editor

-- Orders table
create table if not exists orders (
  id text primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_city text not null,
  customer_address text not null,
  customer_note text,
  items jsonb not null,
  subtotal integer not null,
  delivery_fee integer not null,
  total integer not null,
  payment text not null check (payment in ('cod', 'bank_transfer', 'card', 'jazzcash')),
  status text not null default 'pending' check (status in ('pending', 'awaiting_proof', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_proof_url text,
  admin_notes text
);

-- Enable Row Level Security
alter table orders enable row level security;

-- Policy: Anyone can insert orders (customers placing orders)
create policy "public_insert_orders" on orders
  for insert with check (true);

-- Policy: Authenticated admin users can read all orders
create policy "admin_read_all_orders" on orders
  for select using (
    auth.role() = 'authenticated' and 
    (auth.jwt() ->> 'email') = 'iqraanum1995@gmail.com'
  );

-- Policy: Authenticated admin users can update orders
create policy "admin_update_orders" on orders
  for update using (
    auth.role() = 'authenticated' and 
    (auth.jwt() ->> 'email') = 'iqraanum1995@gmail.com'
  );

-- Index for faster admin queries
create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);

-- Settings table for bank details and site config
create table if not exists site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Insert default bank details (update with your actual details)
insert into site_settings (key, value) values
  ('bank_details', '{"bank": "Allied Bank", "account_title": "Sidra Anum", "account_number": "0010159652950014", "iban": "PK00ALLA000000100159652950014", "branch": "Main Branch, Karachi"}'::jsonb),
  ('jazzcash_details', '{"account_name": "Iqra Anum", "number": "03222629284"}'::jsonb),
  ('delivery_fee', '300'::jsonb),
  ('delivery_note', '"Flat PKR 300 across Karachi"'::jsonb)
on conflict (key) do nothing;

-- Enable RLS on settings
alter table site_settings enable row level security;

-- Public read access for bank details and delivery info
create policy "public_read_settings" on site_settings
  for select using (true);

-- Admin write access
create policy "admin_write_settings" on site_settings
  for all using (
    auth.role() = 'authenticated' and 
    (auth.jwt() ->> 'email') = 'iqraanum1995@gmail.com'
  );

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for orders table
drop trigger if exists update_orders_updated_at on orders;
create trigger update_orders_updated_at
  before update on orders
  for each row
  execute function update_updated_at_column();

-- Trigger for settings table
drop trigger if exists update_settings_updated_at on site_settings;
create trigger update_settings_updated_at
  before update on site_settings
  for each row
  execute function update_updated_at_column();