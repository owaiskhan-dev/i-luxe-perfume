import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();

    if (!record) {
      return new Response(JSON.stringify({ error: "No order record provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_EMAIL");

    if (!resendApiKey || !adminEmail) {
      console.error("Missing RESEND_API_KEY or ADMIN_EMAIL environment variables");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);

    const itemsHtml = record.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name} (${item.size})</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">PKR ${item.price.toLocaleString()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">PKR ${(item.price * item.qty).toLocaleString()}</td>
        </tr>
      `
      )
      .join("");

    const paymentMethod = record.payment === "cod" ? "Cash on Delivery" : "Bank Transfer";
    const statusLabel = record.status === "awaiting_proof" ? "Awaiting Payment Proof" : "Pending";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #111; color: #fff; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Order Received</h1>
          <p style="margin: 8px 0 0; opacity: 0.8;">Order ID: <strong>${record.id}</strong></p>
        </div>
        <div style="background: #fff; border: 1px solid #e5e5e5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 16px; margin: 0 0 12px; color: #333;">Customer Details</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #666; width: 120px;">Name:</td>
                <td style="padding: 6px 0; font-weight: 500;">${record.customer_name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666;">Phone:</td>
                <td style="padding: 6px 0; font-weight: 500;">${record.customer_phone}</td>
              </tr>
              ${record.customer_email ? `
              <tr>
                <td style="padding: 6px 0; color: #666;">Email:</td>
                <td style="padding: 6px 0;">${record.customer_email}</td>
              </tr>
              ` : ""}
              <tr>
                <td style="padding: 6px 0; color: #666;">City:</td>
                <td style="padding: 6px 0;">${record.customer_city}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666;">Address:</td>
                <td style="padding: 6px 0;">${record.customer_address}</td>
              </tr>
              ${record.customer_note ? `
              <tr>
                <td style="padding: 6px 0; color: #666; vertical-align: top;">Note:</td>
                <td style="padding: 6px 0;">${record.customer_note}</td>
              </tr>
              ` : ""}
            </table>
          </div>

          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 16px; margin: 0 0 12px; color: #333;">Order Items</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #fafafa;">
                  <th style="padding: 10px 8px; text-align: left; border-bottom: 2px solid #e5e5e5; font-weight: 600;">Product</th>
                  <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #e5e5e5; font-weight: 600;">Qty</th>
                  <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #e5e5e5; font-weight: 600;">Price</th>
                  <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #e5e5e5; font-weight: 600;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <div style="background: #fafafa; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #666;">Subtotal</td>
                <td style="padding: 6px 0; text-align: right;">PKR ${record.subtotal.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666;">Delivery Fee</td>
                <td style="padding: 6px 0; text-align: right;">PKR ${record.delivery_fee.toLocaleString()}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e5e5;">
                <td style="padding: 10px 0 6px; font-weight: 600; font-size: 16px;">Total</td>
                <td style="padding: 10px 0 6px; text-align: right; font-weight: 600; font-size: 16px;">PKR ${record.total.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div style="padding: 16px; background: ${record.payment === "bank_transfer" ? "#fffbeb" : "#f0fdf4"}; border: 1px solid ${record.payment === "bank_transfer" ? "#fcd34d" : "#86efac"}; border-radius: 8px;">
            <p style="margin: 0; font-weight: 500; color: ${record.payment === "bank_transfer" ? "#92400e" : "#166534"};">
              Payment Method: <strong>${paymentMethod}</strong>
            </p>
            <p style="margin: 8px 0 0; font-size: 14px; color: ${record.payment === "bank_transfer" ? "#92400e" : "#166534"};">
              Status: <strong>${statusLabel}</strong>
            </p>
            ${record.payment === "bank_transfer" ? `
            <p style="margin: 8px 0 0; font-size: 13px; color: #92400e;">
              Customer will send payment proof via WhatsApp/email. Verify before shipping.
            </p>
            ` : `
            <p style="margin: 8px 0 0; font-size: 13px; color: #166534;">
              Customer will pay cash on delivery. Confirm order to proceed.
            </p>
            `}
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center;">
            <a href="${Deno.env.get("SITE_URL") || "https://your-domain.com"}/admin" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View in Admin Dashboard
            </a>
          </div>
        </div>
        <p style="text-align: center; font-size: 12px; color: #888; margin-top: 16px;">
          i.luxe Perfume &mdash; Order Notification System
        </p>
      </body>
      </html>
    `;

    const { error } = await resend.emails.send({
      from: "i.luxe Orders <orders@yourdomain.com>",
      to: adminEmail,
      subject: `New Order ${record.id} - PKR ${record.total.toLocaleString()} (${paymentMethod})`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});