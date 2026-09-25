# i.luxe Perfume - Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for database to be ready (2-3 minutes)
3. Go to **Settings > API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - Anon (public) key → `VITE_SUPABASE_ANON_KEY`

## 2. Run Database Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of `supabase/schema.sql` and run it
3. Verify tables created: `orders`, `site_settings`

## 3. Configure Authentication

1. Go to **Authentication > Providers**
2. Enable **Email** provider
3. Create admin user: **Authentication > Users > Add User**
   - Email: your admin email
   - Password: secure password
   - Confirm email (check email for confirmation link)

## 4. Set Environment Variables

```bash
cp .env.example .env
# Edit .env with your values
```

Required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

For email notifications:
- `RESEND_API_KEY` (from resend.com)
- `ADMIN_EMAIL` (your business email)
- `SITE_URL` (your domain)

## 5. Deploy Edge Function (for email notifications)

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Deploy function
supabase functions deploy new-order

# Set secrets for Edge Function
supabase secrets set RESEND_API_KEY=your-resend-key
supabase secrets set ADMIN_EMAIL=your-email@example.com
supabase secrets set SITE_URL=https://your-domain.com
```

## 6. Set Up Database Trigger (for automatic emails)

1. After deploying Edge Function, get the function URL:
   `https://your-project-ref.supabase.co/functions/v1/new-order`

2. Update `supabase/trigger.sql` with your function URL

3. Run the updated `trigger.sql` in **SQL Editor**

## 7. Update Bank Details

1. Go to **Table Editor > site_settings**
2. Edit the `bank_details` row with your actual bank info:
   ```json
   {
     "bank": "Your Bank Name",
     "account_title": "Your Business Name",
     "iban": "PK00XXXX0000000000000000",
     "branch": "Your Branch, City"
   }
   ```

## 8. Test the Integration

1. Run dev server: `npm run dev`
2. Add items to cart, proceed to checkout
3. Place a COD order
4. Check `/admin` - you should see the order
5. Check your email for notification

## 9. Admin Dashboard Access

Visit `https://your-domain.com/admin` and sign in with the admin credentials created in step 3.

## Features Included

- ✅ Real order storage in PostgreSQL
- ✅ Admin dashboard with order management
- ✅ COD orders (status: pending → confirmed → shipped → delivered)
- ✅ Bank Transfer orders (status: awaiting_proof → confirmed → shipped → delivered)
- ✅ Email notifications on new orders
- ✅ Order status updates from admin
- ✅ Filter orders by status
- ✅ LocalStorage fallback if Supabase unavailable
- ✅ Card/JazzCash disabled (ready for future integration)

## File Structure

```
supabase/
├── schema.sql          # Database schema
├── trigger.sql         # Database trigger for emails
├── config.toml         # Supabase CLI config
└── functions/
    ├── new-order/      # Edge Function for emails
    │   └── index.ts
    └── import_map.json
```