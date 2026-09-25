import { Fragment } from "react";

const ITEMS = [
  "Signature Scents",
  "Cash on Delivery",
  "Karachi Delivery",
  "30ml & Tester Sizes",
];

export default function Marquee() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div className="marquee" id="marquee" aria-hidden="true">
      <div className="marquee-inner">
        {doubled.map((item, i) => (
          <Fragment key={i}>
            <span>{item}</span>
            <i>&#10022;</i>
          </Fragment>
        ))}
      </div>
    </div>
  );
}