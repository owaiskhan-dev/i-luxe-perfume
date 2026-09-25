-- Database trigger to call Edge Function on new order
-- Run this in Supabase Dashboard > SQL Editor AFTER deploying the Edge Function

-- Enable pg_net extension for HTTP requests
create extension if not exists pg_net;

-- Function to call Edge Function
create or replace function notify_new_order()
returns trigger as $$
declare
  payload jsonb;
  response text;
begin
  payload = jsonb_build_object(
    'record', jsonb_build_object(
      'id', new.id,
      'created_at', new.created_at,
      'customer_name', new.customer_name,
      'customer_phone', new.customer_phone,
      'customer_email', new.customer_email,
      'customer_city', new.customer_city,
      'customer_address', new.customer_address,
      'customer_note', new.customer_note,
      'items', new.items,
      'subtotal', new.subtotal,
      'delivery_fee', new.delivery_fee,
      'total', new.total,
      'payment', new.payment,
      'status', new.status
    )
  );

  -- Call the Edge Function (replace with your actual function URL after deployment)
  select pg_net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/new-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  ) into response;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger
drop trigger if exists trigger_new_order on orders;
create trigger trigger_new_order
  after insert on orders
  for each row
  execute function notify_new_order();

-- Grant usage on pg_net to the trigger
grant usage on schema pg_net to postgres;
grant execute on function pg_net.http_post to postgres;