import React from "react";

export default function AnnouncementBar() {
  const messages = [
    <span className="announce-item" key={0}>
      <strong>All Karachi Delivery</strong>
      <i aria-hidden="true">&#10022;</i>
      PKR 300 within the city
    </span>,
    <span className="announce-item" key={1}>
      <strong>Shop over PKR 5,000 and get FREE delivery + a FREE gift 🎁 | COD — Karachi: 2–3 days | Outside Karachi: 5–7 days | First open, then pay.</strong>
    </span>,
  ];

  return (
    <div className="announce-bar" role="region" aria-label="Announcements">
      <div className="announce-track">
        {Array.from({ length: 4 }).map((_, i) => messages.map((msg, j) => React.cloneElement(msg, { key: `${i}-${j}` })))}
      </div>
    </div>
  );
}