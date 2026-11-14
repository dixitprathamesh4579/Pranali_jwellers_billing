import React from "react";

export default function BillHeader() {
  return (
    <header className="shbill-topbar">
      <div className="shbill-brand-lockup">
        <span className="shbill-brand-emblem" aria-hidden="true">✦</span>
        <span className="shbill-brand-copy">
          <strong>PRANALI JEWELLERS</strong>
          <small>GOLD · SILVER · CUSTOM JEWELLERY</small>
        </span>
      </div>
      <span className="shbill-header-status"><span className="shbill-live-dot" /> New invoice</span>
    </header>
  );
}
